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

## GitHub CI observed
Workflow run https://github.com/adenispiroglu-max/Hackathon-itsg/actions/runs/40390304421 completed all four jobs successfully: backend on Python 3.11, 3.12 and 3.13; frontend JavaScript syntax. Tested code commit: `69d7a0e5f180ba85bfe7fb3397afe1798b32b7fa`. Pull request: https://github.com/adenispiroglu-max/Hackathon-itsg/pull/1.

# Active update: 0.2 bulk automation and ITSG-inspired UI

User requested end-to-end automation, then added an ITSG-style frontend requirement.
Local working branch: codex/automation-update. Publish tested files back to the existing
remote codex/auditflow-prototype branch / PR #1 so the user's existing clone can git pull.
Remote starting head: eec21eb1eff3bd7277bea6ace4492c7c77f7bf79.

Implemented: persistent software projects, versioned reviewed synthetic packages, 1–4,000
profiles/cases, analytical template expectations separate from target simulator, background
execution, paginated results, missing-safe software JSON import, JSON/CSV bulk reports,
change-impact selection, optional automatic dispatch on package approval, full suite reruns,
stop/resume and restart recovery. Existing 0.1 data/screens are preserved.

Frontend adds Automatisierung, automatically refreshed progress and ITSG-inspired red
#D50032 / white / charcoal styling. The reference color was observed in the public ITSG
site HTML. No official asset or source document was uploaded. See docs/DESIGN.md.

Important boundaries: these are authored synthetic DBVO templates, not arbitrary law-to-code
compilation; only three structured types are in bulk automation. Income/hours are metadata.
Model access remains unverified. No external payroll product or independent legal oracle is
connected. Recurring full checks are explicit actions, not a configured calendar scheduler.

Verification complete: 69 tests passed, including a 4,000-case run,
restart after a committed partial chunk, auto change dispatch and missing import results.
Legacy and automation Playwright scripts exercise desktop/mobile UI and downloads.
Update docs/VALIDATION.md with final observed results before publishing.

0.2 final local checks: all 69 unittests passed. Both browser scripts passed with no page errors; automation additionally verified result import with eight missing observations. Structured package review automatically triggers enabled project reruns; full reruns reuse profiles. Original sources and credentials remain outside the repository.


## 0.2 GitHub verification observed

Code commit `2299a3b459ad9dc44144a781936d3c516daaaee7` passed all six jobs in
https://github.com/adenispiroglu-max/Hackathon-itsg/actions/runs/40400880383:
frontend syntax, backend Python 3.11/3.12/3.13/3.14, and Windows/Python 3.14.
The user's existing clone can update via `git pull origin codex/auditflow-prototype`.
Stop the old server first, restart `python -m auditflow`, and open `/#automation`.

# 0.3 completed local checkpoint — selective ZIP integration

User approved integrating useful parts of `itsg-ai-payroll-audit (1).zip`. Inspected its
React/Base44 source and isolated problematic evaluator paths; see docs/MERGE.md.
Implemented selected UI/workflow patterns in the existing native frontend, preserving
Python startup, SQLite data and all bulk automation. This is NOT a wholesale React port,
Base44 deploy or merge of a second git history. No cloud auth/account was migrated.

New: unified dashboard/live job refresh, four workflow cards, source-specific PDF page
ranges, typed linked test drafts with rule snapshots/provenance, glossary/help and a
read-only evidence assistant for legacy reports and bulk results. Explicit offline mode
uses stored facts; explicit live mode uses Model. Request references are resolved by the
server; model markup is escaped and failures never become a fabricated AI success.
No store-wide lock is held over assistant inference. No new runtime dependencies.
Version 0.3.0; existing database entities remain compatible, no destructive migration.

Local branch codex/merge-audit-ui. Starting remote head observed
54b2e5dbb321d2c150200620c56f2621f30e273e on codex/auditflow-prototype / PR #1.
Publish verified changed files to that existing remote branch with expected-head lease,
so the user's existing Windows clone can pull normally. Do not merge main automatically.

