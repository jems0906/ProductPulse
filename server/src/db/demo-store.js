const now = new Date();

let users = [
  { id: 1, name: "Sam Submitter", email: "submitter@productpulse.dev", role: "submitter", password_hash: "password123" },
  { id: 2, name: "Paula Product", email: "owner@productpulse.dev", role: "product_owner", password_hash: "password123" },
  { id: 3, name: "Alex Admin", email: "admin@productpulse.dev", role: "admin", password_hash: "password123" },
];

let feedbackRequests = [
  {
    id: 1,
    title: "Dark mode for roadmap view",
    description: "Provide dark mode option for users in the roadmap and release pages.",
    status: "planned",
    priority: "high",
    tags: ["ui", "accessibility"],
    assigned_to: null,
    created_by: 1,
    created_at: offsetDate(-18),
    updated_at: offsetDate(-18),
  },
  {
    id: 2,
    title: "Slack notifications for comments",
    description: "Notify product teams in Slack when high-priority requests receive updates.",
    status: "in_progress",
    priority: "critical",
    tags: ["integrations", "notifications"],
    assigned_to: 2,
    created_by: 2,
    created_at: offsetDate(-10),
    updated_at: offsetDate(-4),
  },
  {
    id: 3,
    title: "CSV export for feedback list",
    description: "Allow export of filtered feedback as CSV for stakeholder meetings.",
    status: "shipped",
    priority: "medium",
    tags: ["reporting"],
    assigned_to: 3,
    created_by: 3,
    created_at: offsetDate(-30),
    updated_at: offsetDate(-7),
  },
];

let feedbackComments = [
  { id: 1, feedback_id: 2, author_id: 2, body: "Working with design to align the notification copy.", created_at: offsetDate(-3) },
  { id: 2, feedback_id: 2, author_id: 3, body: "Admin approval will be needed before launch.", created_at: offsetDate(-2) },
];

let feedbackVotes = [
  { feedback_id: 1, voter_id: 1, created_at: offsetDate(-8) },
  { feedback_id: 1, voter_id: 2, created_at: offsetDate(-7) },
  { feedback_id: 2, voter_id: 1, created_at: offsetDate(-6) },
  { feedback_id: 2, voter_id: 3, created_at: offsetDate(-6) },
  { feedback_id: 3, voter_id: 1, created_at: offsetDate(-5) },
];

let releases = [
  { id: 1, title: "Roadmap v1", summary: "Initial roadmap dashboard with status lanes.", version: "1.0.0", status: "shipped", shipped_at: offsetDate(-21), created_at: offsetDate(-22) },
  { id: 2, title: "Feedback Filters", summary: "Advanced search, tags, and priority filters.", version: "1.1.0", status: "shipped", shipped_at: offsetDate(-7), created_at: offsetDate(-8) },
  { id: 3, title: "Analytics Beta", summary: "Most requested features and velocity chart.", version: "1.2.0", status: "in_progress", shipped_at: null, created_at: offsetDate(-2) },
];

let milestones = [
  { id: 1, name: "Public Feedback Portal", target_date: offsetDateDate(14), status: "in_progress", created_at: offsetDate(-12) },
  { id: 2, name: "Release Automation", target_date: offsetDateDate(30), status: "planned", created_at: offsetDate(-11) },
  { id: 3, name: "Enterprise SSO", target_date: offsetDateDate(45), status: "planned", created_at: offsetDate(-10) },
];

let nextIds = { feedback: 4, comment: 3, release: 4, milestone: 4 };

