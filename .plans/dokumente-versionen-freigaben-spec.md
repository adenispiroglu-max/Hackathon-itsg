# Spec: Dokumentenablage, automatischer Versionsvergleich, KI-Vorprüfung und „Ergebnisse & Abdeckung“

Status: im Interview am 27.10.2026 abgestimmt. Noch nicht umgesetzt.
Umfang: „Quellen & KI“, Anforderungen, Testfälle, die neue Seite „Ergebnisse & Abdeckung“ und das zugehörige Backend.
Bleibt erhalten: die vereinfachte Übersicht und der Befund-Assistent als Symbol.

## 0. Reihenfolge und Abhängigkeiten

- Die Umsetzung beginnt erst, wenn die Arbeit an der Übersicht/Zertifizierung
  (`.plans/uebersicht-redesign-spec.md`) committet ist. Grund: Beide Vorhaben ändern
  `service.py`, `server.py`, `app.js`, `workspace.js` und `style.css`. Diese Dateien haben
  sehr lange Zeilen, deshalb führt paralleles Arbeiten zu schweren Merge-Konflikten.
- Umsetzung in einem eigenen Worktree und Branch, der vom committeten Übersicht-Stand abzweigt.
- Neue Backend-Logik kommt in neue Module (zum Beispiel `auditflow/library.py`,
  `auditflow/review.py`). Die gemeinsam genutzten Dateien erhalten nur die Anbindung.
- Herstellerunterlagen („Einreichungen“) aus der Übersicht-Spec bleiben dort, bei der
  Software-Version unter „Kunden & Software“. Sie erscheinen **nicht** in der Dokumentenablage.
- Die Erinnerungen der Übersicht-Spec werden aus `valid_from` abgeleitet. Sie müssen ab jetzt
  pro **Dokumentversion** erzeugt werden (siehe Abschnitt 3.1).

## 1. Ziele

1. Jede Information erscheint als lesbarer Text, als beschriftetes Feld oder als Tabelle.
   Im normalen Ablauf gibt es keine JSON-Blöcke und keine Quellcode-Ansichten.
2. Ein Upload unter „Quellen & KI“ erkennt selbst, ob die Datei ein neues Dokument, eine neue
   Version oder ein Duplikat ist. Er vergleicht automatisch mit dem bisherigen Stand und
   überträgt die Änderungen in neue Anforderungsversionen.
3. Eine zentrale Dokumentenablage mit Ordnern nach Dokumenttyp, Versionen, Status, Ansicht
   und Download.
4. Eine gemeinsame Seite „Ergebnisse & Abdeckung“ ersetzt „Prüfberichte“ und „Testabdeckung“.
5. Freigaben gezielt einsetzen: Eine Anforderung wird einmal geprüft. Eine erneute Prüfung
   gibt es nur bei fachlicher Änderung oder wenn die Grundlage nicht mehr gültig ist. Für
   einzelne Testfälle gibt es keine erneute Anforderungsfreigabe.
6. Die KI erkennt, erklärt und empfiehlt. Die fachliche Freigabe trifft immer ein Mensch.

## 2. Begriffe

| Begriff | Bedeutung |
|---|---|
| Dokument | Eine Quelle über alle Stände hinweg, z. B. „Prüfkriterien Entgeltbescheinigung“. |
| Dokumentversion | Ein hochgeladener Stand eines Dokuments, mit Originaldatei, Text und Metadaten. |
| Fingerabdruck | SHA-256 der Originaldatei. Er ist bei identischen Bytes gleich. Damit erkennt die Anwendung Duplikate und weist den Stand nach. |
| Anforderungsversion | Ein Stand einer Anforderung. Jede fachliche Änderung erzeugt eine neue Version. |
| KI-vorgeprüft | Die KI hat eine Empfehlung abgegeben. Das ist **keine** Freigabe. |
| Fachlich freigegeben | Ein Mensch hat die Anforderungsversion mit Namen und Begründung freigegeben. |
| Veraltet | Ein Testfall oder Ergebnis beruht auf einer Anforderungsversion, die nicht mehr aktuell ist. |

„KI-vorgeprüft“ und „fachlich freigegeben“ werden getrennt gespeichert und getrennt angezeigt.
Eine KI-Vorprüfung kann dieselben Fehler machen wie der KI-Entwurf. Sie ist kein unabhängiger
Nachweis der Richtigkeit. Fehlende Quellen und unklare Regeln bleiben sichtbar offen.

## 3. Datenmodell

