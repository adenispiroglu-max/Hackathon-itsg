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

# 0.4 UI polish, collapsible sidebar, certification overview

Branch ui/polish-overrides (merged origin/codex/auditflow-prototype at 79dddb0; pushed c37cbf0 earlier).
Spec agreed with the user in an interview: `.plans/uebersicht-redesign-spec.md`.

Implemented:
- UI polish block and collapsible sidebar (appended to style.css/app.js): touch-safe hover,
  0.96 press feedback, 8px/12px radii, dialog scroll containment; sidebar collapses on desktop
  (localStorage `auditflow.sidebar`) and is a drawer with its own close button at <=760px.
- `auditflow/static/icons.js` + `docs/ICONS.md`: prepared SVG set, NOT wired in and not in the
  server whitelist. Next step: merge these icons into the existing `uiIcon` helper instead.
- Certification backend `auditflow/certification.py` and `/api/cert/*` routes: manufacturer,
  software version (neu, in_pruefung, freigegeben, abgelehnt; erneut_pruefen derived), manual
  transitions with reviewer and reason, approval gate (completed import job only, no fail or
  technical_error, every not_assessable accepted per case and per job, submissions decided,
  four-eyes by self-declared names), submissions in SQLite with SHA-256 (PDF/DOCX/TXT <= 5 MB),
  reminders (manual with required source note, or derived from document `valid_from`),
  90/14-day windows, overdue rule. Existing auto_projects migrate to `neu` versions, idempotent.
  Fresh demo DB seeds 3 fictional "(fiktiv)" manufacturers, 5 versions, 1 synthetic reminder.
- Frontend: overview rewritten (4 KPIs, open certifications, reminders and dates, documents to
  decide), new page `#customers` (`customers.js`), `#requirements?doc=` filter, nav badge.
  Test packages are now started from the version detail; removed from the overview.

Observed: 101 unittest tests OK (3 skipped); `node --check` passes on all static JS. Browser
checks (Windows Chrome via playwright-core, disposable DB) passed at 1440/390 for the overview,
create flow, transitions, submission upload/download/hash, import evidence with failures and
missing observations, per-job acceptances, four-eyes refusal and approval, reminders, badge
and drawer. Zero page errors, no horizontal overflow.

Limitations: reviewer names are self-declared (four-eyes is a process hint, not security).
Not verified in a browser: erneut_pruefen with an approval dated before the effective date
(unit-tested), the 8-row cap, derived document reminders, PDF/DOCX uploads and the 5 MB limit.
The official ITSG name for the approval step is unknown; labels use "Zertifizierung/Freigabe".
Restarting a server on the normal DB migrates its projects into `neu` versions (no approvals).

