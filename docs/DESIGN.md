# ITSG-inspired frontend

The public ITSG site was inspected on 26 October 2026:
https://www.itsg.de/tag/in-eigener-sache/

Its HTML styling uses the red accent `#D50032`; the public child-theme stylesheet refers to
Fira Sans Condensed. AuditFlow adopts the red/white/charcoal language with local system-font
fallbacks, clear tables, restrained borders, red navigation accents and a light sidebar.
No remote font/CDN is required. Pass/fail/unknown statuses retain distinct semantic colors.

The AuditFlow mark is authored SVG. The header's ITSG text is a challenge reference, not an
imported official logo asset. The UI remains explicitly labelled a hackathon prototype.
This is a visual adaptation, not a claim of exact compliance with an unpublished design guide.

Desktop and mobile views are checked through the reproducible browser smoke scripts.

## 0.3 adapted workspace

The supplied Base44 app informed the four workflow cards, evidence assistant panel,
structured test-type selection, PDF range controls, glossary and help patterns. These are
implemented in the existing native frontend (workspace.js), using existing API/status
semantics and ITSG-inspired red tokens. No React bundle, Base44 cloud auth, external
font request, static source excerpt or original sample was imported. The assistant panel
is read-only and labels local evidence explanations separately from real model output.
