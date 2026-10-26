# Validation log

## First checkpoint
- 38 unittest tests passed (calendar, fixture parsing, service workflows, model failures, HTTP/API behavior).
- JavaScript syntax and Python compilation passed.
- Original sample parsed as 4 AU periods, DBVO starting at byte 350, AZVU distinct from reference ID.
- Real inference connection attempt received HTTP 403. No successful model inference claimed.

This demonstrates internal implementation behavior within the documented fixture scope. It does not establish normative/legal correctness or conformance of external payroll software.

## Repository data policy
Automatic review rejected original fixture and original source-excerpt uploads. The checked-in seed is now entirely authored synthetic content with new dates/references. Original-file checks were local only. Normative source grounding must be established by importing authorized originals and reviewing mappings.

## Final functional checkpoint
- **44 unittest tests passed** in the available Python environment, including PDF generation.
- Browser E2E: nine application views at 1440 px and 390 px, no page errors or body overflow.
- E2E exercised rule and expectation reviews, a passing synthetic file, wrong-AZVU failure,
  JSON/PDF downloads, four pending boundary drafts, TXT import and literal draft extraction.
- Browser testing caught and fixed a form `id` shadowing bug and a mobile grid overflow.
- PDF report inspected programmatically for readable nonempty pages.
- Optional live test generation is implemented but actual inference remains unverified (403).
- GitHub Actions configuration added; cloud CI results are not claimed until observed.

Reproduction: `scripts/browser_smoke.cjs` requires Playwright/Chromium and a disposable local
server database; the guard prevents accidental execution without explicit test opt-in.

## GitHub CI observed
Workflow run https://github.com/adenispiroglu-max/Hackathon-itsg/actions/runs/40390304421 completed all four jobs successfully: backend on Python 3.11, 3.12 and 3.13; frontend JavaScript syntax. Tested code commit: `69d7a0e5f180ba85bfe7fb3397afe1798b32b7fa`. Pull request: https://github.com/adenispiroglu-max/Hackathon-itsg/pull/1.
