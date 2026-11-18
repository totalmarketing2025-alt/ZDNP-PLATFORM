# NGAD single-use test access (temporary)

This is a **passwordless test session**, not a password reset and not an open
login bypass. It is available only for the existing, enabled `NGAD` user with
`institution_admin` and `global_admin=1`. No other users' authentication changes.

## Before the test

1. Deploy the updated Worker source from `main` to `zdnp-platform`. Merging a
   GitHub branch is not proof that the Cloudflare Worker is deployed.
2. In Cloudflare Workers > `zdnp-platform` > Settings > Variables and Secrets,
   configure `NGAD_TEST_LOGIN_TOKEN` as a **Secret** with at least 48 random
   characters (64+ recommended). **Never put its value in GitHub, URLs, logs,
   or chat.** Do not use the existing NGAD password as this token.
3. Configure `NGAD_TEST_LOGIN_UNTIL` as a Worker **text variable** in UTC ISO-8601
   format, for example `2026-11-18T16:00:00Z` if that time is still in the
   future. It must be **no more than four hours ahead**. These two values must
   be deployed to the same active Worker version.
4. Visit `https://zdnp.org/najava?ngad-test=1` (or the identical path on
   `www.zdnp.org` if that is the hostname actually routed to the Worker).
   Enter only the new test token; the normal account password is not needed.

The token is **single-use**: a D1 transaction saves an expired unique marker
and a 30-minute session together. A later attempt to reuse that token is
rejected. Both session cookies are `Secure`, `HttpOnly`, `SameSite=Strict` and
host-specific; stay on the same hostname for the whole session.

`must_change_password=1` is bypassed only for a verified test session so NGAD
can inspect the staging panel without changing the existing account password.
The test exception expires after 30 minutes, sooner if the configured deadline
is reached, or immediately if the Worker secret is removed/rotated. Ordinary
logins and all other users keep the existing password policy.

## After the test

1. Log out.
2. Delete `NGAD_TEST_LOGIN_TOKEN` and `NGAD_TEST_LOGIN_UNTIL` from the Worker,
   and deploy the configuration change.
3. Remove the temporary endpoint and UI in the next code cleanup.
4. Rotate the original NGAD password privately; previous credentials appeared
   in historical troubleshooting messages.

## Troubleshooting

- HTTP `404` on the test login endpoint: secret missing, expired/too-distant
  deadline, wrong token, or Worker code not yet deployed.
- HTTP `409`: wrong NGAD role/permission, previously used token, or D1 session
  transaction unavailable. Check the structured Worker log event.
- Test accepted but panel unavailable: inspect `/api/me` and panel API responses;
  do not reuse the consumed token. An existing test session can be refreshed
  from the same browser until it expires.
