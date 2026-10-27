# Contract: Demo-Login und Herstellerportal

Decided with the user on 27.10.2026:
- **Demo login**, no real security: choose a fictional account. Every screen says
  "Demo-Anmeldung – keine Sicherheitsfunktion".
- A manufacturer can: see the status of their own software versions, submit documents
  (Einreichungen), download test packages and upload result JSON, read ITSG decisions.
- The **server** returns only the manufacturer's own data (not just a UI filter).

Code style: match the surrounding code (dense, standard library only, German UI strings,
`InputError` for user errors, `store.event(...)` for the audit log). No external CDN, no build step.
Never invent legal rules. Demo data stays labelled fictional.

## 0. File ownership (strict)

| Owner | Files |
|---|---|
| Worker BE | `auditflow/portal.py` (new), `tests/test_portal.py` (new) |
| Worker UI | `auditflow/static/portal.js` (new), `auditflow/static/portal.css` (new) |
| Integrator | `server.py`, `service.py`, `app.js`, `index.html`, existing tests, docs, HANDOFF.md |

Another Claude session is editing `workspace.js`, `style.css` and `locale.js` right now in a
different worktree. Nobody here edits those three files.

## 1. Accounts and sessions (Worker BE)

```
account = { id, role: 'pruefer'|'hersteller', name, manufacturer_id? }
  'pruefer'            -> name 'ITSG-Prüfer (Demo)'
  'm:<manufacturer_id>' -> role 'hersteller', name = manufacturer name (all are fictional demo data)
session (store kind 'session') = { id: <token>, account_id, created_at }
```
- `Portal(store, certification, automation)`.
- `accounts()` -> list of accounts (pruefer first, then manufacturers sorted by name).
- `login(body)` `{account_id}` -> `{token, account}`; token `secrets.token_urlsafe(32)`;
  event `portal_login` (account id and name, never the token).
- `logout(token)` deletes the session (`store.delete_many([('session',token)])`); event `portal_logout`.
- `account_for(token)` -> account or None (None if session or manufacturer no longer exists).

## 2. Manufacturer API (Worker BE) — every method takes the account and checks ownership

Raise `Forbidden` (define `class Forbidden(Exception)` in portal.py) when a version, job or
submission does not belong to `account['manufacturer_id']`, or when the account is not a
manufacturer. The integrator maps it to HTTP 403.

- `overview(account)` ->
```
{ manufacturer: {id, name},
  versions: [{ id, software, version, status, status_label, hint_text, waiting_since,
               missing: [str],            # gate items that are not ok, as readable German text
               decisions: [{at, label, note, by}],   # from version history: transitions with reviewer + note
               submissions: [{id, name, size, uploaded_at, uploaded_by, status, status_label,
                              decisions: [{at, label: 'Angenommen'|'Abgelehnt', note}]}],
               packages: [{ job_id, name, created_at, status, status_label, waiting: bool,
                            total, counts: {pass, fail, not_assessable} | None }] }],
  notice: 'Demo-Anmeldung – keine Sicherheitsfunktion. Daten sind fiktiv.' }
```
  Status labels: `neu` 'Neu', `in_pruefung` 'In Prüfung', `freigegeben` 'Freigegeben',
  `abgelehnt` 'Abgelehnt', `erneut_pruefen` 'Erneut prüfen'. Use `certification.view(v)` for
  status, hint, gate and history. Packages = automation jobs (`auto_job`) of the version's
  `project_id` with mode 'import' (simulations are never shown to the manufacturer).
  **Never include**: requirements, AI pre-reviews, internal acceptances of unclear results,
  other manufacturers, expected outcomes, `data_base64`.
- `package_input(account, job_id)` -> `automation.export(job_id,'input')` after the ownership check.
  This export contains no expected outcomes (verify in a test).