Verification: 80 Python tests pass. Three browser suites pass at desktop/mobile with zero
page errors. New suite covers typed drafts, real local PDF range import, single/bulk
assistant evidence, escaped mocked AI output and explicit failure. Existing suite verifies
36-case fictional change regression (17 selected/19 skipped/eight detected mismatches).
Desktop/mobile screenshots inspected. Real inference, real vendor connection, normative
legal mapping, monetary calculation and multi-user identity remain outside verified scope.

Next: publish, observe CI and record exact code commit/run. Run `python -m auditflow`,
then open /#dashboard. Reports/bulk rows -> Erklären; Fälle -> Gezielte Testentwürfe;
Quellen import -> optional PDF pages; Hilfe & Ablauf -> short demo instructions.

## 0.3 GitHub verification observed

Published code commit `d7e68783117ab136e52fecd4822c1e1ea7012d2f` to the existing
`codex/auditflow-prototype` branch / PR #1. All six GitHub jobs passed in
https://github.com/adenispiroglu-max/Hackathon-itsg/actions/runs/40407389909:
backend Python 3.11/3.12/3.13/3.14, JavaScript syntax and Windows/Python 3.14.
No merge into main was performed. The user can stop the server, run
`git pull origin codex/auditflow-prototype`, then `python -m auditflow` and open
http://127.0.0.1:8080/#dashboard. Real inference remains unverified.

# 0.3.1 navigation simplification — current UI contract

User asked to remove separate Automatisierung, Prüfung starten, Änderungen,
Nachrichtenfolge and Glossar pages. Navigation now has exactly seven entries: Übersicht,
Quellen & KI, Anforderungen, Profile & Testfälle, Prüfberichte, Testabdeckung, Hilfe & Ablauf.
Manufacturer package preparation and result import are embedded once in Übersicht; its
summary is not duplicated as a second page. Quellversionen vergleichen is below document
inspection in Quellen & KI. Glossary/timeline/direct execution renderers and their action
links are removed. Old bookmarked hashes redirect to dashboard, sources or reports.

The user clarified manufacturers execute the tests. UI launch and explicit subset/full
reruns now create import-mode packages, never simulations. New packages wait for
manufacturer observations; simulation controls and fictitious fault-run buttons are not
available in the UI. Existing simulation reports remain labelled as historical simulation;
legacy APIs remain compatible for backend tests and existing integrations. No records were
deleted. Existing opted-in project events retain backend policy semantics; newly UI-created
import suites also wait for imports after rule changes.

Local branch codex/simplify-navigation; parent remote head observed
6209f2e0a27a855f2ac6f58d2db6b65983be45f2. Browser scripts updated to use the embedded
manufacturer workflow. The original smoke script exercises legacy execution compatibility
through the API and reads resulting reports through the retained UI. No user-facing
execution screen is restored by tests. See VALIDATION.md for final results before publish.

0.3.1 final local check: 80 Python tests passed (8.430 s); JavaScript syntax, compileall and diff checks passed.

# 0.3.2 minimal dashboard / icon assistant

User invoked Figma and requested a simpler, less dense UI with beautiful overview graphics
and an icon-only assistant in the corner. Created an editable Figma concept at
https://www.figma.com/design/bmj0psVtlm26tSuizevY52?node-id=2-395 using discovered library
instances, auto-layout, editable labels and vectors. Verified native node types/no image
fills and Inter typography, corrected clipped layout and SVG ring rendering. Figma values
are illustrative. No app data, original documents or credentials were uploaded to Figma.

Implemented in existing native frontend: three KPIs (package jobs, distinct generated
profiles, waiting imports), latest completed manufacturer-import ring with text legend,
next-action card, three latest package rows/Alle anzeigen, collapsed setup/change tools,
icon-only accessible chat/spark corner button and calmer shared spacing/panels/headings.
Latest result is ordered by finish time, not creation time; simulations and superseded
suite runs do not enter the graphic. Default view does not open a report or technical form.
No chart library or external font/runtime dependency. Existing package/import/review flow
is unchanged. Local branch codex/clean-dashboard; starting local commit c62a768.

