/* Home page: map, filters, site list. */
(function () {
  var A = window.Atlas;
  var state = { constituency: '', q: '' };
  var data, map, markers = {};

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

  function row(s) {
    var where = isMapped(s)
      ? A.esc(A.LABELS.precision[s.location.precision]) + '<br><button type="button" class="linkbtn" data-show="' + A.esc(s.id) + '">Show on map</button>'
      : 'Not located yet';
    return '<tr id="row-' + A.esc(s.id) + '">' +
      '<th scope="row"><a href="' + profileUrl(s) + '">' + A.esc(s.name) + '</a></th>' +
      '<td data-label="Constituency">' + A.esc(s.constituency) + '</td>' +
      '<td data-label="Kind">' + A.tierTag(s.tier) + '</td>' +
      '<td data-label="Status">' + A.badge(s.verification_status) + '</td>' +
      '<td data-label="Map">' + where + '</td></tr>';
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
      // The Status column shows one word, so say here what it means. Worded from the data,
      // so the line stays true once a profile has been reviewed.
      var unreviewed = function (s) { return s.verification_status === 'draft' || s.verification_status === 'desk_sourced'; };
      html = '<p class="callout callout-caution">' + (list.every(unreviewed)
        ? 'None of these profiles have been reviewed by custodians.'
        : 'Profiles marked Draft or Desk-sourced have not been reviewed by custodians.') + '</p>' +
        '<div class="table-scroll"><table class="stack" aria-labelledby="sites"><thead><tr>' +
        '<th scope="col">Site</th><th scope="col">Constituency</th><th scope="col">Kind</th><th scope="col">Status</th><th scope="col">Map</th>' +
        '</tr></thead><tbody>' + list.map(row).join('') + '</tbody></table></div>';
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
  }

  function buildMap() {
    map = A.baseMap('map', { limit: true });
    A.addStudyArea(map);
    data.sites.filter(isMapped).forEach(function (s) {
      var ll = [s.location.lat, s.location.lng];
      var zone = s.location.radius_m ? A.zoneCircle(ll, s.location.radius_m, s.tier).addTo(map) : null;
      var pin = L.marker(ll, { icon: A.pinIcon(s.tier), title: s.name, alt: s.name, keyboard: true }).addTo(map);
      pin.bindPopup('<p><strong>' + A.esc(s.name) + '</strong></p>' +
        '<p class="small">' + A.esc(s.constituency) + ' &middot; ' + A.tierTag(s.tier) + '</p>' +
        '<p class="small">' + A.statusText(s.verification_status) + '</p>' +
        '<p class="small"><em>' + A.esc(s.location.note) + '</em></p>' +
        '<a href="' + profileUrl(s) + '">Open profile</a>');
      markers[s.id] = { pin: pin, zone: zone };
      pin.on('popupopen', function () { highlight(s.id, false); });
    });
  }

  function highlight(id, pan) {
    document.querySelectorAll('tr.active').forEach(function (r) { r.classList.remove('active'); });
    var r = document.getElementById('row-' + id);
    if (r) r.classList.add('active');
    if (pan && markers[id]) {
      map.setView(markers[id].pin.getLatLng(), 11);
      markers[id].pin.openPopup();
      document.getElementById('map').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
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
      var b = e.target.closest('[data-show]');
      if (b) highlight(b.getAttribute('data-show'), true);
    });
  }

  A.loadAll().then(function (d) {
    data = d;
    document.getElementById('status-note').textContent = d.meta.status;
    renderCoverage();
    // The legend starts open on wide screens and collapsed on phones.
    var legend = document.getElementById('legend');
    if (legend && window.matchMedia('(max-width: 600px)').matches) legend.removeAttribute('open');
    wireControls();
    // The list is the equivalent of the map, so it must render even if the map cannot.
    try { buildMap(); } catch (e) { if (window.console) console.warn('Map not shown:', e.message); }
    renderList();
  }).catch(function (err) {
    A.showLoadError(document.getElementById('list'), err);
  });
})();
