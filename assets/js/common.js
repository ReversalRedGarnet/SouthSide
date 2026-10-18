/* Shared helpers: data loading, labels, small HTML utilities. No frameworks. */
(function () {
  var LABELS = {
    tier: {
      legal_pa: 'Legally declared protected area',
      community_area: 'Community-managed area',
      community_group: 'Community conservation group'
    },
    realm: { land: 'Land / forest', coast_sea: 'Coast and sea' },
    verification: {
      draft: 'Draft (single source)',
      desk_sourced: 'Desk-sourced (not community-reviewed)',
      community_checked: 'Community-checked',
      source_verified: 'Source-verified',
      disputed: 'Disputed'
    },
    confidence: {
      reported: 'Reported',
      corroborated: 'Corroborated',
      unknown: 'Unknown',
      conflicting: 'Conflicting'
    },
    visitor: {
      unknown: 'Unknown - ask first',
      ask_first: 'Open by permission only',
      guided: 'Open with a local guide',
      open: 'Open to visitors',
      closed_sensitive: 'Closed - sensitive site'
    },
    consent: {
      not_yet_sought: 'Not yet sought',
      in_progress: 'In progress',
      given_scoped: 'Given for a stated scope',
      declined: 'Declined'
    },
    precision: {
      point: 'Point',
      bay: 'Bay / village level',
      area: 'General area',
      unlocated: 'Not yet located'
    }
  };

  var CONSTITUENCIES = ["East Are'are", "West Are'are", 'Small Malaita'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function loadJSON(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error('Could not load ' + path + ' (' + r.status + ')');
      return r.json();
    });
  }

  function loadAll() {
    return Promise.all([loadJSON('data/sites.json'), loadJSON('data/sources.json')]).then(function (a) {
      var sources = {};
      a[1].sources.forEach(function (s) { sources[s.id] = s; });
      return { sites: a[0].sites, meta: a[0].meta, sources: sources, sourceList: a[1].sources };
    });
  }

  function showLoadError(el, err) {
    var onFile = location.protocol === 'file:';
    el.innerHTML = '<div class="callout danger"><p><strong>The data could not be loaded.</strong> ' +
      (onFile
        ? 'This page was opened straight from a folder. Browsers block data files in that case. Open it through GitHub Pages, or run <code>python -m http.server</code> in this folder and visit <code>http://localhost:8000</code>.'
        : esc(err.message)) + '</p></div>';
  }

  function srcChips(ids, sources) {
    if (!ids || !ids.length) return '';
    return '<span class="src">' + ids.map(function (id) {
      var s = sources[id];
      return '<a href="site.html#" data-src="' + esc(id) + '" title="' + esc(s ? s.title : id) + '">' + esc(id) + '</a>';
    }).join(' ') + '</span>';
  }

  function badges(site) {
    return '<ul class="badges">' +
      '<li class="badge v-' + esc(site.verification_status) + '">' + esc(LABELS.verification[site.verification_status]) + '</li>' +
      '<li class="badge">' + esc(LABELS.tier[site.tier]) + '</li>' +
      '<li class="badge">' + esc(site.constituency) + '</li>' +
      '</ul>';
  }

  function fmtDate(iso) {
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  var TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  var TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  function baseMap(id, center, zoom) {
    var map = L.map(id, { scrollWheelZoom: false }).setView(center, zoom);
    L.tileLayer(TILE_URL, { maxZoom: 17, attribution: TILE_ATTR }).addTo(map);
    // Enable wheel zoom only after the user clicks the map, so the page can still scroll.
    map.on('focus click', function () { map.scrollWheelZoom.enable(); });
    map.on('blur mouseout', function () { map.scrollWheelZoom.disable(); });
    return map;
  }

  function pinIcon(tier) {
    return L.divIcon({
      className: '',
      html: '<div class="pin ' + tier + '"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 22],
      popupAnchor: [0, -22]
    });
  }

  window.Atlas = {
    LABELS: LABELS, CONSTITUENCIES: CONSTITUENCIES, esc: esc, loadAll: loadAll, loadJSON: loadJSON,
    showLoadError: showLoadError, srcChips: srcChips, badges: badges, fmtDate: fmtDate,
    baseMap: baseMap, pinIcon: pinIcon
  };
})();
