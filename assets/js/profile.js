/* Profile page: reads ?id=SM-001 and renders one site. */
(function () {
  var A = window.Atlas;
  var root = document.getElementById('profile');

  function factRow(f, sources) {
    return '<tr><th scope="row">' + A.esc(f.label) + '</th><td>' +
      '<span class="conf ' + A.esc(f.confidence) + '">' + A.esc(A.LABELS.confidence[f.confidence]) + '</span>' +
      A.esc(f.value) + ' ' + A.srcChips(f.source_ids, sources) +
      (f.note ? '<span class="note">' + A.esc(f.note) + '</span>' : '') +
      '</td></tr>';
  }

  function render(d, s) {
    document.title = s.name + ' - Are\'are-Small Malaita Conservation Atlas (prototype)';
    var used = {};
    s.facts.forEach(function (f) { (f.source_ids || []).forEach(function (id) { used[id] = true; }); });
    ((s.location && s.location.source_ids) || []).forEach(function (id) { used[id] = true; });
    var usedIds = d.sourceList.map(function (x) { return x.id; }).filter(function (id) { return used[id]; });

    var mapped = s.location && s.location.lat != null;
    var cite = 'Are’are–Small Malaita Conservation Atlas (prototype). “' + s.name + '.” Desk-sourced profile, last reviewed ' +
      A.fmtDate(s.last_reviewed) + '. Based on published sources ' + usedIds.join(', ') + '. Not reviewed by custodians.';

    root.innerHTML =
      '<div class="crumbs"><a href="index.html">&larr; All sites</a></div>' +
      '<header class="profile-head"><p class="muted small" style="margin:0">' + A.esc(s.id) + '</p><h1>' + A.esc(s.name) + '</h1>' +
      A.badges(s) + '</header>' +
      '<div class="profile-grid"><div>' +

      '<div class="callout"><p><strong>Read this first.</strong> ' + A.esc(A.LABELS.verification[s.verification_status]) +
      '. Everything below comes from published sources, not from the custodians. Items marked <em>Unknown</em> are gaps, not guesses.</p></div>' +

      '<section class="panel"><h2>Why it matters</h2><p>' + A.esc(s.summary_en) + '</p>' +
      '<p class="small muted">Solomon Pijin summary: ' + (s.summary_pijin ? A.esc(s.summary_pijin) : 'not yet written. Best written by local reviewers.') + '</p></section>' +

      '<section class="panel"><h2>Key facts</h2><table class="facts"><tbody>' +
      s.facts.map(function (f) { return factRow(f, d.sources); }).join('') + '</tbody></table></section>' +

      '<section class="panel"><h2>What we still don’t know</h2>' +
      '<p class="small muted">Starting points for first-hand research. Ask permission first. See the <a href="kit.html">Field Kit</a>.</p>' +
      '<ul class="clean">' + s.open_questions.map(function (q) { return '<li>' + A.esc(q) + '</li>'; }).join('') + '</ul></section>' +

      '<section class="panel"><h2>Sources</h2><ol class="sources">' +
      usedIds.map(function (id) {
        var x = d.sources[id];
        return '<li id="src-' + A.esc(id) + '"><strong>' + A.esc(id) + '</strong> &middot; ' + A.esc(x.title) +
          '<br><span class="small muted">' + A.esc(x.publisher) + ' &middot; ' + A.esc(x.type) + ' &middot; ' + A.esc(x.date) + '</span>' +
          '<br><a class="small" href="' + A.esc(x.url) + '" rel="noopener" target="_blank">' + A.esc(x.url) + '</a>' +
          (x.notes ? '<br><span class="small muted">' + A.esc(x.notes) + '</span>' : '') + '</li>';
      }).join('') + '</ol>' +
      '<h3>Cite this profile</h3><p class="small">' + A.esc(cite) + '</p></section>' +

      '</div><aside>' +

      '<section class="panel"><h2>Where</h2><p style="margin:0 0 .5rem">' + A.esc(s.place_text) + '</p>' +
      (mapped ? '<div id="mini" class="mini-map" role="img" aria-label="Small map showing the approximate location"></div>' : '') +
      '<p class="small muted" style="margin:0">' + A.esc(s.location.note) + '</p>' +
      '<p class="small" style="margin:.5rem 0 0"><strong>Precision:</strong> ' + A.esc(A.LABELS.precision[s.location.precision]) + '</p></section>' +

      '<section class="panel"><h2>Visiting</h2>' +
      '<p style="margin:0 0 .4rem"><strong>' + A.esc(A.LABELS.visitor[s.visitor.access]) + '</strong></p>' +
      '<p class="small" style="margin:0">' + A.esc(s.visitor.note) + '</p></section>' +

      '<section class="panel"><h2>Permission and contact</h2><dl class="meta">' +
      '<dt>Consent status</dt><dd>' + A.esc(A.LABELS.consent[s.consent.status]) + '. ' + A.esc(s.consent.note) + '</dd>' +
      '<dt>Public contact</dt><dd>' + (s.contact.public ? A.esc(s.contact.public) : 'None published.') + ' ' + A.esc(s.contact.note) + '</dd>' +
      '<dt>Map visibility</dt><dd>' + A.esc(s.public_visibility) + '</dd>' +
      '<dt>Last reviewed</dt><dd>' + A.esc(A.fmtDate(s.last_reviewed)) + '</dd></dl>' +
      '<p class="small" style="margin:.8rem 0 0">Spotted an error, or a custodian wants this changed or removed? See <a href="about.html#corrections">how corrections work</a>.</p></section>' +

      '</aside></div>';

    // Source chips jump to the source entry on this page
    root.querySelectorAll('a[data-src]').forEach(function (a) {
      a.setAttribute('href', '#src-' + a.getAttribute('data-src'));
    });

    if (mapped) {
      var m = A.baseMap('mini', [s.location.lat, s.location.lng], 10);
      L.marker([s.location.lat, s.location.lng], { icon: A.pinIcon(s.tier), alt: s.name }).addTo(m);
      if (s.location.radius_m) L.circle([s.location.lat, s.location.lng], { radius: s.location.radius_m, color: '#1f5a43', weight: 2, dashArray: '6 6', fillOpacity: 0.08, interactive: false }).addTo(m);
    }
  }

  var id = new URLSearchParams(location.search).get('id');
  A.loadAll().then(function (d) {
    var s = d.sites.filter(function (x) { return x.id === id; })[0];
    if (!s) {
      root.innerHTML = '<div class="crumbs"><a href="index.html">&larr; All sites</a></div><h1>Profile not found</h1><p>There is no site with the ID “' + A.esc(id || '') + '”.</p>';
      return;
    }
    render(d, s);
  }).catch(function (err) { A.showLoadError(root, err); });
})();
