# ProductPulse

ProductPulse is a product feedback and release planning platform where teams collect requests, prioritize work, and track delivery from idea to launch.

## Documentation index

- `CHANGELOG.md` - versioned release notes
- `RELEASE_CHECKLIST.md` - final pre-release verification steps
- `.github/workflows/ci.yml` - CI jobs for api-tests and smoke-test

## Stack

- React frontend served as a static app by Express
- Node.js + Express backend REST APIs
- PostgreSQL database with a built-in demo fallback when no database is configured
- Browser-rendered analytics cards and velocity bars

## Features

- Feedback submission with tags
- Search, status, priority, and tag filtering
- Product team actions: assign, prioritize, and update statuses
- Role-based behavior for submitter, product owner, and admin
- Public roadmap and release notes visibility
- Dashboard for planned, in progress, and shipped items
- Analytics for most requested features and release velocity

## Project structure

- `client` - React UI
- `server` - Node.js API and PostgreSQL scripts
- `server/sql/schema.sql` - Database schema
- `server/sql/seed.sql` - Seed data and demo users
- `Dockerfile` - Server image for local containers
- `docker-compose.yml` - PostgreSQL + app runtime

## Environment setup

1. Create a PostgreSQL database named `productpulse`.
2. Copy `.env` templates:
   - `server/.env.example` -> `server/.env`
3. Update `server/.env` database connection if needed.

If `DATABASE_URL` is not set, the app runs in demo mode with in-memory seed data so you can still explore the full UI.

## Docker run

```bash
npm run docker:up
```

That starts PostgreSQL and the ProductPulse app on `http://localhost:5000`.

## Smoke test

```bash
npm run smoke:test
```

This verifies health, submitter login, feedback creation, product-owner login, release creation, and analytics responses against the running app.

## API tests

```bash
npm run test:api
```

This runs focused route-level tests for login validation, feedback filtering, and release authorization using the app's demo-mode in-memory store.

## Install and run

```bash
npm run install:all
npm run build:client
npm run db:init
npm run dev:server
```

App URL: `http://localhost:5000`
API base: `http://localhost:5000/api`

## Frontend runtime note

The frontend is delivered entirely by the Node server from the `client` folder. The JSX source (`client/app.jsx`) is compiled into `client/app.js`, and the React runtime files are copied into `client/vendor` during `npm run build:client` and during Docker image builds, so the UI no longer depends on external CDN assets.

## Demo users

- Submitter: `submitter@productpulse.dev` / `password123`
- Product owner: `owner@productpulse.dev` / `password123`
- Admin: `admin@productpulse.dev` / `password123`

## API highlights

- `POST /api/auth/login`
- `GET/POST /api/feedback`
- `PATCH /api/feedback/:id` (product owner/admin)
- `POST /api/feedback/:id/vote`
- `GET /api/releases`
- `GET /api/analytics/overview`
