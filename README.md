# AuditFlow

**ITSG DTA-EEL hackathon prototype: sources → reviewed requirements → synthetic cases → evidence.**

A complete local demo with three Python backend modules and a responsive German web UI.
Core runtime uses Python's standard library. No Node build, cloud account or model key is needed to explore the offline workflow.

## Start on Windows

Install Python 3.11 or newer. Open PowerShell in this repository:

```powershell
python -m pip install -r requirements.txt
python -m auditflow
```

Open **http://127.0.0.1:8080**. Or double-click `START_WINDOWS.bat` after installing Python.
The optional packages enable PDF/DOCX imports and PDF exports. Without them, the synthetic demo sources, TXT imports, checks and JSON exports still work.

## Start on macOS / Linux

```bash
python3 -m pip install -r requirements.txt
python3 -m auditflow
```

## Demonstrate in five minutes

1. Open **Anforderungen**. Inspect the authored demo statements for C1–C4. Record your own review decisions and reasons. All rules start pending; no human approval is fabricated.
2. Open **Profile & Testfälle**. Inspect `CASE-001`, review its expected request and its synthetic scope. Approve only within an explicitly acknowledged demo scope.
3. **Prüfung starten → DBVO-Datei prüfen → Synthetische Demo-Fixture**. With the relevant approvals, the narrow fixture checks and comparison pass.
4. Choose **Fehler einbauen: falsches AZVU**. The expectation comparison detects the mutation.
5. Review `CASE-002`, then run **Szenario-Simulation** with healthy and buggy behavior. A missing certificate should prevent an enquiry; the buggy simulator always sends it.
6. Open the report, source excerpts, input snapshot and JSON/PDF export.
7. Demonstrate an open AU or exact six-month boundary. Unresolved assumptions remain **not assessable**.

A scenario eligibility failure is not itself a software defect: a correctly suppressed message can pass its expected-behavior comparison. In message mode, an ineligible enquiry is a rule failure. The report labels these axes separately.

## Scope and honesty

- Four illustrative DBVO-like demo criteria and Abgabegrund 41, using a fully synthetic 2026 profile.
- Original documents are not distributed in GitHub. Import your authorized source documents through the UI. All shipped source statements are authored synthetic demo material, not legal authority.
- Sample-specific fixed-width parser, **not** a verified general technical DTA-EEL implementation. Unsupported blocks/records fail explicitly.
- No payroll vendor integration, real insurer exchange, official certification or independently implemented benefit calculation.
- The 41→61→01→61→88→01→62 scenario is shown as a sourced timeline. Only a synthetic 41 file has executable raw-file support.
- Exact six-month boundaries, twelve-month clipping and uncertified periods with seamless follow-up require specialist clarification. Open-AU counting requires an explicit policy and is not auto-approved.
- Simulator and condition checker share logic. This is not independent software validation.
- Verified citation ≠ approved interpretation. Generated requirements are drafts without executable mappings.
- Reports retain their scenario and requirement snapshots. The local event hash chain supports traceability, **not tamper-proof external audit storage**.

## Optional model connection

The organizer handout specifies an OpenAI-compatible chat route and two model IDs. The adapter defaults to the shown GLM option. Credentials must be supplied locally:

```powershell
$env:HAI_API_KEY = Read-Host "Team API key"
$env:AUDITFLOW_MODEL = "vllm/GLM-Flash-Latest"
python -m auditflow
```

For hidden input in PowerShell, use a secure environment-secret mechanism; `Read-Host` above displays characters but does not put the value into command history. Never commit the real value. `.env.example` lists names; the app reads process environment and does not automatically load `.env`.

Endpoint default: `https://hip-gw.hessian.ai/v1/chat/completions`.
Alternative model shown in the handout: `vllm/Kolibri-1`.
Override `AUDITFLOW_MODEL_URL` only with a trusted HTTPS endpoint. The API key is sent to the configured endpoint.

Use **Quellen & KI → KI-Verbindung testen**. The development-environment connectivity attempt received **HTTP 403**; successful live extraction is therefore not claimed. Offline literal drafting is distinct and labelled.

## Quality checks

```bash
python -m unittest discover -s tests -v
node --check auditflow/static/app.js
```

The tests use temporary databases and synthetic review identities. They do not approve the shipped seed data. See `docs/VALIDATION.md` for observed results and limitations.

## Data and server operation

Data persists in `var/auditflow.sqlite3`; restarting does not erase approvals or reports.
Back up this file with SQLite's backup API before changing deployments. To start a separate session, set `AUDITFLOW_DB` to a new path.
Default binding is localhost. Network mode requires `AUDITFLOW_ACCESS_TOKEN`, entered by users via **Zugang**. This is a single-user/local hackathon server, not hardened production hosting. Do not expose it directly to the internet.

## Architecture and handoff

- Backend 1: `model.py`, document import/extraction/review/diff in `service.py`.
- Backend 2: scenarios, cases and coverage in `service.py`; calendar conditions in `domain.py`.
- Backend 3: `parser.py`, run orchestration/evidence in `service.py`, exports in `server.py`.
- UI: `auditflow/static/`; HTTP API: `server.py`; persistence: `store.py`.

See **`HANDOFF.md`** for exact progress, reproducible commands and next steps for another developer or AI. No credentials belong in that file.

## Fixture privacy
The committed sample is constructed from scratch with synthetic name/contact fields. No original identifying header/contact bytes are uploaded. It preserves the narrow layout, synthetic scenario dates and explicitly supplied example references. The untouched original was inspected only locally.
