# Release Checklist

Reference docs:
- `README.md` for setup and run commands
- `CHANGELOG.md` for release notes and scope

## Version and Notes
- Confirm release version is finalized.
- Update CHANGELOG.md with release notes and date.
- Verify README.md reflects current run and test commands.

## Quality Gates
- Run API tests: npm run test:api
- Run smoke tests: npm run smoke:test
- Ensure all tests pass with zero failures.

## Build and Runtime
- Rebuild stack: docker compose up -d --build
- Verify services are healthy: docker compose ps
- Verify app health endpoint: GET /api/health

## Functional Spot Checks
- Submitter login succeeds.
- Product owner login succeeds.
- Feedback creation works.
- Release creation works for product owner and is blocked for submitter.
- Analytics endpoint returns expected shape.

## Security and Config
- Confirm JWT_SECRET is set for non-local environments.
- Confirm DATABASE_URL points to target release database.
- Confirm no development-only credentials are used in production.

## CI and Delivery
- Confirm api-tests job is passing.
- Confirm smoke-test job is passing.
- Tag release after green CI.
