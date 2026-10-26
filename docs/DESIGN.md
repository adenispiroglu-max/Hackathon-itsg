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
