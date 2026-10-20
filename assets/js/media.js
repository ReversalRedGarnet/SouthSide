/* Media: photos and videos. No photo or video file is ever stored in this repository.
   - Posted publicly by an organisation: credited, linked, and (for allowlisted platforms) embedded on click only.
   - Own work or given with permission: shown only as a link to the private team folder; never from a social account.
   - Never from a person's own account.
   Needs common.js and updates.js loaded first. */
(function () {
  var A = window.Atlas, U = window.Updates;

  // ---- The release switch. This is the only place it is set. ----
  // Only the exact value 'test' shows test-use items ("Test use only" labels). Any other value, a typo or a missing
  // value hides them, so forgetting to change it back fails safe.
  var MEDIA_MODE = 'release';

  // ---- Who posted it ----
  var POSTER_TYPES = {
    government: 'Government', intergovernmental: 'Intergovernmental organisation', ngo: 'NGO',
    community_org: 'Community organisation', news_outlet: 'News outlet', individual: 'A person’s own account'
  };
  var ALLOWED_POSTERS = ['government', 'intergovernmental', 'ngo', 'community_org', 'news_outlet'];   // all except individual
  var ALLOW_OPEN_LICENCE_FROM_INDIVIDUALS = false;   // Aziel to confirm. While false, individuals are refused even with an open licence.
  var INDIVIDUAL_REASON = 'Not allowed: officials only permit material posted by an organisation. A post from a person’s own account cannot be used, even if it is public.';

  // ---- Rights ----
  var RIGHTS = {
    org_published_test_use: 'Published by an organisation; agreed with officials for test use only',
    not_cleared: 'Not cleared',
    open_licence: 'Open licence',
    own_work: 'Own work',
    permission_given: 'Permission given by the creator'
  };
  var TEST_ONLY_RIGHTS = { not_cleared: 'Test use only, rights not cleared', org_published_test_use: 'Test use only, published by an organisation' };
  var POSTED_RIGHTS = ['org_published_test_use', 'not_cleared', 'open_licence'];  // public posts: linked or embedded, never copied
  var HELD_RIGHTS = ['own_work', 'permission_given'];                             // team-folder link only, never embedded
  var EMBEDDABLE_RIGHTS = ['org_published_test_use', 'open_licence'];

  // ---- Embeds: built here from the post address, never from pasted code. Click-to-load only. ----
  // The frame hosts must match frame-src in the Content-Security-Policy meta tag of every page (checked on updates-check.html).
  var EMBED_PROVIDERS = [
    { name: 'YouTube', host: 'https://www.youtube-nocookie.com', note: 'YouTube may set cookies', build: function (u) {
      var h = u.hostname, id = null, m;
      if (h === 'youtu.be') { m = u.pathname.match(/^\/([\w-]{11})$/); id = m && m[1]; }
      else if (h === 'www.youtube.com' || h === 'youtube.com' || h === 'm.youtube.com') {
        if (u.pathname === '/watch') id = u.searchParams.get('v');
        else { m = u.pathname.match(/^\/(?:shorts|live)\/([\w-]{11})\/?$/); id = m && m[1]; }
      }
      return id && /^[\w-]{11}$/.test(id) ? { src: 'https://www.youtube-nocookie.com/embed/' + id, shape: 'video' } : null;
    } },
    { name: 'Facebook', host: 'https://www.facebook.com', note: 'Facebook may set cookies or record your visit', build: function (u) {
      if (['www.facebook.com', 'facebook.com', 'm.facebook.com', 'web.facebook.com'].indexOf(u.hostname) === -1) return null;
      var p = u.pathname, q = u.searchParams, m, href = null, plugin = 'post';
      if ((m = p.match(/^\/([A-Za-z0-9.]{1,80})\/posts\/([A-Za-z0-9]{1,100})\/?$/))) href = 'https://www.facebook.com/' + m[1] + '/posts/' + m[2];
      else if ((m = p.match(/^\/([A-Za-z0-9.]{1,80})\/videos\/(\d{1,25})\/?$/))) { href = 'https://www.facebook.com/' + m[1] + '/videos/' + m[2]; plugin = 'video'; }
      else if (p === '/permalink.php' && /^[A-Za-z0-9]{1,100}$/.test(q.get('story_fbid') || '') && /^\d{1,25}$/.test(q.get('id') || '')) {
        href = 'https://www.facebook.com/permalink.php?story_fbid=' + q.get('story_fbid') + '&id=' + q.get('id');
      } else if (/^\/photo(\.php|\/)?$/.test(p) && /^\d{1,25}$/.test(q.get('fbid') || '')) href = 'https://www.facebook.com/photo/?fbid=' + q.get('fbid');
      if (!href) return null;
      return { src: 'https://www.facebook.com/plugins/' + plugin + '.php?href=' + encodeURIComponent(href) + (plugin === 'post' ? '&show_text=true&width=500' : '&show_text=false&width=560'), shape: plugin === 'post' ? 'post' : 'video' };
    } },
    { name: 'Vimeo', host: 'https://player.vimeo.com', note: 'Vimeo may set cookies', build: function (u) {
      if (u.hostname !== 'vimeo.com' && u.hostname !== 'www.vimeo.com') return null;
      var m = u.pathname.match(/^\/(\d{1,12})\/?$/);
      return m ? { src: 'https://player.vimeo.com/video/' + m[1] + '?dnt=1', shape: 'video' } : null;
    } }
  ];
  // Own work and permission items never come from these.
  var SOCIAL_HOSTS = ['facebook.com', 'fb.watch', 'instagram.com', 'youtube.com', 'youtu.be', 'vimeo.com', 'x.com', 'twitter.com', 'tiktok.com', 'linkedin.com', 'threads.net'];

  // ---- Limits and lists ----
  var MEDIA_FILE = 'data/media.json';
  var MEDIA_SAMPLE_FILE = 'data/media.sample.json';   // local only, never uploaded; loads with ?sample=1
  var CAPTION_MAX_WORDS = 50;
  var ALT_MIN_CHARS = 20;
  var FILE_MAX_BYTES = 400 * 1024;                     // team-folder files only
  var FILE_MAX_EDGE = 1600;                            // px, long edge; team-folder files only
  var KINDS = { image: 'Photo', video: 'Video' };
  var PEOPLE = {
    none: 'No people', not_identifiable: 'People, not identifiable', identifiable_adults: 'Identifiable adults',
    identifiable_children: 'Identifiable children, or age uncertain (never shown)'
  };
  var SENSITIVITY = { none: 'None', generalise: 'Generalise', withhold: 'Withhold' };
  var REPOSTS = ['yes', 'no', 'unknown'];
  var WITHDRAWN_REASONS = ['consent', 'sensitivity', 'rights', 'other'];
  var BLANK_WHEN_WITHDRAWN = ['consent', 'sensitivity', 'rights'];
  var BLANK_FIELDS = ['caption', 'alt', 'creator', 'source_url', 'folder_url'];
  var LOCATION_FIELDS = ['lat', 'lng', 'lon', 'latitude', 'longitude', 'gps', 'coordinates', 'geo', 'geotag', 'location'];
  var CODE_FIELDS = ['embed_html', 'embed_code', 'iframe', 'html'];
  var CONSENT_ID = /^C\d{2,}$/;      // consent record, as in assets/templates/consent-record-template.csv
  var RIGHTS_ID = /^P\d{2,}$/;       // private permission record
  var APPROVAL_ID = /^A\d{2,}$/;     // private record of the officials' agreement
  var SOURCE_ID = /^S\d+$/;

  // ---- Rules: [level, hides the item, plain explanation]. Reports show item id, rule name and this text only. ----
  var RULES = {
    'media-file-not-list': ['error', false, 'data/media.json must be a list ([]).'],
    'id-missing': ['error', false, 'The item has no id.'],
    'id-duplicate': ['error', false, 'Another item has the same id.'],
    'status-invalid': ['error', true, 'status must be published or withdrawn. Hidden until fixed.'],
    'withdrawn-reason': ['error', false, 'Withdrawn, but withdrawn_reason is not consent, sensitivity, rights or other.'],
    'withdrawn-not-blank': ['error', false, 'Withdrawn for consent, sensitivity or rights, so caption, alt, creator, source_url and folder_url must be blank. The text is still readable in the public data file.'],
    'html-pasted': ['error', true, 'A field contains HTML or embed code. Only the post address is stored; the site builds any embed itself. Hidden until removed.'],
    'coords-in-text': ['error', true, 'A text field looks like it contains coordinates. Hidden until removed.'],
    'location-field': ['error', true, 'The item has a location field. Media records never carry a location. Hidden until removed.'],
    'kind-invalid': ['error', true, 'kind must be image or video. Hidden until fixed.'],
    'rights-invalid': ['error', true, 'rights_status is missing or not one of the list. Hidden until fixed.'],
    'poster-individual': ['error', true, INDIVIDUAL_REASON],
    'poster-type-unknown': ['error', true, 'poster_type is missing or not one of: ' + ALLOWED_POSTERS.join(', ') + '. Hidden until fixed.'],
    'poster-name-missing': ['error', true, 'poster_name is missing: say which organisation posted it. Hidden until fixed.'],
    'repost-unknown': ['error', true, 'It is not known whether this re-posts a private person’s photo. Find out first; until then it is hidden.'],
    'repost-unproven': ['error', true, 'Re-posts a private person’s photo without a consent_note_id (C01) or rights_note_id (P01) proving that person’s consent. Hidden until fixed.'],
    'url-not-single-https': ['error', true, 'source_url must be a single https address, with no spaces or login details. Hidden until fixed.'],
    'credit-missing': ['error', true, 'creator is missing. Every item is credited as the original credits it. Hidden until fixed.'],
    'publisher-missing': ['error', true, 'publisher is missing. Hidden until fixed.'],
    'source-missing': ['error', true, 'source_id is missing. Hidden until fixed.'],
    'source-unknown': ['error', true, 'The source_id is not in data/sources.json. Hidden until fixed.'],
    'alt-missing': ['error', true, 'alt text is missing. Hidden until fixed.'],
    'alt-weak': ['error', true, 'alt text is shorter than ' + ALT_MIN_CHARS + ' characters, or looks like a filename or "image of". Hidden until fixed.'],
    'caption-missing': ['error', false, 'caption is missing.'],
    'caption-too-long': ['error', false, 'caption is over ' + CAPTION_MAX_WORDS + ' words. Not shown until shortened.'],
    'date-published-invalid': ['error', false, 'date_published must be a real date written YYYY-MM-DD.'],
    'date-captured-invalid': ['error', false, 'date_captured must be YYYY-MM-DD, or null when unknown.'],
    'date-captured-after': ['error', false, 'date_captured is after date_published.'],
    'site-missing': ['error', true, 'site_ids needs at least one site. Hidden until fixed.'],
    'site-unknown': ['error', false, 'A site id is not in data/sites.json.'],
    'licence-missing': ['error', true, 'Open licence, but licence is missing. Hidden until fixed.'],
    'rights-note-missing': ['error', true, 'Permission given, but rights_note_id (P01) is missing or malformed. Hidden until fixed.'],
    'approval-missing': ['error', true, 'Published by an organisation for test use, but approval_note_id (A01) for the officials’ agreement is missing or malformed. Hidden until fixed.'],
    'people-invalid': ['error', true, 'people_shown is missing or not one of the list. When unsure of age, treat as a child and leave the item out.'],
    'children': ['error', true, 'Shows identifiable children, or a person of uncertain age. Never shown.'],
    'adults-no-consent': ['error', true, 'Shows identifiable adults without a consent_note_id (C01). Hidden until fixed.'],
    'sensitivity-invalid': ['error', true, 'location_sensitivity must be none, generalise or withhold. Hidden until fixed.'],
    'sensitive-on-pinned-site': ['error', true, 'Marked location-sensitive, but a linked site shows a map point. Hidden until fixed.'],
    'held-needs-folder': ['error', true, 'Own work and permission items are shown only as a team-folder link: folder_url and the prepared file record are required. Hidden until fixed.'],
    'held-from-social': ['error', true, 'Own work and permission items never come from a social media account. Hidden until fixed.'],
    'held-video': ['error', true, 'Videos are never held, not even in the team folder. Hidden until removed.'],
    'posted-held-copy': ['error', true, 'Items posted by others must not be copied: remove folder_url and file. Hidden until fixed.'],
    'file-not-cleaned': ['error', true, 'No record that location data (EXIF/GPS) was removed. Run the file through the Field Kit tool first.'],
    'file-too-large': ['error', true, 'File size is missing or over ' + (FILE_MAX_BYTES / 1024) + ' KB. Hidden until fixed.'],
    'file-too-big': ['error', true, 'File dimensions are missing or over ' + FILE_MAX_EDGE + ' px on the long edge. Hidden until fixed.'],
    'captions-invalid': ['warning', false, 'captions_available should be yes, no or unknown.'],
    'embed-not-allowlisted': ['info', false, 'The address is not one the site can embed, so it is shown as a link only.'],
    'csp-frame-hosts-mismatch': ['error', false, 'The frame hosts in this page’s Content-Security-Policy do not match EMBED_PROVIDERS in assets/js/media.js.']
  };

  var esc = A.esc;
  function testMode() { return MEDIA_MODE === 'test'; }
  function words(s) { return String(s || '').trim().split(/\s+/).filter(Boolean).length; }
  function isoDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var p = s.split('-').map(Number), t = Date.UTC(p[0], p[1] - 1, p[2]), d = new Date(t);
    return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2] ? t : null;
  }
  function weakAlt(a) {
    a = String(a || '').trim();
    return a.length < ALT_MIN_CHARS || /^(an? )?(image|photo|picture|video) of\b/i.test(a) ||
      /\.(jpe?g|png|gif|webp|heic|mp4|mov)$/i.test(a) || /^(img|dsc|pxl|vid)[_-]?\d+/i.test(a);
  }
  // HTML or embed code: any tag, an escaped tag, or "iframe src". The plain word "iframe" in a sentence is fine.
  function hasHtml(s) { return typeof s === 'string' && /<\s*\/?\s*[a-z!]|&lt;\s*\/?\s*[a-z!]|\biframe\b[^.]*\bsrc\s*=/i.test(s); }
  function coords(s) { return U ? U.findCoords(s) : null; }
  function mapPinned(site) { return !!(site && site.location && site.location.lat != null && site.location.lng != null); }
  // A single https address with no spaces, quotes, angle brackets, login details or port.
  function parseUrl(s) {
    if (typeof s !== 'string' || /[\s<>"'`]/.test(s)) return null;
    try { var u = new URL(s); } catch (e) { return null; }
    return u.protocol === 'https:' && !u.username && !u.password && !u.port ? u : null;
  }
  function onSocial(s) {
    var u = parseUrl(s); if (!u) return false;
    return SOCIAL_HOSTS.some(function (h) { return u.hostname === h || u.hostname.slice(-(h.length + 1)) === '.' + h; });
  }
  function embedFromUrl(s) {
    var u = parseUrl(s); if (!u) return null;
    for (var i = 0; i < EMBED_PROVIDERS.length; i++) {
      var b = EMBED_PROVIDERS[i].build(u);
      if (b) return { provider: EMBED_PROVIDERS[i], src: b.src, shape: b.shape };
    }
    return null;
  }
  function embedFor(e) {
    if (e.embed === false || EMBEDDABLE_RIGHTS.indexOf(e.rights_status) === -1) return null;
    return embedFromUrl(e.source_url);
  }
  function posterAllowed(type, rights) {
    if (ALLOWED_POSTERS.indexOf(type) !== -1) return true;
    return type === 'individual' && ALLOW_OPEN_LICENCE_FROM_INDIVIDUALS && rights === 'open_licence';
  }

  // ---- Loading ----
  function load() {
    var smp = U && U.sampleMode() ? A.loadJSON(MEDIA_SAMPLE_FILE).catch(function () { return null; }) : Promise.resolve(null);
    return Promise.all([A.loadAll(), A.loadJSON(MEDIA_FILE), smp]).then(function (r) {
      var d = r[0], live = r[1], s = r[2];
      var items = (Array.isArray(live) ? live : []).concat(s && Array.isArray(s.media) ? s.media : []);
      var sources = {};
      d.sourceList.concat(s && Array.isArray(s.sources) ? s.sources : []).forEach(function (x) { sources[x.id] = x; });
      var m = check(items, sources, d.sites);
      m.sampleLoaded = !!s;
      if (!Array.isArray(live)) m.issues.unshift(issue('data/media.json', 'media-file-not-list'));
      return m;
    });
  }
  function issue(where, rule, param) {
    return { where: where, rule: rule, level: RULES[rule][0], msg: RULES[rule][2] + (param ? ' (' + param + ')' : '') };
  }

  // ---- Checks ----
  function check(items, sources, siteList) {
    var issues = [], sites = {}, seen = {}, entries = [];
    siteList.forEach(function (s) { sites[s.id] = s; });

    items.forEach(function (e) {
      e = e || {};
      var id = e.id ? String(e.id) : '(no id)';
      var v = { e: e, id: id, hidden: false, captionOk: true, testOnly: !!TEST_ONLY_RIGHTS[e.rights_status] };
      // param is only ever a field name or a register id, never entry text.
      function add(rule, param) { issues.push(issue('Media ' + id, rule, param)); if (RULES[rule][1]) v.hidden = true; }

      if (!e.id) add('id-missing');
      else if (seen[e.id]) add('id-duplicate');
      seen[e.id] = true;

      // Checked on every item, withdrawn ones too, because the file is public.
      Object.keys(e).forEach(function (k) { if (CODE_FIELDS.indexOf(k) !== -1 || hasHtml(e[k])) add('html-pasted', k); });
      ['caption', 'alt', 'creator', 'publisher', 'poster_name'].forEach(function (f) { if (coords(e[f])) add('coords-in-text', f); });
      LOCATION_FIELDS.forEach(function (f) { if (e[f] != null) add('location-field', f); });

      if (e.status === 'withdrawn') {
        v.hidden = true; v.withdrawn = true;
        if (WITHDRAWN_REASONS.indexOf(e.withdrawn_reason) === -1) add('withdrawn-reason');
        else if (BLANK_WHEN_WITHDRAWN.indexOf(e.withdrawn_reason) !== -1 && BLANK_FIELDS.some(function (f) { return e[f]; })) add('withdrawn-not-blank');
        entries.push(v); return;
      }
      if (e.status !== 'published') { add('status-invalid'); entries.push(v); return; }

      if (!KINDS[e.kind]) add('kind-invalid');
      if (!e.creator) add('credit-missing');
      if (!e.publisher) add('publisher-missing');
      if (!e.source_id) add('source-missing');
      else if (!sources[e.source_id]) add('source-unknown', e.source_id);
      if (!e.alt) add('alt-missing');
      else if (weakAlt(e.alt)) add('alt-weak');
      if (!e.caption) add('caption-missing');
      else if (words(e.caption) > CAPTION_MAX_WORDS) { v.captionOk = false; add('caption-too-long'); }
      var pub = isoDate(e.date_published), cap = e.date_captured == null ? null : isoDate(e.date_captured);
      if (pub == null) add('date-published-invalid');
      if (e.date_captured != null && cap == null) add('date-captured-invalid');
      if (pub != null && cap != null && cap > pub) add('date-captured-after');
      var siteIds = Array.isArray(e.site_ids) ? e.site_ids : [];
      if (!siteIds.length) add('site-missing');
      siteIds.forEach(function (sid) { if (!sites[sid]) add('site-unknown', sid); });

      // Posted by an organisation, or held by the team.
      var posted = POSTED_RIGHTS.indexOf(e.rights_status) !== -1, held = HELD_RIGHTS.indexOf(e.rights_status) !== -1;
      if (!posted && !held) add('rights-invalid');
      if (posted) {
        if (e.poster_type === 'individual' && !posterAllowed('individual', e.rights_status)) add('poster-individual');
        else if (!posterAllowed(e.poster_type, e.rights_status)) add('poster-type-unknown');
        if (!e.poster_name) add('poster-name-missing');
        if (REPOSTS.indexOf(e.reposts_private_photo) === -1 || e.reposts_private_photo === 'unknown') add('repost-unknown');
        else if (e.reposts_private_photo === 'yes' && !CONSENT_ID.test(e.consent_note_id || '') && !RIGHTS_ID.test(e.rights_note_id || '')) add('repost-unproven');
        if (!parseUrl(e.source_url)) add('url-not-single-https');
        if (e.folder_url || e.file) add('posted-held-copy');
        if (e.rights_status === 'org_published_test_use' && !APPROVAL_ID.test(e.approval_note_id || '')) add('approval-missing');
        if (e.rights_status === 'open_licence' && !e.licence) add('licence-missing');
        if (EMBEDDABLE_RIGHTS.indexOf(e.rights_status) !== -1 && e.embed !== false && parseUrl(e.source_url) && !embedFromUrl(e.source_url)) add('embed-not-allowlisted');
      }
      if (held) {
        if (e.kind === 'video') add('held-video');
        if (e.source_url && !parseUrl(e.source_url)) add('url-not-single-https');
        if (onSocial(e.source_url) || onSocial(e.folder_url)) add('held-from-social');
        if (e.rights_status === 'permission_given' && !RIGHTS_ID.test(e.rights_note_id || '')) add('rights-note-missing');
        var f = e.file || {};
        if (!parseUrl(e.folder_url) || !e.file) add('held-needs-folder');
        else {
          if (f.exif_stripped !== true) add('file-not-cleaned');
          if (!(f.bytes > 0) || f.bytes > FILE_MAX_BYTES) add('file-too-large');
          if (!(f.width > 0 && f.height > 0) || Math.max(f.width, f.height) > FILE_MAX_EDGE) add('file-too-big');
        }
      }

      // People: children (or an uncertain age) are never shown; identifiable adults need consent.
      if (!PEOPLE[e.people_shown]) add('people-invalid');
      else if (e.people_shown === 'identifiable_children') add('children');
      else if (e.people_shown === 'identifiable_adults' && !CONSENT_ID.test(e.consent_note_id || '')) add('adults-no-consent');
      // Sensitive locations: nothing marked sensitive on a site that shows a map point.
      if (!SENSITIVITY[e.location_sensitivity]) add('sensitivity-invalid');
      else if (e.location_sensitivity !== 'none') {
        var pinned = siteIds.filter(function (sid) { return mapPinned(sites[sid]); });
        if (pinned.length) add('sensitive-on-pinned-site', pinned.join(', '));
      }
      if (e.kind === 'video' && e.captions_available != null && ['yes', 'no', 'unknown'].indexOf(e.captions_available) === -1) add('captions-invalid');
      entries.push(v);
    });
    return { entries: entries, issues: issues, sites: sites };
  }

  function visible(m) { return m.entries.filter(function (v) { return !v.hidden && (!v.testOnly || testMode()); }); }
  function listed(m, f) { return m.entries.filter(function (v) { return !v.withdrawn && f(v.e); }); }

  // ---- Rendering. Nothing is requested from outside the site until a viewer presses Load. ----
  var EMBEDS = {};
  function card(v, n) {
    var e = v.e, k = KINDS[e.kind], posted = POSTED_RIGHTS.indexOf(e.rights_status) !== -1, emb = embedFor(e);
    var dates = [];
    if (e.date_published) dates.push('Published ' + esc(A.fmtDate(e.date_published)));
    dates.push(e.date_captured ? (e.kind === 'video' ? 'Recorded ' : 'Taken ') + esc(A.fmtDate(e.date_captured)) : 'Date taken unknown');
    var rights = e.rights_status === 'open_licence' ? 'Open licence (' + esc(e.licence) + ')' : esc(RIGHTS[e.rights_status]);
    var link = posted
      ? '<a href="' + esc(e.source_url) + '" rel="noopener">' + (e.kind === 'video' ? 'Watch on ' : 'View the original on ') + esc(e.publisher) + '</a>'
      : '<a href="' + esc(e.folder_url) + '" rel="noopener">View in the team folder (sign-in needed)</a>';
    var load = '';
    if (emb) {
      var key = 'm' + n; EMBEDS[key] = { src: emb.src, shape: emb.shape, title: k + ' from ' + (e.poster_name || e.publisher) + ' on ' + emb.provider.name };
      var label = 'Load from ' + emb.provider.name + ' (' + emb.provider.note + ')';
      load = '<p><button type="button" class="btn media-load" data-embed="' + key + '" data-label="' + esc(label) + '" aria-expanded="false">' + esc(label) + '</button></p>' +
        '<div class="media-embed"></div><p class="small muted">If nothing appears, open the original.</p>';
    }
    return '<article class="media-item">' +
      '<p class="media-kind"><strong>' + esc(k) + '</strong>' +
      (v.testOnly ? ' <span class="chip chip-caution chip-check">' + esc(TEST_ONLY_RIGHTS[e.rights_status]) + '</span>' : '') +
      (e.sample ? ' <span class="chip chip-neutral">Sample</span>' : '') + '</p>' +
      (e.caption && v.captionOk ? '<p class="media-caption">' + esc(e.caption) + '</p>' : '') +
      '<p class="small">What it shows: ' + esc(e.alt) + '</p>' +
      '<p class="media-credit">' + (posted ? 'Posted by ' + esc(e.poster_name) + ' (' + esc(POSTER_TYPES[e.poster_type]) + ') on ' + esc(e.publisher) + ' &middot; ' : '') +
        'Credit: ' + esc(e.creator) + ' &middot; ' + dates.join(' &middot; ') + '</p>' +
      '<p class="small">Rights: ' + rights + (e.people_shown === 'identifiable_adults' ? ' &middot; People shown: consent on record' : '') +
      (e.kind === 'video' ? ' &middot; ' + (e.duration ? 'Length ' + esc(e.duration) + ' &middot; ' : '') + 'Captions: ' + esc(e.captions_available || 'unknown') : '') + '</p>' +
      load +
      '<p class="small">' + link + '</p>' +
      '</article>';
  }
  // Load builds the frame with DOM calls (no HTML strings); Unload removes it. The original link never goes away.
  function toggleEmbed(btn) {
    var emb = EMBEDS[btn.getAttribute('data-embed')], slot = btn.closest('.media-item').querySelector('.media-embed');
    if (!emb || !slot) return;
    if (slot.firstChild) {
      slot.textContent = '';
      btn.textContent = btn.getAttribute('data-label'); btn.setAttribute('aria-expanded', 'false');
      return;
    }
    var f = document.createElement('iframe');
    f.className = 'media-frame media-frame-' + emb.shape;
    f.title = emb.title;
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-presentation');
    f.setAttribute('allow', 'encrypted-media; picture-in-picture; fullscreen');
    f.setAttribute('allowfullscreen', '');
    f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    f.src = emb.src;
    slot.appendChild(f);
    btn.textContent = 'Unload'; btn.setAttribute('aria-expanded', 'true');
  }
  function notices(m) {
    return (m.sampleLoaded ? '<p class="callout callout-info small"><strong>Sample mode.</strong> Fictional sample media are mixed in because the address ends in ?sample=1. Each one carries a Sample label.</p>' : '') +
      (testMode() ? '<p class="callout callout-caution small"><strong>Test mode.</strong> Test-use items are shown for private testing only. Do not download, screenshot or repost them.</p>' : '');
  }
  function fail(el, err) { el.innerHTML = '<p class="muted">Media could not be loaded (' + esc(err.message) + ').</p>'; }

  // Profile: the media for one site, newest first.
  function renderSite(el, siteId) {
    load().then(function (m) {
      var vs = visible(m).filter(function (v) { return (v.e.site_ids || []).indexOf(siteId) !== -1; })
        .sort(function (a, b) { return String(b.e.date_published).localeCompare(String(a.e.date_published)); });
      el.innerHTML = notices(m) + (vs.length
        ? '<p class="small muted">Photos and videos are not stored here. Each one is credited and links to where it was published. Embedded posts load only when you press Load.</p><div class="media-list">' + vs.map(card).join('') + '</div>'
        : A.emptyState('No photos or videos for this site yet.', 'Next step: see <a href="kit.html#media-intake">how to add a photo or video</a> in the Field Kit.'));
      el.addEventListener('click', function (ev) { var b = ev.target.closest('.media-load'); if (b) toggleEmbed(b); });
      if (U) U.keepSample();
    }).catch(function (err) { fail(el, err); });
  }

  // ---- updates-check.html: the release gate and the media problems ----
  function cspIssues() {
    var meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    var m = meta && meta.getAttribute('content').match(/frame-src([^;]*)/);
    var inPage = m ? m[1].trim().split(/\s+/).filter(Boolean).sort() : [];
    var inCode = EMBED_PROVIDERS.map(function (p) { return p.host; }).sort();
    return inPage.join(' ') === inCode.join(' ') ? [] : [issue('This page', 'csp-frame-hosts-mismatch')];
  }
  function table(rows) {
    return '<div class="table-scroll"><table class="stack"><thead><tr><th scope="col">Where</th><th scope="col">Level</th><th scope="col">Rule</th><th scope="col">What it means</th></tr></thead><tbody>' +
      rows.map(function (i) {
        var chip = i.level === 'error' ? 'chip-danger">Error' : i.level === 'warning' ? 'chip-caution">Warning' : 'chip-neutral">Info';
        return '<tr><th scope="row">' + esc(i.where) + '</th><td data-label="Level"><span class="chip ' + chip + '</span></td>' +
          '<td data-label="Rule"><code>' + esc(i.rule) + '</code></td><td data-label="What it means">' + esc(i.msg) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function ids(vs) { return vs.length ? esc(vs.map(function (v) { return v.id; }).join(', ')) + ' (' + vs.length + ')' : 'None'; }
  function renderGate(gate, report) {
    load().then(function (m) {
      var issues = cspIssues().concat(m.issues);
      var nc = listed(m, function (e) { return e.rights_status === 'not_cleared'; });
      var org = listed(m, function (e) { return e.rights_status === 'org_published_test_use'; });
      var comm = listed(m, function (e) { return e.poster_type === 'community_org'; });
      var errors = issues.filter(function (i) { return i.level === 'error'; }).length;
      var blockers = [];
      if (testMode()) blockers.push('Media mode is "test", so test-use items are shown.');
      if (nc.length) blockers.push(nc.length + ' item(s) still not cleared.');
      if (org.length) blockers.push(org.length + ' organisation-published item(s) agreed for test use only: review each before any public release.');
      if (comm.length) blockers.push(comm.length + ' community organisation item(s): review each before any public release.');
      if (errors) blockers.push(errors + ' media problem(s) listed below.');
      gate.innerHTML = notices(m) +
        '<p class="callout ' + (blockers.length ? 'callout-danger' : 'callout-info') + '"><strong>' + (blockers.length ? 'Not ready for public release.' : 'No release blockers in media.') + '</strong></p>' +
        '<table class="facts"><tbody>' +
        '<tr><th scope="row">Media mode</th><td><strong>' + esc(MEDIA_MODE) + '</strong>. ' + (testMode()
          ? 'Test-use items are shown with a "Test use only" label. Set <code>MEDIA_MODE</code> back to <code>\'release\'</code> in <code>assets/js/media.js</code> before any public release.'
          : 'Test-use items are hidden everywhere. Only the exact value <code>\'test\'</code> in <code>assets/js/media.js</code> shows them.') + '</td></tr>' +
        '<tr><th scope="row">Not cleared</th><td>' + ids(nc) + '</td></tr>' +
        '<tr><th scope="row">Published by an organisation, test use only (review)</th><td>' + ids(org) + '</td></tr>' +
        '<tr><th scope="row">Community organisation items (review)</th><td>' + ids(comm) + '</td></tr>' +
        '<tr><th scope="row">Individuals allowed with an open licence</th><td>' + (ALLOW_OPEN_LICENCE_FROM_INDIVIDUALS ? 'Yes' : 'No (waiting for Aziel)') + '</td></tr>' +
        '<tr><th scope="row">Embeds allowed from</th><td>' + esc(EMBED_PROVIDERS.map(function (p) { return p.name + ' (' + p.host.replace('https://', '') + ')'; }).join(', ')) + '</td></tr>' +
        '<tr><th scope="row">Media items</th><td>' + m.entries.length + ' in total, ' + visible(m).length + ' shown in the current mode, ' +
          m.entries.filter(function (v) { return v.withdrawn; }).length + ' withdrawn.</td></tr>' +
        '</tbody></table>' +
        (blockers.length ? '<ul>' + blockers.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>' : '');
      report.innerHTML = issues.length ? table(issues) : '<p>No media problems.</p>';
      if (U) U.keepSample();
    }).catch(function (err) { fail(gate, err); fail(report, err); });
  }

  // ---- Field Kit: build a media.json entry in the browser. Nothing is sent anywhere, and no address is fetched. ----
  function renderForm(form) {
    var out = document.getElementById('media-out'), need = document.getElementById('media-need');
    var copyBtn = document.getElementById('media-copy'), dlBtn = document.getElementById('media-dl');
    var fileInput = document.getElementById('media-file'), fileNote = document.getElementById('media-file-note');
    var preview = document.getElementById('media-preview'), embedNote = document.getElementById('media-embed-status');
    var fileInfo = null, sites = {}, last = '';
    function val(n) { var el = form.elements[n]; return el ? String(el.value).trim() : ''; }
    function show(name, on) { form.querySelectorAll('[data-when="' + name + '"]').forEach(function (el) { el.hidden = !on; }); }

    function build() {
      var miss = [], stop = [];
      var who = val('poster_type'), team = who === 'team', posted = !!who && !team;
      var kind = val('kind'), rights = val('rights_status'), people = val('people_shown'), sens = val('location_sensitivity'), repost = val('reposts_private_photo');
      var siteIds = [].slice.call(form.querySelectorAll('input[name="site_ids"]:checked')).map(function (c) { return c.value; });
      // Rights that fit the answer to "Who posted it?"
      [].forEach.call(form.elements.rights_status.options, function (o) {
        if (o.value) o.disabled = !who || (team ? HELD_RIGHTS.indexOf(o.value) === -1 : POSTED_RIGHTS.indexOf(o.value) === -1);
      });
      var rightsOk = rights && (team ? HELD_RIGHTS : POSTED_RIGHTS).indexOf(rights) !== -1;
      show('poster', posted);
      show('repost_ids', posted && repost === 'yes');
      show('approval', rights === 'org_published_test_use');
      show('licence', rights === 'open_licence');
      show('rights_note', rights === 'permission_given');
      show('consent', people === 'identifiable_adults');
      show('video', kind === 'video');
      show('held', team);

      // 1. Who posted it: asked first.
      if (!who) miss.push('who posted it');
      else if (who === 'individual' && !posterAllowed('individual', rights)) stop.push(INDIVIDUAL_REASON);
      if (posted && !val('poster_name')) miss.push('the name of the organisation that posted it');
      if (posted) {
        if (!repost) miss.push('whether this re-posts a private person’s photo');
        else if (repost === 'unknown') stop.push('Find out whether this re-posts a private person’s photo before adding it.');
        else if (repost === 'yes' && !CONSENT_ID.test(val('repost_consent_id')) && !RIGHTS_ID.test(val('repost_rights_id'))) miss.push('the private record of that person’s consent (C01) or permission (P01)');
      }
      // 2. The item.
      if (!KINDS[kind]) miss.push('photo or video');
      if (team && kind === 'video') stop.push('Videos are never held, not even in the team folder. Link to an organisation’s post instead.');
      if (!SOURCE_ID.test(val('source_id'))) miss.push('source ID from data/sources.json (for example S33)');
      var url = val('source_url');
      embedNote.textContent = '';
      if (hasHtml(url)) stop.push('Paste the post’s address, not embed code.');
      else if (posted) {
        if (!parseUrl(url)) miss.push('the https address of the post or page');
        else if (EMBEDDABLE_RIGHTS.indexOf(rights) !== -1) {
          var emb = embedFromUrl(url);
          embedNote.textContent = emb ? 'Can be loaded on click from ' + emb.provider.name + '. Nothing loads until a viewer presses Load.' : 'Will be shown as a link only.';
        } else embedNote.textContent = 'Will be shown as a link only.';
      } else if (team && url) {
        if (!parseUrl(url)) miss.push('an https address for the original (or leave it empty)');
        else if (onSocial(url)) stop.push('Own work and permission items never come from a social media account.');
      }
      if (!val('creator')) miss.push('the credit, as the original gives it');
      if (!val('publisher')) miss.push(team ? 'who holds it (for example the student group)' : 'where it was posted');
      if (isoDate(val('date_published')) == null) miss.push('date published');
      if (val('date_captured') && isoDate(val('date_captured')) == null) miss.push('date taken in YYYY-MM-DD form (or leave it empty)');
      if (!val('caption')) miss.push('caption in your own words');
      else if (words(val('caption')) > CAPTION_MAX_WORDS) miss.push('a shorter caption (' + CAPTION_MAX_WORDS + ' words at most)');
      if (!val('alt')) miss.push('alt text');
      else if (weakAlt(val('alt'))) miss.push('alt text of at least ' + ALT_MIN_CHARS + ' characters that describes what is shown');
      if (!siteIds.length) miss.push('at least one site');
      // 3. Rights and people.
      if (!rightsOk) miss.push('rights status');
      if (rights === 'org_published_test_use' && !APPROVAL_ID.test(val('approval_note_id'))) miss.push('the officials’ agreement record ID (for example A01)');
      if (rights === 'open_licence' && !val('licence')) miss.push('licence name');
      if (rights === 'permission_given' && !RIGHTS_ID.test(val('rights_note_id'))) miss.push('permission record ID (for example P01)');
      if (!PEOPLE[people]) miss.push('who is shown');
      if (people === 'identifiable_children') stop.push('This item cannot be added: it shows identifiable children, or someone whose age is uncertain.');
      if (people === 'identifiable_adults' && !CONSENT_ID.test(val('consent_note_id'))) miss.push('consent record ID (for example C01)');
      if (!SENSITIVITY[sens]) miss.push('location sensitivity');
      else if (sens !== 'none') {
        var pinned = siteIds.filter(function (sid) { return mapPinned(sites[sid]); });
        if (pinned.length) stop.push('This item is marked location-sensitive, but ' + pinned.join(', ') + ' shows a map point. Choose another site or leave the item out.');
      }
      ['caption', 'alt', 'creator', 'publisher', 'poster_name'].forEach(function (f) {
        if (coords(val(f))) stop.push('The ' + f.replace('_', ' ') + ' looks like it contains coordinates. Remove them.');
        if (f !== 'caption' && hasHtml(val(f))) stop.push('The ' + f.replace('_', ' ') + ' contains HTML. Type plain text.');
      });
      if (hasHtml(val('caption')) || hasHtml(val('alt'))) stop.push('The caption and alt text must be plain text, not HTML or embed code.');
      // Team folder (own work or permission only).
      if (team) {
        if (!parseUrl(val('folder_url'))) miss.push('https address of the cleaned copy in the team folder');
        else if (onSocial(val('folder_url'))) stop.push('The team-folder address must not be a social media page.');
        if (!fileInfo) miss.push('the photo run through "Prepare a photo"');
      }

      var rec = { id: 'M-0001', kind: kind || '' };
      if (posted) { rec.poster_type = who; rec.poster_name = val('poster_name'); rec.reposts_private_photo = repost || ''; }
      rec.source_id = val('source_id'); rec.creator = val('creator'); rec.publisher = val('publisher');
      if (url) rec.source_url = url;
      rec.date_published = val('date_published'); rec.date_captured = val('date_captured') || null;
      rec.caption = val('caption'); rec.alt = val('alt'); rec.site_ids = siteIds; rec.rights_status = rightsOk ? rights : '';
      if (rights === 'org_published_test_use') rec.approval_note_id = val('approval_note_id');
      if (rights === 'open_licence') rec.licence = val('licence');
      var rid = rights === 'permission_given' ? val('rights_note_id') : (posted && repost === 'yes' ? val('repost_rights_id') : '');
      if (rid) rec.rights_note_id = rid;
      rec.people_shown = people || '';
      var cid = people === 'identifiable_adults' ? val('consent_note_id') : (posted && repost === 'yes' ? val('repost_consent_id') : '');
      if (cid) rec.consent_note_id = cid;
      rec.location_sensitivity = sens || '';
      if (kind === 'video') { rec.duration = val('duration') || null; rec.captions_available = val('captions_available') || 'unknown'; }
      if (team) { rec.folder_url = val('folder_url'); if (fileInfo) rec.file = fileInfo; }
      rec.status = 'published';

      var ready = !miss.length && !stop.length;
      last = JSON.stringify(rec, null, 2);
      out.textContent = ready ? last : 'Not ready yet. The entry appears here once everything is filled in.';
      [copyBtn, dlBtn].forEach(function (b) { b.disabled = !ready; });
      need.className = 'callout ' + (stop.length ? 'callout-danger' : ready ? 'callout-info' : 'callout-caution');
      need.innerHTML = stop.length
        ? stop.map(function (s) { return '<li><strong>Stop:</strong> ' + esc(s) + '</li>'; }).join('')
        : ready ? '<li><strong>Ready.</strong> Copy or download the entry and send it to the maintainer. Only Aziel adds entries to data/media.json.</li>'
          : '<li><strong>Still needed:</strong> ' + esc(miss.join('; ')) + '.</li>';
    }

    // Prepare a photo: redraws it on a canvas, which drops all metadata including GPS, shrinks it to the size limits,
    // shows the cleaned copy (the canvas itself, so no image address is needed) and offers it to save. Nothing leaves the browser.
    function gpsInJpeg(buf) {
      try {
        var b = new DataView(buf); if (b.getUint16(0) !== 0xFFD8) return null;
        for (var off = 2; off + 4 < b.byteLength;) {
          var marker = b.getUint16(off), len = b.getUint16(off + 2);
          if (marker === 0xFFE1 && b.getUint32(off + 4) === 0x45786966) {
            var t = off + 10, le = b.getUint16(t) === 0x4949, ifd = t + b.getUint32(t + 4, le), n = b.getUint16(ifd, le);
            for (var i = 0; i < n; i++) if (b.getUint16(ifd + 2 + i * 12, le) === 0x8825) return true;
            return false;
          }
          if (marker === 0xFFDA) break;
          off += 2 + len;
        }
        return false;
      } catch (e) { return null; }
    }
    function prepare(file) {
      fileInfo = null; preview.textContent = ''; build();
      fileNote.textContent = 'Preparing…';
      file.arrayBuffer().then(function (buf) {
        var gps = gpsInJpeg(buf);
        return createImageBitmap(file).then(function (bmp) {
          var scale = Math.min(1, FILE_MAX_EDGE / Math.max(bmp.width, bmp.height));
          var w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          var ctx = c.getContext('2d'); ctx.fillStyle = A.token('--bg'); ctx.fillRect(0, 0, w, h); ctx.drawImage(bmp, 0, 0, w, h);
          function encode(q) {
            return new Promise(function (res) { c.toBlob(res, 'image/jpeg', q); }).then(function (blob) {
              return blob.size > FILE_MAX_BYTES && q > 0.55 ? encode(Math.round((q - 0.1) * 100) / 100) : blob;
            });
          }
          return encode(0.85).then(function (blob) {
            if (blob.size > FILE_MAX_BYTES) { fileNote.textContent = 'Still over ' + (FILE_MAX_BYTES / 1024) + ' KB after shrinking. Crop the photo and try again.'; return; }
            fileInfo = { bytes: blob.size, width: w, height: h, exif_stripped: true };
            c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Preview of the cleaned copy');
            preview.appendChild(c);
            var a = document.getElementById('media-save');
            if (a.href) URL.revokeObjectURL(a.href);
            a.href = URL.createObjectURL(blob); a.download = 'cleaned-photo.jpg'; a.hidden = false;
            fileNote.textContent = (gps ? 'GPS location data was found and removed. ' : gps === false ? 'No GPS location data found. ' : '') +
              'All metadata removed. ' + w + ' × ' + h + ' px, ' + Math.round(blob.size / 1024) + ' KB. Save the cleaned copy and put only that in the team folder.';
            build();
          });
        });
      }).catch(function () { fileNote.textContent = 'This file could not be read as a photo.'; });
    }

    A.loadAll().then(function (d) {
      var box = document.getElementById('media-sites');
      d.sites.forEach(function (s) {
        sites[s.id] = s;
        box.insertAdjacentHTML('beforeend', '<label class="check"><input type="checkbox" name="site_ids" value="' + esc(s.id) + '"> ' + esc(s.id) + ' ' + esc(s.name) + '</label>');
      });
      build();
    }).catch(function () { build(); });
    form.addEventListener('input', build);
    form.addEventListener('change', build);
    fileInput.addEventListener('change', function () { if (fileInput.files[0]) prepare(fileInput.files[0]); });
    copyBtn.addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(last).then(function () { copyBtn.textContent = 'Copied'; setTimeout(function () { copyBtn.textContent = 'Copy entry'; }, 1500); });
    });
    dlBtn.addEventListener('click', function () {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([last], { type: 'application/json' })); a.download = 'media-entry.json';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);
    });
    build();
  }

  window.Media = { load: load, check: check, renderSite: renderSite, embedFromUrl: embedFromUrl, MEDIA_MODE: MEDIA_MODE, EMBED_PROVIDERS: EMBED_PROVIDERS };

  var gate = document.getElementById('release-gate'), report = document.getElementById('media-check'), form = document.getElementById('media-form');
  if (gate && report) renderGate(gate, report);
  if (form) renderForm(form);
})();
