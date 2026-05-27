const baseUrl = (process.env.APP_URL || "http://localhost:5000").replace(/\/$/, "");
const timestamp = Date.now();

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function login(email, password) {
  return requestJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

async function main() {
  const health = await requestJson("/api/health");
  if (health.status !== "ok") {
    throw new Error(`Health check failed: ${JSON.stringify(health)}`);
  }

  const submitter = await login("submitter@productpulse.dev", "password123");
  const owner = await login("owner@productpulse.dev", "password123");

  const feedbackTitle = `Smoke feedback ${timestamp}`;
  const releaseTitle = `Smoke release ${timestamp}`;
  const releaseVersion = `9.${new Date().getUTCMonth() + 1}.${new Date().getUTCDate()}`;

  await requestJson("/api/feedback", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${submitter.token}`,
    },
    body: JSON.stringify({
      title: feedbackTitle,
      description: "Smoke test feedback created by automated verification.",
      tags: ["smoke", "automation"],
    }),
  });

  const feedbackList = await requestJson("/api/feedback", {
    headers: {
      Authorization: `Bearer ${submitter.token}`,
    },
  });

  if (!feedbackList.some((item) => item.title === feedbackTitle)) {
    throw new Error("Created feedback item was not returned by GET /api/feedback");
  }

  await requestJson("/api/releases", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${owner.token}`,
    },
    body: JSON.stringify({
      title: releaseTitle,
      summary: "Smoke test release created by automated verification.",
      version: releaseVersion,
      shippedAt: new Date().toISOString().slice(0, 10),
      status: "planned",
    }),
  });

  const releaseData = await requestJson("/api/releases", {
    headers: {
      Authorization: `Bearer ${owner.token}`,
    },
  });

  if (!releaseData.releases.some((item) => item.title === releaseTitle)) {
    throw new Error("Created release was not returned by GET /api/releases");
  }

  const analytics = await requestJson("/api/analytics/overview", {
    headers: {
      Authorization: `Bearer ${owner.token}`,
    },
  });

  if (!Array.isArray(analytics.states) || !Array.isArray(analytics.mostRequested)) {
    throw new Error("Analytics payload shape is invalid");
  }

  console.log("Smoke test passed");
  console.log(JSON.stringify({ feedbackTitle, releaseTitle, releaseVersion }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
