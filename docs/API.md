# Local HTTP API

Same-origin JSON API. API errors have `{ "error": "..." }` and a non-2xx status.
If `AUDITFLOW_ACCESS_TOKEN` is configured, send `Authorization: Bearer <local access token>`.
This is separate from the model API key, which never reaches the browser.

| Method | Path | Purpose / request |
|---|---|---|
| GET | `/api/health` | Runtime health and version. |
| GET | `/api/state` | Sources, rules, cases, reports, coverage, model configuration state. |
| GET | `/api/events` | Local traceability events. Not externally tamper-proof. |
| POST | `/api/import` | `{name, version, valid_from?, base64}`; TXT/MD/PDF/DOCX, ≤5 MB. |
| POST | `/api/draft` | `{document_id, section_id, mode: "offline" or "live"}`; pending candidates. |
| POST | `/api/verify` | `{id}`; exact linked-source quotation check. |
| POST | `/api/review` | `{kind: "requirement" or "case", id, reviewer, note, approve: true/false}`. |
| POST | `/api/cases` | `{name, scenario, expected_message: true/false/null, expectation_source}`. |
| POST | `/api/generate` | `{case_id, mode: "boundary" or "live"}`; C1/C2/C4 approval required; outputs pending. |
| POST | `/api/run` | `{case_id, mode: "scenario" or "message", software_mode?: "healthy" or "buggy", mutation?, base64?}`. |
| POST | `/api/diff` | `{old_id, new_id}`; structurally matched sections and direct dependents. |
| POST | `/api/model/test` | `{}`; real connection request, no fabricated fallback success. |
| GET | `/api/runs/<id>` | Frozen JSON report download. |
| GET | `/api/runs/<id>/pdf` | PDF report download; optional reportlab required. |

## Status semantics

- Requirement quotation state and substantive review state are separate.
- Scenario rules describe **eligibility**, not a verdict on a real software product.
- A correctly suppressed simulated message can match its expectation even when eligibility is false.
- Message-mode rules judge whether the imported enquiry meets the limited fixture checks.
- Overall pass requires required approvals and a complete applicable comparison.
- Unsupported/unresolved context yields `not_assessable`; malformed input/execution yields `technical_error`.
- Existing reports contain frozen case and rule snapshots. Coverage marks results stale after changed reviews.

## Example

```json
{
  "case_id": "CASE-001",
  "mode": "message",
  "mutation": "wrong_azvu"
}
```

The response includes `overall_status`, `rule_status`, `comparison_status`, per-rule results,
raw/scenario evidence, checker/parser versions, input hash and limitations. No actual payroll
software is called by this endpoint.

## Narrow implementation boundaries

Only `fixture-2026` has executable rules. Newly extracted requirements remain unmapped even
if approved; arbitrary legal text is not compiled into executable code. Supporting a new
ruleset requires a reviewed implementation and independent fixtures. There is no public
multi-user permission model, hosted deployment or real insurer connector.

## Automation 0.2

The persistent bulk workflow, supported package schemas, imports, automatic change events
and new endpoints are documented in `AUTOMATION.md`. Single-case APIs remain compatible.

## Adapted workspace 0.3

- `POST /api/import`: additive `pages_from` / `pages_to` positive integer fields for PDF
  only. Both must be present if either is supplied; inclusive range <=100 pages. A range
  past the PDF is rejected. Original section IDs/page numbers and whole-file hash remain.
- `POST /api/generate`: existing `boundary` / `live` modes remain; `template` adds offline
  typed drafts. `test_type` is `positive`, `negative`, `boundary`, or `missing_data`.
  Generated cases retain requirement IDs/snapshots, model_id, prompt_version and mode.
- `POST /api/assistant/explain`: `{question, mode: "offline"|"live", ref}`. For a single
  report use `ref:{kind:"run",id, finding_id?}`; for a bulk result use
  `ref:{kind:"automation",job_id,case_id}`. Server-resolved evidence only. Output contains
  answer, explicit mode/model/prompt version, evidence, next_steps and scope note.
  Unknown references, missing question/evidence or unsupported modes are errors. Existing
  access token and same-origin requirements apply. Live inference failures return 502.
  The endpoint has no approval/update capability and does not hold the store lock over
  network inference. No persistent chat history is created.

## Document library and requirement versions (0.4)

Shapes are defined in `.plans/dokumente-versionen-impl-contract.md`.

- `POST /api/library/analyse` `{name, base64, version_label, doc_type?, valid_from?, valid_until?}`:
  duplicate (by SHA-256 only, nothing stored) or `upload_id` + match `suggestion` + `date_suggestions`.
- `POST /api/library/confirm` `{upload_id, library_id|null, title?, doc_type?, valid_from?, valid_until?}`:
  stores the version and the original file, builds the diff, updates affected requirements;
  returns `document`, `library_doc`, `diff`, `steps`, `summary`.
- `GET /api/library`, `GET /api/library/version/<id>`, `GET /api/library/version/<id>/text`,
  `GET /api/library/version/<id>/file` (`?download=1` = attachment, else inline), `GET /api/library/diff/<id>`.
- `POST /api/library/withdraw` `{document_id, reason, by}`. Versions are never deleted.
- `POST /api/requirements/edit` `{id, title?, criterion?, conditions?, exceptions?, source_excerpt?, reason}`,
  `POST /api/requirements/prereview` `{id}`, `POST /api/requirements/accept-suggestion` `{id}`,
  `POST /api/requirements/editorial-accept` `{diff_id, reviewer, note, change_ids?}`,
  `POST /api/requirements/reclassify` `{diff_id, change_id, classification:'fachlich'}`,
  `GET /api/requirements/<id>/versions`.
- `POST /api/review` with `kind:'requirement'` approves the current version; against an AI
  recommendation other than "Freigabe empfohlen" the note must have at least 20 characters
  and the record gets `against_ai:true`.
- `GET /api/results`: data for "Ergebnisse & Abdeckung"; also in `/api/state` as `results`,
  next to `library`. `/api/import` and `/api/diff` stay for compatibility; the UI no longer uses them.