Observed: 80 Python tests passed (8.304 s). All three browser suites passed at 1440/390 px
with zero page errors. Added browser checks for exactly three metrics, icon-only accessible
trigger, collapsed setup, completion-time/import-only summary semantics, graphic values
matching stored counts and expanding/collapsing the full package list. Final desktop/mobile
screenshots inspected. Sources/reviews/imports/PDF/assistant and backend 4,000-case checks
remain covered. Publish to existing codex/auditflow-prototype with expected-head lease.

# Active checkpoint — 0.5 customer audit conveyor (2026-10-27)

Latest user requests an ERP-style conveyor: customer/input files, automatic source identity
and version comparison, intermediate reports behind document icons, AI recommendations with
exact revision marks, HUMAN requirement approval, automatic case/profile drafting, reviewed
package delivery, manufacturer result import and human final sign-off.

Local branch codex/document-review-workflow. Unpublished 0.4 work is included. Remote PR #1
head observed c37cbf00ffafa278726038120e7675ce36fc9e01 on codex/auditflow-prototype.
Remote-only sidebar/polish/icons changes from 122281a were inspected and preserved locally.
Do not overwrite them or merge main. Publish verified files using expected-head lease.

Implemented documents.py/library.js: original BLOB persistence, source families/version
history, automatic compare and resumable section jobs, exact-quote validated AI recommendations,
Unicode-safe highlights, human-readable UI, merged results/coverage, new pending revisions.
Older versions stay historical; partial PDF views remain separate. Changed complete source
basis never silently inherits a human approval. Local mode never claims AI inference.

Implemented workflow.py/workflow.js: customer-bound SQLite worklist, immutable input after
start, durable phase/case cursor, requirement gate, AI 2–4 cases per approved requirement or
explicit local skeletons with unknown expectations, case/expectation review gate, snapshots,
JSON package excluding expected values, SMTP TLS auto-send opt-in, manual handoff, exact package
result import, missing-safe typed comparisons, final report and human named acceptance/rework.
Source/approval changes invalidate live packages and return to requirement review. Closed
records preserve their historic basis. Intermediate HTML/PDF reports are append-only snapshots.
SMTP ambiguous delivery is unknown, never automatically retried. Real SMTP and real AI calls
have NOT been verified; all tests use synthetic data/mocked inference and SMTP.

Observed at this checkpoint: 115 Python tests passed (14.466s); pure Node frontend contracts
pass all nine phases, escaping, report controls and Unicode marks. Current subsequent catalog/help
and polling changes still need final checks. Native cloud browser confirmed input creation,
source attachment, automatic source analysis → requirement gate and readable document-icon
report. One synthetic human decision persisted; no real rules approved. Preview uses an ignored
package.json and preview_dev.py with synthetic-only var/conveyor-preview.sqlite3; remove temporary
preview files before final handoff. Do not commit runtime DB or screenshots/originals/secrets.

Next: finish targeted backend/frontend tests, inspect updated browser flow, update docs, commit,
publish to existing PR branch, observe CI. Earlier browser suites were adapted for #packages
but are not claimed rerun for 0.5. Live AI, real mail, SAP integration, arbitrary payroll evaluation,
cryptographic signatures, official certification and multi-user auth remain unverified/out of scope.

0.5 final local checkpoint: 117 Python tests passed (15.936 s), all JS syntax/compileall/diff
checks passed; Node contracts now also verify German Ja/Nein parsing. Native browser verified
all four synthetic human approvals → automatic eight local skeletons → package gate, with
three readable intermediate reports. Final HTML/PDF includes source versions, approvals,
package release, handoff and results; signed report retains that full evidence snapshot.
Customer JSON/HTML/PDF hides internal expected values. New revisions queue fresh prechecks;
missing/stale prechecks prevent generation even after human approval. No real inference or
mail was performed. Publish next, then record actual remote SHA and CI run.
