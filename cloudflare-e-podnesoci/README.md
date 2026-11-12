# Cloudflare-only staging prototype

Cloudflare Worker serves the Macedonian dashboard from Workers Static Assets and provides a D1-backed API. D1 is SQLite, **not PostgreSQL**. PostgreSQL migrations and services remain untouched in their own folders.

## Setup (manual, after security review)

1. Create a **staging-only** Cloudflare D1 database, then replace the placeholder `database_id` in wrangler.toml with the assigned ID. Do not commit any credentials.
2. Install dependencies (`npm install`), authenticate Wrangler privately (`npx wrangler login`), and apply the migration using `npx wrangler d1 migrations apply zdnp-e-podnesoci-staging --remote`.
3. Create an initial admin with a private one-time provisioning process. **No admin is seeded by this repo.** Never publish a bootstrap endpoint or use the password shared in chat. Keep `workers_dev=false` and place a verified Cloudflare Access policy on a dedicated staging hostname before exposing the Worker.
4. Verify authentication, roles, session revocation, audit logs, backups and tenant isolation with end-to-end tests before any deployment. No CI auto-deploy is configured.

**Not production-ready:** This is a staging scaffold, not a finished secure system. Login throttling is not implemented yet; Cloudflare WAF rate limits are required, and a server-side lockout strategy should be added. Cloudflare Access JWT verification, CSRF token defense, session management under concurrency, institutional access review, secure confidential complaints routing, document encryption, legal approval and security testing are still required. The Worker must not be publicly deployed as-is. No real prison or staff data should be entered. NGAD is not yet provisioned and no actual Cloudflare account changes have been made.
