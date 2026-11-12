# Central NGAD — staging-only

## Current design
- `global_admin=1` is a separately granted privilege, never assigned to staff through the API.
- Only the NGAD username and institution_admin role may hold it (D1 triggers).
- Central NGAD can list and manage staff accounts across IDR/PRI/STI and view administrative activity counts; ordinary staff and institution admins remain institution-scoped.
- No privileged API grants NGAD access to confidential case bodies. The existing /api/cases endpoint rejects administrators.
- NGAD is anchored to IDR as a compatibility institution_id, but its explicit central flag controls cross-institution management.

## Staging steps (NOT YET EXECUTED)
1. In D1 Console apply `migrations/0002_central_ngad.sql` once, after `0001_initial.sql`. Do not re-run ALTER TABLE.
2. In a trusted local Node.js environment run `node scripts/provision-ngad.mjs` and enter a NEW private password. The script outputs a one-time INSERT with a derived password hash, not plaintext. Run that SQL in the **private D1 Console**, never commit or paste the hash in chat. Use a password different from any previously shared password. No default NGAD exists.
3. Before deployment, complete a security review and enforce Cloudflare Access on a private staging hostname. Worker and UI still require functional end-to-end tests, particularly central-admin workflows and browser compatibility.
4. No public Worker deploy or production domain change has been performed.

## Security gaps
This is a prototype, not ready for sensitive correctional records. Further work: Access JWT validation, robust CSRF protection, IP/WAF rate limiting, atomic login lockout, password recovery and change UX, audit coverage, encrypted case payloads, confidential case workflows, backups and retention policy, and institutional approvals. Cloudflare D1 has no PostgreSQL RLS; tenant isolation must be validated on every API query.
