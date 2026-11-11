# Phase 7 — private staff API (development only)

This is a **read-only, loopback-bound API foundation**, not a completed staff portal.

Authentication: externally issued OIDC **access** JWT, checked against HTTPS JWKS, issuer, audience, expiry and explicit MFA method (amr). Token's subject is resolved to an enabled staff profile in PostgreSQL. No public registration or account creation.

Required environment: DATABASE_URL (restricted non-owner DB role), OIDC_ISSUER, OIDC_AUDIENCE, OIDC_JWKS_URL. Run with Node 22+, `npm install`, `npm test`, `npm start` is NOT defined; use `node server.js` after configuration.

GET /api/me and GET /api/cases require Authorization: Bearer <verified access token>. Server binds to 127.0.0.1 only. No CORS, no public deployment. Existing RLS must be enabled, verified, and applied to a separate DB role. Staff user provisioning remains manual and requires institutional approval.

**Not ready for real data**: MFA claim semantics must be confirmed against the selected identity provider; JWT revocation, session management, CSRF strategy for any future cookies, audit logs, complaint routing, and end-to-end integration tests remain open. A valid MFA claim alone does not prove the provider's policy is sufficient. The static prototype remains unconnected.
