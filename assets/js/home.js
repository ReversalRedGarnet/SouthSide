/* Home page: map, filters, site list. Below 1100px the list is a table under the map; from 1100px the map sits in a
   sticky left column and the list becomes compact rows beside it. A site selected in the list is selected on the map,
   and the other way round. */
(function () {
  var A = window.Atlas;
  var state = { constituency: '', q: '' };
  var data, map, markers = {}, selected = null, startView = null, relabel = null;
  // The side-by-side breakpoint; keep it the same as the @media (min-width: 1100px) block in styles.css.
  var wide = window.matchMedia ? window.matchMedia('(min-width: 1100px)') : { matches: false };

  function matches(s) {
    if (state.constituency && s.constituency !== state.constituency) return false;
    if (state.q) {
      var hay = (s.name + ' ' + (s.alt_names || []).join(' ') + ' ' + s.place_text).toLowerCase();
      if (hay.indexOf(state.q.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function isMapped(s) { return s.location && s.location.lat != null && s.location.lng != null; }
  function profileUrl(s) { return 'site.html?id=' + encodeURIComponent(s.id); }
  function siteById(id) { return data.sites.filter(function (s) { return s.id === id; })[0]; }

  // Table row (stacked layout).
  function row(s) {
    var where = isMapped(s)
      ? A.esc(A.LABELS.precision[s.location.precision]) + '<br><button type="button" class="linkbtn" data-select="' + A.esc(s.id) + '">Show on map</button>'
      : 'Not located yet';
    return '<tr id="row-' + A.esc(s.id) + '">' +
      '<th scope="row"><a href="' + profileUrl(s) + '">' + A.esc(s.name) + '</a></th>' +
      '<td data-label="Constituency">' + A.esc(s.constituency) + '</td>' +
      '<td data-label="Kind">' + A.tierTag(s.tier, true) + '</td>' +
      '<td data-label="Status">' + A.badge(s.verification_status) + '</td>' +
      '<td data-label="Map">' + where + '</td></tr>';
  }

  // Compact row (side by side): everything the table row shows. A click anywhere on the row selects it; the button
  // does the same from the keyboard.
  function compactRow(s) {
    var mapped = isMapped(s);
    var button = mapped
      ? '<button type="button" class="linkbtn" data-select="' + A.esc(s.id) + '">Show on map</button>'
      : '<button type="button" class="linkbtn" data-select="' + A.esc(s.id) + '" aria-label="Select ' + A.esc(s.name) + '">Select</button>';
    return '<li class="site-row" id="srow-' + A.esc(s.id) + '" data-id="' + A.esc(s.id) + '">' +
      '<p class="site-row-name"><a href="' + profileUrl(s) + '">' + A.esc(s.name) + '</a></p>' +
      '<p class="site-row-meta">' + A.tierTag(s.tier, true) + A.badge(s.verification_status) + '</p>' +
      '<p class="site-row-meta"><span>' + A.esc(s.constituency) + '</span><span>Map: ' +
        (mapped ? A.esc(A.LABELS.precision[s.location.precision]) : 'not located yet') + '</span>' + button + '</p></li>';
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  // "4 desk-sourced, 1 draft": counts by verification status, in the order the labels are defined.
  function statusBreakdown(sites) {
    return Object.keys(A.LABELS.verification).map(function (k) {
      var n = sites.filter(function (s) { return s.verification_status === k; }).length;
      return n ? n + ' ' + A.statusWord(k).toLowerCase() : null;
    }).filter(Boolean).join(', ');
  }

  // Every number here is counted from the data, so it stays true as profiles are added.
  function renderCoverage() {
    var covered = A.CONSTITUENCIES.filter(function (c) { return data.sites.some(function (s) { return s.constituency === c; }); });
    document.getElementById('coverage-total').textContent =
      plural(data.sites.length, 'profile', 'profiles') + ' (' + statusBreakdown(data.sites) + ') in ' +
      covered.length + ' of ' + A.CONSTITUENCIES.length + ' constituencies, ' +
      data.sites.filter(isMapped).length + ' with a map point.';
    document.getElementById('coverage').innerHTML = A.CONSTITUENCIES.map(function (c) {
      var here = data.sites.filter(function (s) { return s.constituency === c; });
      if (!here.length) {
        return '<li><strong>' + A.esc(c) + '</strong>: no sites found in published sources yet. This is a research gap, not a finding that none exist.</li>';
      }
      return '<li><strong>' + A.esc(c) + '</strong>: ' + plural(here.length, 'profile', 'profiles') + ' (' + A.esc(statusBreakdown(here)) + '), ' +
        here.filter(isMapped).length + ' with a map point.</li>';
    }).join('');
  }

  function renderList() {
    var list = data.sites.filter(matches);
    // Sites with a map point first, so the list follows the map.
    list = list.filter(isMapped).concat(list.filter(function (s) { return !isMapped(s); }));
    document.getElementById('count').textContent = list.length + ' of ' + data.sites.length + ' profiles';

    var html;
    if (!list.length) {
      var none = state.constituency && !data.sites.some(function (s) { return s.constituency === state.constituency; });
      html = '<p>No profiles match these filters.' +
        (none ? ' Nothing has been recorded in ' + A.esc(state.constituency) + ' yet. That is a research gap, not a finding that nothing is there.' : '') + '</p>';
    } else {
      // Review status is stated in the banner (meta.status) and per row by the Status badge.
      // Both forms are written; the stylesheet shows the table below 1100px and the compact rows from 1100px.
      html = '<div class="table-scroll"><table class="stack" aria-labelledby="sites"><thead><tr>' +
        '<th scope="col">Site</th><th scope="col">Constituency</th><th scope="col">Kind</th><th scope="col">Status</th><th scope="col">Map</th>' +
        '</tr></thead><tbody>' + list.map(row).join('') + '</tbody></table></div>' +
        '<ul class="site-rows" aria-labelledby="sites">' + list.map(compactRow).join('') + '</ul>';
      if (list.some(function (s) { return !isMapped(s); })) {
        html += '<p class="small muted">"Not located yet" means the site has a profile but no confirmed location. Recording one, with the custodians\' permission, is a good first research task.</p>';
      }
    }
    document.getElementById('list').innerHTML = html;

    // Show/hide markers to match filters
    Object.keys(markers).forEach(function (id) {
      var m = markers[id];
      var visible = list.some(function (s) { return s.id === id; });
      [m.pin, m.zone].forEach(function (layer) {
        if (!layer) return;
        if (visible && !map.hasLayer(layer)) layer.addTo(map);
        if (!visible && map.hasLayer(layer)) map.removeLayer(layer);
      });
    });
    // A selected site that the filters hide is no longer selected.
    if (selected && !list.some(function (s) { return s.id === selected; })) selected = null;
    showSelection();
  }

  // Marks the selected site in the table, the compact rows and on the map (a thicker ring, by class), and says under
  // the map which site is selected and whether it has a map point. The line is a polite live region, so it is announced.
  function showSelection() {
    document.querySelectorAll('#list .is-selected').forEach(function (el) { el.classList.remove('is-selected'); el.removeAttribute('aria-current'); });
    ['row-', 'srow-'].forEach(function (prefix) {
      var el = selected && document.getElementById(prefix + selected);
      if (el) { el.classList.add('is-selected'); el.setAttribute('aria-current', 'true'); }
    });
    Object.keys(markers).forEach(function (id) {
      var el = markers[id].pin.getElement();
      if (el) el.classList.toggle('is-selected', id === selected);
    });
    var s = selected && siteById(selected);
    document.getElementById('map-selected').textContent = s ? 'Selected: ' + s.name + (isMapped(s) ? ' — shown on the map' : ' — no map point yet') : '';
  }

  // From the list: select, then show the site's marker and open its popup.
  function selectFromList(id) {
    selected = id;
    showSelection();
    if (!map) return;
    var m = markers[id];
    if (!m) { map.closePopup(); return; }
    var still = A.reducedMotion();
    map.setView(m.pin.getLatLng(), 11, { animate: !still });
    m.pin.openPopup();
    // Stacked, the map is above the list, so bring it into view. Side by side it is already beside the list.
    if (!wide.matches) document.getElementById('map').scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
  }

  // From the map (a marker's popup opened): select, and side by side bring the row into view. Stacked, the list is
  // below the map, so the page stays where it is.
  function selectFromMap(id) {
    selected = id;
    showSelection();
    var r = document.getElementById('srow-' + id);
    if (wide.matches && r) r.scrollIntoView({ block: 'nearest', behavior: A.reducedMotion() ? 'auto' : 'smooth' });
  }

  function view() { return map.getCenter().toString() + ' ' + map.getZoom(); }

  // The map changed size (layout switch, window resize): recalculate it, so no grey tiles are left, and update the
  // zoom limits. If nobody has moved the map yet, frame the three constituencies again, clear of the attribution, and
  // place the constituency labels again. The old limits are lifted first and set again after: the old minimum zoom
  // could stop a smaller map from framing them, and the pan limit would answer the resize with an animated pan that
  // ends after the new view.
  function relayout() {
    if (!map) return;
    var atStart = view() === startView;
    if (atStart) { map.setMaxBounds(null); map.setMinZoom(0); }
    map.invalidateSize();
    if (atStart) A.fitStudy(map, { clearControls: true });
    A.limitStudy(map);
    if (atStart) { startView = view(); if (relabel) relabel(); }
  }

  function buildMap() {
    map = A.baseMap('map', { limit: true });
    startView = view();
    // The boundary credit lengthens the attribution, so frame the outlines again once it is in.
    A.addStudyArea(map).then(function (place) { relabel = place || null; relayout(); });
    data.sites.filter(isMapped).forEach(function (s) {
      var ll = [s.location.lat, s.location.lng];
      var zone = s.location.radius_m ? A.zoneCircle(ll, s.location.radius_m, s.tier).addTo(map) : null;
      var pin = L.marker(ll, { icon: A.pinIcon(s.tier), title: A.pinLabel(s.name, s.tier), alt: A.pinLabel(s.name, s.tier), keyboard: true }).addTo(map);
      pin.bindPopup('<p><strong>' + A.esc(s.name) + '</strong></p>' +
        '<p class="small">' + A.esc(s.constituency) + ' &middot; ' + A.tierTag(s.tier) + '</p>' +
        '<p class="small">Location: ' + A.esc(A.LABELS.precision[s.location.precision] || s.location.precision) + (zone ? ' (dashed circle)' : '') + '</p>' +
        '<p class="small">' + A.statusText(s.verification_status) + '</p>' +
        '<p class="small"><em>' + A.esc(s.location.note) + '</em></p>' +
        '<a href="' + profileUrl(s) + '">Open profile</a>');
      markers[s.id] = { pin: pin, zone: zone };
      pin.on('popupopen', function () { selectFromMap(s.id); });
    });
    if (window.ResizeObserver) new ResizeObserver(relayout).observe(document.getElementById('map'));
    if (wide.addEventListener) wide.addEventListener('change', relayout);
  }

  function wireControls() {
    var fc = document.getElementById('f-constituency');
    A.CONSTITUENCIES.forEach(function (c) { fc.insertAdjacentHTML('beforeend', '<option>' + A.esc(c) + '</option>'); });

    function update() {
      state.constituency = fc.value;
      state.q = document.getElementById('f-q').value.trim();
      renderList();
    }
    fc.addEventListener('change', update);
    document.getElementById('f-q').addEventListener('input', update);
    document.getElementById('list').addEventListener('click', function (e) {
      var b = e.target.closest('[data-select]');
      if (b) { selectFromList(b.getAttribute('data-select')); return; }
      var r = e.target.closest('.site-row');
      if (r && !e.target.closest('a')) selectFromList(r.getAttribute('data-id'));
    });
  }

  A.loadAll().then(function (d) {
    data = d;
    document.getElementById('status-note').textContent = d.meta.status;
    renderCoverage();
    wireControls();
    // The list is the equivalent of the map, so it must render even if the map cannot.
    try { buildMap(); } catch (e) { if (window.console) console.warn('Map not shown:', e.message); }
    renderList();
  }).catch(function (err) {
    A.showLoadError(document.getElementById('list'), err);
  });
})();
