# Spec: Übersicht redesign: customers, certification, documents and law-update reminders

Status: agreed in interview on 27 Oct 2026. Not implemented yet.
Scope: the overview page (`#dashboard`), a new page "Kunden & Software", and the backend they need.

## 1. Goal

The overview answers four questions at a glance:

1. How many manufacturers and software versions do we administer?
2. Which software versions still wait for certification and approval?
3. Which documents wait for a review decision?
4. Which law updates are coming, and which approved software do they affect?

Test packages and test profiles leave the overview. The package workflow stays in the app and moves into the version detail page.

## 2. Terms

| Term | Meaning |
|---|---|
| Hersteller (customer) | A payroll software manufacturer. Counted once, regardless of how many products it has. |
| Software-Version | One product version of a manufacturer, e.g. "LohnPro 5.2". The unit that is counted, certified and approved. |
| Einreichung (submission) | A file a manufacturer hands in for one version (test report, declaration). Needs approve/reject. |
| Erinnerung (reminder) | An upcoming law/spec update with an effective date and a source. |
| Herstellerergebnis | Output that the manufacturer's software produced, imported as JSON (existing import mode). |

## 3. Certification model

### 3.1 Status per software version

| Status | Label | Meaning |
|---|---|---|
| `neu` | Neu | Created, review not started. |
| `in_pruefung` | In Prüfung | A reviewer started the review. |
| `freigegeben` | Freigegeben | A reviewer approved it after the gate (3.3) passed. |
| `abgelehnt` | Abgelehnt | A reviewer rejected it with a reason. |
| `erneut_pruefen` | Erneut prüfen | Approved, but a confirmed law update has taken effect. Computed at read time (3.4). |

### 3.2 Transitions

Every transition needs a reviewer name and a written reason, and writes an event to the local event log.
There is no login, so reviewer names are self-declared.

| From | Action | To | Condition |
|---|---|---|---|
| `neu` | Prüfung starten | `in_pruefung` | Manual button only. No automatic start. |
| `erneut_pruefen` | Prüfung starten | `in_pruefung` | Manual. The earlier approval stays in the history. |
| `in_pruefung` | Freigeben | `freigegeben` | Approval gate (3.3) passes. |
| `in_pruefung` | Ablehnen | `abgelehnt` | Reason required. |
| `abgelehnt` | Wieder öffnen | `in_pruefung` | Reason required. The rejection stays in the history. |

Nothing ever approves automatically. Test results are evidence, never a decision.

### 3.3 Approval gate

Approval is refused, with a message naming each blocking item, unless all of the following hold:

