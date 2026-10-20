/* Research library: published sources and researcher-submitted works about southern Malaita.
   One register: every entry is a source in data/sources.json. Needs common.js and updates.js loaded first
   (it reuses the sample-mode helpers and the coordinate detector from updates.js). */
(function () {
  var A = window.Atlas, U = window.Updates;

  // ---- Controlled lists and limits: edit here ----
  var SUMMARY_MAX_WORDS = 80;
  var ORIGINS = {
    published: 'Published source',
    researcher_submitted: 'Submitted by the author'
  };
  var EVIDENCE_KINDS = {
    peer_reviewed: 'Peer-reviewed',
    government_report: 'Government report',
    government_notice: 'Government report or notice',
    ngo_report: 'NGO report',
    thesis_grey: 'Thesis or grey literature',
    researcher_submitted: 'Researcher-submitted (not independently reviewed)',
    news_media: 'News or media',
    other: 'Other'
  };
  var TAXON_GROUPS = {
    birds: 'Birds',
    mammals_bats: 'Mammals and bats',
    reptiles_amphibians: 'Reptiles and amphibians',
    fish_marine: 'Fish and marine life',
    corals_reef: 'Corals and reef',
    plants: 'Plants',
    forest_mangrove: 'Forest and mangrove habitat',
    other: 'Other'
  };
  // Default library order: strongest kind of evidence first. Both government kinds share a rank; unrecorded kinds go last.
  var EVIDENCE_RANK = {
    peer_reviewed: 0, government_report: 1, government_notice: 1, ngo_report: 2, thesis_grey: 3,
    researcher_submitted: 4, news_media: 5, other: 6
  };
  var SORT_PARAM = 'sort';           // library.html?sort=title shares a title-sorted view; no parameter = evidence strength
  var LIBRARY_FIELDS =['origin', 'evidence_kind', 'taxon_groups', 'summary', 'region_tags', 'citation', 'rights_confirmed'];

  var esc = A.esc;
  function words(s) { return String(s || '').trim().split(/\s+/).filter(Boolean).length; }
  function link(h) { return U ? U.link(h) : h; }
  function siteLabel(s) { return s.name; }

  // ---- Loading: the register plus, with ?sample=1, the sample file's sources ----
  function load() {
    var sample = U && U.sampleMode()
      ? A.loadJSON(U.SAMPLE_FILE).catch(function () { return null; })
      : Promise.resolve(null);
    return Promise.all([A.loadAll(), sample]).then(function (r) {
      var d = r[0], smp = r[1];
      var sourceList = d.sourceList.concat(smp && smp.sources ? smp.sources : []);
      var m = check(sourceList, d.sites);
      m.siteList = d.sites; m.sampleLoaded = !!smp;
      return m;
    });
  }

  // ---- Checks ----
  // Problems are reported by entry id and rule only. Never quote a title, summary or citation.
  function check(sourceList, siteList) {
    var issues = [], sites = {}, cited = {}, seen = {}, entries = [];
    function add(id, level, msg) { issues.push({ where: 'Source ' + id, level: level, msg: msg }); }
    siteList.forEach(function (s) { sites[s.id] = s; });

    // Which site facts cite each source ("Cited for"), from the existing source_ids in sites.json.
    siteList.forEach(function (s) {
      function cite(id, label) {
        var c = cited[id] = cited[id] || {};
        (c[s.id] = c[s.id] || []).indexOf(label) === -1 && c[s.id].push(label);
      }
      s.facts.forEach(function (f) { (f.source_ids || []).forEach(function (id) { cite(id, f.label); }); });
      ((s.location && s.location.source_ids) || []).forEach(function (id) { cite(id, 'Location'); });
    });

    sourceList.forEach(function (src) {
      var id = src.id || '(no id)';
      if (seen[id]) add(id, 'error', 'Duplicate id in the source register.');
      seen[id] = true;

      var hasFields = LIBRARY_FIELDS.some(function (f) { return src[f] != null; });
      if (src.authority_type === 'custodian') {
        if (hasFields) add(id, 'warning', 'Custodian sources are never listed in the research library. Remove the library fields; custodian material goes through consent and primary updates.');
        return;
      }
      var origin = src.origin || 'published', submitted = origin === 'researcher_submitted';
      var tags = Array.isArray(src.region_tags) ? src.region_tags : [];
      var isCited = !!cited[id];
      if (!isCited && !tags.length && !submitted) return;   // register-only: not listed, no warning

      var v = { src: src, id: id, origin: origin, hidden: false, cited: cited[id] || {}, siteIds: [], constituencies: [], summaryOk: true };

      if (!ORIGINS[origin]) add(id, 'error', 'origin must be "published" or "researcher_submitted".');
      if (!/^https?:\/\/\S+$/.test(src.url || '')) { v.hidden = true; add(id, 'error', 'url is missing or is not a web address (http or https). Hidden until fixed.'); }
      if (src.evidence_kind != null && !EVIDENCE_KINDS[src.evidence_kind]) add(id, 'error', 'evidence_kind is not one of the controlled list.');
      if (src.taxon_groups != null && !Array.isArray(src.taxon_groups)) add(id, 'error', 'taxon_groups must be a list.');
      (Array.isArray(src.taxon_groups) ? src.taxon_groups : []).forEach(function (t) {
        if (!TAXON_GROUPS[t]) add(id, 'error', 'A taxon group is not one of the controlled list.');
      });
      if (src.summary != null && words(src.summary) > SUMMARY_MAX_WORDS) {
        v.summaryOk = false;
        add(id, 'error', 'summary is over ' + SUMMARY_MAX_WORDS + ' words. The summary is not shown until it is shortened.');
      }
      if (submitted && src.rights_confirmed !== true) { v.hidden = true; add(id, 'error', 'Researcher-submitted without rights_confirmed: true. Hidden until the author has agreed to be listed.'); }
      if (submitted && src.evidence_kind === 'peer_reviewed') add(id, 'warning', 'Researcher-submitted and marked peer-reviewed: check the publisher link before publishing.');
      ['title', 'summary', 'citation'].forEach(function (f) {
        if (U && U.findCoords(src[f])) { v.hidden = true; add(id, 'error', 'The ' + f + ' looks like it contains coordinates. Hidden everywhere until removed.'); }
      });

      // Scope: at least one site or constituency in the three southern Malaita constituencies.
      Object.keys(v.cited).forEach(function (sid) { if (v.siteIds.indexOf(sid) === -1) v.siteIds.push(sid); });
      var unknownTag = false;
      tags.forEach(function (t) {
        if (sites[t]) { if (v.siteIds.indexOf(t) === -1) v.siteIds.push(t); }
        else if (A.CONSTITUENCIES.indexOf(t) !== -1) { if (v.constituencies.indexOf(t) === -1) v.constituencies.push(t); }
        else unknownTag = true;
      });
      if (unknownTag) add(id, 'warning', 'A region tag is not one of the three constituencies or a site ID in data/sites.json.');
      v.siteIds.forEach(function (sid) { var c = sites[sid].constituency; if (v.constituencies.indexOf(c) === -1) v.constituencies.push(c); });
      if (!v.siteIds.length && !v.constituencies.length) { v.hidden = true; add(id, 'warning', 'Outside the southern Malaita scope: no site or constituency from the three. Hidden from the library until fixed.'); }

      entries.push(v);
    });
    return { entries: entries, issues: issues, sites: sites };
  }

  // ---- Rendering ----
  function visible(m) { return m.entries.filter(function (v) { return !v.hidden; }); }
  function byTitle(a, b) { return String(a.src.title).localeCompare(String(b.src.title)); }

  // One card: title (with its byline), then origin and evidence tag, then summary and taxa, then "Cited for", then the
  // link. Origin is told by words and by the rule's shape (solid = published, dashed = submitted by the author);
  // evidence kind is a separate outlined tag in words. No colour carries either.
  function card(v, m, opts) {
    var s = v.src, h = opts.h || 'h3', submitted = v.origin === 'researcher_submitted';
    var kind = s.evidence_kind && EVIDENCE_KINDS[s.evidence_kind] ? EVIDENCE_KINDS[s.evidence_kind] : 'not recorded';
    var meta = s.citation ? esc(s.citation) : [s.publisher, s.date].filter(Boolean).map(esc).join(' &middot; ');
    var taxa = (s.taxon_groups || []).filter(function (t) { return TAXON_GROUPS[t]; }).map(function (t) { return TAXON_GROUPS[t]; });
    var citedFor = Object.keys(v.cited).filter(function (sid) { return m.sites[sid]; }).map(function (sid) {
      return '<a href="' + esc(link('site.html?id=' + encodeURIComponent(sid))) + '">' + esc(siteLabel(m.sites[sid])) + '</a>: ' + esc(v.cited[sid].join(', '));
    });
    var tagged = (s.region_tags || []).filter(function (t) { return m.sites[t] || A.CONSTITUENCIES.indexOf(t) !== -1; }).map(function (t) {
      return m.sites[t] ? '<a href="' + esc(link('site.html?id=' + encodeURIComponent(t))) + '">' + esc(siteLabel(m.sites[t])) + '</a>' : esc(t);
    });
    return '<article class="lib-entry ' + (submitted ? 'lib-submitted' : 'lib-published') + '">' +
      '<' + h + '>' + esc(s.title) + '</' + h + '>' +
      (meta ? '<p class="lib-meta">' + meta + ' &middot; ' + esc(v.id) + '</p>' : '<p class="lib-meta">' + esc(v.id) + '</p>') +
      '<p class="lib-kind"><strong>' + esc(ORIGINS[v.origin] || v.origin) + '</strong> <span class="lib-tag">Evidence: ' + esc(kind) + '</span>' +
      (s.sample ? ' <span class="chip chip-neutral">Sample</span>' : '') + '</p>' +
      (s.summary && v.summaryOk ? '<p>' + esc(s.summary) + '</p>' : '') +
      (taxa.length ? '<p class="small">Taxon groups: ' + esc(taxa.join(', ')) + '</p>' : '') +
      '<p class="small">' + (citedFor.length ? 'Cited for: ' + citedFor.join('; ') : 'Not yet cited for any site fact.') + '</p>' +
      (tagged.length ? '<p class="small">Tagged for: ' + tagged.join(', ') + '</p>' : '') +
      '<p class="small"><a href="' + esc(s.url) + '" rel="noopener">' + (submitted ? 'Open the work&rsquo;s page' : 'Open the published page') + '</a></p>' +
      '</article>';
  }
  function cards(vs, m, opts) { return '<div class="lib-list">' + vs.map(function (v) { return card(v, m, opts); }).join('') + '</div>'; }
  function fail(el, err) { el.innerHTML = '<p class="muted">The research library could not be loaded (' + esc(err.message) + ').</p>'; }
  function keep() { if (U) U.keepSample(); }

  // Profile: the library entries linked to one site, by citation or site tag. Published first, then by title.
  function renderSite(el, siteId) {
    load().then(function (m) {
      var vs = visible(m).filter(function (v) { return v.siteIds.indexOf(siteId) !== -1; })
        .sort(function (a, b) { return (a.origin === 'published' ? 0 : 1) - (b.origin === 'published' ? 0 : 1) || byTitle(a, b); });
      el.innerHTML = vs.length
        ? '<p class="small muted">Works about this site, with what each is cited for. <a href="' + esc(link('library.html')) + '">Research library</a>.</p>' + cards(vs, m, { h: 'h3' })
        : A.emptyState('No research listed for this site yet.', 'Next step: browse the <a href="' + esc(link('library.html')) + '">Research library</a>, or see <a href="kit.html#research">how to submit research</a> in the Field Kit.');
      keep();
    }).catch(function (err) { fail(el, err); });
  }

  function renderLibrary(el) {
    var f = {};
    ['site', 'constituency', 'taxon', 'kind', 'origin', 'q', 'sort'].forEach(function (k) { f[k] = document.getElementById('l-' + k); });
    var count = document.getElementById('l-count');
    load().then(function (m) {
      m.siteList.forEach(function (s) { f.site.insertAdjacentHTML('beforeend', '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'); });
      A.CONSTITUENCIES.forEach(function (c) { f.constituency.insertAdjacentHTML('beforeend', '<option>' + esc(c) + '</option>'); });
      Object.keys(TAXON_GROUPS).forEach(function (k) { f.taxon.insertAdjacentHTML('beforeend', '<option value="' + k + '">' + esc(TAXON_GROUPS[k]) + '</option>'); });
      Object.keys(EVIDENCE_KINDS).forEach(function (k) { f.kind.insertAdjacentHTML('beforeend', '<option value="' + k + '">' + esc(EVIDENCE_KINDS[k]) + '</option>'); });
      Object.keys(ORIGINS).forEach(function (k) { f.origin.insertAdjacentHTML('beforeend', '<option value="' + k + '">' + esc(ORIGINS[k]) + '</option>'); });
      var all = visible(m).sort(byTitle);
      function rank(v) { var r = EVIDENCE_RANK[v.src.evidence_kind]; return r == null ? 7 : r; }
      var byStrength = all.slice().sort(function (a, b) { return rank(a) - rank(b) || byTitle(a, b); });
      // The sort choice lives in the address (?sort=title), so a view can be shared. Other parameters, such as sample=1, are kept.
      var params = new URLSearchParams(location.search);
      f.sort.value = [].some.call(f.sort.options, function (o) { return o.value === params.get(SORT_PARAM); }) ? params.get(SORT_PARAM) : 'strength';
      f.sort.addEventListener('change', function () {
        var p = new URLSearchParams(location.search);
        if (f.sort.value === 'strength') p.delete(SORT_PARAM); else p.set(SORT_PARAM, f.sort.value);
        var qs = p.toString();
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
        draw();
      });
      function hay(v) {
        var s = v.src;
        return [s.title, s.publisher, s.citation, s.summary, s.organisation, s.id].concat((s.taxon_groups || []).map(function (t) { return TAXON_GROUPS[t]; })).join(' ').toLowerCase();
      }
      function draw() {
        var q = f.q.value.trim().toLowerCase();
        var vs = (f.sort.value === 'title' ? all : byStrength).filter(function (v) {
          return (!f.site.value || v.siteIds.indexOf(f.site.value) !== -1) &&
            (!f.constituency.value || v.constituencies.indexOf(f.constituency.value) !== -1) &&
            (!f.taxon.value || (v.src.taxon_groups || []).indexOf(f.taxon.value) !== -1) &&
            (!f.kind.value || v.src.evidence_kind === f.kind.value) &&
            (!f.origin.value || v.origin === f.origin.value) &&
            (!q || hay(v).indexOf(q) !== -1);
        });
        // Results line: "24 works · sorted by evidence strength", or "3 of 24 works · …" while filters are set.
        count.textContent = (vs.length === all.length ? '' : vs.length + ' of ') + all.length + (all.length === 1 ? ' work' : ' works') +
          ' · sorted by ' + (f.sort.value === 'title' ? 'title' : 'evidence strength');
        el.innerHTML = (m.sampleLoaded ? '<p class="callout callout-info small"><strong>Sample mode.</strong> Fictional sample entries are mixed in because the address ends in ?sample=1. Each one carries a Sample label.</p>' : '') +
          (vs.length ? cards(vs, m, { h: 'h2' })
            : A.emptyState('No works match these filters.', 'Next step: <button type="button" class="linkbtn" data-clear-filters>Clear filters</button>'));
        keep();
      }
      // Clear filters: every filter back to "all"; the sort order stays. From the empty state, whose button goes away,
      // focus moves to the search field.
      function clear() { FILTERS.forEach(function (k) { f[k].value = ''; }); draw(); }
      var FILTERS = ['q', 'site', 'constituency', 'taxon', 'kind', 'origin'];
      document.getElementById('l-clear').addEventListener('click', clear);
      el.addEventListener('click', function (e) { if (e.target.closest('[data-clear-filters]')) { clear(); f.q.focus(); } });
      ['site', 'constituency', 'taxon', 'kind', 'origin'].forEach(function (k) { f[k].addEventListener('change', draw); });
      f.q.addEventListener('input', draw);
      draw();
    }).catch(function (err) { fail(el, err); });
  }

  // Maintainer report section on updates-check.html: id and rule only.
  function renderCheck(el) {
    load().then(function (m) {
      var shown = visible(m).length, hidden = m.entries.length - shown;
      var errors = m.issues.filter(function (i) { return i.level === 'error'; }).length;
      el.innerHTML = '<p class="callout ' + (errors ? 'callout-caution' : 'callout-info') + '"><strong>' + (errors ? errors + ' problem(s) to fix.' : 'No problems found.') + '</strong> ' +
        m.entries.length + ' library entries: ' + shown + ' listed, ' + hidden + ' hidden by a problem. Sources that are not cited, tagged or submitted stay in the register only.</p>' +
        (m.issues.length
          ? '<div class="table-scroll"><table class="stack"><thead><tr><th scope="col">Where</th><th scope="col">Level</th><th scope="col">Problem</th></tr></thead><tbody>' +
            m.issues.map(function (i) {
              return '<tr><th scope="row">' + esc(i.where) + '</th><td data-label="Level">' + (i.level === 'error' ? '<span class="chip chip-danger">Error</span>' : '<span class="chip chip-caution">Warning</span>') +
                '</td><td data-label="Problem">' + esc(i.msg) + '</td></tr>';
            }).join('') + '</tbody></table></div>'
          : '');
    }).catch(function (err) { fail(el, err); });
  }

  // Field Kit: list the allowed values from the constants above, so the kit never drifts from the code.
  function fillValues() {
    var lists = { evidence: EVIDENCE_KINDS, taxon: TAXON_GROUPS };
    document.querySelectorAll('[data-lib-values]').forEach(function (el) {
      var l = lists[el.getAttribute('data-lib-values')];
      if (l) el.innerHTML = Object.keys(l).map(function (k) { return '<code>' + esc(k) + '</code> (' + esc(l[k]) + ')'; }).join(', ');
    });
  }

  window.Library = { load: load, check: check, renderSite: renderSite };

  fillValues();
  var lib = document.getElementById('library'), rep = document.getElementById('library-check');
  if (lib) renderLibrary(lib);
  if (rep) renderCheck(rep);
})();
