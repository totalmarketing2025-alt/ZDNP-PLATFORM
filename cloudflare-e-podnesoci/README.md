# ZDNP e-PODNESOCI — Cloudflare staging portal

The Worker source lives on `main` and the operator has routed a test portal on
`zdnp.org` / `www.zdnp.org`. GitHub's deploy workflow is **manual**; a merge does
not prove a Cloudflare deployment. This is a staging/test system. Do not process
real correctional records without a separate security and privacy review.

## Existing resources
- Worker: `zdnp-platform`
- D1 binding: `DB`, database `zdnp-e-podnesoci-staging`
- D1 database ID is already set in `wrangler.toml`.
- NGAD has been inserted manually in staging D1 (confirmed by operator). Do not seed another NGAD.
- `workers_dev=false`; no automatic deploy in GitHub Actions.

## Recommended hardening before real use (operator action)

1. Open Cloudflare Zero Trust > Settings > Custom Pages / Team domain (the location varies by dashboard version). Copy the exact team domain, normally `https://YOUR-TEAM.cloudflareaccess.com`. Do not guess it.
2. Under Access > Applications, create a **Self-hosted** application for a **dedicated private staging hostname**. Configure an explicit allow policy for **only the designated test administrators**; require identity-provider MFA. Deny everyone else. Avoid broad email-domain allow rules.
3. In the Access application details, copy the **Application AUD Tag** (audience).
4. Set the Worker variables `ACCESS_TEAM_DOMAIN` (full HTTPS team URL, no trailing slash) and `ACCESS_AUD` (exact AUD Tag) using Cloudflare Worker settings or a private deployment configuration. Do **not** commit real account values or passwords to GitHub.
5. Keep `workers_dev=false` and verify that Access protects the dedicated staging hostname before treating it as private.
6. Confirm that requests without a valid Cloudflare Access JWT return HTTP 403, and that authenticated requests use the expected issuer and audience. Test session handling and account permissions separately.

**Important:** The current Worker does **not** verify Cloudflare Access JWTs.
Access integration and multi-factor protection remain security work for the
private staging design; the current public test portal uses D1-backed account
passwords and a secret-gated, single-use NGAD recovery/test procedure. See
`NGAD_TEMPORARY_ACCESS.md`. Do not mistake the public test portal for an
Access-protected production system.

## Local checks (no deployment)

From `cloudflare-e-podnesoci/`:
```sh
npm install --no-audit --no-fund
npm run check
npm test
```

The current CI does not perform real Cloudflare Access or D1 end-to-end tests. Green CI alone is not deployment approval.

## Public web intake (staging)

The Worker now defines:
- `POST /api/public/submissions` for request and petition submissions;
- `POST /api/public/status` for status lookup using the case number and the one-time tracking code;
- `GET /api/cases/{id}` for institution-scoped educators/directors to read an authorized non-confidential submission.

The public payload is encrypted with AES-GCM before it reaches D1. The tracking code is returned once to the submitter; only its SHA-256 hash is stored. Public rate limiting stores an HMAC fingerprint of the Cloudflare client IP, not the raw IP.

Before the endpoint can accept submissions, apply migration `0003_public_intake.sql` to the staging D1 database and configure two Worker secrets (never commit them):
- `CASE_ENCRYPTION_KEY`: at least 48 random characters; keep a protected backup because losing it makes submitted content unreadable.
- `PUBLIC_INTAKE_HMAC_KEY`: at least 48 random characters; changing it resets rate-limit fingerprints.

Then deploy the Worker through the protected manual staging workflow. The website form is limited to requests and petitions for now. Complaints and corruption/irregularity reports remain disabled until a separate confidential reviewer and routing path are defined. The app and website display a test-data warning. Do not accept real personal or correctional records on this staging system.

## Remaining security blockers
- Complete integration tests for all three institutions, NGAD cross-institution actions, session revocation and negative access cases.
- CSRF protection, atomic login throttling / WAF rules, secure password-change UI and audit coverage.
- Backups, retention, incident response, institutional approval and confidential-record security review.
- Never use real prisoner, complaint or staff records in this staging prototype.

## Same-domain portal routing
The shared sign-in URL for NGAD and all institutional users is `https://zdnp.org/najava` (or `www.zdnp.org/najava` where separately routed). Authenticated UI uses `/dashboard`, and API uses `/api/*`. The existing website homepage and other Pages routes must remain untouched.

**Do not use a catch-all `www.zdnp.org/*` Worker route.** In Cloudflare Workers > Worker > Settings > Domains & Routes, add **only** these three routes to the portal Worker after checking existing Pages/Workers route ownership:
- `www.zdnp.org/najava`
- `www.zdnp.org/dashboard`
- `www.zdnp.org/api/*`

These are route patterns, not three separate Workers. Route ownership and Cloudflare Pages compatibility must be verified in the actual account before enabling them. Never configure the root hostname as a Worker custom domain, which could intercept the whole site.

The Worker currently uses application session authentication, not verified
Cloudflare Access JWTs. The temporary NGAD test route additionally requires an
independent secret, a short deadline and a one-use marker in D1. Never open an
unrestricted NGAD bypass. Merging to `main` does not publish route changes or
guarantee the active deployment matches the repository.
