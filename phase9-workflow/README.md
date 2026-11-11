# Phase 9 — PostgreSQL transaction and audit integration

Migration `database/migrations/004_case_transitions.sql` implements a narrowly scoped SECURITY DEFINER function for four state changes (assign, forward, answer, close). It checks enabled staff, role, institution, confidential flag, state, assignment, and locks the case row. The case update and audit insert are atomic.

The restricted `zdnp_app` role has EXECUTE on this function but **no direct INSERT/UPDATE grants**. PostgreSQL 16 integration tests exercise successful transitions, cross-institution denial, confidential denial, wrong-role denial, duplicate action rejection, and event count. The CI-only database and identities are fictional.

**Critical trust boundary:** The function takes an OIDC subject and cannot itself verify a JWT. Only a private backend which verifies OIDC signature, issuer, audience, expiry, MFA and maps the verified token subject may call it. A database client with application credentials could impersonate any subject; these credentials must never be exposed to users, browsers, plugins or untrusted workloads. This is a development-stage design, not a completed production authorization boundary.

The earlier `workflow.js` remains an illustrative internal service and is **not wired to the new function**. The integration test invokes the database function directly. Do not deploy or collect real data without security review, independent confidential-complaint routing, institutional agreements, credential separation, and verified backend integration.
