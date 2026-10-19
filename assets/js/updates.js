/* Site updates: checks, homepage selection and the views (homepage, profile, archive, check page).
   Only the maintainer publishes, by editing data/updates.json. Sample entries live in data/updates.sample.json
   and load only when the address has ?sample=1. Never uses view counts. */
(function () {
  var A = window.Atlas;

  // ---- Settings: every tunable number and text lives here ----
  var HOME_MAX = 3;                  // most updates shown on the homepage (pinned ones count toward it)
  var HALF_LIFE_DAYS = 60;           // score = weight x 0.5^(age_days / HALF_LIFE_DAYS)
  var HOME_THRESHOLD = 2.0;          // lowest score that reaches the homepage; pinned updates skip this
  var WEIGHT_MIN = 1, WEIGHT_MAX = 5;
  var REQUEST_CONTACT = 'contact not yet published';   // how to ask for an update; shown wherever [data-update-contact] appears
  var UPDATES_FILE = 'data/updates.json';
  var SAMPLE_FILE = 'data/updates.sample.json';        // local only, never uploaded
  var SAMPLE_PARAM = 'sample';                         // ?sample=1 loads the sample file
  var TRUSTABLE = ['government', 'provincial', 'custodian', 'ngo'];
  var NEVER_TRUSTED = ['intergovernmental', 'media', 'research', 'reference', 'commercial'];
  var AUTHORITY_LABEL = {
    government: 'From the national government',
    provincial: 'From the provincial government',
    custodian: 'From a custodian group',
    ngo: 'From an NGO'
  };
  var WITHDRAWN_REASONS = ['consent', 'sensitivity', 'other'];
  var BLANK_WHEN_WITHDRAWN = ['consent', 'sensitivity'];   // these reasons require title, summary and body to be emptied
  var CONSENT_ID = /^C\d{2,}$/;      // record_id format from assets/templates/consent-record-template.csv
  // Coordinates are never allowed in an update. Kept narrow so dates, percentages and ordinary decimals pass.
  var COORD_PATTERNS = [
    /(^|[^\d.])-?\d{1,3}\.\d{3,}\s*°?\s*[NSns]?\s*[,;\/ ]\s*-?\d{1,3}\.\d{3,}/,   // decimal-degree pair, 3+ decimals each
    /\d{1,3}\s*°\s*\d{1,2}(\.\d+)?\s*['′]/,                                         // degrees and minutes: 9°17'
    /\d{1,3}\s*[dD]\s*\d{1,2}\s*[mM]\s*\d{1,2}(\.\d+)?\s*[sS]\b/,                   // 9d17m52s
    /\b(lat|latitude|lon|lng|longitude|coords?|coordinates)\b\s*[.:=]?\s*[-−]?\d/i  // labelled: "lat -9.3", "coordinates: 9"
  ];

  var esc = A.esc;

  function sampleMode() {
    try { return new URLSearchParams(location.search).get(SAMPLE_PARAM) === '1'; } catch (e) { return false; }
  }

  // ---- Loading ----
  function load() {
    var sample = sampleMode()
      ? A.loadJSON(SAMPLE_FILE).catch(function () { return null; })   // missing sample file: carry on without it
      : Promise.resolve(null);
    return Promise.all([A.loadAll(), A.loadJSON(UPDATES_FILE), sample]).then(function (r) {
      var d = r[0], live = r[1], smp = r[2];
      var sourceList = d.sourceList.slice(), sources = {};
      if (smp && smp.sources) sourceList = sourceList.concat(smp.sources);
      sourceList.forEach(function (s) { sources[s.id] = s; });
      var sites = {};
      d.sites.forEach(function (s) { sites[s.id] = s; });
      var raw = (live.updates || []).concat(smp && smp.updates ? smp.updates : []);
      var model = check(raw, sourceList, sources, sites);
      model.sites = sites; model.siteList = d.sites; model.sources = sources;
      model.sampleLoaded = !!smp;
      if (model.issues.length && window.console) console.info('SouthSide updates: ' + model.issues.length + ' item(s) to look at. Open updates-check.html for the report.');
      return model;
    });
  }

  // ---- Checks ----
  function isoDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var p = s.split('-').map(Number), t = Date.UTC(p[0], p[1] - 1, p[2]), d = new Date(t);
    return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2] ? t : null;
  }
  function todayUTC() { var n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); }
  function findCoords(text) {
    for (var i = 0; i < COORD_PATTERNS.length; i++) {
      var m = String(text || '').match(COORD_PATTERNS[i]);
      if (m) return m[0].trim();
    }
    return null;
  }

  function check(raw, sourceList, sources, sites) {
    var issues = [];
    function add(where, level, msg) { issues.push({ where: where, level: level, msg: msg }); }

    // Source register: types, and one trusted value per organisation.
    var byOrg = {}, mixed = {};
    sourceList.forEach(function (s) {
      var w = 'Source ' + s.id;
      if (TRUSTABLE.concat(NEVER_TRUSTED).indexOf(s.authority_type) === -1) add(w, 'error', 'authority_type is missing or not one of: ' + TRUSTABLE.concat(NEVER_TRUSTED).join(', ') + '.');
      if (typeof s.trusted !== 'boolean') add(w, 'error', 'trusted must be true or false.');
      if (!s.organisation) add(w, 'error', 'organisation is missing.');
      else (byOrg[s.organisation] = byOrg[s.organisation] || []).push(s);
      if (s.trusted === true && TRUSTABLE.indexOf(s.authority_type) === -1) add(w, 'error', 'Marked trusted, but a source of type "' + s.authority_type + '" can never be trusted. Treated as not trusted.');
    });
    Object.keys(byOrg).forEach(function (org) {
      var list = byOrg[org], ids = list.map(function (s) { return s.id; }).join(', ');
      if (list.some(function (s) { return s.trusted === true; }) && list.some(function (s) { return s.trusted !== true; })) {
        mixed[org] = true;
        add('Organisation ' + org, 'error', 'Sources ' + ids + ' disagree on trusted. Trust is per organisation, so none of them counts as trusted until they match.');
      }
      if (list.some(function (s) { return s.authority_type !== list[0].authority_type; })) add('Organisation ' + org, 'warning', 'Sources ' + ids + ' have different authority_type values.');
    });
    function trusted(s) { return !!s && s.trusted === true && TRUSTABLE.indexOf(s.authority_type) !== -1 && !mixed[s.organisation]; }

    var seen = {}, today = todayUTC();
    var entries = raw.map(function (e) {
      var id = e && e.id ? String(e.id) : '(no id)', w = 'Update ' + id;
      var v = { e: e, id: id, tier: 'secondary', demoted: false, why: [], hidden: false, authority: null, time: isoDate(e.date), score: 0 };
      if (!e.id) add(w, 'error', 'id is missing.');
      else if (seen[e.id]) add(w, 'error', 'Duplicate id.');
      seen[e.id] = true;

      // Coordinates anywhere in the text: hide everywhere until fixed (also for withdrawn entries, since the file is public).
      // The message names the field only. Issue messages never quote an entry's title, summary or body.
      ['title', 'summary', 'body'].forEach(function (f) {
        if (findCoords(e[f])) { v.hidden = true; add(w, 'error', 'The ' + f + ' looks like it contains coordinates. Hidden on every page until removed.'); }
      });

      if (e.status === 'withdrawn') {
        v.hidden = true; v.withdrawn = true;
        if (WITHDRAWN_REASONS.indexOf(e.withdrawn_reason) === -1) add(w, 'error', 'Withdrawn, but withdrawn_reason is not one of: ' + WITHDRAWN_REASONS.join(', ') + '.');
        else if (BLANK_WHEN_WITHDRAWN.indexOf(e.withdrawn_reason) !== -1 && ['title', 'summary', 'body'].some(function (f) { return e[f]; })) {
          add(w, 'error', 'Withdrawn for ' + e.withdrawn_reason + ', so title, summary and body must be blank. The text is still readable in the public data file.');
        }
        return v;
      }
      if (e.status !== 'published') { v.hidden = true; add(w, 'error', 'status must be "published" or "withdrawn". Hidden until fixed.'); return v; }

      if (v.time == null) add(w, 'error', 'date must be a real date written YYYY-MM-DD.');
      else if (v.time > today) add(w, 'warning', 'Dated in the future.');
      if (!e.title) add(w, 'error', 'title is missing.');
      var weightOk = e.weight === Math.round(e.weight) && e.weight >= WEIGHT_MIN && e.weight <= WEIGHT_MAX;
      if (!weightOk) add(w, 'error', 'weight must be a whole number from ' + WEIGHT_MIN + ' to ' + WEIGHT_MAX + '. Scores 0 until fixed.');
      if (e.pinned != null && typeof e.pinned !== 'boolean') add(w, 'warning', 'pinned should be true or false.');
      if (e.tier !== 'primary' && e.tier !== 'secondary') add(w, 'error', 'tier must be "primary" or "secondary". Shown as a community note.');

      var srcIds = Array.isArray(e.source_ids) ? e.source_ids : [];
      if (!Array.isArray(e.source_ids)) add(w, 'error', 'source_ids must be a list.');
      srcIds.forEach(function (sid) { if (!sources[sid]) add(w, 'error', 'Source ' + sid + ' is not in data/sources.json.'); });
      var siteIds = Array.isArray(e.site_ids) ? e.site_ids : [];
      if (!Array.isArray(e.site_ids)) add(w, 'error', 'site_ids must be a list.');
      siteIds.forEach(function (sid) { if (!sites[sid]) add(w, 'error', 'Site ' + sid + ' is not in data/sites.json.'); });

      if (e.tier === 'primary') {
        var t = srcIds.map(function (sid) { return sources[sid]; }).filter(trusted)[0];
        if (!t) v.why.push('its source is not on the trusted list');
        if (!e.consent_id) v.why.push('it has no consent record ID');
        else if (!CONSENT_ID.test(e.consent_id)) v.why.push('its consent record ID is not in the form C01');
        if (v.why.length) { v.demoted = true; add(w, 'error', 'Primary rules not met: ' + v.why.join('; ') + '. Shown as a community note marked "Needs checking".'); }
        else { v.tier = 'primary'; v.authority = t.authority_type; }
      } else if (e.consent_id) add(w, 'warning', 'consent_id is only used on primary updates; ignored here.');

      if (weightOk && v.time != null) v.score = e.weight * Math.pow(0.5, Math.max(0, (today - v.time) / 86400000) / HALF_LIFE_DAYS);
      return v;
    });

    var pinned = entries.filter(function (v) { return !v.hidden && v.e.pinned === true; });
    if (pinned.length > HOME_MAX) add('Homepage', 'warning', pinned.length + ' updates are pinned but the homepage shows ' + HOME_MAX + '. Only the newest ' + HOME_MAX + ' appear.');
    return { entries: entries, issues: issues };
  }

  // ---- Selection ----
  function byDate(a, b) { return (b.time || 0) - (a.time || 0); }
  function visible(m) { return m.entries.filter(function (v) { return !v.hidden; }); }
  function homeSelection(m) {
    var shown = visible(m);
    var pinned = shown.filter(function (v) { return v.e.pinned === true; }).sort(byDate);
    var rest = shown.filter(function (v) { return v.e.pinned !== true && v.score >= HOME_THRESHOLD; })
      .sort(function (a, b) { return b.score - a.score || byDate(a, b); });
    return pinned.concat(rest).slice(0, HOME_MAX);
  }

  // ---- Rendering ----
  function link(href) {
    if (!sampleMode()) return href;
    return href + (href.indexOf('?') === -1 ? '?' : '&') + SAMPLE_PARAM + '=1';
  }
  function paragraphs(text) {
    return String(text || '').split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean)
      .map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
  }

  // One update. The tier is carried by words and by the rule beside it (solid or dashed), never by colour alone.
  function item(v, m, opts) {
    var e = v.e, primary = v.tier === 'primary', h = opts.h || 'h3';
    var kind = primary
      ? '<strong>Primary update</strong> <span>' + esc(AUTHORITY_LABEL[v.authority]) + '</span>'
      : '<strong>Community note, unverified</strong>';
    var chips = (v.demoted ? ' <span class="chip chip-caution chip-check">Needs checking</span>' : '') +
      (e.sample ? ' <span class="chip chip-neutral">Sample</span>' : '');
    var siteLinks = (e.site_ids || []).filter(function (id) { return m.sites[id] && id !== opts.exceptSite; }).map(function (id) {
      return '<a href="' + esc(link('site.html?id=' + encodeURIComponent(id))) + '">' + esc(m.sites[id].name) + '</a>';
    });
    var srcs = (e.source_ids || []).filter(function (id) { return m.sources[id]; }).map(function (id) {
      var s = m.sources[id], t = esc(s.title) + ', ' + esc(s.publisher);
      return s.url ? '<a href="' + esc(s.url) + '" rel="noopener">' + t + '</a>' : t;
    });
    var foot = [];
    if (srcs.length) foot.push((srcs.length > 1 ? 'Sources: ' : 'Source: ') + srcs.join('; '));
    if (primary) foot.push('Consent on record');   // the consent_id itself stays in the data and the check page
    return '<article class="update ' + (primary ? 'update-primary' : 'update-secondary') + '">' +
      '<p class="update-kind">' + kind + chips + '</p>' +
      '<' + h + '>' + esc(e.title) + '</' + h + '>' +
      '<p class="update-meta">As of ' + esc(A.fmtDate(e.date)) + (siteLinks.length ? ' &middot; ' + siteLinks.join(', ') : '') + '</p>' +
      (e.summary ? '<p>' + esc(e.summary) + '</p>' : '') +
      (e.body ? '<details class="update-body"><summary>Read more</summary>' + paragraphs(e.body) + '</details>' : '') +
      (v.demoted ? '<p class="small"><strong>Needs checking:</strong> entered as a primary update, but ' + esc(v.why.join(' and ')) + '. Shown as a community note until it is checked.</p>' : '') +
      (foot.length ? '<p class="small muted">' + foot.join(' &middot; ') + '</p>' : '') +
      '</article>';
  }
  function list(vs, m, opts) { return '<div class="updates">' + vs.map(function (v) { return item(v, m, opts); }).join('') + '</div>'; }

  function sampleNotice(m) {
    return m.sampleLoaded ? '<p class="callout callout-info small"><strong>Sample mode.</strong> Fictional sample updates are mixed in because the address ends in ?sample=1. Each one carries a Sample label.</p>' : '';
  }
  function fail(el, err) { el.innerHTML = '<p class="muted">Updates could not be loaded (' + esc(err.message) + ').</p>'; }

  // In sample mode, keep ?sample=1 on links between pages so the samples stay visible while browsing.
  function keepSample(root) {
    if (!sampleMode()) return;
    (root || document).querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (/^[\w-]+\.html(\?|#|$)/.test(h) && !/[?&]sample=1/.test(h)) {
        var i = h.indexOf('#'), base = i === -1 ? h : h.slice(0, i), hash = i === -1 ? '' : h.slice(i);
        a.setAttribute('href', link(base) + hash);
      }
    });
  }

  function renderHome(el) {
    load().then(function (m) {
      var sel = homeSelection(m);
      el.innerHTML = sampleNotice(m) + (sel.length ? list(sel, m, { h: 'h3' }) : '<p>No updates yet.</p>');
      keepSample();
    }).catch(function (err) { fail(el, err); });
  }

  // A site's updates: primary first, then newest first.
  function renderSite(el, siteId) {
    load().then(function (m) {
      var vs = visible(m).filter(function (v) { return (v.e.site_ids || []).indexOf(siteId) !== -1; })
        .sort(function (a, b) { return (a.tier === 'primary' ? 0 : 1) - (b.tier === 'primary' ? 0 : 1) || byDate(a, b); });
      el.innerHTML = sampleNotice(m) + (vs.length ? list(vs, m, { h: 'h3', exceptSite: siteId }) : '<p>No updates yet for this site.</p>');
      keepSample();
    }).catch(function (err) { fail(el, err); });
  }

  function renderArchive(el) {
    var fTier = document.getElementById('u-tier'), fSite = document.getElementById('u-site'), count = document.getElementById('u-count');
    load().then(function (m) {
      m.siteList.forEach(function (s) { fSite.insertAdjacentHTML('beforeend', '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'); });
      var all = visible(m).sort(byDate);
      function draw() {
        var vs = all.filter(function (v) {
          return (!fTier.value || v.tier === fTier.value) && (!fSite.value || (v.e.site_ids || []).indexOf(fSite.value) !== -1);
        });
        count.textContent = vs.length + ' of ' + all.length + ' updates';
        el.innerHTML = sampleNotice(m) + (all.length
          ? (vs.length ? list(vs, m, { h: 'h2' }) : '<p>No updates match these filters.</p>')
          : '<p>No updates yet.</p>');
      }
      fTier.addEventListener('change', draw);
      fSite.addEventListener('change', draw);
      draw();
      keepSample();
    }).catch(function (err) { fail(el, err); });
  }

  // Maintainer report: every problem, then what the homepage would show and why.
  function renderCheck(el) {
    load().then(function (m) {
      var shown = visible(m), sel = homeSelection(m);
      var n = function (f) { return m.entries.filter(f).length; };
      var errors = m.issues.filter(function (i) { return i.level === 'error'; }).length;
      var html = sampleNotice(m) +
        '<p class="callout ' + (errors ? 'callout-caution' : 'callout-info') + '"><strong>' + (errors ? errors + ' problem(s) to fix.' : 'No problems found.') + '</strong> ' +
        m.entries.length + ' entries: ' + shown.length + ' shown, ' + n(function (v) { return !v.hidden && v.tier === 'primary'; }) + ' as primary, ' +
        n(function (v) { return v.demoted && !v.hidden; }) + ' marked "Needs checking", ' + n(function (v) { return v.withdrawn; }) + ' withdrawn, ' +
        n(function (v) { return v.hidden && !v.withdrawn; }) + ' hidden by a problem.</p>';
      html += '<h2>Problems</h2>' + (m.issues.length
        ? '<div class="table-scroll"><table class="stack"><thead><tr><th scope="col">Where</th><th scope="col">Level</th><th scope="col">Problem</th></tr></thead><tbody>' +
          m.issues.map(function (i) {
            return '<tr><th scope="row">' + esc(i.where) + '</th><td data-label="Level">' + (i.level === 'error' ? '<span class="chip chip-danger">Error</span>' : '<span class="chip chip-caution">Warning</span>') +
              '</td><td data-label="Problem">' + esc(i.msg) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<p>None.</p>');
      html += '<h2>Homepage selection</h2><p class="small muted">Score = weight &times; 0.5^(age in days &divide; ' + HALF_LIFE_DAYS + '). Threshold ' + HOME_THRESHOLD.toFixed(1) +
        ', at most ' + HOME_MAX + ' shown, pinned updates always included. Ages are counted to today in this browser.</p>' +
        (shown.length ? '<div class="table-scroll"><table class="stack"><thead><tr><th scope="col">Update</th><th scope="col">Shown as</th><th scope="col">Weight</th><th scope="col">Score</th><th scope="col">Homepage</th></tr></thead><tbody>' +
          shown.slice().sort(function (a, b) { return b.score - a.score; }).map(function (v) {
            var on = sel.indexOf(v) !== -1;
            return '<tr><th scope="row">' + esc(v.id) + '</th><td data-label="Shown as">' + (v.tier === 'primary' ? 'Primary' : v.demoted ? 'Community note (needs checking)' : 'Community note') +
              '</td><td data-label="Weight">' + esc(v.e.weight) + '</td><td data-label="Score">' + v.score.toFixed(2) + '</td><td data-label="Homepage">' +
              (on ? (v.e.pinned === true ? 'Yes, pinned' : 'Yes') : (v.e.pinned === true ? 'No, too many pinned' : v.score >= HOME_THRESHOLD ? 'No, above threshold but over the limit' : 'No, below threshold')) + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<p>No published updates.</p>');
      el.innerHTML = html;
      keepSample();
    }).catch(function (err) { fail(el, err); });
  }

  function fillContact() {
    document.querySelectorAll('[data-update-contact]').forEach(function (s) { s.textContent = REQUEST_CONTACT; });
  }

  window.Updates = { load: load, check: check, findCoords: findCoords, homeSelection: homeSelection, renderSite: renderSite };

  fillContact();
  keepSample();
  var home = document.getElementById('updates-home'), archive = document.getElementById('updates-archive'), report = document.getElementById('updates-check');
  if (home) renderHome(home);
  if (archive) renderArchive(archive);
  if (report) renderCheck(report);
})();