function offsetDate(days) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function offsetDateDate(days) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function withAssigneeName(item) {
  const assignee = users.find((user) => user.id === item.assigned_to);
  return {
    ...item,
    assignee: assignee ? assignee.name : "Unassigned",
    vote_count: feedbackVotes.filter((vote) => vote.feedback_id === item.id).length,
  };
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

export function loginUser(email, password) {
  const user = users.find((entry) => entry.email === email && entry.password_hash === password);
  return user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null;
}

export function listUsers() {
  return users.map(({ id, name, role }) => ({ id, name, role }));
}

export function listFeedback(filters = {}) {
  const search = normalize(filters.search);
  const status = normalize(filters.status);
  const priority = normalize(filters.priority);
  const tag = normalize(filters.tag);
  const assignee = normalize(filters.assignee);
  const sort = normalize(filters.sort || "newest");

  return feedbackRequests
    .filter((item) => {
      const assigneeName = users.find((user) => user.id === item.assigned_to)?.name || "";
      const matchesSearch = !search || normalize(item.title).includes(search) || normalize(item.description).includes(search);
      const matchesStatus = !status || item.status === status;
      const matchesPriority = !priority || item.priority === priority;
      const matchesTag = !tag || item.tags.some((entry) => normalize(entry) === tag);
      const matchesAssignee = !assignee || normalize(assigneeName).includes(assignee);

      return matchesSearch && matchesStatus && matchesPriority && matchesTag && matchesAssignee;
    })
    .map(withAssigneeName)
    .sort((left, right) => {
      if (sort === "oldest") return new Date(left.created_at) - new Date(right.created_at);
      if (sort === "mostrequested") return right.vote_count - left.vote_count || new Date(right.created_at) - new Date(left.created_at);
      return new Date(right.created_at) - new Date(left.created_at);
    });
}

export function createFeedback({ title, description, tags, createdBy }) {
  const item = {
    id: nextIds.feedback++,
    title,
    description,
    status: "planned",
    priority: "medium",
    tags: tags || [],
    assigned_to: null,
    created_by: createdBy || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  feedbackRequests.unshift(item);
  return withAssigneeName(item);
}

export function updateFeedback(id, patch) {
  const item = feedbackRequests.find((entry) => entry.id === Number(id));
  if (!item) return null;

  if (patch.status) item.status = patch.status;
  if (patch.priority) item.priority = patch.priority;
  if (patch.tags) item.tags = patch.tags;
  if (patch.assignedTo !== undefined) item.assigned_to = patch.assignedTo || null;
  item.updated_at = new Date().toISOString();
  return withAssigneeName(item);
}

export function listComments(feedbackId) {
  return feedbackComments
    .filter((item) => item.feedback_id === Number(feedbackId))
    .map((item) => ({
      id: item.id,
      body: item.body,
      created_at: item.created_at,
      author: users.find((user) => user.id === item.author_id)?.name || "Anonymous",
    }))
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
}

export function createComment(feedbackId, authorId, body) {
  const comment = {
    id: nextIds.comment++,
    feedback_id: Number(feedbackId),
    author_id: authorId || null,
    body,
    created_at: new Date().toISOString(),
  };

  feedbackComments.unshift(comment);
  return comment;
}

export function addVote(feedbackId, voterId) {
  const existing = feedbackVotes.find((vote) => vote.feedback_id === Number(feedbackId) && vote.voter_id === Number(voterId));
  if (!existing) {
    feedbackVotes.push({ feedback_id: Number(feedbackId), voter_id: Number(voterId), created_at: new Date().toISOString() });
  }
}

export function listReleases() {
  return releases
    .slice()
    .sort((left, right) => new Date(right.shipped_at || right.created_at) - new Date(left.shipped_at || left.created_at));
}

export function createRelease({ title, summary, version, shippedAt, status }) {
  const release = {
    id: nextIds.release++,
    title,
    summary: summary || "",
    version,
    status: status || "planned",
    shipped_at: shippedAt || null,
    created_at: new Date().toISOString(),
  };

  releases.unshift(release);
  return release;
}

export function listMilestones() {
  return milestones.slice().sort((left, right) => new Date(left.target_date) - new Date(right.target_date));
}

export function createMilestone({ name, targetDate, status }) {
  const milestone = {
    id: nextIds.milestone++,
    name,
    target_date: targetDate,
    status: status || "planned",
    created_at: new Date().toISOString(),
  };

  milestones.unshift(milestone);
  return milestone;
}

export function analyticsOverview() {
  const stateMap = feedbackRequests.reduce((accumulator, item) => {
    accumulator[item.status] = (accumulator[item.status] || 0) + 1;
    return accumulator;
  }, {});

  const mostRequested = feedbackRequests
    .map((item) => ({ id: item.id, title: item.title, votes: feedbackVotes.filter((vote) => vote.feedback_id === item.id).length }))
    .sort((left, right) => right.votes - left.votes || right.id - left.id)
    .slice(0, 5);

  const eightWeeksAgo = new Date(now);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const releaseVelocity = releases
    .filter((item) => item.shipped_at && new Date(item.shipped_at) >= eightWeeksAgo)
    .reduce((accumulator, item) => {
      const key = new Date(item.shipped_at).toISOString().slice(0, 10).slice(0, 7);
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});

  return {
    states: Object.entries(stateMap).map(([status, count]) => ({ status, count })),
    mostRequested,
    releaseVelocity: Object.entries(releaseVelocity).map(([week, releases]) => ({ week, releases })).sort((left, right) => left.week.localeCompare(right.week)),
  };
}
