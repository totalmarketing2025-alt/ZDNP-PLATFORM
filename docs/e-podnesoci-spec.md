# ZDNP e-PODNESOCI — development specification (draft)

Status: DEVELOPMENT ONLY. No live submission intake or staff accounts. No real prisoner or family personal data.

## Scope
Three separately isolated institutions: Idrizovo (IDR), Prilep (PRI), Stip (STI).
Public submission at /podnesoci, status at /status; staff sign-in at /login, protected /dashboard, /predmeti, /administracija.

## Roles
- Public submitter: create and securely track own case.
- Educator: assigned institution cases; review, request additions, forward when authorized.
- Director: authorized forwarded cases and questions; respond/decide within competence.
- Institutional admin: manage accounts and grants ONLY for own institution; no implicit access to case content.
- ZDNP technical operator: infrastructure support without routine case-content access.

## Security invariants
1. Every backend query enforces institution scope and least-privilege authorization; client UI checks are insufficient.
2. Individual MFA staff accounts; strong password hashing; session expiration and revocation.
3. Public prisoner ID is not an authentication credential; private tracking uses independent high-entropy token.
4. Sensitive complaints, especially against staff, bypass the subject of complaint and have independent confidential routing.
5. All case actions are recorded in tamper-evident audit logs; attachments are private, scanned and access-controlled.
6. No personal data in Git, client bundles, URLs, notification bodies or logs.
7. Data retention, controller/processor roles, legal basis, institutional approvals and incident response must be settled before production.

## Proposed entities
institutions, users, user_roles, prisoner_records, submitters, cases, case_assignments, case_documents, case_comments, case_decisions, case_events, notifications, access_grants.

## Workflow
Submission -> validation -> institution intake -> educator assignment -> authorized routing -> response/decision -> secure notification.
Confidential complaints use a distinct independent intake path.
Case transitions must be authorized, audited, and idempotent.

## Development stages
1. Inspect existing static website and deployment constraints.
2. Build isolated prototype with fictional data and no external submission endpoint.
3. Implement backend authorization, DB migrations, storage and secure sessions.
4. Add tests: cross-institution access denial, unauthorized director access, confidential complaints, uploads, audit.
5. Security and privacy review, institutional agreements, then controlled pilot.

## Existing repository baseline
As inspected 2026-11-11: static root index.html, assets/logo.svg, assets/hero.svg, README.md, .gitignore. No backend currently present.
Do not change main or deploy this branch without separate review.
