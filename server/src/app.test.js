import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "";

const { default: app } = await import("./app.js");

describe("ProductPulse API", () => {
  let server;
  let baseUrl;

  before(() => {
    server = app.listen(0);
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(() => {
    server.close();
  });

  async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, options);
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    return { response, body };
  }

  async function login(email, password) {
    const { response, body } = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    assert.equal(response.status, 200);
    assert.ok(body.token);
    return body.token;
  }

  test("rejects invalid login credentials", async () => {
    const { response, body } = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "submitter@productpulse.dev", password: "wrong-password" }),
    });

    assert.equal(response.status, 401);
    assert.equal(body.message, "Invalid credentials");
  });

  test("filters feedback by tag and search in demo mode", async () => {
    const { response, body } = await request("/api/feedback?tag=reporting&search=csv");

    assert.equal(response.status, 200);
    assert.equal(body.length, 1);
    assert.equal(body[0].title, "CSV export for feedback list");
  });

  test("blocks submitters from release creation", async () => {
    const submitterToken = await login("submitter@productpulse.dev", "password123");
    const { response, body } = await request("/api/releases", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${submitterToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Blocked release",
        summary: "Submitters must not create releases.",
        version: "0.0.1",
      }),
    });

    assert.equal(response.status, 403);
    assert.equal(body.message, "Forbidden");
  });

  test("allows product owners to create releases", async () => {
    const ownerToken = await login("owner@productpulse.dev", "password123");
    const releaseTitle = `API test release ${Date.now()}`;
    const version = `9.9.${Date.now().toString().slice(-3)}`;

    const { response, body } = await request("/api/releases", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: releaseTitle,
        summary: "Created by focused API integration coverage.",
        version,
        status: "planned",
      }),
    });

    assert.equal(response.status, 201);
    assert.equal(body.title, releaseTitle);
    assert.equal(body.version, version);

    const listResult = await request("/api/releases");
    assert.equal(listResult.response.status, 200);
    assert.ok(listResult.body.releases.some((release) => release.title === releaseTitle && release.version === version));
  });

  test("creates and lists comments for feedback", async () => {
    const submitterToken = await login("submitter@productpulse.dev", "password123");
    const commentBody = `API test comment ${Date.now()}`;

    const createResult = await request("/api/feedback/1/comments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${submitterToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: commentBody }),
    });

    assert.equal(createResult.response.status, 201);
    assert.equal(createResult.body.body, commentBody);

    const listResult = await request("/api/feedback/1/comments");
    assert.equal(listResult.response.status, 200);
    assert.ok(listResult.body.some((comment) => comment.body === commentBody));
  });

  test("requires login to vote on feedback", async () => {
    const { response, body } = await request("/api/feedback/1/vote", {
      method: "POST",
    });

    assert.equal(response.status, 401);
    assert.equal(body.message, "Login required to vote");
  });

  test("blocks submitters from feedback status updates and allows product owners", async () => {
    const submitterToken = await login("submitter@productpulse.dev", "password123");
    const forbiddenResult = await request("/api/feedback/1", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${submitterToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "in_progress" }),
    });

    assert.equal(forbiddenResult.response.status, 403);
    assert.equal(forbiddenResult.body.message, "Forbidden");

    const ownerToken = await login("owner@productpulse.dev", "password123");
    const patchedStatus = `planned`;
    const allowedResult = await request("/api/feedback/1", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: patchedStatus, priority: "medium" }),
    });

    assert.equal(allowedResult.response.status, 200);
    assert.equal(allowedResult.body.id, 1);
    assert.equal(allowedResult.body.status, patchedStatus);
  });
});