### 3.1 Dokument und Dokumentversion

```
document          { id, title, doc_type, created_at }
document_version  { id, document_id, version_no (1,2,3…), version_label, sha256, file_name,
                    file_kind (pdf|txt|md|docx), file_stored (bool), valid_from?, valid_until?,
                    validity_confirmed (bool), status, withdrawn_reason?, sections[], paragraphs[],
                    uploaded_at, uploaded_by?, diff_id? }
document_diff     { id, document_id, old_version_id, new_version_id, created_at,
                    changes:[{ kind: added|removed|changed, old_ref?, new_ref?, before?, after?,
                               classification?: redaktionell|fachlich|offen,
                               classification_source?: ki|keine }],
                    affected_requirement_ids[] }
```

- `doc_type` ist eine feste Liste: **Gesetz/Verordnung**, **Technische Spezifikation**,
  **Prüfkriterien**, **Sonstige**. Diese Typen sind die Ordner der Ablage.
- Originaldateien liegen unter `var/documents/<sha256>.<ext>`. Weil der Fingerabdruck der
  Dateiname ist, wird jede Datei nur einmal gespeichert. `var/` ist bereits von git
  ausgeschlossen. Die Metadaten liegen in SQLite.
- `paragraphs[]`: der Text, in Absätze zerlegt, mit Quellort (Seite bzw. Absatznummer). Das ist
  die Grundlage für den Vergleich.
- Die Seitenauswahl beim PDF-Import (`page_range`) **entfällt**. Ein PDF wird immer vollständig
  importiert (höchstens 500 Seiten, höchstens 5 MB wie bisher).
- Versionen werden nie gelöscht. Sie lassen sich nur **zurückziehen**, mit Begründung. Eine
  zurückgezogene Version bleibt sichtbar, zählt aber nicht mehr als aktueller Stand.
- Erinnerungen (Übersicht-Spec) werden pro Dokumentversion mit `valid_from` erzeugt.

### 3.2 Anforderungsversionen

```
requirement          { id, document_id, current_version_id, approved_version_id? }
requirement_version  { id, requirement_id, version_no, title, criterion, conditions[], exceptions[],
                       source_version_id, source_ref, source_excerpt, citation_status,
                       origin: ki_entwurf|manuell|übernommen_redaktionell|migration,
                       change_reason?, ai_review?, approval?, created_at }
ai_review   { status: läuft|fertig|nicht_verfügbar|fehler, recommendation, reasoning,
              evidence:{version_id, page_or_ref, excerpt}, marks:[...], suggested_change?,
              open_question?, model, created_at }
approval    { decision: freigegeben|abgelehnt, reviewer, note, against_ai (bool), decided_at }
```

- Eine bestehende Freigabe gilt für genau eine `requirement_version`.
- Die bisherige Zitatprüfung (`citation_status`) bleibt als Bedingung für die Freigabe erhalten.

### 3.3 Testfälle

- Ein Testfall verweist auf die `requirement_version_id`, aus der er erzeugt wurde.
- Die eigene Freigabe pro Testfall entfällt im Normalfall: Ein Testfall aus einer freigegebenen
  Anforderungsversion ist ohne weitere Freigabe verwendbar.
- Nur diese Testfälle brauchen eine Prüfung: Testfälle mit **von Hand geändertem** erwarteten
  Ergebnis und Testfälle mit **offenem** erwarteten Ergebnis. Ein offenes erwartetes Ergebnis
  bleibt wie bisher nicht freigebbar.

### 3.4 Migration bestehender Datenbanken

Beim Start, idempotent:
- Jedes bestehende `document` wird zu einem Dokument mit Version 1. Da die Originaldatei fehlt,
  gilt `file_stored=false`. Die Ablage zeigt „Originaldatei nicht gespeichert“, eine
  Textansicht ist möglich, ein Download nicht.
- Jede bestehende Anforderung wird Version 1 mit `origin: migration`. Bestehende Freigaben
  bleiben unverändert erhalten.
- Bestehende Testfälle werden mit Version 1 ihrer Anforderung verknüpft.

## 4. Upload-Ablauf unter „Quellen & KI“

### 4.1 Eingaben

- Datei (TXT, MD, PDF, DOCX).
- **Versionsbezeichnung (Pflicht)**, z. B. „2027-01“. Die Anwendung errät sie nie.
- Dokumenttyp: wird vom erkannten Dokument vorgeschlagen und kann geändert werden.
- Gültig ab / bis: **optional**. Die Anwendung schlägt Daten vor, die sie im Text findet
  (z. B. „gilt ab 01.01.2027“, per Mustererkennung). Ohne Datum gilt die Version ab dem Upload,
  läuft nicht ab und erhält den Hinweis „Gültigkeit nicht bestätigt“.