- `import_results(account, body)` `{job_id, records}` -> ownership check -> `automation.import_results(body)`.
- `submit(account, body)` `{version_id, name, base64}` -> ownership check ->
  `certification.submit({...body, 'reviewer': account['name']})` (field name in certification is
  `reviewer`, it becomes `uploaded_by`). 5 MB limit of submissions stays.
- `download_submission(account, id)` -> own submissions only -> `certification.download(id)`.

## 3. HTTP (integrator wires; UI consumes)

Session cookie `af_session` (HttpOnly, SameSite=Strict, Path=/). UI uses `fetch` with
`credentials: 'same-origin'` (default) — no token handling in JS.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET  | /api/portal/accounts | | `[account]` |
| GET  | /api/portal/me | | `{account}` or `{account: null}` |
| POST | /api/portal/login | `{account_id}` | `{account}` + Set-Cookie |
| POST | /api/portal/logout | `{}` | `{ok: true}` + cookie cleared |
| GET  | /api/portal/overview | | overview() |
| GET  | /api/portal/package/<job_id> | | JSON download (attachment) |
| POST | /api/portal/import | `{job_id, records}` | job |
| POST | /api/portal/submission | `{version_id, name, base64}` | submission meta |
| GET  | /api/portal/submission/<id> | | file download |

Server rule: a request with a **manufacturer** session gets 403 on every `/api/*` path except
`/api/health` and `/api/portal/*`. No session = existing behaviour (keeps all tests and scripts
working; documented as demo limitation).

## 4. UI (Worker UI)

`portal.js` is loaded **after** `locale.js` and `app.js`. It exposes:
```js
window.portalGate = async () => 'pruefer' | 'hersteller' | 'login'
```
The integrator changes app.js to `await portalGate()` before the first `load()`:
- `'pruefer'`: normal app continues; portal.js adds the account name and an "Abmelden" button
  to `.header-right`, and pre-fills the remembered reviewer name (`custRemember(name)` exists).
- `'hersteller'`: portal.js owns the page: adds `body.portal-mode`, renders its own nav
  (Übersicht, Einreichungen, Testpakete, Entscheidungen — or a single page with sections; your
  choice, keep it simple) into `#nav`, renders into `#content`, handles its own `hashchange`
  (routes prefixed `#portal`), hides the reviewer-only controls (assistant button, Zugang, refresh
  can stay). app.js does not call `load()`.
- `'login'`: full-screen login page (inside `#content`, sidebar hidden via `body.login-mode`):
  AuditFlow brand, title, the demo notice, two groups "ITSG-Prüfung" and "Hersteller (fiktiv)",
  one button per account; after login reload the page (`location.reload()`).

Manufacturer page content (from `/api/portal/overview`):
- per version: status pill, hint, "Was noch fehlt" list, decisions timeline (readable labels).
- Einreichungen: list with status and ITSG decision notes; upload (drag-and-drop box like
  Quellen & KI: `.drop-box` pattern, PDF/DOCX/TXT, max 5 MB) per version.
- Testpakete: list; for waiting packages "Testpaket herunterladen (JSON)" and "Ergebnisse
  hochladen (JSON)" with a short explanation of the result format
  `{"records":[{"case_id":"…","observed":{"message_present":true|false|null}}]}`.
  Completed packages show counts (bestanden / fehlgeschlagen / nicht beurteilbar).
- Empty states in plain German ("Noch kein Testpaket bereitgestellt. ITSG stellt es bereit.").

Translation: `locale.js` translates authored German strings through the `UX_EN` dictionary.
Add your strings in portal.js: `Object.assign(UX_EN, {'Deutscher Text':'English text', …})`
(only works because portal.js loads after locale.js). Keep sentences short and stable.

Styles: only in `portal.css` (new file; integrator adds the `<link>` and the static route).
Reuse existing classes (`panel`, `btn`, `pill`, `field-list`, `cert-empty`, `drop-box`,
`table-wrap`) and CSS variables. Must work at 390 px width and in the dark theme (existing
tokens). No `<pre>`/raw JSON in the normal flow.