1. **Evidence exists**: at least one completed job in **import** mode (results from the manufacturer's software) is linked to the version.
   Simulation jobs are shown with a "Simulation · keine Freigabegrundlage" label and never count.
2. **No failures**: the latest completed import job has zero `fail` results.
3. **Unclear results accepted**: every `not_assessable` result of that job (including missing observations) has been accepted individually
   ("fachlich akzeptiert") with a reviewer name and a reason. Acceptances are stored per job and case and appear in the report.
4. **Submissions decided**: no submission for the version is still `pending`.
5. **Four-eyes rule**: the approver's name differs from every name that accepted an unclear result (comparison trimmed, case-insensitive).
   Names are self-declared, so this is a process safeguard, not a security control. The UI says so.

If a newer import job arrives after acceptances were made, the acceptances of the older job do not carry over.

### 3.4 Law updates and "Erneut prüfen"

- A reviewer confirms which versions a reminder affects (4.2). The default suggestion is all currently `freigegeben` versions.
- A confirmed version shows `erneut_pruefen` from the reminder's effective date onwards. The status is computed when it is read, so no scheduler is needed.
- The stored approval is not revoked. The history shows "Freigegeben am … · betroffen von Erinnerung … ab …".

## 4. Reminders and calendar

### 4.1 Sources

AGENTS.md forbids inventing legal rules or dates. Every reminder therefore has a source:

- **Derived from documents**: each imported source document with a `valid_from` date produces one reminder
  (title "‹Name› ‹Version› gültig ab ‹Datum›"). Idempotent per document ID.
- **Manual**: title, effective date, a required source note (e.g. document and section) and the reviewer name.

### 4.2 Affected software

The reminder detail shows a checklist of versions, all `freigegeben` versions ticked by default.
The reviewer confirms with name and reason. Only confirmed versions get `erneut_pruefen`. The list can be edited later and every change is logged.

### 4.3 Display rules

| State | Rule | Display |
|---|---|---|
| Upcoming | Effective date in the next 90 days | Normal row |
| Soon | Effective date in the next 14 days | Highlighted |
| Overdue | Effective date passed and at least one confirmed version not yet re-approved | Top of list, warning colour |
| Unconfirmed | Within 90 days and affected versions not yet confirmed | Hint "Betroffene Software bestätigen" |
| Done | Effective date passed and all confirmed versions re-approved, or none affected | Hidden from the overview |

### 4.4 Calendar

An upcoming-dates list, no month grid. It shows the reminder effective dates of the next 90 days, grouped by month, newest last.
It works at phone width.

### 4.5 Notification

In-app only: the overview panel, plus a count badge on the "Übersicht" nav item for soon and overdue reminders.
No email and no calendar export.

## 5. Documents awaiting a decision

The overview lists two kinds. Rows only link; decisions are made where the evidence is shown.

| Kind | Row content | Link target |
|---|---|---|
| Source with open requirements | Document name, version, number of `pending` requirements | `#requirements` filtered to that document (filter must be added if missing) |
| Manufacturer submission | Manufacturer · software version · file name · uploaded date | Version detail on "Kunden & Software" |

### 5.1 Submissions

- Upload PDF, DOCX or TXT, at most 5 MB, stored in SQLite with the SHA-256 hash, size, MIME type, uploader name and date.
- No text extraction. Download from the version detail.
- Approve or reject with reviewer name and reason. A decision can be changed only with a new reason, and every decision is logged.

## 6. Overview page layout

From top to bottom:

1. **Heading**: "Übersicht" / "Alles Wichtige im Blick." and a primary button "+ Hersteller / Software", which opens the create dialog.
2. **KPI row (4)**, each one clickable to its list:
   - Hersteller: number of manufacturers.
   - Software-Versionen: number of versions.
   - Offene Zertifizierungen: versions in `neu`, `in_pruefung` or `erneut_pruefen`.
   - Dokumente zur Freigabe: pending submissions plus documents with pending requirements.
3. **Two columns**:
   - Left, **Offene Zertifizierungen**: grouped by manufacturer, oldest waiting first. Each row shows the version, a status pill, "wartet seit" and one hint:
     "Wartet auf Herstellerergebnisse", "‹n› Einreichungen offen", "‹n› unklare Ergebnisse", "‹n› Fehler im letzten Ergebnis" or "Bereit zur Freigabe".
     At most 8 rows, then "Alle anzeigen" → "Kunden & Software".
   - Right, **Erinnerungen & Termine**: the reminders (4.3) above the upcoming-dates list (4.4), plus a "+ Erinnerung" button.
4. **Dokumente zur Freigabe**: the list from section 5.
5. Scope caption (existing): synthetic demo, manufacturers run the tests, no automatic approval.

**Removed from the overview:**
- the KPIs Testpakete, Testprofile and Warten auf Ergebnisse (the last becomes a row hint);
- the "+ Testpaket" button;
- the "Letztes Herstellerergebnis" ring graphic, which moves to the version detail;
- the "next step" card;
- the manufacturer workspace section.

**Empty states** for each panel name the next action, e.g. "Noch keine Hersteller. + Hersteller / Software".
At phone width the columns stack: KPIs in a 2×2 grid, then certifications, reminders and documents.

## 7. New page "Kunden & Software" (`#customers`)

- New nav item between "Übersicht" and "Quellen & KI", with an icon added to the existing `uiIcon` set (one icon system).
- **List**: manufacturers with their versions, a status pill per version, filters by status and search by name.
- **Create dialog**: choose an existing manufacturer or type a new one, then software and version. Duplicates are rejected (trimmed, case-insensitive).
- **Version detail**:
  - status and the full history (transitions, reasons, reviewers, reminder links);
  - actions: Prüfung starten, Freigeben, Ablehnen, Wieder öffnen, each allowed only in its valid status;
  - gate checklist (3.3), with each item marked ok or blocking and the reason;
  - evidence: latest import job summary with the moved ring graphic, a link to the job report, and the not-assessable cases each with "Akzeptieren";
  - simulation jobs listed separately and labelled as not counting;
  - submissions: upload, list, download, approve/reject;
  - test package entry point: the existing project and package dialogs, relocated here and linked to this version.

## 8. Data model (new store kinds)

```
manufacturer      { id, name, created_at, created_by, scope:'synthetic_demo'|'user' }
software_version  { id, manufacturer_id, software, version, status, project_id|null,
                    history:[{at, action, from, to, reviewer, note, ref?}],
                    acceptances:{ job_id: { case_id: {reviewer, note, at} } },
                    created_at, created_by }
submission        { id, version_id, name, mime, size, sha256, data_base64,
                    status:'pending'|'approved'|'rejected', uploaded_by, uploaded_at,
                    decisions:[{at, approve, reviewer, note}] }
reminder          { id, title, effective_date, source:{type:'document'|'manual', document_id?, note},
                    created_by, created_at,
                    affected:{version_ids:[], confirmed_by, confirmed_at, note}|null,
                    changes:[{at, reviewer, note, version_ids}] }
```

- `software_version.project_id` links to the existing `auto_project`, so existing import jobs serve as evidence.
- `erneut_pruefen` is not stored. It is derived from `freigegeben` plus a confirmed reminder with `effective_date <= today`.
- `/api/state` returns submission metadata only, never `data_base64`.

### 8.1 Migration of existing data

On startup, idempotently:

- For each `auto_project` without a linked version, create or find the manufacturer by name (trimmed, case-insensitive) and create a version with status `neu` and `project_id` set.
- Existing jobs stay linked through the project.
- Nothing is approved.

## 9. API (new)

All writes need a reviewer name and a reason where a decision is made. Errors use the existing `{error}` shape.

| Method | Path | Body |
|---|---|---|
| POST | `/api/cert/version` | `{manufacturer_id | manufacturer_name, software, version, reviewer}` |
| POST | `/api/cert/transition` | `{version_id, action: start|approve|reject|reopen, reviewer, note}` |
| POST | `/api/cert/accept` | `{version_id, job_id, case_id, reviewer, note}` |
| POST | `/api/cert/submission` | `{version_id, name, base64, reviewer}` |
| POST | `/api/cert/submission/review` | `{id, approve, reviewer, note}` |
| GET | `/api/cert/submission/<id>` | file download |
| POST | `/api/cert/reminder` | `{title, effective_date, source_note, reviewer}` |
| POST | `/api/cert/reminder/affected` | `{reminder_id, version_ids, reviewer, note}` |

`/api/state` gains `certification: {manufacturers, versions, submissions, reminders, today}`.
The server's date is used for every date rule.

## 10. Demo seed

- Two or three clearly fictional manufacturers with names marked "(fiktiv)", each with one or two versions, all in status `neu`.
- One reminder from a synthetic seed document with `valid_from`. If the seed document has no date, use a manual reminder with source note "Synthetische Demo-Erinnerung".
- No real law dates and no approvals in the seed.

## 11. Implementation notes

- **Backend**: new module `auditflow/certification.py`, standard library only. Routes go in `server.py`, persistence uses the existing `store.py` kinds, and every change writes an event.
- **Frontend**:
  - the dashboard renderer in `workspace.js` and the new page renderer;
  - an added entry in the `pages` list and the `renders` map in `app.js`;
  - styles appended to `style.css`;
  - no CDN and no build step.
- **Parallel work**: another machine also edits `workspace.js`, `app.js` and `style.css`. Pull before starting and merge often. Keep new CSS in one appended block.

## 12. Tests (unittest, temporary databases)

- Transitions: allowed and refused for each status; reviewer and reason required; history entries written.
- Gate: refused without an import job; refused on a fail; refused on an unaccepted not-assessable result; refused with a pending submission; refused by the four-eyes rule; simulation jobs never count; acceptances don't carry over to a newer job; passes when all hold.
- Reminders: derived from `valid_from` and idempotent; manual reminders need a source note; the 90/14-day windows and the overdue rule computed with an injected "today"; `erneut_pruefen` derived only for confirmed versions after the effective date.
- Submissions: type and size limits, hash stored, `/api/state` without file data, download route.
- Migration: existing projects become `neu` versions once, and nothing is approved.
- HTTP routes for all new endpoints, including error cases.
- Run `node --check` on all JS files, and update the browser smoke scripts for the new overview and page at 1440px and 390px.

## 13. Non-goals

- No automatic approval or revocation; no email, calendar export or scheduler.
- No real ITSG, insurer or vendor connection; no legal validity claims. Labels keep the "synthetic demo" scope.
- No month-grid calendar.
- No authentication. Reviewer names stay self-declared.

## 14. Open questions

- What does ITSG call its approval step officially (e.g. "Systemuntersuchung", "Zertifizierung", "Zulassung")? Labels should use the official term. Not to be invented.
- Does `#requirements` already support filtering by document? If not, the filter is part of this work.
- Should a certification have a deadline or a target date (e.g. before the law's effective date)? Not modelled now.
