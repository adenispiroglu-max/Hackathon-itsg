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
