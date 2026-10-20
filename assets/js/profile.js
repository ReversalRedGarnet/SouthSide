/* Profile page: reads ?id=SM-001 and renders one site. */
(function () {
  var A = window.Atlas;
  var root = document.getElementById('profile');

  // id: optional, so "At a glance" can link to the row.
  function factRow(f, sources, id) {
    // A conflicting fact gets a flagged row as well as its mark and word.
    return '<tr' + (id ? ' id="' + id + '"' : '') + (f.confidence === 'conflicting' ? ' class="flag-conflicting"' : '') + '><th scope="row">' + A.esc(f.label) + '</th><td>' +
      A.confMark(f.confidence) + ' ' +
      A.esc(f.value) + ' ' + A.srcLinks(f.source_ids, sources) +
      (f.note ? '<span class="note">' + A.esc(f.note) + '</span>' : '') +
      '</td></tr>';
  }

  // "None published." plus the note, unless the note already says there is no published contact.
  function contactText(c) {
    if (c.public) return A.esc(c.public) + ' ' + A.esc(c.note);
    if (/^(not|none) published\.?$/i.test((c.note || '').trim())) return A.esc(c.note);
    return 'None published. ' + A.esc(c.note);
  }

  function pairRow(label, html, id) {
    return '<tr' + (id ? ' id="' + id + '"' : '') + '><th scope="row">' + A.esc(label) + '</th><td>' + html + '</td></tr>';
  }

  function render(d, s) {
    document.title = s.name + ' - SouthSide (prototype)';
    var used = {};
    s.facts.forEach(function (f) { (f.source_ids || []).forEach(function (id) { used[id] = true; }); });
    ((s.location && s.location.source_ids) || []).forEach(function (id) { used[id] = true; });
    var usedIds = d.sourceList.map(function (x) { return x.id; }).filter(function (id) { return used[id]; });

    var mapped = s.location && s.location.lat != null && s.location.lng != null;
    var cite = 'SouthSide (prototype). “' + s.name + '.” ' + A.statusWord(s.verification_status) + ' profile, last reviewed ' +
      A.fmtDate(s.last_reviewed) + '. Based on published sources ' + usedIds.join(', ') + '. Not reviewed by custodians.';

    // The Key facts row that backs the kind of site (its confidence mark and sources are there), if the profile has one.
    var legal = -1;
    s.facts.forEach(function (f, i) { if (legal === -1 && f.label === 'Legal status') legal = i; });

    // "At a glance": the same values as the sections below, rendered by the same helpers, so their words match. A value
    // with a row lower on the page links to it ("details"), where its marks, sources and notes are.
    var glance = [
      ['Kind', A.tierTag(s.tier), legal === -1 ? null : 'fact-legal-status'],
      ['Constituency', A.esc(s.constituency)],
      ['Status', A.statusText(s.verification_status)],
      ['Location precision', A.esc(A.LABELS.precision[s.location.precision]), 'row-precision'],
      ['Visitor access', A.chip('visitor', s.visitor.access), 'row-access'],
      ['Consent status', A.chip('consent', s.consent.status), 'row-consent'],
      ['Last reviewed', A.esc(A.fmtDate(s.last_reviewed)), 'row-reviewed']
    ];

    // Sections in page order: [id, heading, body, back-to-top link after it]. Updates, Research and Media are slots the
    // other scripts fill; their back-to-top link is hidden while they hold only an empty state (styles.css).
    var sections = [
      ['why', 'Why it matters', '<p>' + A.esc(s.summary_en) + '</p>' +
        '<p class="small muted">Solomon Pijin summary: ' + (s.summary_pijin ? A.esc(s.summary_pijin) : 'not yet written. Best written by local reviewers.') + '</p>'],

      ['facts', 'Key facts', '<p class="small muted">Each fact starts with how sure we are: Reported, Corroborated, Conflicting or Unknown.</p>' +
        '<table class="facts"><tbody>' + s.facts.map(function (f, i) { return factRow(f, d.sources, i === legal ? 'fact-legal-status' : null); }).join('') + '</tbody></table>', true],

      window.Updates ? ['updates', 'Updates', '<div id="site-updates"><p class="muted">Loading updates&hellip;</p></div>', true] : null,

      ['where', 'Where', '<p>' + A.esc(s.place_text) + '</p>' +
        (mapped
          ? '<div id="mini" class="mini-map" role="img" aria-label="Small map showing the approximate location"></div>'
          : '<p class="callout callout-danger"><strong>No map point</strong> (location withheld or unknown).</p>') +
        '<table class="facts"><tbody>' +
        pairRow('Precision', A.esc(A.LABELS.precision[s.location.precision]), 'row-precision') +
        pairRow('Location note', A.esc(s.location.note) + ' ' + A.srcLinks(s.location.source_ids, d.sources)) +
        '</tbody></table>'],

      ['visiting', 'Visiting', '<table class="facts"><tbody>' +
        pairRow('Access', A.chip('visitor', s.visitor.access), 'row-access') +
        pairRow('Note', A.esc(s.visitor.note)) +
        '</tbody></table>'],

      ['permission', 'Permission and contact', '<table class="facts"><tbody>' +
        pairRow('Consent status', A.chip('consent', s.consent.status) + ' ' + A.esc(s.consent.note), 'row-consent') +
        pairRow('Public contact', contactText(s.contact)) +
        pairRow('Map visibility', A.esc(s.public_visibility)) +
        pairRow('Last reviewed', A.esc(A.fmtDate(s.last_reviewed)), 'row-reviewed') +
        '</tbody></table>' +
        '<p class="small">Spotted an error, or a custodian wants this changed or removed? See <a href="about.html#corrections">how corrections work</a>.</p>'],

      ['unknowns', 'What we still don’t know', '<p class="small muted">Starting points for first-hand research. Ask permission first. See the <a href="kit.html">Field Kit</a>.</p>' +
        '<ul>' + s.open_questions.map(function (q) { return '<li>' + A.esc(q) + '</li>'; }).join('') + '</ul>'],

      window.Library ? ['research', 'Research', '<div id="site-research"><p class="muted">Loading research&hellip;</p></div>', true] : null,
      window.Media ? ['media', 'Media', '<div id="site-media"><p class="muted">Loading media&hellip;</p></div>', true] : null,

      ['sources', 'Sources', '<ol class="sources">' +
        usedIds.map(function (id) {
          var x = d.sources[id];
          return '<li id="src-' + A.esc(id) + '"><strong>' + A.esc(id) + '</strong> &middot; ' + A.esc(x.title) +
            '<br><span class="small muted">' + A.esc(x.publisher) + ' &middot; ' + A.esc(x.type) + ' &middot; ' + A.esc(x.date) + '</span>' +
            // Custodian-supplied material has no public link, so no link line.
            (x.url ? '<br><a class="small" href="' + A.esc(x.url) + '" rel="noopener" target="_blank">' + A.esc(x.url) + '</a>' : '') +
            (x.notes ? '<br><span class="small muted">' + A.esc(x.notes) + '</span>' : '') + '</li>';
        }).join('') + '</ol>' +
        '<h3>Cite this profile</h3><p class="small">' + A.esc(cite) + '</p>', true]
    ].filter(Boolean);

    root.innerHTML =
      '<p class="crumbs"><a href="index.html">&larr; All sites</a></p>' +
      '<p class="profile-id">' + A.esc(s.id) + '</p>' +
      '<h1>' + A.esc(s.name) + '</h1>' +
      '<section class="glance" aria-labelledby="glance-title"><h2 class="glance-title" id="glance-title">At a glance</h2><dl>' +
        glance.map(function (g) {
          return '<div><dt>' + A.esc(g[0]) + '</dt><dd>' + g[1] +
            (g[2] ? ' <a class="glance-more" href="#' + g[2] + '" aria-label="' + A.esc(g[0]) + ': details">details</a>' : '') + '</dd></div>';
        }).join('') + '</dl></section>' +
      '<p>Status: ' + A.statusText(s.verification_status) + '. This profile is desk-sourced from published material, not from the custodians. Updates are listed separately, each labelled with who it comes from. Items marked <strong>Unknown</strong> are gaps, not guesses.</p>' +
      '<nav class="toc" aria-labelledby="toc-title"><p class="toc-title" id="toc-title">On this page</p><ul>' +
        sections.map(function (x) { return '<li><a href="#' + x[0] + '">' + x[1] + '</a></li>'; }).join('') + '</ul></nav>' +
      sections.map(function (x) {
        return '<section class="profile-section"><h2 id="' + x[0] + '">' + x[1] + '</h2>' + x[2] +
          (x[3] ? '<p class="to-top"><a href="#main">Back to top</a></p>' : '') + '</section>';
      }).join('');

    if (window.Updates) window.Updates.renderSite(document.getElementById('site-updates'), s.id);
    if (window.Library) window.Library.renderSite(document.getElementById('site-research'), s.id);
    if (window.Media) window.Media.renderSite(document.getElementById('site-media'), s.id);

    // The profile text is already on the page; a map problem must not replace it with an error.
    if (mapped) {
      try {
        var ll = [s.location.lat, s.location.lng];
        var m = A.baseMap('mini', { center: ll, zoom: 10, limit: true });
        A.addStudyArea(m);
        if (s.location.radius_m) A.zoneCircle(ll, s.location.radius_m, s.tier).addTo(m);
        L.marker(ll, { icon: A.pinIcon(s.tier), title: A.pinLabel(s.name, s.tier), alt: A.pinLabel(s.name, s.tier) }).addTo(m);
      } catch (e) { if (window.console) console.warn('Map not shown:', e.message); }
    }
  }

  var id = new URLSearchParams(location.search).get('id');
  A.loadAll().then(function (d) {
    var s = d.sites.filter(function (x) { return x.id === id; })[0];
    if (!s) {
      root.innerHTML = '<p class="crumbs"><a href="index.html">&larr; All sites</a></p><h1>Profile not found</h1><p>There is no site with the ID “' + A.esc(id || '') + '”.</p>';
      return;
    }
    render(d, s);
  }).catch(function (err) { A.showLoadError(root, err); });
})();
