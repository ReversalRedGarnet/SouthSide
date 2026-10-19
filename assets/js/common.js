/* Shared helpers: data loading, labels, small HTML utilities. No frameworks. */
(function () {
  // Verification status as plain text: a bold word, then what it means. Never colour alone.
  var STATUS = {
    draft: ['Draft', 'single source, not reviewed by custodians'],
    desk_sourced: ['Desk-sourced', 'not reviewed by custodians'],
    community_checked: ['Community-checked', 'reviewed by named custodians'],
    source_verified: ['Source-verified', 'key facts checked against primary records'],
    disputed: ['Disputed', 'custodians or sources disagree']
  };

  var LABELS = {
    tier: {
      legal_pa: 'Legally declared protected area',
      community_area: 'Community-managed area',
      community_group: 'Community conservation group'
    },
    verification: {},
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
  Object.keys(STATUS).forEach(function (k) { LABELS.verification[k] = STATUS[k][0] + ', ' + STATUS[k][1]; });

  var CONSTITUENCIES = ["East Are'are", "West Are'are", 'Small Malaita'];
  var ACCENT = '#325a4b';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Just the status word ("Desk-sourced", "Draft"), for compact lists that explain the words nearby.
  function statusWord(code) { return STATUS[code] ? STATUS[code][0] : code; }

  function statusText(code) {
    var s = STATUS[code];
    return s ? '<strong>' + esc(s[0]) + '</strong>, ' + esc(s[1]) : esc(code);
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
    el.innerHTML = '<p><strong>The data could not be loaded.</strong> ' +
      (onFile
        ? 'This page was opened straight from a folder. Browsers block data files in that case. Open it through GitHub Pages, or run <code>python -m http.server</code> in this folder and visit <code>http://localhost:8000</code>.'
        : esc(err.message)) + '</p>';
  }

  function srcLinks(ids, sources) {
    if (!ids || !ids.length) return '';
    return '<span class="src">' + ids.map(function (id) {
      var s = sources[id];
      return '<a href="#src-' + esc(id) + '" title="' + esc(s ? s.title : id) + '">[' + esc(id) + ']</a>';
    }).join(' ') + '</span>';
  }

  function fmtDate(iso) {
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  var TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  var TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  // Extent of East Are'are, West Are'are and Small Malaita (south-west, north-east corners).
  var STUDY_BOUNDS = [[-9.74, 160.94], [-8.98, 161.59]];

  // opts.center + opts.zoom: start there; otherwise frame the study area.
  // opts.limit: keep people near the study area (minimum zoom, and soft pan limits).
  function baseMap(id, opts) {
    opts = opts || {};
    var study = L.latLngBounds(STUDY_BOUNDS);
    var map = L.map(id, { scrollWheelZoom: false, zoomSnap: 0.25, maxBoundsViscosity: 0.8 });
    if (opts.center) map.setView(opts.center, opts.zoom);
    else map.fitBounds(study, { padding: [8, 8] });
    if (opts.limit) {
      map.setMinZoom(Math.floor(map.getBoundsZoom(study, false, L.point(16, 16))) - 1);
      map.setMaxBounds(study.pad(0.5));
    }
    L.tileLayer(TILE_URL, { maxZoom: 17, attribution: TILE_ATTR }).addTo(map);
    // Enable wheel zoom only after the user clicks the map, so the page can still scroll.
    map.on('focus click', function () { map.scrollWheelZoom.enable(); });
    map.on('blur mouseout', function () { map.scrollWheelZoom.disable(); });
    return map;
  }

  // Fade everything outside the three constituencies and outline each one.
  // The fade sits in its own pane below site circles and pins, and nothing in it is interactive.
  // If the boundary file fails to load, the map simply stays unfaded.
  var BOUNDARY_ATTR = 'Constituencies: SINSO 2009 census via <a href="https://data.humdata.org/dataset/cod-ab-slb">OCHA HDX</a> (CC BY-IGO)';
  function addStudyArea(map) {
    return loadJSON('data/constituencies.geojson').then(function (g) {
      map.createPane('fade').style.zIndex = 350;
      var world = [[-40, 130], [-40, 190], [20, 190], [20, 130]];
      var holes = [];
      g.features.forEach(function (f) {
        f.geometry.coordinates.forEach(function (poly) {
          poly.forEach(function (ring) { holes.push(ring.map(function (p) { return [p[1], p[0]]; })); });
        });
      });
      L.polygon([world].concat(holes), {
        pane: 'fade', stroke: false, fillColor: '#fff', fillOpacity: 0.55, interactive: false
      }).addTo(map);
      L.geoJSON(g, {
        pane: 'fade', interactive: false, attribution: BOUNDARY_ATTR,
        style: { color: ACCENT, weight: 1.25, opacity: 0.9, fill: false }
      }).addTo(map);
    }).catch(function () {});
  }

  // Every site uses the same green circle. Kind of site is told in text, not by pin colour.
  function pinIcon() {
    return L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -8] });
  }

  // Dashed circle for a location known only roughly (bay, village or generalised area).
  function zoneCircle(latlng, radius) {
    return L.circle(latlng, { radius: radius, color: ACCENT, weight: 2, dashArray: '6 6', fillColor: ACCENT, fillOpacity: 0.06, interactive: false });
  }

  window.Atlas = {
    LABELS: LABELS, CONSTITUENCIES: CONSTITUENCIES, esc: esc, loadAll: loadAll, loadJSON: loadJSON,
    showLoadError: showLoadError, srcLinks: srcLinks, statusWord: statusWord, statusText: statusText, fmtDate: fmtDate,
    baseMap: baseMap, addStudyArea: addStudyArea, pinIcon: pinIcon, zoneCircle: zoneCircle
  };
})();