### 4.2 Ablauf in einem Dialog mit Live-Schritten

1. **Datei geprüft**: Fingerabdruck berechnet.
   - Identische Bytes sind schon vorhanden: Der Upload wird abgelehnt mit „Diese Datei ist
     bereits als ‹Dokument› Version ‹X› vorhanden“ und einem Link dorthin. Dort lassen sich die
     Metadaten korrigieren. Es entsteht kein zweiter Eintrag, auch nicht bei abweichender
     Versionsbezeichnung oder abweichendem Datum.
2. **Text gelesen**: Absätze mit Quellort werden erkannt. Für gescannte PDFs ohne Text gilt wie
   bisher „Externe OCR erforderlich“.
3. **Dokument erkannt**: Die Anwendung schlägt einen Treffer vor, nach Ähnlichkeit von Titel bzw.
   Dateiname und Text: „Sieht aus wie eine neue Version von ‹Dokument› (aktuell Version 2).“
   Der Nutzer bestätigt den Vorschlag oder wählt „Neues Dokument“ bzw. ein anderes Dokument.
   Ohne Bestätigung geht es nicht weiter. Es wird nie stillschweigend zusammengeführt.
4. **Gespeichert**: Bei einem neuen Dokument entsteht ein Dokument mit Version 1. Bei einer neuen
   Version entsteht Version n+1. Die alten Versionen bleiben erhalten.
5. **Änderungen verglichen** (nur bei einer neuen Version): siehe 4.3.
6. **Anforderungen aktualisiert**: siehe Abschnitt 5.
7. **Zusammenfassung**: „5 Absätze geändert, 1 neu, 0 entfernt · 3 Anforderungen betroffen
   (2 fachlich, 1 redaktionell)“, mit Links zum Vergleich und zu den betroffenen Anforderungen.

### 4.3 Automatischer Versionsvergleich

- Der Vergleich läuft auf **Absatzebene**: Die Absätze beider Versionen werden über die Seiten
  hinweg nach Ähnlichkeit zugeordnet (`difflib` aus der Standardbibliothek). Ergebnis: neue,
  entfernte und geänderte Absätze, jeweils mit alter und neuer Seite bzw. Fundstelle. So
  verfälschen verschobene Seiten den Vergleich nicht.
- Geänderte Absätze zeigen den Text vorher und nachher, mit Hervorhebung auf Wortebene
  (rot entfernt, grün ergänzt).
- Mit KI-Schlüssel stuft die KI jede Änderung als „redaktionell“ oder „fachlich“ ein, mit einem
  Satz Begründung. Ohne Schlüssel bleibt die Einstufung offen (siehe 5.3).
- Das Vergleichsergebnis wird gespeichert (`document_diff`) und bleibt bei der Dokumentversion
  abrufbar.
- **Der manuelle Vergleich „Bisheriger Stand / Neuer Stand“ (Bild 3) wird entfernt**, in der
  UI und als Ablauf. `POST /api/diff` darf intern weiterbestehen, wenn Tests es brauchen.

## 5. Änderungen in Anforderungen übernehmen

### 5.1 Zuordnung

Eine Anforderung ist betroffen, wenn ihr Quellenzitat (`source_excerpt`) in einem entfernten oder
geänderten Absatz der alten Version liegt. Ist das Zitat in der neuen Version unverändert
auffindbar, ist die Anforderung nicht betroffen.

### 5.2 Mit KI-Schlüssel

- Bei einer **fachlichen** Änderung entwirft die KI eine neue Anforderungsversion aus dem neuen
  Text (`origin: ki_entwurf`) mit Status „Freigabe nötig“. Die bisher freigegebene Version bleibt
  sichtbar und gültig, bis ein Mensch entscheidet. Danach läuft automatisch die KI-Vorprüfung
  (Abschnitt 6).
- **Redaktionelle** Änderungen werden gesammelt. Ein Mensch bestätigt sie gemeinsam
  („3 redaktionelle Änderungen übernehmen“, mit Name und Begründung). Danach entsteht eine
  neue Version mit `origin: übernommen_redaktionell`, die ihre Freigabe übernimmt. Ohne diese
  Bestätigung wird keine Freigabe übernommen. Der Nutzer kann eine einzelne Änderung trotzdem
  als „fachlich“ markieren.