Next actions: update scripts/*_smoke.cjs for the new overview and page; wire icons into
`uiIcon`; remove unused CSS (.timeline*, .glossary-list) and unused `ws-waiting` /
dashboard polling in automation.js; answer the spec's open questions (section 14).

## Checkpoint 27.10.2026: document library, automatic version diff, AI pre-review, Ergebnisse & Abdeckung

Spec: `.plans/dokumente-versionen-freigaben-spec.md` (German). Binding module/API contract:
`.plans/dokumente-versionen-impl-contract.md`. Branch `feat/dokumente-versionen` (from 85924ae).

- `auditflow/library.py`: document library. `library_doc` groups versions; existing kind
  `document` now means one document version (old fields unchanged). Originals in
  `<db dir>/documents/<sha256>.<ext>`. Upload = `analyse` (sha256 duplicate rejected regardless
  of metadata; match suggestion, user must confirm; date suggestions by regex, never applied
  automatically) + `confirm` (version n+1, old versions kept, paragraph diff via difflib that
  ignores page boundaries, stored `document_diff`). PDF page-range import removed for new uploads.
  Withdraw instead of delete. Legacy documents migrate to v1 with "Originaldatei nicht gespeichert".
- `auditflow/review.py`: requirement versions (`requirement_version`, id `<req>@v<n>`), migration
  keeps approvals, affected requirements per diff, AI classification redaktionell/fachlich and
  AI revision drafts (live only), offline flag "Quelle geändert – Prüfung nötig", editorial bulk
  confirmation, approval per version with `against_ai`, validity (superseded source in force or
  valid_until passed), case inheritance/outdated/regeneration, `results()` for #results.
  AI pre-review never falls back to rules: without key "nicht verfügbar"; marks are checked
  against the real text and unprovable ones dropped. Model additions in `model.py`
  (`classify_changes`, `draft_revision`, `prereview`, prompt `requirement-review-v1`).
- `service.py`: wiring; `run()` uses `review.effective` / `case_usable`. New guard: the fixture
  checker only computes C1–C4 if the APPROVED version still cites `DOC-CRITERIA`; otherwise
  the result is not_assessable with a reason (no silent 2026-fixture/2027-rule mix).
- UI: `library.js` (Quellen & KI library, upload dialog with live steps, stored diff with
  word-level marks, editorial confirm, requirement detail with AI card, version history and
  approval form), `results.js` (#results: two SVG charts, filterable table; #reports and
  #coverage redirect). No `<pre>`/JSON in the normal flow; "Technische Details" collapsed;
  ⓘ glossary tooltips. Fictional fixture `data/demo/Synthetic demo requirements v2 (fiktiv).txt`.

Observed: `python3 -m unittest discover -s tests -q` 137 tests OK (5 skipped: PDF/DOCX packages
missing), twice in a row; `node --check` passes on all static JS. Browser walkthrough (Windows
headless Chrome via a CDP script, fresh DB, no model key): approve C2/C4 via form, upload v2
in the dialog (suggestion score 0.86, date suggestion applied), stored diff with 30→32 word
marks, C2/C4 flagged, manual C4 v2 edit + approval, scenario run (C1/C2 pass, C4 not_assessable
with fixture reason), #results 2 of 4 covered with only C4 outdated, redirects, tooltip, no
`<pre>` on 6 routes, no horizontal overflow at 390 px (sources, results, requirement detail).
Fixed during the walkthrough: re-render blocked by focus left in the closed upload dialog;
`[hidden]` buttons still shown; per-case instead of per-requirement outdated evidence; results
table overflow at phone width; pre-review thread race in tests.

Limitations: no live model run (no key), so AI classification, AI drafts and a finished
pre-review card with marks are unit-tested with a mocked model only. PDF/DOCX parsing and the
PDF blob viewer are untested here (optional packages missing). Withdrawn source versions do not
invalidate approvals (open point, spec §13). Similarity thresholds (0.45 suggestion, 0.6
paragraph pairing) are heuristics, not calibrated on real documents. Unconfirmed uploads keep
their base64 in the store (no cleanup). The "Erklären" button needs a run (no requirement-only
assistant ref yet). Automation packages keep their own approval (out of scope).

Next actions: install the optional packages and test PDF/DOCX upload + viewer; run one live
model pre-review; decide the withdrawn-version rule; add upload cleanup; add a requirement
assistant ref; update `scripts/*_smoke.cjs` for the new routes.

### Follow-up 27.10.2026 (user feedback)
- Übersicht: "+ Hersteller / Software" button removed (still on Kunden & Software).
- Kunden & Software version page: test package areas ("Testpakete", "Testpaket vorbereiten",
  rule/template packages, "Regeländerung übernehmen") hidden; `custPackages` kept, new placement
  pending discussion. Note: the approval gate still needs a completed import job, which can now
  only be started from elsewhere.
- Quellen & KI: flat document list (title, short description, current version, version and
  requirement counts, status, "Detaillierte Informationen"). Detail page lists all versions and
  all requirements extracted from any version. Optional `description` on `library_doc` (upload
  field "Kurzbeschreibung"); fallback: legacy note, else a text excerpt. Doc type stays a field.
- PDF paragraphs: line-block fallback now applies from 2 lines (was 4), so short pages split.
- Optional packages installed in `.venv` (git-ignored). Observed with `.venv/bin/python -m unittest
  discover -s tests -q`: 137 tests OK, 0 skipped. PDF upload verified in the browser dialog.
- Quellen & KI uploads: no size limit (5 MB) and no 500-page PDF limit any more; the request cap
  is lifted only for `/api/library/analyse` (other endpoints keep 7.5 MB). The DOCX zip-bomb guard
  remains (> max(1 GB, 200× file size) unpacked). Whole file is held in memory as base64 JSON, so
  very large files need matching RAM. Submissions (Einreichungen) keep their 5 MB limit.
  Fingerprint no longer shown in upload steps or version fields (still used for duplicate
  detection, visible under "Technische Details"). Drag-and-drop box in the upload dialog and on
  the Quellen page (drop or click opens the dialog with the file). Observed: 138 tests OK,
  12.2 MB TXT upload via HTTP accepted, drop on page box opens dialog with file (headless Chrome).
- Quellen & KI: "Zurückziehen" replaced by "Dokument löschen" (user decision, overrides spec
  "no delete"). `POST /api/library/delete {library_id, by, reason?}` removes the library_doc, all
  its versions, stored files, comparisons, derived "gültig ab" reminders and every requirement whose
  current or first version cites one of the versions (with requirement_version history). The audit
  log keeps a `library_delete` event (who, what). Test cases and historical runs stay; a run marks
  C1–C4 results "not_assessable" when the requirement was deleted. Store now seeds only once per
  database (empty `meta`), so deleting every document does not restore the demo data on restart.
  The withdraw API still exists but the UI no longer offers it. Observed: 140 tests OK; UI delete
  of a PDF document with 3 drafted requirements in headless Chrome.
- Profile & Testfälle: profile view restructured (`scenarioView`): key facts (Meldedatum,
  Beschäftigungsende, Versicherung) as labelled boxes above the AU table; columns Von/Bis/Tage
  (inclusive days)/Bescheinigt; German dates; certified `null` now shows "unbekannt" (was wrongly
  "Nein"); sum line of certified prior days (+ current AU). Field lists now render plain ISO dates
  as dd.mm.yyyy and map `synthetic-demo` to "Synthetische Demo-Kasse (fiktiv)". Tests: 140 OK.

## Selective port from codex/auditflow-prototype (2026-10-27)
- `send()` now writes an ASCII fallback plus an RFC 5987 `filename*=UTF-8''…` name (from prototype 9201959); inline/attachment choice kept. All current routes already pass ASCII-cleaned names, so this protects future routes; test added in test_certification.
- CI: Python 3.13 installs the optional extras from `requirements.txt` (file already existed, unchanged); node --check added for library.js, results.js, customers.js, icons.js. The Windows job already existed.
- Not ported: prototype contract scripts (they test prototype-only workflow.js/controls.js/customers.js), controls/trash, locale/dark theme, conveyor workflow, prototype Kunden and document library (incompatible store schemas for manufacturer/software_version/submission).
- Observed: 140 tests OK (5 skipped), node --check on all static JS and scripts OK, workflow YAML parses. GitHub CI not yet run on this commit.

## English interface + dark theme in settings (2026-10-27)
- Adapted from codex/auditflow-prototype (locale.js/controls.js/workspace settings), rebuilt for this branch: `meta/ui_settings` {language de|en, theme light|dark|system}; `GET /api/state` → `settings`, `POST /api/settings` (validated, event-logged). No other records change.
- `auditflow/static/locale.js`: gear button in the top bar opens Settings. English is applied after each render by translating authored text nodes and placeholder/aria-label/title attributes (exact dictionary plus number/date patterns); record content (names, requirement and source text, notes, `pre/code`, history notes) is protected and stays German. Dates follow the language (`fmt` uses en-GB/de-DE). Theme sets `html[data-theme]`; "system" follows prefers-color-scheme live.
- Dark theme CSS appended for this branch's components (cards, nav, inputs, pills, notes, quotes, diff, results bars).
- Also ported from ui/polish-overrides: evidence notice removed on the version page; upload row aligned (hint on its own row). Help text updated: the server can read HAI_API_KEY from a local .env.
- Observed: 141 tests OK (5 skipped); node --check all JS. Browser (1440 and 390, disposable DB copy): all 8 pages in EN/dark have no untranslated interface text — the 12 remaining German strings are record content; DE↔EN and light↔dark toggle without reload and persist after reload; no page errors; no horizontal scroll at 390.
- Not verified: dialogs other than Settings (e.g. upload, reminder, approve) were not walked in English. Strings missing from the dictionary simply stay German; add them to UX_EN or UX_RULES.
