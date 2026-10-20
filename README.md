# SouthSide (prototype v0.2)

Conservation sites in Southern Malaita (East Are'are, West Are'are and Small Malaita), Malaita Province, Solomon Islands.
A teaching prototype for tourism students. The test link is shared privately with the test group; do not add it to any file in this repository.

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

## Research library
- `library.html` lists sources from `data/sources.json` (one register, no second list). A source is listed if a site
  fact cites it, it has `region_tags`, or it is `researcher_submitted`. Custodian sources are never listed; other
  sources stay in the register only.
- Optional fields: `origin`, `evidence_kind`, `taxon_groups`, `summary` (own words, 80 words maximum, never an
  abstract), `region_tags`, and for researcher submissions `citation` and `rights_confirmed`. Allowed values are the
  constants at the top of `assets/js/library.js`. Template and checklist: Field Kit section 7.
- Scope is southern Malaita only: each entry needs a site ID or one of the three constituencies. Entries out of scope,
  without `rights_confirmed: true` (researcher submissions), without a web `url`, or with coordinates in the title,
  summary or citation are hidden and listed in `updates-check.html`.
- No full texts, PDFs, photographs or videos in the repo: entries link out. Traditional knowledge, oral histories and
  custodian material never go in the library; they go through consent and primary updates.

## Media (photos and videos)
- `data/media.json` is a list of credited records. No photo or video file is ever stored in this repository. Items
  posted publicly by an organisation (government, intergovernmental, NGO, community organisation, news outlet) may
  be embedded on the test site, click-to-load only, from the platforms in `EMBED_PROVIDERS` (YouTube no-cookie,
  Facebook posts and videos, Vimeo); everything else links out. Posts from an individual's own account are never
  used. Images on organisations' own websites link out only. Own work and items given with permission are shown only
  as a link to a cleaned copy in the private team folder: never from a social account, never embedded, never video.
  Students prepare entries with Field Kit section 8; only Aziel adds them.
- Every item cites a source in `data/sources.json` and needs `poster_type`, `poster_name`, `reposts_private_photo`
  (for organisation posts), creator, publisher, an `https` address (never embed code), alt text and a rights status.
  `org_published_test_use` needs `approval_note_id`; a re-posted private photo needs a consent or permission record
  ID. No identifiable children (when age is uncertain, leave the item out); identifiable adults only with a consent
  record ID; no location in any field; nothing marked location-sensitive on a site with a map point.
- Release switch: `MEDIA_MODE` at the top of `assets/js/media.js`. Only the exact value `'test'` shows test-use items
  (`not_cleared`, `org_published_test_use`), labelled "Test use only". Any other value hides them. The release gate
  at the top of `updates-check.html` shows the current mode and lists every item to review before a public release.
- Withdrawing: `status` `withdrawn` with `withdrawn_reason` `consent`, `sensitivity`, `rights` or `other`. For the
  first three, empty `caption`, `alt`, `creator`, `source_url` and `folder_url`, and delete any team-folder copy.
- Samples: `data/media.sample.json` (invented records) loads only with `?sample=1`. Do not upload it.

## Design tokens
All values live as CSS custom properties in the `:root` block at the top of `assets/css/styles.css`. Use a token,
never a new literal value.
- Colour: neutrals, the four greens (`--green-1` to `--green-4`) and `--glow`, then role tokens (`--brand`,
  `--chrome`, `--on-chrome` and so on), the trust ramp, the semantic states and the map colours. Brand green is
  chrome only; the glow is decoration only.
- Spacing: `--space-1` to `--space-11` (2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 48 px).
- Type: `--text-xs` to `--text-3xl` (13, 14, 15, 16, 18, 20, 22, 28 px), `--text-code`, and line heights
  `--leading-body`, `--leading-heading`, `--leading-tag`, `--leading-code`. System fonts only (`--sans`).
- Borders and corners: `--border-1` to `--border-3`, `--rule-card` (card and callout rules), `--radius-0`,
  `--radius-sm`, `--radius-round`.
- Focus: `--focus-width`, `--focus-offset` (dark ring with a glow halo), `--target-outline`, `--target-offset`.
- Components: `--wrap-max`, `--gutter`, `--nav-gap` (narrower at 380px and below so the nav fits on one line at
  360px), `--control-h` (2.5rem, 44px on phones) and control padding, `--tag-pad-x`, `--card-pad-left`, `--card-gap`,
  mark and pin sizes, and column minimums.
- Targets: `--target-min` (24px), `--link-pad-y` (taller tap area on links without moving text), `--check-size`,
  `--pin-hit` (28px tappable box around a map marker; `assets/js/common.js` uses the same number) and `--scroll-pad`
  (room inside scrolling tables so focus rings are not cut off).
- Homepage layout: `--wide-max` (map, panels and site list, wider than the text column). From 1100px the map sits in
  a sticky column beside the site list (`--col-site-list`), with its height set by `--map-side-min`, `--map-side-max`
  and `--map-side-room`. The 1100px breakpoint is written in both `assets/css/styles.css` and `assets/js/home.js`;
  keep them the same.
- Left as fixed values on purpose: the constituency outline, label and swatch rules and the attribution link rule
  (not to be changed), the stacked map's height, and the drawing geometry of the confidence marks and legend swatches.

## Rules
- Prototype only: profiles are desk-sourced and NOT reviewed by custodians. Pages carry `noindex`. `noindex` is not
  access control: anyone with the address can open every page and data file.
- Never commit true coordinates of sensitive places, private contacts, consent records, permission records, raw notes,
  or photo and video files. Git history keeps them.
- Do not copy Protected Planet / WDPA boundaries into this repo (its terms bar redistribution).
- Base map: OpenStreetMap standard tiles, light use only (https://operations.osmfoundation.org/policies/tiles/).
- No external requests on page load except OpenStreetMap map tiles. Embeds request nothing until a viewer presses
  Load, and pages may only frame the hosts in `EMBED_PROVIDERS`, enforced by the Content-Security-Policy meta tag on
  every page (keep the two in step; `updates-check.html` compares them). No inline scripts, event handlers or styles.
- Content and code licences: not yet chosen. `data/constituencies.geojson` keeps its CC BY-IGO licence. Media belongs
  to its credited creators; see each item's rights status.