### 5.3 Ohne KI-Schlüssel

- Der Vergleich (4.3) läuft vollständig.
- Betroffene Anforderungen erhalten „Quelle geändert – Prüfung nötig“. Die Anwendung schreibt
  keinen Text automatisch um.
- Der Mensch schreibt die neue Version selbst (`origin: manuell`). Die Freigabe ist Pflicht.
- Offline gilt keine Änderung als redaktionell. Es gibt keine automatische Übernahme einer
  Freigabe.

### 5.4 Wann eine Freigabe ungültig wird (ohne Textänderung)

- **Quelle ersetzt**: Eine neuere Version des Quelldokuments ist gültig geworden (`valid_from`
  erreicht oder ohne Datum hochgeladen) und der zitierte Absatz wurde geändert.
- **Gültigkeit abgelaufen**: Die Quellversion hat ein `valid_until`, und das Datum ist überschritten.

Unveränderte Anforderungen behalten ihre Freigabe, solange keiner dieser Fälle eintritt.
Eine ungültige Freigabe wird nicht gelöscht. Sie erscheint als „Freigabe nicht mehr gültig:
‹Grund›“, und die Anforderung kommt auf die Liste für eine erneute Prüfung.
2026- und 2027-Stände werden nie vermischt: Eine Anforderungsversion verweist immer auf genau
eine Quellversion.

## 6. KI-Vorprüfung

### 6.1 Auslöser

Die Vorprüfung startet automatisch im Hintergrund nach jedem KI-Entwurf und nach jeder neuen
Anforderungsversion. Der Prüfer kann sie neu starten („Erneut vorprüfen“).
Für unveränderte, freigegebene Anforderungen läuft keine neue Vorprüfung, ihre Freigabe gilt weiter.

### 6.2 Prüfkriterien

| Kriterium | Frage |
|---|---|
| Quellenbezug | Stützt die zitierte Textstelle die Aussage? |
| Vollständigkeit | Sind Bedingungen, Ausnahmen und Gültigkeitsdatum berücksichtigt? |
| Widersprüche | Passt die Anforderung zu anderen Anforderungen und zum richtigen Dokumentstand? |
| Prüfbarkeit | Lässt sich ein eindeutiger Test mit erwartetem Ergebnis ableiten? |
| Änderungen | Was unterscheidet sich von der zuletzt freigegebenen Version? |

### 6.3 Ergebnis (als Felder dargestellt, nicht als JSON)

| Feld | Beispiel |
|---|---|
| KI-Empfehlung | **Freigabe empfohlen** · **Überarbeitung empfohlen** · **Fachliche Klärung erforderlich** |
| Begründung | „Eine Ausnahme aus dem Quellabschnitt fehlt.“ |
| Beleg | Dokument, Version, Seite und betreffende Textstelle |
| Änderungsvorschlag | „Ergänzung der fehlenden Ausnahme …“ |
| Offene Frage | „Gilt diese Ausnahme auch für den betrachteten Fall?“ |

### 6.4 Markierungen bei „Überarbeitung empfohlen“ oder „Klärung erforderlich“

Alle drei Arten werden angezeigt:
1. **In der Quelle**: Die Textstelle im Dokument, die fehlt oder falsch gelesen wurde, ist
   hervorgehoben.
2. **In der Anforderung**: Das betroffene Wort oder Feld ist hervorgehoben.
3. **Änderungsvorschlag als Vergleich**: der neue Wortlaut neben dem aktuellen (rot/grün). Der
   Mensch übernimmt ihn, passt ihn an oder verwirft ihn. Eine Übernahme erzeugt eine neue
   Anforderungsversion, die wieder vorgeprüft wird.

Die Markierungen müssen sich auf Text beziehen, der tatsächlich vorhanden ist. Das Backend prüft,
dass jede markierte Quellstelle wörtlich (normalisiert) in der genannten Quellversion vorkommt.
Markierungen, die sich nicht belegen lassen, werden verworfen und als „KI-Markierung nicht
belegbar“ angezeigt. Erfundene Fundstellen werden nie angezeigt.

### 6.5 Ohne KI-Schlüssel

Es gibt keine Empfehlung und keinen Ersatz durch Regeln. Die Anforderung zeigt
„KI-Vorprüfung nicht verfügbar (kein Modell verbunden)“. Der Mensch prüft ohne Hilfe. Bei einem
Modellfehler erscheint „KI-Vorprüfung fehlgeschlagen“ mit dem Grund. Es gibt nie eine
vorgetäuschte Antwort.

