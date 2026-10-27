# Prepared ITSG challenge demo

The default option for a new workflow or source upload is **Vorbereitete Challenge-Demo · ohne API**.
No API key or model connection is required. Exact SHA-256 matches load authored scenario
requirements immediately; this is a prepared demonstration, not live inference or legal certification.
Renaming the original is supported; editing, exporting or scanning it again changes its bytes
and will not match. Unrecognized files in explicit demo mode are rejected, with no model call.
Other existing live/offline modes remain available for unrelated files.

## Presentation path

1. Pull `codex/auditflow-prototype`, restart `python -m auditflow`, refresh the browser.
2. Create a workflow, select prepared demo mode, enter synthetic customer details, choose 8 cases.
3. Upload the supplied GG EEL V13.1 PDF. Its 4 prepared requirements appear immediately.
4. Start the workflow. The source report is created; inspect quotations and prepared recommendations.
5. A human reviews and approves all four requirements. Six-month boundary questions stay explicit.
6. Eight synthetic test specifications are assigned without an API. Profiles, inputs, steps and
   expectations are visible. Review expectations independently before releasing the package.
7. Download the customer package, which omits internal expected values. Actual email needs SMTP
   and explicit selection as before. A manually documented handoff is sufficient for the demo.
8. Import manufacturer observations using the existing JSON contract. No manufacturer software
   is connected. Demonstration observations must be described as synthetic, not real vendor results.
9. The comparison report is created and awaits a human final decision.

Intermediate reports stay behind the document icons. Source originals remain available in the
runtime database; selected text excerpts in demo mode do not represent extraction of the full document.
Prepared status is visible in sources, recommendations, workflow, reports and package metadata.

## Catalogue

| Supplied source | Prepared checks | Scope |
| --- | ---: | --- |
| GG EEL V13.1, 06.05.2025 | 4 | Effective 01.01.2026 |
| DTA EEL Vorerkrankung scenario DOCX | 4 | Supplied 2026 scenario |
| Vorerkrankung test-constellation notes DOCX | 3 | Supplied 2026 scenario |
| Procedure V13.4, 10.03.2026 | 4 | Effective 01.01.2027 |
| Example paper V13.3, 10.03.2026 | 3 | Effective 01.01.2027 |
| Rundschreiben 11.12.2024, Annex 3 | 3 | Selected historical/reference examples |
| Rundschreiben 10.12.2025, Annex 1 | 2 | Selected child sickness benefit examples |
| Rundschreiben 10.12.2025, Annex 2 | 2 | Selected maternity examples |
| TEEL0-Test1-DBVO, extensionless sample | 2 | Technical specimen, not normative law |

Total: **9 exact original files and 27 selected requirements**. The 406-page Annex 3 is approximately
5.54 MB: its known fingerprint bypasses the generic 5 MB file limit; the bounded HTTP upload limit
is 10 MB to accommodate base64. Unknown files keep the 5 MB decoded limit.

Do not combine 2026 and 2027 scoped files in one workflow. Create separate workflows. This
restriction does not prevent uploading all sources into the document library.

## Limits and provenance

The catalogue is a deliberately small selection, not a complete analysis of all pages or laws.
Every requirement has a source excerpt and page/paragraph/table locator. Source matching is
not substantive approval. No approval is invented or inherited simply because a file is recognized.
The notes contain a March-2025/March-2026 discrepancy; it is retained as a clarification issue.
Exact six-month boundaries remain unresolved. Some missing-data cases deliberately have null
expectations; these block package release until a human supplies and reviews the expectation.

Some cases are concrete arithmetic or DBVO conditions; others are scenario assertions requiring
human observation. Large requested counts repeat the finite prepared pattern set with distinct
synthetic profile identifiers; they do not create additional independent legal coverage. Manual
changes to a prepared criterion block the old case template, rather than silently applying it.

Only fingerprints, selected excerpts and authored requirements/case patterns are committed.
Original files and runtime databases are not committed. Existing unrelated records are retained;
old same-source model requirements become history through explicit supersession links.

## Verification

Synthetic registry tests exercise fingerprint matching, renamed duplicate uploads, unknown-file
rejection, no model calls, human gates, package/result comparison, scope separation, edited
requirements and lifecycle behavior. A separate temporary HTTP check uploaded all nine actual
provided originals and verified 27 matching citations without any model call. Browser inspection
verified the prepared requirement/recommendation view and source completion status using a
disposable preview. No live manufacturer, SMTP or model call was made.

## Direct case decisions

The package review now shows automatic prechecks inside each expandable case, with
**Genehmigen** and **Ablehnen**. Demo checks use prepared completeness/source checks;
local checks are labelled local. In live mode an approval click first requests a structured
model recommendation. A model recommendation is never a human approval. Unresolved
values/questions and recommendations for clarification cannot be approved unchanged.

No extra name/note form is needed for the case/package buttons. The current session's
reviewer label is used if available; otherwise the action is recorded as **Bediener (nicht
authentifiziert)**, explicitly not an authenticated identity. Each decision is linked to the
case content hash; edits reset its approval and preserve decision history.

After every case is decided, the final button adopts only the approved cases. At least one
approved case per requirement is mandatory. Rejected drafts remain in the intermediate
report and the workflow's excluded_cases; they are not sent, tested or counted as passing.
The delivered case count can therefore be smaller than the originally requested count.
All customer imports compare only the released package and its recalculated hash.
Expanded cases remain open across decisions and polling in the current browser page;
a full browser reload resets the expansion state. Existing cases receive precheck cards
without regenerating their original inputs or expected values.
