/* Home page: map, filters, site list. */
(function () {
  var A = window.Atlas;
  var state = { constituency: '', tier: '', realm: '', q: '' };
  var data, map, markers = {};

  function matches(s) {
    if (state.constituency && s.constituency !== state.constituency) return false;
    if (state.tier && s.tier !== state.tier) return false;
    if (state.realm && s.realm !== state.realm) return false;
    if (state.q) {
      var hay = (s.name + ' ' + (s.alt_names || []).join(' ') + ' ' + s.place_text).toLowerCase();
      if (hay.indexOf(state.q.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function isMapped(s) { return s.location && s.location.lat != null && s.location.lng != null; }

  function card(s) {
    var mapped = isMapped(s);
    var locLine = mapped
      ? 'Map point: ' + A.LABELS.precision[s.location.precision].toLowerCase() + ' only'
      : 'Not on the map yet - location not confirmed';
    return '<li class="card" id="card-' + A.esc(s.id) + '" data-id="' + A.esc(s.id) + '">' +
      '<h3><a href="site.html?id=' + encodeURIComponent(s.id) + '">' + A.esc(s.name) + '</a></h3>' +
      A.badges(s) +
      '<p>' + A.esc(s.place_text) + '</p>' +
      '<p class="small">' + A.esc(locLine) + '</p>' +
      '<div class="actions">' +
        '<a class="btn" href="site.html?id=' + encodeURIComponent(s.id) + '">Open profile</a>' +
        (mapped ? '<button type="button" class="btn ghost" data-show="' + A.esc(s.id) + '">Show on map</button>' : '') +
      '</div></li>';
  }

  function renderCoverage() {
    var el = document.getElementById('coverage');
    el.innerHTML = A.CONSTITUENCIES.map(function (c) {
      var n = data.sites.filter(function (s) { return s.constituency === c; }).length;
      var mapped = data.sites.filter(function (s) { return s.constituency === c && isMapped(s); }).length;
      if (n === 0) {
        return '<div class="cov empty"><div class="n">0</div><div class="lbl">' + A.esc(c) + '</div>' +
          '<p class="hint">No sites found in published sources yet. This is a research gap, not a finding that none exist.</p></div>';
      }
      return '<div class="cov"><div class="n">' + n + '</div><div class="lbl">' + A.esc(c) + '</div>' +
        '<p class="hint">' + n + ' desk-sourced profiles, ' + mapped + ' with a map point.</p></div>';
    }).join('');
  }

  function renderList() {
    var list = data.sites.filter(matches);
    var mapped = list.filter(isMapped);
    var unmapped = list.filter(function (s) { return !isMapped(s); });
    document.getElementById('count').textContent = list.length + ' of ' + data.sites.length + ' profiles';

    var html = '';
    if (!list.length) {
      html = '<div class="empty-state">No profiles match these filters. If you chose West Are\'are or Small Malaita, that is expected - nothing has been recorded there yet.</div>';
    } else {
      if (mapped.length) html += '<ul class="site-list" aria-label="Sites with a map point">' + mapped.map(card).join('') + '</ul>';
      if (unmapped.length) {
        html += '<h2 class="unmapped-title">Not yet on the map (' + unmapped.length + ')</h2>' +
          '<p class="small muted">These have a profile but no confirmed location. Recording one, with the custodians\' permission, is a good first research task.</p>' +
          '<ul class="site-list" aria-label="Sites without a map point">' + unmapped.map(card).join('') + '</ul>';
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
    map = A.baseMap('map', [-9.55, 161.3], 8);
    data.sites.filter(isMapped).forEach(function (s) {
      var pin = L.marker([s.location.lat, s.location.lng], {
        icon: A.pinIcon(s.tier), title: s.name, alt: s.name, keyboard: true
      }).addTo(map);
      pin.bindPopup('<h3>' + A.esc(s.name) + '</h3>' +
        '<p class="small" style="margin:0 0 .5rem">' + A.esc(s.constituency) + ' &middot; ' + A.esc(A.LABELS.tier[s.tier]) + '</p>' +
        '<p class="small" style="margin:0 0 .5rem"><em>' + A.esc(s.location.note) + '</em></p>' +
        '<a href="site.html?id=' + encodeURIComponent(s.id) + '">Open profile</a>');
      var zone = null;
      if (s.location.radius_m) {
        zone = L.circle([s.location.lat, s.location.lng], {
          radius: s.location.radius_m, color: '#1f5a43', weight: 2, dashArray: '6 6',
          fillColor: '#1f5a43', fillOpacity: 0.08, interactive: false
        }).addTo(map);
      }
      markers[s.id] = { pin: pin, zone: zone };
      pin.on('click', function () { highlight(s.id, false); });
    });
  }

  function highlight(id, pan) {
    document.querySelectorAll('.card.active').forEach(function (c) { c.classList.remove('active'); });
    var c = document.getElementById('card-' + id);
    if (c) { c.classList.add('active'); c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    if (pan && markers[id]) {
      var ll = markers[id].pin.getLatLng();
      map.setView(ll, 11);
      markers[id].pin.openPopup();
      document.getElementById('map').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function wireControls() {
    var fc = document.getElementById('f-constituency');
    A.CONSTITUENCIES.forEach(function (c) { fc.insertAdjacentHTML('beforeend', '<option>' + A.esc(c) + '</option>'); });
    var ft = document.getElementById('f-tier');
    Object.keys(A.LABELS.tier).forEach(function (k) { ft.insertAdjacentHTML('beforeend', '<option value="' + k + '">' + A.esc(A.LABELS.tier[k]) + '</option>'); });
    var fr = document.getElementById('f-realm');
    Object.keys(A.LABELS.realm).forEach(function (k) { fr.insertAdjacentHTML('beforeend', '<option value="' + k + '">' + A.esc(A.LABELS.realm[k]) + '</option>'); });

    function update() {
      state.constituency = fc.value; state.tier = ft.value; state.realm = fr.value;
      state.q = document.getElementById('f-q').value.trim();
      renderList();
    }
    [fc, ft, fr].forEach(function (el) { el.addEventListener('change', update); });
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
    wireControls();
    buildMap();
    renderList();
  }).catch(function (err) {
    A.showLoadError(document.getElementById('list'), err);
  });
})();
