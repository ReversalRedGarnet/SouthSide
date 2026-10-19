/* Profile page: reads ?id=SM-001 and renders one site. */
(function () {
  var A = window.Atlas;
  var root = document.getElementById('profile');

  function factRow(f, sources) {
    // A conflicting fact gets a flagged row as well as its mark and word.
    return '<tr' + (f.confidence === 'conflicting' ? ' class="flag-conflicting"' : '') + '><th scope="row">' + A.esc(f.label) + '</th><td>' +
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

  function pairRow(label, html) {
    return '<tr><th scope="row">' + A.esc(label) + '</th><td>' + html + '</td></tr>';
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

    root.innerHTML =
      '<p class="crumbs"><a href="index.html">&larr; All sites</a></p>' +
      '<p class="profile-id">' + A.esc(s.id) + ' &middot; ' + A.esc(s.constituency) + ' &middot; ' + A.tierTag(s.tier) + '</p>' +
      '<h1>' + A.esc(s.name) + '</h1>' +
      '<p>Status: ' + A.statusText(s.verification_status) + '. This profile is desk-sourced from published material, not from the custodians. Updates are listed separately, each labelled with who it comes from. Items marked <strong>Unknown</strong> are gaps, not guesses.</p>' +

      '<h2>Why it matters</h2><p>' + A.esc(s.summary_en) + '</p>' +
      '<p class="small muted">Solomon Pijin summary: ' + (s.summary_pijin ? A.esc(s.summary_pijin) : 'not yet written. Best written by local reviewers.') + '</p>' +
      (window.Updates ? '<h2 id="updates">Updates</h2><div id="site-updates"><p class="muted">Loading updates&hellip;</p></div>' : '') +

      '<h2>Key facts</h2><p class="small muted">Each fact starts with how sure we are: Reported, Corroborated, Conflicting or Unknown.</p>' +
      '<table class="facts"><tbody>' + s.facts.map(function (f) { return factRow(f, d.sources); }).join('') + '</tbody></table>' +

      '<h2>Where</h2><p>' + A.esc(s.place_text) + '</p>' +
      (mapped
        ? '<div id="mini" class="mini-map" role="img" aria-label="Small map showing the approximate location"></div>'
        : '<p class="callout callout-danger"><strong>No map point</strong> (location withheld or unknown).</p>') +
      '<table class="facts"><tbody>' +
      pairRow('Precision', A.esc(A.LABELS.precision[s.location.precision])) +
      pairRow('Location note', A.esc(s.location.note) + ' ' + A.srcLinks(s.location.source_ids, d.sources)) +
      '</tbody></table>' +

      '<h2>Visiting</h2><table class="facts"><tbody>' +
      pairRow('Access', A.chip('visitor', s.visitor.access)) +
      pairRow('Note', A.esc(s.visitor.note)) +
      '</tbody></table>' +

      '<h2>Permission and contact</h2><table class="facts"><tbody>' +
      pairRow('Consent status', A.chip('consent', s.consent.status) + ' ' + A.esc(s.consent.note)) +
      pairRow('Public contact', contactText(s.contact)) +
      pairRow('Map visibility', A.esc(s.public_visibility)) +
      pairRow('Last reviewed', A.esc(A.fmtDate(s.last_reviewed))) +
      '</tbody></table>' +
      '<p class="small">Spotted an error, or a custodian wants this changed or removed? See <a href="about.html#corrections">how corrections work</a>.</p>' +

      '<h2>What we still don’t know</h2>' +
      '<p class="small muted">Starting points for first-hand research. Ask permission first. See the <a href="kit.html">Field Kit</a>.</p>' +
      '<ul>' + s.open_questions.map(function (q) { return '<li>' + A.esc(q) + '</li>'; }).join('') + '</ul>' +

      '<h2>Sources</h2><ol class="sources">' +
      usedIds.map(function (id) {
        var x = d.sources[id];
        return '<li id="src-' + A.esc(id) + '"><strong>' + A.esc(id) + '</strong> &middot; ' + A.esc(x.title) +
          '<br><span class="small muted">' + A.esc(x.publisher) + ' &middot; ' + A.esc(x.type) + ' &middot; ' + A.esc(x.date) + '</span>' +
          '<br><a class="small" href="' + A.esc(x.url) + '" rel="noopener" target="_blank">' + A.esc(x.url) + '</a>' +
          (x.notes ? '<br><span class="small muted">' + A.esc(x.notes) + '</span>' : '') + '</li>';
      }).join('') + '</ol>' +
      '<h3>Cite this profile</h3><p class="small">' + A.esc(cite) + '</p>';

    if (window.Updates) window.Updates.renderSite(document.getElementById('site-updates'), s.id);

    // The profile text is already on the page; a map problem must not replace it with an error.
    if (mapped) {
      try {
        var ll = [s.location.lat, s.location.lng];
        var m = A.baseMap('mini', { center: ll, zoom: 10, limit: true });
        A.addStudyArea(m);
        if (s.location.radius_m) A.zoneCircle(ll, s.location.radius_m, s.tier).addTo(m);
        L.marker(ll, { icon: A.pinIcon(s.tier), alt: s.name }).addTo(m);
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
