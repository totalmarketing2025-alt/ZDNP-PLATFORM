# Phase 6 – private database and authentication foundation

**Not a working production login or live backend.** This stage adds a PostgreSQL data-access adapter, restrictive RLS migration and a deliberately fail-closed MFA identity contract.

- `npm install`, `npm test` for identity-contract unit tests (no database required).
- PostgreSQL migration `../database/migrations/002_tenant_rls.sql` requires 001 first.
- `db.js` uses transaction-local identity settings and read-only transactions; no public server or endpoint is exposed.
- `verifyStaffSession()` ALWAYS rejects until a trusted institutional OIDC identity provider and MFA are configured.
- `assertVerifiedPrincipal()` checks shape/flags but **does not authenticate a user**. Never populate its flags from client input, headers or cookies.
- Do not use owner/superuser/BYPASSRLS database credentials in app runtime.
- RLS policies must be integration-tested against a non-owner DB role before deployment. They intentionally deny all writes.
- PostgreSQL, secrets, institutional agreements, controller/processor assignments and real MFA have not been provisioned.

Do not deploy, collect personal data, or connect this to zdnp.org.
