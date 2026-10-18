# Are'are–Small Malaita Conservation Atlas (prototype v0.2)

Static site. No build step. Upload the contents of this folder to a GitHub repo and enable Pages
(Settings > Pages > deploy from branch, root). All paths are relative, and Leaflet is bundled, so it works under
`https://<user>.github.io/<repo>/`.

Open through a web server, not by double-clicking: `python -m http.server`, then visit http://localhost:8000.

## Update content
- `data/sites.json`: one record per site. Each fact lists `source_ids` and a `confidence`.
- `data/sources.json`: the source register. Add a source here before citing it.
- `assets/templates/`: blank CSV/JSON templates for student researchers.

## Rules
- Prototype only: profiles are desk-sourced and NOT reviewed by custodians. Pages carry `noindex`.
- Never commit true coordinates of sensitive places, private contacts, consent records or raw notes. Git history keeps them.
- Do not copy Protected Planet / WDPA boundaries into this repo (its terms bar redistribution).
- Base map: OpenStreetMap standard tiles, light use only (https://operations.osmfoundation.org/policies/tiles/).
- Content and code licences: not yet chosen.
