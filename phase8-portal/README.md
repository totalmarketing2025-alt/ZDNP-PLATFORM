# Phase 8: role and workflow policy prototype

Pure functions for **proposed** institutional account management and case transitions, with tests. These do NOT write to the database, authenticate anyone, or expose endpoints.

- `npm test` runs authorization and state-machine checks.
- Confidential complaints are explicitly excluded pending independently authorized routing.
- Account changes are planning results only; audit and reauthentication must be enforced transactionally before any implementation.
- No real data or production deployment.

The existing Phase 7 API is read-only. OIDC MFA configuration, account management implementation, durable event log, protected attachments, UI-to-API integration, institutional authorization and legal review are outstanding.
