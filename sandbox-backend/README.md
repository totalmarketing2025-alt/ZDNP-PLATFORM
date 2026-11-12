# Local-only functional sandbox

This is an **isolated fictional workflow simulator**, not a real backend. Do not deploy to Cloudflare, expose on the Internet or use real personal data.

Requirements: Node.js 20+.

Run:
```sh
cd sandbox-backend
npm test
npm start
curl -H 'x-demo-user: demo-idr-educator' http://127.0.0.1:8789/api/cases
curl -H 'x-demo-user: demo-idr-educator' -H 'content-type: application/json' -d '{"action":"assign"}' http://127.0.0.1:8789/api/cases/DEMO-IDR-001/actions
```

The server binds to loopback only. The x-demo-user header is an **intentionally insecure test identity selector**, not authentication. Data is reset on restart. No database connection, uploads, login, password handling, public submission or production API exists.

Before any deployment, replace demo identity selection with verified institutional accounts and MFA, implement PostgreSQL RLS, privacy safeguards, secure storage and independent complaint routing, and obtain institutional authorization.