### 6.6 Freigabe durch den Menschen

- Die Freigabe ist immer möglich, auch gegen die KI-Empfehlung. Die KI hat kein Vetorecht.
- Lautet die Empfehlung nicht „Freigabe empfohlen“, muss die Begründung die offene Frage bzw.
  die Begründung der KI beantworten. Der Datensatz zeigt dann „Freigegeben entgegen
  KI-Empfehlung“ (`against_ai: true`).
- Pflichtangaben wie bisher: Name und fachliche Begründung. Die Zitatprüfung muss bestanden sein.

## 7. Dokumentenablage

- Ein zentraler Bereich unter „Quellen & KI“. Ordner = Dokumenttyp (Abschnitt 3.1).
- Pro Dokument eine Zeile: Name, aktuelle Version, Gültigkeit, Status und das Badge
  „‹n› Anforderungen warten auf Freigabe“.
- **Status** (fünf einfache Werte): „Wird verarbeitet“, „Bereit“, „Fehler beim Lesen“,
  „Ersetzt durch Version X“, „Abgelaufen“. Zurückgezogene Versionen zeigen zusätzlich
  „Zurückgezogen: ‹Grund›“.
- Detailseite des Dokuments: Liste der Versionen mit Datum, Bezeichnung, Gültigkeit und Status,
  der gespeicherte Vergleich zur Vorversion und die verknüpften Anforderungen.
- **Ansehen**: Ein PDF öffnet sich im eingebauten Viewer des Browsers
  (`Content-Type: application/pdf`, `inline`). TXT, MD und DOCX erscheinen als lesbare
  Textseite mit Absatznummern. Keine Konvertierung nach PDF.
- **Download** der Originaldatei für jede Version mit `file_stored=true`.
- Der Bereich aus Bild 1 („Identität & Integrität“ als JSON) wird ersetzt durch beschriftete
  Felder: „Fingerabdruck (SHA-256)“ (gekürzt, ganz kopierbar, mit ⓘ-Erklärung) und
  „Importumfang: vollständiges Dokument“.

## 8. „Ergebnisse & Abdeckung“

- Ein Navigationspunkt „Ergebnisse & Abdeckung“ unter `#results` ersetzt „Prüfberichte“ und
  „Testabdeckung“. `#reports` und `#coverage` leiten mit passendem Filter dorthin weiter.
  Berichtsdetails (`#report/<id>`) bleiben aus der Tabelle erreichbar.
- Oben zwei Diagramme (SVG, ohne externe Bibliothek):
  1. **Ergebnisverteilung**: bestanden / fehlgeschlagen / nicht beurteilbar / veraltet.
  2. **Anforderungsabdeckung**: Anteil der freigegebenen Anforderungen mit aktuellem,
     bestandenem Nachweis, aufgeteilt nach Status.
- Darunter eine filterbare Tabelle mit den Spalten Anforderung (Version, Freigabestatus) →
  Testfälle → letztes Ergebnis → Quelle (Dokument, Version, Seite).
- Deutlich markiert sind:
  - **Fehlend**: freigegebene Anforderung ohne Testfall oder ohne Ergebnis.
  - **Offen**: Testfall mit offenem erwarteten Ergebnis, oder die Anforderung wartet auf Freigabe.
  - **Veraltet**: Testfall oder Ergebnis beruht auf einer älteren Anforderungsversion bzw.
    Quellversion.
- Der Button „Erklären“ (Befund-Assistent) bleibt pro Zeile erhalten.
- Bekommt eine Anforderung eine neue Version, werden ihre alten Testfälle und Ergebnisse als
  „veraltet – basiert auf Version n“ markiert. Nach der Freigabe der neuen Version erzeugt die
  Anwendung neue Testfälle. Die alten Testfälle bleiben als veralteter Nachweis sichtbar.

## 9. Verständliche Darstellung in der ganzen Anwendung

- Im normalen Ablauf werden alle `<pre>`- und JSON-Ausgaben (`app.js`, `automation.js`,
  `workspace.js`) durch beschriftete Felder und Tabellen ersetzt.
- Rohdaten (IDs, Fingerabdrücke, Snapshots) liegen auf Detailseiten in einem eingeklappten
  Bereich „Technische Details“ ganz unten, dort als Feldliste und nicht als JSON. JSON gibt es
  nur noch in Downloads und Exporten.
