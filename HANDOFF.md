# Continuation checkpoint — AuditFlow

## User goal
Build the complete ITSG hackathon solution in `adenispiroglu-max/Hackathon-itsg`.
User authorized coding, GitHub work and autonomous routine implementation. Roughly 15 hours were available when starting.
Hessian.AI is optional if unavailable. Only supplied data exists; no payroll-software connection.
User requested checkpoints so another AI can continue if context runs out.

## Repository baseline
- Private repository, originally README only.
- Base commit: `556a5491d3d87f51fc9edc791fc364935d9a6a86`.
- Work branch: `codex/auditflow-prototype`.
- No Base44 app existed in the repository. A portable local Python/web application was implemented instead.

## Implemented
- Durable SQLite store, all original approvals pending, provenance and local hash-linked events.
- Fully authored synthetic demo documents and profiles. Original documents were inspected locally but are NOT in the repository.
- Four mapped fixture rules C1–C4; independent source matching and substantive review gates.
- TXT/PDF/DOCX import; literal offline draft mode; optional real model extraction with validation.
- Optional model adapter using the endpoint/model IDs on the supplied handout; no key committed.
- Eight synthetic/historical fixture cases, 29/30/31-day thresholds and explicitly unresolved boundaries.
- Scenario simulation, always-send bug simulator, synthetic sample import and five controlled mutations.
- Sample-specific byte-position parser, checks, explicit incomplete/technical states and snapshots.
- German responsive UI: dashboard, sources, rules, cases, checks, reports, coverage, changes, reference timeline.
- JSON/PDF downloads, local server access token option and no external frontend dependencies.

## Verified so far
- `python -m unittest discover -s tests -v`: 38 tests passed at first backend checkpoint.
- `node --check auditflow/static/app.js`: passed.
- `python -m compileall -q auditflow`: passed.
- Live model attempt: HTTP 403 from execution environment. Do not report successful inference.
- See docs/VALIDATION.md for subsequent verification updates.

## Critical limitations
- Parser layout inferred from one fixture, not confirmed technical annex; only 41 fully supported.
- The timeline documents the full source scenario; it does not execute all message types.
- Only four illustrative fixture criteria are executable; generated arbitrary rules remain unmapped.
- Simulator and checker share logic; an independent vendor/reference implementation is absent.
- Exact date boundaries and typo in March fixture require ITSG confirmation.
- No monetary-benefit calculation/certification, no real insurer/target software, no production hardening.
- Credential exists only outside repo in current execution scratch/process environment. Never reproduce it.

## Run
`python -m auditflow` from repo root. Open http://127.0.0.1:8080.
Optional imports/exports: `python -m pip install -r requirements.txt`.
Tests: `python -m unittest discover -s tests -v`.
Use a temporary AUDITFLOW_DB for demos/tests rather than changing shipped seed defaults.

## Next actions
1. Finish browser end-to-end checks and inspect desktop/mobile layouts.
2. Add/verify backend-2 generated boundary drafts and optional model-backed test drafting if time permits.
3. Record all observed verification results, capture demo evidence and improve UX defects found.
4. Finish docs/API, architecture, pitch script and demo fallback.
5. Commit tested source and updated notes to GitHub; open a reviewable PR without merging main automatically.
6. If continuing beyond prototype, obtain authoritative technical annexes and actual payroll exports first.

## Automatic upload review
The original raw fixture and later original source excerpts/scenario identifiers were rejected for GitHub upload by automatic review. Do not retry uploading them indirectly. The repository data was replaced with entirely authored demo statements, new synthetic dates and generic IDs. A separate local-only source copy may exist in the originating scratch workspace; do not export it without resolving authorization.

## Latest completed checkpoint
- Added deterministic boundary generation and optional model test drafting; all outputs pending.
- Fixed browser form submission (`name="id"` shadowing form.id) using getAttribute('id').
- Fixed mobile grid overflow and verified all nine views at desktop/mobile widths.
- **44 tests passed**; E2E passed reviews, golden synthetic file, mutation failure, downloads,
  boundary drafts, document import and literal extraction with zero page errors.
- Added scripts/browser_smoke.cjs and GitHub Actions configuration.
- Added docs/API.md, docs/ARCHITECTURE.md, docs/PITCH.md and updated validation notes.
- First GitHub checkpoint commit: `4aee193d4cad7d2dfb90fd72559da1ed571f4e85`.

## Remaining external dependencies
Only real inference access (403 here), normative technical annexes, expert confirmation of
boundary rules and a vendor sandbox remain unverified. Do not describe the prototype as
full EEL certification, independent benefit calculation or a live payroll audit.

## Final handoff priorities
The implementation and documented demo are ready for local use. Run the README start commands and import authorised originals locally. The next substantive improvement is authoritative source-to-executable-rule mapping plus independent software/reference validation, not additional cosmetic code. UI regression script and backend tests should be rerun after changes.
