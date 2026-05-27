# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-05-27

### Added
- Full ProductPulse platform implementation for feedback intake, prioritization, assignment, and release tracking.
- React-based frontend with dashboard, feedback queue, roadmap, and analytics views.
- Node.js and Express REST API routes for auth, feedback, releases, and analytics.
- PostgreSQL schema and seed scripts for users, feedback, comments, votes, releases, and milestones.
- Demo-mode in-memory fallback store when DATABASE_URL is not configured.
- Role-based authorization for submitter, product owner, and admin.
- Search, tag, status, priority, and assignee filtering for feedback requests.
- Basic analytics for most requested features and release velocity.

### Changed
- Frontend runtime hardened to use precompiled app.js output and locally served vendor runtime assets.
- CI pipeline upgraded to run fast API tests before Docker-based smoke tests.
- CI API test job optimized with npm cache based on server lockfile.

### Tested
- Route-level API tests using Node test runner.
- End-to-end smoke test flow for health, login, feedback creation, release creation, and analytics.
- Docker Compose stack validation for app and database services.