- Fachbegriffe erhalten ein ⓘ mit einer Erklärung in einem Satz (beim Überfahren mit der Maus
  oder beim Antippen, per Tastatur erreichbar). „Mehr“ führt zum bestehenden Glossar. Neue
  Glossareinträge: Fingerabdruck, Dokumentversion, redaktionelle/fachliche Änderung,
  KI-vorgeprüft, fachlich freigegeben, veraltet, Abdeckung, nicht beurteilbar.

## 10. API (neu bzw. geändert)

| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/api/library/upload` | Datei und Metadaten. Antwort: Duplikat-Hinweis oder Treffervorschlag (Schritt 3) |
| POST | `/api/library/upload/<id>/confirm` | Treffer bestätigen oder „neues Dokument“ wählen, Verarbeitung starten |
| GET | `/api/library` | Ordner, Dokumente, Versionen, Status |
| GET | `/api/library/version/<id>/file` | Originaldatei (`?download=1` als Anhang) |
| GET | `/api/library/version/<id>/text` | lesbarer Text mit Absatznummern |
| GET | `/api/library/diff/<id>` | gespeicherter Vergleich |
| POST | `/api/library/version/<id>/withdraw` | zurückziehen mit Begründung |
| POST | `/api/requirements/<id>/editorial-accept` | redaktionelle Änderungen gemeinsam bestätigen |
| POST | `/api/requirements/<id>/review/rerun` | KI-Vorprüfung neu starten |
| POST | `/api/approve` (geändert) | Freigabe pro Anforderungsversion, `against_ai` wird gesetzt |
| GET | `/api/results` | Daten für „Ergebnisse & Abdeckung“ |

Alle Endpunkte unterliegen wie bisher dem Zugriffstoken, wenn der Netzwerkbetrieb aktiv ist.
Hochgeladene Dateinamen werden nie als Pfad verwendet, nur `<sha256>.<ext>`.

## 11. Nicht im Umfang

- Die Automatisierung behält ihre eigene Paketfreigabe und den Änderungsablauf 30 → 32 Tage.
  Ein Hinweis in den Docs beschreibt diese Lücke.
- Keine Löschung von Dokumenten oder Versionen.
- Keine Seitenauswahl beim PDF-Import mehr.
- Keine Konvertierung von TXT, MD oder DOCX nach PDF.
- Keine Herstellerunterlagen in der Ablage.
- Kein Ersatz der KI-Vorprüfung durch Regeln.

## 12. Fertig, wenn

1. **Unit-Tests** (Standardbibliothek `unittest`, Modell gemockt) für:
   Duplikaterkennung, Treffervorschlag, Absatzvergleich bei verschobenen Seiten, Zuordnung
   betroffener Anforderungen, Übernahme redaktioneller Änderungen, Ungültigwerden einer Freigabe
   (ersetzt / abgelaufen), Migration bestehender Daten, Vertrag der KI-Vorprüfung (Pflichtfelder,
   Verwerfen nicht belegbarer Markierungen, „nicht verfügbar“ ohne Schlüssel, Fehlerfall),
   Freigabe gegen KI-Empfehlung.
2. **Browser-Durchlauf** mit Screenshots: Version 1 hochladen → geänderte Version 2 hochladen →
   Treffer bestätigen → Vergleich ansehen → betroffene Anforderung (mit Empfehlung bzw.
   „nicht verfügbar“) freigeben → Ergebnis und Status „veraltet“ in „Ergebnisse & Abdeckung“.
3. Wie `AGENTS.md` verlangt: alle bestehenden Tests grün, JS-Syntaxprüfung grün, `HANDOFF.md`
   mit beobachteten Tests, genauen Grenzen und nächsten Schritten aktualisiert.

## 13. Offene Punkte

- Soll eine **zurückgezogene** Quellversion die darauf beruhenden Freigaben ungültig machen?
  Im Interview war das kein gewählter Grund (5.4). Vorschlag: ja, weil „falsch“ ein typischer
  Grund für das Zurückziehen ist.
- Schwellwert der Ähnlichkeit für den Treffervorschlag (Schritt 3) und für die Zuordnung der
  Absätze: beim Bau mit den synthetischen Beispieldateien kalibrieren und in `HANDOFF.md`
  festhalten.
- Für den Browser-Durchlauf braucht es eine synthetische zweite Version der Demo-Quelle. Sie
  muss als **fiktiv** gekennzeichnet sein, es dürfen keine erfundenen echten Regeln entstehen.
