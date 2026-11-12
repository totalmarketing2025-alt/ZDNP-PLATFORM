# ZDNP e-PODNESOCI — Cloudflare staging (private, not deployed)

This branch is staging-only. Do not merge into main, publish a route, enable workers.dev, or process real correctional records without a separate security review.

## Existing resources
- Worker: `zdnp-e-podnesoci-staging`
- D1 binding: `DB`, database `zdnp-e-podnesoci-staging`
- D1 database ID is already set in `wrangler.toml`.
- NGAD has been inserted manually in staging D1 (confirmed by operator). Do not seed another NGAD.
- `workers_dev=false`; no automatic deploy in GitHub Actions.

## Required Cloudflare Zero Trust setup (operator action)

1. Open Cloudflare Zero Trust > Settings > Custom Pages / Team domain (the location varies by dashboard version). Copy the exact team domain, normally `https://YOUR-TEAM.cloudflareaccess.com`. Do not guess it.
2. Under Access > Applications, create a **Self-hosted** application for a **dedicated private staging hostname**, never `zdnp.org` or the production site. Configure an explicit allow policy for **only the designated test administrators**; require identity-provider MFA. Deny everyone else. Avoid broad email-domain allow rules.
3. In the Access application details, copy the **Application AUD Tag** (audience).
4. Set the Worker variables `ACCESS_TEAM_DOMAIN` (full HTTPS team URL, no trailing slash) and `ACCESS_AUD` (exact AUD Tag) using Cloudflare Worker settings or a private deployment configuration. Do **not** commit real account values or passwords to GitHub.
5. Route the dedicated staging hostname to the Worker only after the Access application and policy are in place. Keep `workers_dev=false`, do not create a public `*.workers.dev` endpoint, and do not deploy until the explicit staging approval.
6. Confirm that requests without a valid Cloudflare Access JWT return HTTP 403, and that authenticated requests use the expected issuer and audience. Test session handling and account permissions separately.

The Worker **fails closed** when `ACCESS_TEAM_DOMAIN` or `ACCESS_AUD` is missing or when the JWT cannot be verified against Cloudflare Access signing keys. Do not disable this gate for convenience.

## Local checks (no deployment)

From `cloudflare-e-podnesoci/`:
```sh
npm install --no-audit --no-fund
npm run check
npm test
```

The current CI does not perform real Cloudflare Access or D1 end-to-end tests. Green CI alone is not deployment approval.

## Remaining security blockers
- Complete integration tests for all three institutions, NGAD cross-institution actions, session revocation and negative access cases.
- CSRF protection, atomic login throttling / WAF rules, secure password-change UI and audit coverage.
- Backups, retention, incident response, institutional approval and confidential-record security review.
- Never use real prisoner, complaint or staff records in this staging prototype.
