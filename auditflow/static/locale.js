'use strict';
// Interface language and theme (adapted from codex/auditflow-prototype locale.js/controls.js).
// Only authored interface strings are translated. Source texts, record contents and names stay unchanged.
const UX_EN=Object.fromEntries(`Übersicht|Overview
ÜBERSICHT|OVERVIEW
Kunden & Software|Customers & software
Quellen & KI|Sources & AI
Anforderungen|Requirements
Profile & Testfälle|Profiles & test cases
Ergebnisse & Abdeckung|Results & coverage
Hilfe & Ablauf|Help & process
Workspace / Übersicht|Workspace / Overview
Workspace / Kunden & Software|Workspace / Customers & software
Workspace / Quellen & KI|Workspace / Sources & AI
Workspace / Anforderungen|Workspace / Requirements
Workspace / Profile & Testfälle|Workspace / Profiles & test cases
Workspace / Ergebnisse & Abdeckung|Workspace / Results & coverage
Workspace / Ergebnisse & Abdeckung / Bericht|Workspace / Results & coverage / Report
Workspace / Hilfe & Ablauf|Workspace / Help & process
PROTOTYP|PROTOTYPE
KI konfiguriert · Verbindung prüfbar|AI configured · test connection
Offline-Modus · kein Modell nötig|Offline mode · no model required
Zugang|Access
Zugriffstoken für Netzwerkbetrieb|Access token for network mode
Aktualisieren|Refresh
Schließen|Close
Hauptnavigation|Main navigation
Navigation schließen|Close navigation
Navigation ausblenden|Hide navigation
Navigation einblenden|Show navigation
AuditFlow · Nachvollziehbare Prüfungen.|AuditFlow · Traceable assessments.
Hackathon-Prototyp · keine Zertifizierung|Hackathon prototype · no certification
Synthetische Demo · Hersteller führen die Tests aus · Keine automatische Zulassung|Synthetic demo · manufacturers execute tests · no automatic certification
Alles Wichtige im Blick.|Everything that matters at a glance.
Hersteller, offene Zertifizierungen, Dokumente und Termine.|Manufacturers, open certifications, documents and dates.
Hersteller|Manufacturers
Kunden insgesamt|Customers in total
Software-Versionen|Software versions
Verwaltete Versionen|Managed versions
Offene Zertifizierungen|Open certifications
Neu, in Prüfung, erneut prüfen|New, under review, review again
Dokumente zur Freigabe|Documents to approve
Quellen und Einreichungen|Sources and submissions
Älteste Wartezeit zuerst|Longest waiting first
Wartet auf Herstellerergebnisse|Waiting for manufacturer results
Bereit zur Freigabe|Ready for approval
Prüfung starten|Start review
wartet seit heute|waiting since today
wartet seit 1 Tag|waiting for 1 day
Erinnerungen & Termine|Reminders & dates
Gesetzes- und Spezifikationsänderungen mit Quelle|Law and specification changes with source
+ Erinnerung|+ Reminder
Betroffene Software bestätigen|Confirm affected software
Nächste 90 Tage|Next 90 days
Entscheidungen fallen dort, wo die Belege stehen|Decisions are made where the evidence is
Keine Dokumente offen.|No documents pending.
Quellen unter|Import sources under
importieren oder Einreichungen in der Version hochladen.|or upload submissions in the version.
Keine offenen Zertifizierungen.|No open certifications.
Keine Erinnerungen.|No reminders.
Befund-Assistent|Evidence assistant
Befund-Assistent öffnen|Open evidence assistant
Assistent schließen|Close assistant
Erklären · Belege · nächste Schritte|Explain · evidence · next steps
Wähle einen Befund in einem Bericht.|Choose a finding in a report.
Deine Frage zum Befund|Your question about the finding
Befund erklären|Explain finding
Erklärung wird geladen …|Loading explanation …
Nächste Prüfschritte|Next review steps
Verwendete gespeicherte Belege|Stored evidence used
Lokale Erklärung · ohne KI|Local explanation · no AI
Hersteller und ihre Software.|Manufacturers and their software.
Status, Nachweise und Freigaben je Software-Version. Keine automatische Zulassung.|Status, evidence and approvals per software version. No automatic certification.
+ Hersteller / Software|+ Manufacturer / software
Suche nach Name|Search by name
Alle Status|All statuses
Offen · Neu, In Prüfung, Erneut prüfen|Open · new, under review, review again
Hersteller oder Software|Manufacturer or software
← Alle Hersteller|← All manufacturers
Neu|New
In Prüfung|Under review
Freigegeben|Approved
Abgelehnt|Rejected
Erneut prüfen|Review again
Freigeben|Approve
Ablehnen|Reject
Wieder öffnen|Reopen
Freigabe-Voraussetzungen|Approval prerequisites
Erfüllt|Met
Blockiert|Blocked
Herstellerergebnisse vorhanden (Import)|Manufacturer results available (import)
Kein abgeschlossener Importlauf. Simulationen zählen nicht.|No completed import run. Simulations do not count.
Keine Fehler im letzten Ergebnis|No failures in the latest result
Kein Importlauf.|No import run.
Unklare Ergebnisse fachlich akzeptiert|Unclear results accepted after review
Einreichungen entschieden|Submissions decided
Keine offenen Einreichungen.|No open submissions.
Vier-Augen-Prinzip|Four-eyes principle
Historie|History
Prüfung gestartet|Review started
Angelegt|Created
Angelegt.|Created.
Nachweise|Evidence
ausgewertet|assessed
Ansehen|View
Jedes nicht beurteilbare Ergebnis einzeln mit Name und Begründung fachlich akzeptieren. Akzeptanzen gelten nur für diesen Import.|Accept each not-assessable result individually with name and reason. Acceptances apply only to this import.
Akzeptiert|Accepted
Akzeptieren|Accept
Simulationen|Simulations
Keine Simulationen. Simulationen zählen nie als Nachweis.|No simulations. Simulations never count as evidence.
Einreichungen|Submissions
Unterlagen des Herstellers zu dieser Version|Manufacturer documents for this version
Noch keine Einreichungen.|No submissions yet.
Datei hinzufügen|Add file
PDF, DOCX oder TXT · maximal 5 MB · keine Textauswertung|PDF, DOCX or TXT · maximum 5 MB · no text analysis
Hochgeladen von|Uploaded by
Hochladen|Upload
Dein Name|Your name
Begründung|Reason
Testpakete|Test packages
SYNTHETISCHE DEMO|SYNTHETIC DEMO
Öffnen|Open
Testpaket vorbereiten|Prepare test package
Regeländerung übernehmen|Apply rule change
Abgeschlossen|Completed
Status|Status
Bestanden|Passed
Abweichung|Deviation
Nicht beurteilbar|Not assessable
Technischer Fehler|Technical error
Backend 1 · Quellen & Extraktion|Backend 1 · Sources & extraction
Jede Regel beginnt mit einer Quelle.|Every rule starts with a source.
Alle Dokumente mit Version und Kurzbeschreibung. Ein Upload erkennt Duplikate und neue Versionen und vergleicht automatisch mit dem bisherigen Stand.|All documents with version and short description. An upload detects duplicates and new versions and compares them automatically with the previous state.
Datei hierher ziehen oder klicken · TXT, MD, PDF oder DOCX|Drop a file here or click · TXT, MD, PDF or DOCX
+ Dokument hochladen|+ Upload document
Dokument hochladen|Upload document
Dokumente|Documents
Bereit|Ready
Detaillierte Informationen|Detailed information
Backend 1 · fachliche Freigabe|Backend 1 · specialist approval
Regeln mit Herkunft.|Rules with provenance.
Ein gefundenes Zitat ist noch keine bestätigte fachliche Interpretation.|A matched quote is not yet a confirmed interpretation.
Freigegebene Beispielregeln gelten für|Approved example rules apply to
. Neu extrahierte Regeln bleiben ohne ausführbare Zuordnung und werden nicht automatisch vom Prüfer verwendet. „KI-vorgeprüft“|. Newly extracted rules stay without an executable mapping and are not used automatically by the checker. “AI prechecked”
Die KI hat eine Empfehlung abgegeben; das ist keine Freigabe.|The AI gave a recommendation; this is not an approval.
Mehr|More
ist keine Freigabe; „fachlich freigegeben“|is not an approval; “approved after review”
Ein Mensch hat genau diese Anforderungsversion mit Namen und Begründung freigegeben.|A person approved exactly this requirement version with name and reason.
entscheidet ein Mensch.|is decided by a person.
Originalzitat und Quelle|Original quote and source
Zitat prüfen|Check quote
Zitat gefunden|Quote verified
Zitat abweichend|Quote mismatch
Prüfen & freigeben|Review & approve
Quelle geändert – Prüfung nötig|Source changed – review needed
KI-Vorprüfung nicht verfügbar|AI precheck not available
KI-Vorprüfung|AI precheck
KI-vorgeprüft|AI prechecked
Fachlich freigegeben|Approved after review
Veraltet|Outdated
Backend 2 · Profile & Erwartungen|Backend 2 · Profiles & expectations
Szenarien, die Unterschiede zeigen.|Scenarios that reveal differences.
Synthetische Personenprofile mit unabhängiger Erwartungsfreigabe.|Synthetic profiles with independent expected-value approval.
KI-Testentwürfe|AI case drafts
Gezielte Testentwürfe|Targeted case drafts
+ Testfall anlegen|+ Create test case
Erwartungen sind Entwürfe. Kalenderrechnung ist überprüfbar, ersetzt aber keine fachliche Freigabe. Ungeklärte Grenzfälle bleiben offen.|Expected values are drafts. Calendar arithmetic is inspectable but does not replace specialist approval. Unresolved boundary cases stay open.
Profil und Eingabedaten|Profile and inputs
Meldedatum|Report date
Erwartung prüfen|Review expectation
Grenzfälle ableiten|Derive boundary cases
Prüfung offen|Pending review
Ein Testfall oder Ergebnis beruht auf einer Anforderungs- oder Quellversion, die nicht mehr aktuell ist.|A test case or result is based on a requirement or source version that is no longer current.
· Erwartung: Anfrage|· Expected: enquiry
· Erwartung: keine Anfrage|· Expected: no enquiry
· Erwartung: offen|· Expected: open
Selbst konstruierte Demo-Erwartung; keine Original-Testkonstellation. Fachliche Freigabe offen.|Self-constructed demo expectation; not an original test constellation. Specialist approval pending.
Beschäftigungsende|Employment end
Versicherung|Insurance
Zeitraum|Period
Von|From
Bis|To
Tage|Days
Bescheinigt|Certified
Aktuelle AU|Current sick leave
Ja|Yes
Nein|No
Quellversion geändert: erwartetes Ergebnis für Version 2 neu bestimmen.|Source version changed: determine the expected result for version 2 again.
Backend 2 · Ergebnisse & Abdeckung|Backend 2 · Results & coverage
Was ist tatsächlich nachgewiesen?|What is actually proven?
Ergebnisse, Abdeckung freigegebener Anforderungen und veraltete Nachweise an einem Ort.|Results, coverage of approved requirements and outdated evidence in one place.
Nur fachlich freigegebene Anforderungsversionen|Only requirement versions approved after review
zählen für die Abdeckung|count towards coverage
Anteil der freigegebenen Anforderungen mit aktuellem, bestandenem Nachweis.|Share of approved requirements with current, passed evidence.
. Nicht beurteilbar|. Not assessable
Das Ergebnis lässt sich nicht bewerten, etwa weil eine Erwartung offen, eine Regel nicht freigegeben oder ein Ergebnis fehlt.|The result cannot be assessed, for example because an expectation is open, a rule is not approved or a result is missing.
zählt nie als bestanden; veraltete Nachweise|never counts as passed; outdated evidence
bleiben sichtbar.|stays visible.
Ergebnisverteilung|Result distribution
Letztes Ergebnis je Testfall und Anforderung|Latest result per test case and requirement
Fehlgeschlagen|Failed
Nicht ausgeführt|Not run
Anforderungsabdeckung|Requirement coverage
Freigegebene Anforderungen nach Nachweisstand|Approved requirements by evidence state
Abgedeckt|Covered
aktueller, bestandener Nachweis|current, passed evidence
Offen|Open
offen|open
Erwartung offen oder Ergebnis nicht bestanden|Expectation open or result not passed
Fehlend|Missing
kein Testfall oder kein Ergebnis|no test case or no result
Nachweis zu älterer Version|Evidence for an older version
Anforderungen, Testfälle und Ergebnisse|Requirements, test cases and results
Lücken|Gaps
Aktuell|Current
Alle|All
Suche|Search
Testfälle → letztes Ergebnis|Test cases → latest result
Quelle|Source
Erklären|Explain
Bericht ↗|Report ↗
Noch kein Ergebnis|No result yet
nicht verwendbar|not usable
Grenzen|Limits
· Ergebnisse stammen aus der internen Simulation bzw. importierten Fixtures; keine echte Abrechnungssoftware angebunden.|· Results come from the internal simulation or imported fixtures; no real payroll software is connected.
· Nur Beispielkriterien; keine vollständige EEL-Konformitätsprüfung und kein Zertifikat.|· Example criteria only; no complete EEL conformance check and no certificate.
· KI-Vorprüfung ist eine Empfehlung und kein unabhängiger Nachweis; Freigaben trifft ein Mensch.|· The AI precheck is a recommendation, not independent evidence; a person makes approvals.
· Zurückgezogene Quellversionen machen Freigaben derzeit nicht automatisch ungültig (offener Punkt).|· Withdrawn source versions do not yet invalidate approvals automatically (open point).
· Aktuelle, aber nicht bestandene Nachweise zählen in der Abdeckung als „offen“.|· Current but not passed evidence counts as “open” in coverage.
Jeder Bericht bewahrt den verwendeten Szenario- und Freigabestand.|Each report keeps the scenario and approval state it used.
Simulation|Simulation
Import|Import
Nach Nachweisstand filtern|Filter by evidence state
Anforderung, Testfall oder Quelle|Requirement, test case or source
Ohne Ergebnis gibt es keinen Befund zum Erklären.|Without a result there is no finding to explain.
Anforderung|Requirement
Nachweis|Evidence
Testfall|Test case
Modus|Mode
Ergebnis|Result
Hilfe & Einstieg|Help & getting started
So funktioniert der gemeinsame Ablauf.|How the shared process works.
Die zusätzlichen Ansichten aus dem ZIP sind an das lokale AuditFlow-Backend angepasst.|The additional views from the ZIP are adapted to the local AuditFlow backend.
Vom Testpaket zum Herstellerbericht|From test package to manufacturer report
Unter|Under
Dokumente hochladen. Neue Versionen werden erkannt und automatisch mit dem bisherigen Stand verglichen. Aus Abschnitten Regelentwürfe erstellen.|upload documents. New versions are detected and compared automatically with the previous state. Create rule drafts from sections.
Anforderungen und synthetische Vorlagen fachlich prüfen und freigeben.|Review and approve requirements and synthetic templates.
Hersteller und Version anlegen und in der Version ein Testpaket mit Profilen und Fall-IDs vorbereiten.|Create the manufacturer and version, then prepare a test package with profiles and case IDs in the version.
Das Eingabepaket als JSON exportieren. Der Hersteller führt die Tests in seiner eigenen Software aus.|Export the input package as JSON. The manufacturer runs the tests in their own software.
Die Ergebnisse des Herstellers importieren. AuditFlow vergleicht Soll und Ist; fehlende Ergebnisse bleiben nicht beurteilbar.|Import the manufacturer's results. AuditFlow compares expected and actual; missing results stay not assessable.
Bei Regeländerungen betroffene Fälle auswählen und ein neues Hersteller-Testpaket erstellen. Neue Ergebnisse importieren und Berichte mit Belegen exportieren.|On rule changes, select the affected cases and create a new manufacturer test package. Import new results and export reports with evidence.
Dokumente und KI|Documents and AI
TXT, MD, PDF oder DOCX hochladen. Die Versionsbezeichnung ist Pflicht; identische Dateien werden als Duplikat erkannt. Ein PDF wird immer vollständig importiert. Versionen werden nie gelöscht, nur mit Begründung zurückgezogen.|Upload TXT, MD, PDF or DOCX. The version label is required; identical files are detected as duplicates. A PDF is always imported completely. Versions are never deleted, only withdrawn with a reason.
Pro Abschnitt wörtliche Offline-Vorschläge oder KI-Entwürfe anfordern. Zitatabgleich und fachliche Freigabe bleiben getrennt. Neue Freitextregeln werden dadurch nicht ausführbar.|Request literal offline suggestions or AI drafts per section. Quote matching and specialist approval stay separate. New free-text rules do not become executable this way.
Der Modell-Key gehört serverseitig in|The model key belongs on the server in
. Eine Konfiguration ist noch kein erfolgreicher Verbindungstest. Alternativ liest der Server ihn aus einer lokalen, nicht eingecheckten .env-Datei.|. A configuration is not yet a successful connection test. Alternatively the server reads it from a local, uncommitted .env file.
Erklärassistent|Explanation assistant
In einem Einzelbericht oder einer Automatik-Ergebniszeile „Erklären“ wählen. Der Assistent liest die gespeicherten Belege des ausgewählten Laufs.|Choose “Explain” in a single report or an automation result row. The assistant reads the stored evidence of the selected run.
Lokal:|Local:
Evidenzanzeige und feste Prüfschritte ohne Modellaufruf.|Evidence display and fixed review steps without a model call.
beantwortet die Frage mit dem konfigurierten Modell. Fehler werden angezeigt; kein verdeckter Wechsel zu einer angeblichen KI-Antwort.|answers the question with the configured model. Errors are shown; there is no hidden switch to a supposed AI answer.
Der Assistent kann keine Freigaben erteilen, Befunde ändern oder Software zulassen.|The assistant cannot grant approvals, change findings or certify software.
Gemeinsamer Stand und Grenzen|Shared state and limits
Die Übersicht bündelt offene Zertifizierungen, Dokumente zur Freigabe und Erinnerungen. Testpakete und Ergebnisimporte liegen in der jeweiligen Version unter Kunden & Software. Der Vergleich zur Vorversion wird beim Upload unter Quellen & KI gespeichert. Ergebnisse, Abdeckung und Prüfberichte stehen unter|The overview collects open certifications, documents to approve and reminders. Test packages and result imports are in each version under Customers & software. The comparison with the previous version is stored on upload under Sources & AI. Results, coverage and reports are under
. Die Oberfläche nutzt weiterhin ITSG-inspiriertes Rot.|. The interface keeps its ITSG-inspired red.
Base44-Konten und Cloud-Dateiablage sind nicht verbunden. Die Anwendung bleibt lokal mit einem optionalen gemeinsamen Zugriffstoken. Eine echte Mehrbenutzerverwaltung ist nicht enthalten.|Base44 accounts and cloud file storage are not connected. The application stays local with an optional shared access token. Real multi-user management is not included.
Unterstützt werden strukturierte synthetische C1-/C2-/C4-Vorlagen und die begrenzte Einzeldateiprüfung. Keine vollständige Lohnprüfung, amtliche Zertifizierung oder automatisch ausführbaren neuen Gesetze.|Supported are structured synthetic C1/C2/C4 templates and the limited single-file check. No complete payroll audit, official certification or automatically executable new laws.
Glossar|Glossary
Fingerabdruck|Fingerprint
SHA-256-Prüfsumme der Originaldatei; identische Bytes ergeben denselben Fingerabdruck.|SHA-256 checksum of the original file; identical bytes give the same fingerprint.
Damit erkennt AuditFlow Duplikate und weist nach, welcher Stand verwendet wurde. Der Fingerabdruck sagt nichts über Inhalt oder Richtigkeit des Dokuments aus.|AuditFlow uses it to detect duplicates and to prove which state was used. The fingerprint says nothing about the content or correctness of the document.
Dokumentversion|Document version
Ein hochgeladener Stand eines Dokuments mit Originaldatei, Text und Metadaten.|An uploaded state of a document with original file, text and metadata.
Versionen werden nie gelöscht, sondern nur mit Begründung zurückgezogen. Jede Anforderungsversion verweist auf genau eine Dokumentversion; Stände verschiedener Jahre werden nicht vermischt.|Versions are never deleted, only withdrawn with a reason. Each requirement version refers to exactly one document version; states from different years are not mixed.
Redaktionelle / fachliche Änderung|Editorial / substantive change
Eine redaktionelle Änderung betrifft nur Wortlaut oder Form, eine fachliche Änderung die Bedeutung einer Regel.|An editorial change affects only wording or form, a substantive change the meaning of a rule.
Mit KI-Schlüssel schlägt die KI eine Einstufung mit Begründung vor. Redaktionelle Änderungen übernimmt erst ein Mensch gemeinsam mit Name und Begründung. Ohne KI-Schlüssel bleibt die Einstufung offen und gilt nie als redaktionell.|With an AI key, the AI proposes a classification with a reason. A person adopts editorial changes only with name and reason. Without an AI key the classification stays open and never counts as editorial.
Die KI-Vorprüfung kann dieselben Fehler machen wie der KI-Entwurf und ist kein unabhängiger Nachweis der Richtigkeit. Die fachliche Freigabe trifft immer ein Mensch.|The AI precheck can make the same mistakes as the AI draft and is not independent proof of correctness. A person always makes the specialist approval.
Die Freigabe gilt für eine Version. Sie wird ungültig, wenn eine neuere Quellversion gilt und der zitierte Absatz sich geändert hat oder die Gültigkeit der Quelle abgelaufen ist. Namen sind selbst angegeben.|The approval applies to one version. It becomes invalid when a newer source version applies and the quoted paragraph changed, or the source's validity has expired. Names are self-declared.
Veraltete Nachweise bleiben sichtbar, zählen aber nicht als aktueller Nachweis. Nach der Freigabe einer neuen Anforderungsversion entstehen neue Testfälle.|Outdated evidence stays visible but does not count as current evidence. New test cases are created after a new requirement version is approved.
Abdeckung|Coverage
Fehlend: kein Testfall oder kein Ergebnis. Offen: offene Erwartung oder Freigabe ausstehend. Veraltet: Nachweis beruht auf einer älteren Version. Mehr Testfälle bedeuten nicht automatisch mehr fachliche Abdeckung.|Missing: no test case or no result. Open: open expectation or approval pending. Outdated: evidence is based on an older version. More test cases do not automatically mean more coverage.
Nicht beurteilbar zählt nie als bestanden. Einzelne unklare Ergebnisse lassen sich nur mit Name und Begründung fachlich akzeptieren.|Not assessable never counts as passed. Individual unclear results can only be accepted with name and reason.
Einstellungen|Settings
Einstellungen öffnen|Open settings
ARBEITSPLATZ|WORKSPACE
Sprache & Darstellung|Language & appearance
Sprache der Bedienoberfläche|Interface language
Dokumente, Anforderungen und gespeicherte Inhalte bleiben unverändert.|Documents, requirements and stored content stay unchanged.
Darstellung|Appearance
Hell|Light
Dunkel|Dark
Wie das System|Same as system
Einstellungen speichern|Save settings
Einstellungen gespeichert.|Settings saved.
Noch keine Einträge.|No entries yet.
automatisch abgeleitet|derived automatically`.split('\n').map(line=>line.split('|')));
const UX_MONTHS={Januar:'January',Februar:'February','März':'March',April:'April',Mai:'May',Juni:'June',Juli:'July',August:'August',September:'September',Oktober:'October',November:'November',Dezember:'December'};
// Patterns for authored strings that contain numbers, dates or names. Captured names stay as they are.
const UX_RULES=[
 [/^(\d+) offen$/,'$1 open'],[/^(\d+) Versionen$/,'$1 versions'],[/^1 Version$/,'1 version'],[/^(\d+) Dokumente$/,'$1 documents'],
 [/^wartet seit (\d+) Tagen$/,'waiting for $1 days'],[/^wartet seit (.+)$/,'waiting since $1'],
 [/^in (\d+) Tagen · (.+) · Quelle: (.+)$/,'in $1 days · $2 · Source: $3'],[/^vor (\d+) Tagen · (.+) · Quelle: (.+)$/,'$1 days ago · $2 · Source: $3'],
 [/^heute · (.+) · Quelle: (.+)$/,'today · $1 · Source: $2'],[/^morgen · (.+) · Quelle: (.+)$/,'tomorrow · $1 · Source: $2'],
 [/^Letzter abgeschlossener Importlauf vom (.+)\.$/,'Latest completed import run from $1.'],[/^(\d+) Fehler im letzten Importlauf\.$/,'$1 failure(s) in the latest import run.'],
 [/^(\d+) Fehler im letzten Ergebnis$/,'$1 failure(s) in the latest result'],[/^(\d+) von (\d+) akzeptiert\.$/,'$1 of $2 accepted.'],
 [/^Freigabe nicht durch: (.+)\. Namen sind selbst angegeben \(Prozessschutz, keine Sicherheitskontrolle\)\.$/,'Approval not by: $1. Names are self-declared (process safeguard, not a security control).'],
 [/^Keine Akzeptanzen; keine Einschränkung\. Namen sind selbst angegeben \(Prozessschutz, keine Sicherheitskontrolle\)\.$/,'No acceptances; no restriction. Names are self-declared (process safeguard, not a security control).'],
 [/^Letzter abgeschlossener Herstellerimport · (.+)$/,'Latest completed manufacturer import · $1'],[/^Unklare Ergebnisse · (\d+) von (\d+) akzeptiert$/,'Unclear results · $1 of $2 accepted'],
 [/^(.+) · keine Beobachtung geliefert$/,'$1 · no observation supplied'],[/^(.+) · Erwartung offen$/,'$1 · expectation open'],
 [/^Fachlich akzeptiert von (.+?) · (.+)$/,'Accepted after review by $1 · $2'],
 [/^Bestanden: (\d+), Abweichung: (\d+), Nicht beurteilbar: (\d+), Technischer Fehler: (\d+)$/,'Passed: $1, deviation: $2, not assessable: $3, technical error: $4'],
 [/^Version (.+) · (\d+) Version(?:en)? · (\d+) Anforderung(?:en)?$/,'Version $1 · $2 version(s) · $3 requirement(s)'],
 [/^Aktuelle AU: (.+) → offen$/,'Current sick leave: $1 → open'],[/^Aktuelle AU: (.+)$/,'Current sick leave: $1'],
 [/^· (\d+) Vorerkrankungen$/,'· $1 prior illness(es)'],[/^Vorerkrankung (\d+)$/,'Prior illness $1'],
 [/^Bescheinigte Vorerkrankungen zusammen: (\d+) Tage, mit der aktuellen AU (\d+) Tage\. Ob und wie sie für Schwellenwerte zählen, regelt die freigegebene Anforderung\.$/,'Certified prior illnesses together: $1 days, $2 days including the current sick leave. Whether and how they count towards thresholds is set by the approved requirement.'],
 [/^Bescheinigte Vorerkrankungen zusammen: (\d+) Tage\. Ob und wie sie für Schwellenwerte zählen, regelt die freigegebene Anforderung\.$/,'Certified prior illnesses together: $1 days. Whether and how they count towards thresholds is set by the approved requirement.'],
 [/^veraltet – basiert auf Version (\d+)$/,'outdated – based on version $1'],[/^Fachlich freigegeben v(\d+)$/,'Approved after review v$1'],[/^Freigegeben v(\d+)$/,'Approved v$1'],
 [/^· Version (\d+)$/,'· version $1'],[/^(\d+) Testfälle ohne Ergebnis$/,'$1 test case(s) without result'],[/^Ergebnisverteilung über (\d+) Testfall-Zuordnungen$/,'Result distribution across $1 test case assignments'],
 [/^Bestanden: (\d+), Fehlgeschlagen: (\d+), Nicht beurteilbar: (\d+), Veraltet: (\d+), Nicht ausgeführt: (\d+)$/,'Passed: $1, failed: $2, not assessable: $3, outdated: $4, not run: $5'],
 [/^freigegebenen Anforderungen mit aktuellem, bestandenem Nachweis \((\d+) %\)$/,'approved requirements with current, passed evidence ($1 %)'],
 [/^Anforderungsabdeckung: (\d+) von (\d+) abgedeckt$/,'Requirement coverage: $1 of $2 covered'],
 [/^Abgedeckt: (\d+), Offen: (\d+), Fehlend: (\d+), Veraltet: (\d+)$/,'Covered: $1, open: $2, missing: $3, outdated: $4'],
 [/^(\d+) von (\d+) Anforderungen$/,'$1 of $2 requirements'],[/^Alle Prüfberichte \((\d+)\)$/,'All reports ($1)'],[/^Abschnitt (\d+)$/,'Section $1'],
 [/^(\d+) von (\d+)$/,'$1 of $2'],[/^C(\d) · Version (\d+) · (.+)$/,'C$1 · version $2 · $3'],[/^Grenzwert · (\d+) Tage Systembestand$/,'Threshold · $1 days in system stock'],
 [/^Prüfung durch (.+)$/,'Reviewed by $1'],[/^Bezug: Importlauf (.+)$/,'Reference: import run $1']];
