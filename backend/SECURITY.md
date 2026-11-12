# Backend security gates (not implemented)

This folder contains a design contract, not a working server. NEVER expose real submissions through the static prototype.

## Mandatory before accepting data
- Institutional agreements and defined controller/processor roles.
- Verified identity provider, individual accounts, MFA, short-lived HttpOnly Secure SameSite cookies and CSRF defense.
- Deny-by-default server authorization: institution match AND role AND case-specific permission.
- Independent confidential complaints routing, not accessible to named subjects.
- Encryption in transit and at rest with managed keys; secrets never committed.
- PostgreSQL row-level security policies and cross-tenant tests.
- Validated, rate-limited submissions; secure anonymous tracking tokens stored as hashes.
- Private object storage, antivirus scanning, file-type and size validation, no public bucket URLs.
- Immutable/tamper-evident access log, retention policy, deletion procedure, incident response.
- Backup and restore tests; security and privacy review before pilot.

## Explicit non-goals of this commit
No login, password verification, database connection, document upload, real case intake or production deployment.
