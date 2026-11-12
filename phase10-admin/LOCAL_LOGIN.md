# Functional local-only login and admin API

Run with Node 22. Supply `ADMIN_USERNAME=NGAD`, `ADMIN_PASSWORD` (new secret of at least 12 characters), and `ADMIN_INSTITUTION_ID=IDR` as private environment variables, then `node server.js`. The password shared in chat is NOT stored or deployed. Bind is loopback only at 127.0.0.1:8792.

Endpoints: POST /login with JSON username/password; GET /me; GET /users; POST /users with username,role,password; POST /users/:id/disable, /reset-password with password, /delete (soft-delete); GET /analytics; POST /logout. Session cookie is HttpOnly and SameSite Strict. Account activity is recorded. Data stored in local JSON, not production database.

**Demo only:** This is not an internet-ready service. No TLS termination, durable shared session store, CSRF token, secure-cookie flag, robust credential stuffing defenses, password-change UI, or institutional approval. Do not use for real staff or incarcerated persons. Never deploy publicly as-is. No confidential case content is exposed. Admin can only manage users of its own institution. `mustChangePassword` is recorded but not yet enforced; password reset users should not be granted real access until enforced.
