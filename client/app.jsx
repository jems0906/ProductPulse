const { useEffect, useMemo, useState } = React;

const API_BASE = `${window.location.origin}/api`;
const demoAccounts = [
  { label: "Submitter", email: "submitter@productpulse.dev", password: "password123" },
  { label: "Product Owner", email: "owner@productpulse.dev", password: "password123" },
  { label: "Admin", email: "admin@productpulse.dev", password: "password123" },
];

const initialAnalytics = {
  states: [],
  mostRequested: [],
  releaseVelocity: [],
};

function App() {
  const [view, setView] = useState("dashboard");
  const [feedback, setFeedback] = useState([]);
  const [releases, setReleases] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [assignees, setAssignees] = useState([]);
  const [commentsById, setCommentsById] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [filters, setFilters] = useState({ search: "", status: "", priority: "", tag: "" });
  const [user, setUser] = useState(() => readStorage("productpulse-user", null));
  const [token, setToken] = useState(() => localStorage.getItem("productpulse-token"));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ email: demoAccounts[0].email, password: "password123" });
  const [feedbackForm, setFeedbackForm] = useState({ title: "", description: "", tags: "" });
  const [releaseForm, setReleaseForm] = useState({ title: "", summary: "", version: "", shippedAt: "", status: "planned" });
  const [milestoneForm, setMilestoneForm] = useState({ name: "", targetDate: "", status: "planned" });

  const canManage = user && ["product_owner", "admin"].includes(user.role);

  const stateCards = useMemo(() => {
    const counts = analytics.states.reduce((acc, item) => {
      acc[item.status] = item.count;
      return acc;
    }, {});

    return [
      { label: "Planned", value: counts.planned || 0 },
      { label: "In Progress", value: counts.in_progress || 0 },
      { label: "Shipped", value: counts.shipped || 0 },
    ];
  }, [analytics.states]);

  const maxVelocity = Math.max(...analytics.releaseVelocity.map((item) => item.releases), 1);

  useEffect(() => {
    persistAuth(token, user);
    loadAll();
  }, []);

  useEffect(() => {
    persistAuth(token, user);
  }, [token, user]);

  useEffect(() => {
    loadFeedback();
  }, [filters.search, filters.status, filters.priority, filters.tag]);

  useEffect(() => {
    if (token) {
      loadAssignees();
    } else {
      setAssignees([]);
    }
  }, [token]);

  async function request(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!response.ok) {
      const payload = await safeJson(response);
      throw new Error(payload.message || "Request failed");
    }

    return safeJson(response);
  }

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadFeedback(), loadReleases(), loadAnalytics()]);
      if (token) {
        await loadAssignees();
      }
    } catch (err) {
      setError(err.message || "Failed to load ProductPulse.");
    } finally {
      setLoading(false);
    }
  }

  async function loadFeedback() {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    const data = await request(`/feedback${params.toString() ? `?${params.toString()}` : ""}`, { method: "GET" });
    setFeedback(data);
  }

  async function loadReleases() {
    const data = await request("/releases", { method: "GET" });
    setReleases(data.releases);
    setMilestones(data.milestones);
  }

  async function loadAnalytics() {
    const data = await request("/analytics/overview", { method: "GET" });
    setAnalytics(data);
  }

  async function loadAssignees() {
    try {
      const data = await request("/feedback/meta/users", { method: "GET" });
      setAssignees(data);
    } catch {
      setAssignees([]);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    try {
      const data = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });
      setToken(data.token);
      setUser(data.user);
      setError("");
    } catch (err) {
      setError(err.message || "Login failed.");
    }
  }

  async function handleFeedbackSubmit(event) {
    event.preventDefault();
    try {
      await request("/feedback", {
        method: "POST",
        body: JSON.stringify({
          title: feedbackForm.title,
          description: feedbackForm.description,
          tags: feedbackForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        }),
      });
      setFeedbackForm({ title: "", description: "", tags: "" });
      await Promise.all([loadFeedback(), loadAnalytics()]);
    } catch (err) {
      setError(err.message || "Could not submit feedback.");
    }
  }

  async function handleVote(id) {
    try {
      await request(`/feedback/${id}/vote`, { method: "POST" });
      await Promise.all([loadFeedback(), loadAnalytics()]);
    } catch (err) {
      setError(err.message || "Voting failed.");
    }
  }

  async function handleFeedbackUpdate(id, patch) {
    try {
      await request(`/feedback/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await Promise.all([loadFeedback(), loadAnalytics()]);
    } catch (err) {
      setError(err.message || "Feedback update failed.");
    }
  }

  async function toggleComments(id) {
    const isOpen = !!openComments[id];
    setOpenComments((prev) => ({ ...prev, [id]: !isOpen }));
    if (!isOpen && !commentsById[id]) {
      try {
        const data = await request(`/feedback/${id}/comments`, { method: "GET" });
        setCommentsById((prev) => ({ ...prev, [id]: data }));
      } catch (err) {
        setError(err.message || "Could not load comments.");
      }
    }
  }

  async function submitComment(id) {
    const body = (commentDrafts[id] || "").trim();
    if (!body) return;

    try {
      await request(`/feedback/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      const data = await request(`/feedback/${id}/comments`, { method: "GET" });
      setCommentsById((prev) => ({ ...prev, [id]: data }));
      setCommentDrafts((prev) => ({ ...prev, [id]: "" }));
    } catch (err) {
      setError(err.message || "Could not add comment.");
    }
  }

  async function submitRelease(event) {
    event.preventDefault();
    try {
      await request("/releases", {
        method: "POST",
        body: JSON.stringify(releaseForm),
      });
      setReleaseForm({ title: "", summary: "", version: "", shippedAt: "", status: "planned" });
      await Promise.all([loadReleases(), loadAnalytics()]);
    } catch (err) {
      setError(err.message || "Could not create release.");
    }
  }

  async function submitMilestone(event) {
    event.preventDefault();
    try {
      await request("/releases/milestones", {
        method: "POST",
        body: JSON.stringify(milestoneForm),
      });
      setMilestoneForm({ name: "", targetDate: "", status: "planned" });
      await loadReleases();
    } catch (err) {
      setError(err.message || "Could not create milestone.");
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
    setAssignees([]);
  }

  function pickDemo(label) {
    const account = demoAccounts.find((item) => item.label === label);
    if (!account) return;
    setLoginForm({ email: account.email, password: account.password });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ProductPulse</p>
          <h1>Feedback To Launch Platform</h1>
          <p className="sub">Collect requests, prioritize features, and keep release progress visible to everyone.</p>
        </div>

        <div className="auth-panel">
          {user ? (
            <div className="user-pill">
              <strong>{user.name}</strong>
              <span>{user.role.replace("_", " ")}</span>
              <button type="button" onClick={logout}>Logout</button>
            </div>
          ) : (
            <form className="login-form" onSubmit={handleLogin}>
              <input
                type="email"
                placeholder="email"
                value={loginForm.email}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
              />
              <input
                type="password"
                placeholder="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
              />
              <button type="submit">Login</button>
              <div className="demo-row">
                {demoAccounts.map((account) => (
                  <button key={account.label} type="button" onClick={() => pickDemo(account.label)}>{account.label}</button>
                ))}
              </div>
            </form>
          )}
        </div>
      </header>

      <nav className="tabs">
        {[
          ["dashboard", "Dashboard"],
          ["feedback", "Feedback Queue"],
          ["roadmap", "Roadmap & Releases"],
          ["analytics", "Analytics"],
        ].map(([key, label]) => (
          <button key={key} type="button" className={view === key ? "active" : ""} onClick={() => setView(key)}>{label}</button>
        ))}
      </nav>

      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p className="loading">Loading data...</p> : null}

      <main className="content-grid">
        {view === "dashboard" ? (
          <>
            <section className="panel stat-row">
              {stateCards.map((card) => (
                <article key={card.label} className="stat-card">
                  <h3>{card.label}</h3>
                  <p>{card.value}</p>
                </article>
              ))}
            </section>

            <section className="panel">
              <h2>Current Priorities</h2>
              <div className="lane-grid">
                {["planned", "in_progress", "shipped"].map((status) => (
                  <div key={status} className="lane">
                    <h3>{status.replace("_", " ")}</h3>
                    {feedback.filter((item) => item.status === status).slice(0, 4).map((item) => (
                      <article key={item.id} className="feedback-card">
                        <div className="title-row">
                          <strong>{item.title}</strong>
                          <span className={`priority ${item.priority}`}>{item.priority}</span>
                        </div>
                        <p>{item.description}</p>
                        <small>{item.vote_count} votes</small>
                      </article>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {view === "feedback" ? (
          <>
            <section className="panel">
              <h2>Submit New Feedback</h2>
              <form className="feedback-form" onSubmit={handleFeedbackSubmit}>
                <input
                  type="text"
                  placeholder="Feature title"
                  value={feedbackForm.title}
                  onChange={(event) => setFeedbackForm((prev) => ({ ...prev, title: event.target.value }))}
                  required
                />
                <textarea
                  placeholder="Describe the user problem"
                  value={feedbackForm.description}
                  onChange={(event) => setFeedbackForm((prev) => ({ ...prev, description: event.target.value }))}
                  required
                />
                <input
                  type="text"
                  placeholder="Tags: search, ux, integrations"
                  value={feedbackForm.tags}
                  onChange={(event) => setFeedbackForm((prev) => ({ ...prev, tags: event.target.value }))}
                />
                <button type="submit">Submit Request</button>
              </form>
            </section>

            <section className="panel">
              <h2>Search & Filters</h2>
              <div className="filter-grid">
                <input type="text" placeholder="Search title/description" value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} />
                <select title="Filter by status" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value="">All status</option>
                  <option value="planned">Planned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="shipped">Shipped</option>
                </select>
                <select title="Filter by priority" value={filters.priority} onChange={(event) => setFilters((prev) => ({ ...prev, priority: event.target.value }))}>
                  <option value="">All priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <input type="text" placeholder="Tag filter" value={filters.tag} onChange={(event) => setFilters((prev) => ({ ...prev, tag: event.target.value }))} />
              </div>
            </section>

            <section className="panel">
              <h2>Feedback Queue</h2>
              <div className="list-grid">
                {feedback.map((item) => (
                  <article key={item.id} className="feedback-card">
                    <div className="title-row">
                      <strong>{item.title}</strong>
                      <span className={`priority ${item.priority}`}>{item.priority}</span>
                    </div>
                    <p>{item.description}</p>
                    <div className="meta-row">
                      <span>{item.tags && item.tags.length ? item.tags.join(", ") : "no tags"}</span>
                      <span>Assignee: {item.assignee}</span>
                      <span>Status: {item.status.replace("_", " ")}</span>
                    </div>
                    <div className="actions-row">
                      <button type="button" onClick={() => handleVote(item.id)}>Vote ({item.vote_count})</button>
                      <button type="button" onClick={() => toggleComments(item.id)}>{openComments[item.id] ? "Hide Comments" : "Show Comments"}</button>
                      {canManage ? (
                        <>
                          <select title="Update status" value={item.status} onChange={(event) => handleFeedbackUpdate(item.id, { status: event.target.value })}>
                            <option value="planned">Planned</option>
                            <option value="in_progress">In Progress</option>
                            <option value="shipped">Shipped</option>
                          </select>
                          <select title="Update priority" value={item.priority} onChange={(event) => handleFeedbackUpdate(item.id, { priority: event.target.value })}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                          <select title="Assign owner" defaultValue="" onChange={(event) => event.target.value && handleFeedbackUpdate(item.id, { assignedTo: Number(event.target.value) })}>
                            <option value="">Assign...</option>
                            {assignees.map((person) => (
                              <option key={person.id} value={person.id}>{person.name}</option>
                            ))}
                          </select>
                        </>
                      ) : null}
                    </div>
                    {openComments[item.id] ? (
                      <div className="comments-panel">
                        <div className="comments-list">
                          {(commentsById[item.id] || []).map((comment) => (
                            <div key={comment.id} className="comment-item">
                              <strong>{comment.author}</strong>
                              <p>{comment.body}</p>
                            </div>
                          ))}
                        </div>
                        <div className="comment-form">
                          <textarea
                            placeholder="Add a comment"
                            value={commentDrafts[item.id] || ""}
                            onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))}
                          />
                          <button type="button" onClick={() => submitComment(item.id)}>Post Comment</button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {view === "roadmap" ? (
          <>
            {canManage ? (
              <section className="panel lane-grid">
                <form className="feedback-form" onSubmit={submitRelease}>
                  <h2>Create Release</h2>
                  <input type="text" placeholder="Release title" value={releaseForm.title} onChange={(event) => setReleaseForm((prev) => ({ ...prev, title: event.target.value }))} required />
                  <input type="text" placeholder="Version" value={releaseForm.version} onChange={(event) => setReleaseForm((prev) => ({ ...prev, version: event.target.value }))} required />
                  <textarea placeholder="Release summary" value={releaseForm.summary} onChange={(event) => setReleaseForm((prev) => ({ ...prev, summary: event.target.value }))} />
                  <input title="Release ship date" type="date" value={releaseForm.shippedAt} onChange={(event) => setReleaseForm((prev) => ({ ...prev, shippedAt: event.target.value }))} />
                  <select title="Release status" value={releaseForm.status} onChange={(event) => setReleaseForm((prev) => ({ ...prev, status: event.target.value }))}>
                    <option value="planned">Planned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="shipped">Shipped</option>
                  </select>
                  <button type="submit">Save Release</button>
                </form>

                <form className="feedback-form" onSubmit={submitMilestone}>
                  <h2>Create Milestone</h2>
                  <input type="text" placeholder="Milestone name" value={milestoneForm.name} onChange={(event) => setMilestoneForm((prev) => ({ ...prev, name: event.target.value }))} required />
                  <input title="Milestone target date" type="date" value={milestoneForm.targetDate} onChange={(event) => setMilestoneForm((prev) => ({ ...prev, targetDate: event.target.value }))} required />
                  <select title="Milestone status" value={milestoneForm.status} onChange={(event) => setMilestoneForm((prev) => ({ ...prev, status: event.target.value }))}>
                    <option value="planned">Planned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="shipped">Shipped</option>
                  </select>
                  <button type="submit">Save Milestone</button>
                </form>
              </section>
            ) : null}

            <section className="panel">
              <h2>Milestones</h2>
              <div className="list-grid">
                {milestones.map((item) => (
                  <article key={item.id} className="roadmap-card">
                    <strong>{item.name}</strong>
                    <p>Target: {formatDate(item.target_date)}</p>
                    <span className={`badge ${item.status}`}>{item.status.replace("_", " ")}</span>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <h2>Release Notes</h2>
              <div className="list-grid">
                {releases.map((item) => (
                  <article key={item.id} className="roadmap-card">
                    <div className="title-row">
                      <strong>{item.title}</strong>
                      <span className={`badge ${item.status}`}>{item.status.replace("_", " ")}</span>
                    </div>
                    <p>{item.summary}</p>
                    <small>v{item.version}{item.shipped_at ? ` • ${formatDate(item.shipped_at)}` : " • pending"}</small>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {view === "analytics" ? (
          <>
            <section className="panel">
              <h2>Most Requested Features</h2>
              <div className="list-grid">
                {analytics.mostRequested.map((entry) => (
                  <article key={entry.id} className="roadmap-card">
                    <strong>{entry.title}</strong>
                    <p>{entry.votes} votes</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel chart-panel">
              <h2>Release Velocity</h2>
              <div className="velocity-chart">
                {analytics.releaseVelocity.map((entry) => (
                  <div key={entry.week} className="velocity-bar-wrap">
                    <meter className="velocity-meter" min="0" max={maxVelocity} value={entry.releases} />
                    <strong>{entry.releases}</strong>
                    <span>{formatShortDate(entry.week)}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function persistAuth(token, user) {
  if (token) {
    localStorage.setItem("productpulse-token", token);
  } else {
    localStorage.removeItem("productpulse-token");
  }

  if (user) {
    localStorage.setItem("productpulse-user", JSON.stringify(user));
  } else {
    localStorage.removeItem("productpulse-user");
  }
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function safeJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function formatDate(value) {
  return new Date(value).toLocaleDateString();
}

function formatShortDate(value) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

ReactDOM.createRoot(document.getElementById("app")).render(<App />);
