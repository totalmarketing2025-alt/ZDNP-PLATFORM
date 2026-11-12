# NGAD administration — development foundation only

NGAD is a proposed administrator username, **not** a seeded or enabled account. No passwords or hashes are committed. The password shared in chat is weak under the 12-character minimum and must be replaced before account provisioning. Never use it for a real deployment.

This module includes password hashing/verification utilities, institution-scoped authorization decisions, role validation and limited activity aggregation. It does **not** create a live login, server, session management, database users or an admin interface. A production implementation needs persistent user storage, Argon2id or equivalent vetted hashing, rate limiting, secure session cookies, CSRF protection, account recovery, lockout monitoring, audit trails and an independently reviewed confidential-complaint access model.

An institution admin cannot cross institutions; ZDNP technical operators must not gain automatic access to sensitive records. Username/password alone is not recommended for real correctional-institution records. Existing OIDC/MFA work must not be removed without formal risk review.