const UX_LABELLED=/^(Bestanden|Fehlgeschlagen|Nicht beurteilbar|Veraltet|Nicht ausgeführt|Abgedeckt|Offen|Fehlend): (\d+) von (\d+)$/;
// Containers whose text is record content (sources, requirements, names, notes) and must never be translated.
const UX_PROTECTED='[data-user-content],.source-text,.document-prose,.quote,.requirement-text,.assistant-prose,pre,code,.cust-maker,.history-list li>p';
const uxTextOrigins=new WeakMap(),uxAttrOrigins=new WeakMap(),uxAttrWritten=new WeakMap();
function uxSettingsState(){return state?.settings||{language:'de',theme:'light'};}
function uxEnglish(){return uxSettingsState().language==='en';}
function uxT(value){return uxEnglish()?uxTranslateString(value):value;}
function uxTranslateString(s){
 const trimmed=s.trim();if(!trimmed)return s;let value=UX_EN[trimmed];
 if(!value){const m=trimmed.match(UX_LABELLED);if(m)value=`${UX_EN[m[1]]}: ${m[2]} of ${m[3]}`;}
 if(!value){const m=trimmed.match(/^(\S+) (\d{4})$/);if(m&&UX_MONTHS[m[1]])value=UX_MONTHS[m[1]]+' '+m[2];}
 if(!value){const m=trimmed.match(/^Erklärung: (.+)$/);if(m)value='Explanation: '+(UX_EN[m[1]]||m[1]);}
 if(!value)for(const [re,out] of UX_RULES)if(re.test(trimmed)){value=trimmed.replace(re,out);break;}
 // Joined status lines such as "Bereit zur Freigabe · wartet seit heute": translate only when every part is known.
 if(!value&&trimmed.includes(' · ')){const parts=trimmed.split(' · ').map(p=>UX_EN[p]||(UX_RULES.find(([re])=>re.test(p))?p.replace(UX_RULES.find(([re])=>re.test(p))[0],UX_RULES.find(([re])=>re.test(p))[1]):null));if(parts.every(Boolean))value=parts.join(' · ');}
 return value?s.replace(trimmed,value):s;
}
function uxTranslate(){
 const english=uxEnglish();
 const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
 while((node=walk.nextNode())){
  const parent=node.parentElement;if(!parent||parent.closest('script,style,textarea,'+UX_PROTECTED)||parent.matches('.cust-head h1'))continue;
  if(!uxTextOrigins.has(node))uxTextOrigins.set(node,node.nodeValue);
  const next=english?uxTranslateString(uxTextOrigins.get(node)):uxTextOrigins.get(node);if(node.nodeValue!==next)node.nodeValue=next;
 }
 for(const el of document.querySelectorAll('[placeholder],[aria-label],[title]')){
  if(el.closest(UX_PROTECTED))continue;let originals=uxAttrOrigins.get(el);
  if(!originals){originals={};for(const a of ['placeholder','aria-label','title'])if(el.hasAttribute(a))originals[a]=el.getAttribute(a);uxAttrOrigins.set(el,originals);}
  for(const [a,s] of Object.entries(originals)){const next=english?uxTranslateString(s):s;if(el.getAttribute(a)!==next){el.setAttribute(a,next);const w=uxAttrWritten.get(el)||{};w[a]=next;uxAttrWritten.set(el,w);}}
 }
}
// Attribute values change on re-render (e.g. the sidebar toggle label); forget stale originals so the new German value is kept.
function uxForget(el,attr){const o=uxAttrOrigins.get(el),value=el.getAttribute(attr);if(!o||value===null||uxAttrWritten.get(el)?.[attr]===value)return;o[attr]=value;}
const uxDark=matchMedia('(prefers-color-scheme: dark)');
function uxApplyPreferences(){
 const cfg=uxSettingsState(),root=document.documentElement;
 root.dataset.theme=cfg.theme==='system'?(uxDark.matches?'dark':'light'):cfg.theme;root.lang=cfg.language;uxTranslate();
}
uxDark.addEventListener?.('change',()=>{if(uxSettingsState().theme==='system')uxApplyPreferences();});
function uxSettingsDialog(){
 const c=uxSettingsState();
 modal(`<div class="eyebrow">ARBEITSPLATZ</div><h2>Einstellungen</h2><section class="ux-settings-section"><h3>Sprache & Darstellung</h3><form id="ux-settings-form"><div class="field"><label for="ux-language">Sprache der Bedienoberfläche</label><select id="ux-language" name="language"><option value="de" ${c.language==='de'?'selected':''}>Deutsch</option><option value="en" ${c.language==='en'?'selected':''}>English</option></select></div><p class="muted">Dokumente, Anforderungen und gespeicherte Inhalte bleiben unverändert.</p><div class="field"><label for="ux-theme">Darstellung</label><select id="ux-theme" name="theme">${[['light','Hell'],['dark','Dunkel'],['system','Wie das System']].map(([v,l])=>`<option value="${v}" ${c.theme===v?'selected':''}>${l}</option>`).join('')}</select></div><button class="btn primary">Einstellungen speichern</button></form></section>`);
}
(function(){
 const trigger=document.createElement('button');
 trigger.type='button';trigger.className='icon-button ux-settings-trigger';trigger.title='Einstellungen öffnen';trigger.setAttribute('aria-label','Einstellungen öffnen');
 trigger.innerHTML='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
 const refresh=document.getElementById('refresh');if(refresh)refresh.before(trigger);else document.body.appendChild(trigger);
 trigger.addEventListener('click',()=>uxSettingsDialog());
 document.addEventListener('submit',async ev=>{
  if(ev.target.id!=='ux-settings-form')return;ev.preventDefault();ev.stopImmediatePropagation();
  const d=Object.fromEntries(new FormData(ev.target));
  try{state.settings=await api('settings',d);document.getElementById('dialog').close();render();uxApplyPreferences();toast(uxT('Einstellungen gespeichert.'));}
  catch(err){toast(err.message);}
 },true);
 // Re-translate after every DOM rebuild. Only childList changes are observed, so our own text edits do not loop.
 let queued=false;
 new MutationObserver(records=>{
  for(const r of records)if(r.type==='attributes')uxForget(r.target,r.attributeName);
  if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;if(state)uxApplyPreferences();});
 }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-label','title','placeholder']});
})();
