# SouthSide (prototype v0.2)

Conservation sites in Southern Malaita (East Are'are, West Are'are and Small Malaita), Malaita Province, Solomon Islands.
A teaching prototype for tourism students: https://reversalredgarnet.github.io/SouthSide/

Static site. No build step. Upload the contents of this folder to a GitHub repo and enable Pages
(Settings > Pages > deploy from branch, root). All paths are relative, and Leaflet is bundled, so it works under
`https://<user>.github.io/<repo>/`.

Open through a web server, not by double-clicking: `python -m http.server`, then visit http://localhost:8000.

## Update content
- `data/sites.json`: one record per site. Each fact lists `source_ids` and a `confidence`.
- `data/sources.json`: the source register. Add a source here before citing it. Each source has an
  `authority_type` and an `organisation` (one fixed spelling), and `trusted` (true/false). Only government,
  provincial, custodian and ngo sources can be trusted, and trust is per organisation. All are `false` for now.
- `data/updates.json`: dated site updates. See "Publishing updates" below.
- `data/constituencies.geojson`: the three constituency boundaries, simplified from the OCHA HDX COD-AB
  (SINSO 2009 census), licence CC BY-IGO 3.0. Source and changes are recorded in the file's `metadata`.
- `assets/templates/`: blank CSV/JSON templates for student researchers.

## Publishing updates
- Only the maintainer publishes. Others ask (the contact text is `REQUEST_CONTACT` in `assets/js/updates.js`).
  Add an entry to `data/updates.json` using the template in the Field Kit (section 6), open `updates-check.html`
  locally, fix every error, then upload `data/updates.json`.
- Primary updates need a source from a trusted organisation and a consent record ID (for example `C01`). Only the ID
  goes in the repo; confirm the consent record exists first. Entries that fail show as community notes marked
  "Needs checking". Community notes are open to anyone and always labelled "Community note, unverified".
- Never put coordinates in an update. Entries that contain them are hidden everywhere until fixed.
- Homepage selection constants (limit, half-life, threshold) are at the top of `assets/js/updates.js`.
- Withdrawing: set `status` to `withdrawn` and `withdrawn_reason` to `consent`, `sensitivity` or `other`. For consent
  or sensitivity, empty the title, summary and body as well. Git history keeps earlier versions of every file, so
  consent must be confirmed in writing before a custodian's story is published.
- Samples: `data/updates.sample.json` holds fictional entries showing every state. Pages load it only with
  `?sample=1` in the address (for example `http://localhost:8000/index.html?sample=1`). Do not upload it.

## Rules
- Prototype only: profiles are desk-sourced and NOT reviewed by custodians. Pages carry `noindex`.
- Never commit true coordinates of sensitive places, private contacts, consent records or raw notes. Git history keeps them.
- Do not copy Protected Planet / WDPA boundaries into this repo (its terms bar redistribution).
- Base map: OpenStreetMap standard tiles, light use only (https://operations.osmfoundation.org/policies/tiles/).
- Content and code licences: not yet chosen. `data/constituencies.geojson` keeps its CC BY-IGO licence.
