# Acceptance test matrix (to automate after backend implementation)

| Scenario | Expected |
|---|---|
| IDR educator requests PRI case | Denied without disclosure |
| Director opens unforwarded case | Denied unless separately authorized |
| Institution admin requests case body | Denied by default |
| Complaint against educator reaches that educator | Denied; confidential independent routing |
| Disabled staff account uses prior session | Denied |
| Unauthenticated user calls /api/v1/cases | 401 |
| Guess case number without tracking token | No sensitive information |
| Upload malware or unsupported content | Quarantined/rejected |
| Case reassigned across institution | Denied without documented exceptional grant |
| Staff views case | Audit event recorded |
| Repeated submit with same idempotency key | One case only |

All test identities and records must be fictional.
