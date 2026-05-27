const {
  useEffect,
  useMemo,
  useState
} = React;
const API_BASE = `${window.location.origin}/api`;
const demoAccounts = [{
  label: "Submitter",
  email: "submitter@productpulse.dev",
  password: "password123"
}, {
  label: "Product Owner",
  email: "owner@productpulse.dev",
  password: "password123"
}, {
  label: "Admin",
  email: "admin@productpulse.dev",
  password: "password123"
}];
const initialAnalytics = {
  states: [],
  mostRequested: [],
  releaseVelocity: []
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
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    priority: "",
    tag: ""
  });
  const [user, setUser] = useState(() => readStorage("productpulse-user", null));
  const [token, setToken] = useState(() => localStorage.getItem("productpulse-token"));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({
    email: demoAccounts[0].email,
    password: "password123"
  });
  const [feedbackForm, setFeedbackForm] = useState({
    title: "",
    description: "",
    tags: ""
  });
  const [releaseForm, setReleaseForm] = useState({
    title: "",
    summary: "",
    version: "",
    shippedAt: "",
    status: "planned"
  });
  const [milestoneForm, setMilestoneForm] = useState({
    name: "",
    targetDate: "",
    status: "planned"
  });
  const canManage = user && ["product_owner", "admin"].includes(user.role);
  const stateCards = useMemo(() => {
    const counts = analytics.states.reduce((acc, item) => {
      acc[item.status] = item.count;
      return acc;
    }, {});
    return [{
      label: "Planned",
      value: counts.planned || 0
    }, {
      label: "In Progress",
      value: counts.in_progress || 0
    }, {
      label: "Shipped",
      value: counts.shipped || 0
    }];
  }, [analytics.states]);
  const maxVelocity = Math.max(...analytics.releaseVelocity.map(item => item.releases), 1);
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
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });
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
    const data = await request(`/feedback${params.toString() ? `?${params.toString()}` : ""}`, {
      method: "GET"
    });
    setFeedback(data);
  }
  async function loadReleases() {
    const data = await request("/releases", {
      method: "GET"
    });
    setReleases(data.releases);
    setMilestones(data.milestones);
  }
  async function loadAnalytics() {
    const data = await request("/analytics/overview", {
      method: "GET"
    });
    setAnalytics(data);
  }
  async function loadAssignees() {
    try {
      const data = await request("/feedback/meta/users", {
        method: "GET"
      });
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
        body: JSON.stringify(loginForm)
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
          tags: feedbackForm.tags.split(",").map(tag => tag.trim()).filter(Boolean)
        })
      });
      setFeedbackForm({
        title: "",
        description: "",
        tags: ""
      });
      await Promise.all([loadFeedback(), loadAnalytics()]);
    } catch (err) {
      setError(err.message || "Could not submit feedback.");
    }
  }
  async function handleVote(id) {
    try {
      await request(`/feedback/${id}/vote`, {
        method: "POST"
      });
      await Promise.all([loadFeedback(), loadAnalytics()]);
    } catch (err) {
      setError(err.message || "Voting failed.");
    }
  }
  async function handleFeedbackUpdate(id, patch) {
    try {
      await request(`/feedback/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      await Promise.all([loadFeedback(), loadAnalytics()]);
    } catch (err) {
      setError(err.message || "Feedback update failed.");
    }
  }
  async function toggleComments(id) {
    const isOpen = !!openComments[id];
    setOpenComments(prev => ({
      ...prev,
      [id]: !isOpen
    }));
    if (!isOpen && !commentsById[id]) {
      try {
        const data = await request(`/feedback/${id}/comments`, {
          method: "GET"
        });
        setCommentsById(prev => ({
          ...prev,
          [id]: data
        }));
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
        body: JSON.stringify({
          body
        })
      });
      const data = await request(`/feedback/${id}/comments`, {
        method: "GET"
      });
      setCommentsById(prev => ({
        ...prev,
        [id]: data
      }));
      setCommentDrafts(prev => ({
        ...prev,
        [id]: ""
      }));
    } catch (err) {
      setError(err.message || "Could not add comment.");
    }
  }
  async function submitRelease(event) {
    event.preventDefault();
    try {
      await request("/releases", {
        method: "POST",
        body: JSON.stringify(releaseForm)
      });
      setReleaseForm({
        title: "",
        summary: "",
        version: "",
        shippedAt: "",
        status: "planned"
      });
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
        body: JSON.stringify(milestoneForm)
      });
      setMilestoneForm({
        name: "",
        targetDate: "",
        status: "planned"
      });
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
    const account = demoAccounts.find(item => item.label === label);
    if (!account) return;
    setLoginForm({
      email: account.email,
      password: account.password
    });
  }
  return React.createElement("div", {
    className: "app-shell"
  }, React.createElement("header", {
    className: "topbar"
  }, React.createElement("div", null, React.createElement("p", {
    className: "eyebrow"
  }, "ProductPulse"), React.createElement("h1", null, "Feedback To Launch Platform"), React.createElement("p", {
    className: "sub"
  }, "Collect requests, prioritize features, and keep release progress visible to everyone.")), React.createElement("div", {
    className: "auth-panel"
  }, user ? React.createElement("div", {
    className: "user-pill"
  }, React.createElement("strong", null, user.name), React.createElement("span", null, user.role.replace("_", " ")), React.createElement("button", {
    type: "button",
    onClick: logout
  }, "Logout")) : React.createElement("form", {
    className: "login-form",
    onSubmit: handleLogin
  }, React.createElement("input", {
    type: "email",
    placeholder: "email",
    value: loginForm.email,
    onChange: event => setLoginForm(prev => ({
      ...prev,
      email: event.target.value
    }))
  }), React.createElement("input", {
    type: "password",
    placeholder: "password",
    value: loginForm.password,
    onChange: event => setLoginForm(prev => ({
      ...prev,
      password: event.target.value
    }))
  }), React.createElement("button", {
    type: "submit"
  }, "Login"), React.createElement("div", {
    className: "demo-row"
  }, demoAccounts.map(account => React.createElement("button", {
    key: account.label,
    type: "button",
    onClick: () => pickDemo(account.label)
  }, account.label)))))), React.createElement("nav", {
    className: "tabs"
  }, [["dashboard", "Dashboard"], ["feedback", "Feedback Queue"], ["roadmap", "Roadmap & Releases"], ["analytics", "Analytics"]].map(([key, label]) => React.createElement("button", {
    key: key,
    type: "button",
    className: view === key ? "active" : "",
    onClick: () => setView(key)
  }, label))), error ? React.createElement("p", {
    className: "error-banner"
  }, error) : null, loading ? React.createElement("p", {
    className: "loading"
  }, "Loading data...") : null, React.createElement("main", {
    className: "content-grid"
  }, view === "dashboard" ? React.createElement(React.Fragment, null, React.createElement("section", {
    className: "panel stat-row"
  }, stateCards.map(card => React.createElement("article", {
    key: card.label,
    className: "stat-card"
  }, React.createElement("h3", null, card.label), React.createElement("p", null, card.value)))), React.createElement("section", {
    className: "panel"
  }, React.createElement("h2", null, "Current Priorities"), React.createElement("div", {
    className: "lane-grid"
  }, ["planned", "in_progress", "shipped"].map(status => React.createElement("div", {
    key: status,
    className: "lane"
  }, React.createElement("h3", null, status.replace("_", " ")), feedback.filter(item => item.status === status).slice(0, 4).map(item => React.createElement("article", {
    key: item.id,
    className: "feedback-card"
  }, React.createElement("div", {
    className: "title-row"
  }, React.createElement("strong", null, item.title), React.createElement("span", {
    className: `priority ${item.priority}`
  }, item.priority)), React.createElement("p", null, item.description), React.createElement("small", null, item.vote_count, " votes")))))))) : null, view === "feedback" ? React.createElement(React.Fragment, null, React.createElement("section", {
    className: "panel"
  }, React.createElement("h2", null, "Submit New Feedback"), React.createElement("form", {
    className: "feedback-form",
    onSubmit: handleFeedbackSubmit
  }, React.createElement("input", {
    type: "text",
    placeholder: "Feature title",
    value: feedbackForm.title,
    onChange: event => setFeedbackForm(prev => ({
      ...prev,
      title: event.target.value
    })),
    required: true
  }), React.createElement("textarea", {
    placeholder: "Describe the user problem",
    value: feedbackForm.description,
    onChange: event => setFeedbackForm(prev => ({
      ...prev,
      description: event.target.value
    })),
    required: true
  }), React.createElement("input", {
    type: "text",
    placeholder: "Tags: search, ux, integrations",
    value: feedbackForm.tags,
    onChange: event => setFeedbackForm(prev => ({
      ...prev,
      tags: event.target.value
    }))
  }), React.createElement("button", {
    type: "submit"
  }, "Submit Request"))), React.createElement("section", {
    className: "panel"
  }, React.createElement("h2", null, "Search & Filters"), React.createElement("div", {
    className: "filter-grid"
  }, React.createElement("input", {
    type: "text",
    placeholder: "Search title/description",
    value: filters.search,
    onChange: event => setFilters(prev => ({
      ...prev,
      search: event.target.value
    }))
  }), React.createElement("select", {
    title: "Filter by status",
    value: filters.status,
    onChange: event => setFilters(prev => ({
      ...prev,
      status: event.target.value
    }))
  }, React.createElement("option", {
    value: ""
  }, "All status"), React.createElement("option", {
    value: "planned"
  }, "Planned"), React.createElement("option", {
    value: "in_progress"
  }, "In Progress"), React.createElement("option", {
    value: "shipped"
  }, "Shipped")), React.createElement("select", {
    title: "Filter by priority",
    value: filters.priority,
    onChange: event => setFilters(prev => ({
      ...prev,
      priority: event.target.value
    }))
  }, React.createElement("option", {
    value: ""
  }, "All priority"), React.createElement("option", {
    value: "low"
  }, "Low"), React.createElement("option", {
    value: "medium"
  }, "Medium"), React.createElement("option", {
    value: "high"
  }, "High"), React.createElement("option", {
    value: "critical"
  }, "Critical")), React.createElement("input", {
    type: "text",
    placeholder: "Tag filter",
    value: filters.tag,
    onChange: event => setFilters(prev => ({
      ...prev,
      tag: event.target.value
    }))
  }))), React.createElement("section", {
    className: "panel"
  }, React.createElement("h2", null, "Feedback Queue"), React.createElement("div", {
    className: "list-grid"
  }, feedback.map(item => React.createElement("article", {
    key: item.id,
    className: "feedback-card"
  }, React.createElement("div", {
    className: "title-row"
  }, React.createElement("strong", null, item.title), React.createElement("span", {
    className: `priority ${item.priority}`
  }, item.priority)), React.createElement("p", null, item.description), React.createElement("div", {
    className: "meta-row"
  }, React.createElement("span", null, item.tags && item.tags.length ? item.tags.join(", ") : "no tags"), React.createElement("span", null, "Assignee: ", item.assignee), React.createElement("span", null, "Status: ", item.status.replace("_", " "))), React.createElement("div", {
    className: "actions-row"
  }, React.createElement("button", {
    type: "button",
    onClick: () => handleVote(item.id)
  }, "Vote (", item.vote_count, ")"), React.createElement("button", {
    type: "button",
    onClick: () => toggleComments(item.id)
  }, openComments[item.id] ? "Hide Comments" : "Show Comments"), canManage ? React.createElement(React.Fragment, null, React.createElement("select", {
    title: "Update status",
    value: item.status,
    onChange: event => handleFeedbackUpdate(item.id, {
      status: event.target.value
    })
  }, React.createElement("option", {
    value: "planned"
  }, "Planned"), React.createElement("option", {
    value: "in_progress"
  }, "In Progress"), React.createElement("option", {
    value: "shipped"
  }, "Shipped")), React.createElement("select", {
    title: "Update priority",
    value: item.priority,
    onChange: event => handleFeedbackUpdate(item.id, {
      priority: event.target.value
    })
  }, React.createElement("option", {
    value: "low"
  }, "Low"), React.createElement("option", {
    value: "medium"
  }, "Medium"), React.createElement("option", {
    value: "high"
  }, "High"), React.createElement("option", {
    value: "critical"
  }, "Critical")), React.createElement("select", {
    title: "Assign owner",
    defaultValue: "",
    onChange: event => event.target.value && handleFeedbackUpdate(item.id, {
      assignedTo: Number(event.target.value)
    })
  }, React.createElement("option", {
    value: ""
  }, "Assign..."), assignees.map(person => React.createElement("option", {
    key: person.id,
    value: person.id
  }, person.name)))) : null), openComments[item.id] ? React.createElement("div", {
    className: "comments-panel"
  }, React.createElement("div", {
    className: "comments-list"
  }, (commentsById[item.id] || []).map(comment => React.createElement("div", {
    key: comment.id,
    className: "comment-item"
  }, React.createElement("strong", null, comment.author), React.createElement("p", null, comment.body)))), React.createElement("div", {
    className: "comment-form"
  }, React.createElement("textarea", {
    placeholder: "Add a comment",
    value: commentDrafts[item.id] || "",
    onChange: event => setCommentDrafts(prev => ({
      ...prev,
      [item.id]: event.target.value
    }))
  }), React.createElement("button", {
    type: "button",
    onClick: () => submitComment(item.id)
  }, "Post Comment"))) : null))))) : null, view === "roadmap" ? React.createElement(React.Fragment, null, canManage ? React.createElement("section", {
    className: "panel lane-grid"
  }, React.createElement("form", {
    className: "feedback-form",
    onSubmit: submitRelease
  }, React.createElement("h2", null, "Create Release"), React.createElement("input", {
    type: "text",
    placeholder: "Release title",
    value: releaseForm.title,
    onChange: event => setReleaseForm(prev => ({
      ...prev,
      title: event.target.value
    })),
    required: true
  }), React.createElement("input", {
    type: "text",
    placeholder: "Version",
    value: releaseForm.version,
    onChange: event => setReleaseForm(prev => ({
      ...prev,
      version: event.target.value
    })),
    required: true
  }), React.createElement("textarea", {
    placeholder: "Release summary",
    value: releaseForm.summary,
    onChange: event => setReleaseForm(prev => ({
      ...prev,
      summary: event.target.value
    }))
  }), React.createElement("input", {
    title: "Release ship date",
    type: "date",
    value: releaseForm.shippedAt,
    onChange: event => setReleaseForm(prev => ({
      ...prev,
      shippedAt: event.target.value
    }))
  }), React.createElement("select", {
    title: "Release status",
    value: releaseForm.status,
    onChange: event => setReleaseForm(prev => ({
      ...prev,
      status: event.target.value
    }))
  }, React.createElement("option", {
    value: "planned"
  }, "Planned"), React.createElement("option", {
    value: "in_progress"
  }, "In Progress"), React.createElement("option", {
    value: "shipped"
  }, "Shipped")), React.createElement("button", {
    type: "submit"
  }, "Save Release")), React.createElement("form", {
    className: "feedback-form",
    onSubmit: submitMilestone
  }, React.createElement("h2", null, "Create Milestone"), React.createElement("input", {
    type: "text",
    placeholder: "Milestone name",
    value: milestoneForm.name,
    onChange: event => setMilestoneForm(prev => ({
      ...prev,
      name: event.target.value
    })),
    required: true
  }), React.createElement("input", {
    title: "Milestone target date",
    type: "date",
    value: milestoneForm.targetDate,
    onChange: event => setMilestoneForm(prev => ({
      ...prev,
      targetDate: event.target.value
    })),
    required: true
  }), React.createElement("select", {
    title: "Milestone status",
    value: milestoneForm.status,
    onChange: event => setMilestoneForm(prev => ({
      ...prev,
      status: event.target.value
    }))
  }, React.createElement("option", {
    value: "planned"
  }, "Planned"), React.createElement("option", {
    value: "in_progress"
  }, "In Progress"), React.createElement("option", {
    value: "shipped"
  }, "Shipped")), React.createElement("button", {
    type: "submit"
  }, "Save Milestone"))) : null, React.createElement("section", {
    className: "panel"
  }, React.createElement("h2", null, "Milestones"), React.createElement("div", {
    className: "list-grid"
  }, milestones.map(item => React.createElement("article", {
    key: item.id,
    className: "roadmap-card"
  }, React.createElement("strong", null, item.name), React.createElement("p", null, "Target: ", formatDate(item.target_date)), React.createElement("span", {
    className: `badge ${item.status}`
  }, item.status.replace("_", " ")))))), React.createElement("section", {
    className: "panel"
  }, React.createElement("h2", null, "Release Notes"), React.createElement("div", {
    className: "list-grid"
  }, releases.map(item => React.createElement("article", {
    key: item.id,
    className: "roadmap-card"
  }, React.createElement("div", {
    className: "title-row"
  }, React.createElement("strong", null, item.title), React.createElement("span", {
    className: `badge ${item.status}`
  }, item.status.replace("_", " "))), React.createElement("p", null, item.summary), React.createElement("small", null, "v", item.version, item.shipped_at ? ` • ${formatDate(item.shipped_at)}` : " • pending")))))) : null, view === "analytics" ? React.createElement(React.Fragment, null, React.createElement("section", {
    className: "panel"
  }, React.createElement("h2", null, "Most Requested Features"), React.createElement("div", {
    className: "list-grid"
  }, analytics.mostRequested.map(entry => React.createElement("article", {
    key: entry.id,
    className: "roadmap-card"
  }, React.createElement("strong", null, entry.title), React.createElement("p", null, entry.votes, " votes"))))), React.createElement("section", {
    className: "panel chart-panel"
  }, React.createElement("h2", null, "Release Velocity"), React.createElement("div", {
    className: "velocity-chart"
  }, analytics.releaseVelocity.map(entry => React.createElement("div", {
    key: entry.week,
    className: "velocity-bar-wrap"
  }, React.createElement("meter", {
    className: "velocity-meter",
    min: "0",
    max: maxVelocity,
    value: entry.releases
  }), React.createElement("strong", null, entry.releases), React.createElement("span", null, formatShortDate(entry.week))))))) : null));
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
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}
ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(App, null));