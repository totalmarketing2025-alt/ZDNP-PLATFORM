# Phase 9: database-backed case workflow (internal prototype)

Internal-only service with transactional state updates and audit events. No HTTP endpoints, no production authentication, no confidential complaint processing.

**Security boundary:** The caller must supply a principal verified by a trusted server-side OIDC/MFA integration; `verified` flags are NOT cryptographic proof and MUST NEVER be accepted from request JSON, headers or a browser. Database staff role is checked on every command.

**Deployment blocker:** The existing PostgreSQL RLS policy deliberately denies writes to `cases` and `case_events`. This service therefore cannot write under the existing restricted application role. A carefully scoped database security-definer function or dedicated mutation authorization design and integration tests are required before it can be enabled. Never grant unrestricted table UPDATE/INSERT to bypass the RLS boundary.

Run `npm test` for mock-transaction tests. Real DB integration, identity provider, retention, independent complaint routing and institutional approvals are still required.
