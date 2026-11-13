# NGAD login diagnostic checklist

This audit does not modify production authentication or expose secrets.

## Confirmed
- D1 user NGAD exists and is enabled.
- The user locally verified their chosen password against the generated PBKDF2-SHA256 hash.
- D1 contains the exact hash from the local SQL reset.
- A failed login incremented failed_attempts to 4, indicating the request reached the D1 user record.
- GitHub main's PBKDF2 uses UTF-8 bytes of the salt string, 310000 iterations, SHA-256, 256 derived bits.

## Remaining hypotheses
1. The live Worker version differs from GitHub main.
2. The login request sends different password bytes (autofill, whitespace, Unicode, input handling).
3. The Worker uses a different D1 binding/environment than the console inspected.
4. The active account may now be locked after another attempt.

## Safe verification procedure
1. Do not attempt another login until failed_attempts and locked_until are checked.
2. Compare live Worker source/deployment to the GitHub main source; deployment metadata alone is insufficient.
3. Verify the login page sends the exact user-entered password as a JSON string, without trimming or transformation. Do not log password contents.
4. Check the D1 binding name and database ID for the live deployment.
5. Use a disposable test user with a non-sensitive test password for end-to-end validation; do not change NGAD during diagnostics.
6. Rotate NGAD's password privately after diagnosis because earlier credentials/hash were disclosed.

## Security guardrails
Never log, paste, or commit passwords, hashes, cookies, tokens, or production SQL dumps. Avoid extra authentication attempts that could trigger lockout.
