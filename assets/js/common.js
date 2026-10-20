/* Shared helpers: data loading, labels, small HTML utilities. No frameworks. */
(function () {
  // Footer "prepared" date (YYYY-MM-DD). Edit it here only; it fills every [data-site-date].
  var SITE_PREPARED = '2026-10-21';

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
    // Short forms for the compact site table; the legend and profiles use the full names.
    tierShort: {
      legal_pa: 'Legal protected area',
      community_area: 'Community area',
      community_group: 'Community group'
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

  // Colours live in CSS tokens (assets/css/styles.css). Map layers that need a colour value read the token.
  function token(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  // Boundary file names (ADM2_NAME) -> display name, colour token and legend class.
  var CONSTITUENCY_STYLE = {
    'East AreAre': { name: "East Are'are", token: '--const-east', cls: 'const-east' },
    'West Areare': { name: "West Are'are", token: '--const-west', cls: 'const-west' },
    // Small Malaita's label sits just off its east coast, so it does not cover the base map's "Maramasike" name.
    'Small Malaita': { name: 'Small Malaita', token: '--const-small', cls: 'const-small', labelOffshore: 'east' }
  };
  var CHIP = {
    visitor: { unknown: 'neutral', ask_first: 'caution', guided: 'caution', open: 'info', closed_sensitive: 'danger' },
    consent: { not_yet_sought: 'neutral', in_progress: 'caution', given_scoped: 'info', declined: 'danger' }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Just the status word ("Desk-sourced", "Draft"), for compact lists that explain the words nearby.
  function statusWord(code) { return STATUS[code] ? STATUS[code][0] : code; }

  // Verification badge: the status word on the trust-ramp colour (icons for verified/disputed come from CSS).
  function badge(code) {
    return '<span class="badge badge-' + esc(code) + '">' + esc(statusWord(code)) + '</span>';
  }

  // Badge plus what it means, e.g. [Desk-sourced] not reviewed by custodians.
  // Empty state, shared by the profile's Updates, Research and Media sections: what is missing (plain text), then a
  // next step (HTML with links, built by the caller).
  function emptyState(what, next) {
    return '<div class="empty-state"><p class="empty-state-what">' + esc(what) + '</p>' +
      (next ? '<p class="empty-state-next">' + next + '</p>' : '') + '</div>';
  }

  function statusText(code) {
    var s = STATUS[code];
    return s ? badge(code) + ' ' + esc(s[1]) : esc(code);
  }

  // Kind of site: coloured shape plus its name (short form for the site table, with the full name as a tooltip).
  function tierTag(tier, short) {
    var full = LABELS.tier[tier] || tier;
    var text = short ? (LABELS.tierShort[tier] || full) : full;
    return '<span class="tier"' + (short ? ' title="' + esc(full) + '"' : '') + '><span class="mark shape-' + esc(tier) + '" aria-hidden="true"></span>' + esc(text) + '</span>';
  }

  // Visitor access or consent status as a chip; the chip text is the label.
  function chip(kind, code) {
    return '<span class="chip chip-' + (CHIP[kind][code] || 'neutral') + '">' + esc(LABELS[kind][code] || code) + '</span>';
  }

  // Fact confidence: a mark (different shape per level) and the word.
  function confMark(level) {
    return '<span class="conf conf-' + esc(level) + '"><span class="conf-mark" aria-hidden="true"></span>' + esc(LABELS.confidence[level] || level) + '.</span>';
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
    el.innerHTML = '<p class="callout callout-danger"><strong>The data could not be loaded.</strong> ' +
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

  // Leaflet 1.9 points cancelled and removed tiles at a data: image, which the page's Content-Security-Policy (img-src)
  // blocks. These two overrides keep Leaflet's own logic but remove the tile's src instead, so no data: image is used
  // and the policy stays strict. The vendored leaflet.js is left untouched.
  if (window.L && L.TileLayer && L.GridLayer) {
    L.TileLayer.prototype._removeTile = function (key) {
      var t = this._tiles[key];
      if (!t) return;
      t.el.removeAttribute('src');
      return L.GridLayer.prototype._removeTile.call(this, key);
    };
    L.TileLayer.prototype._abortLoading = function () {
      for (var key in this._tiles) {
        var t = this._tiles[key];
        if (t.coords.z === this._tileZoom) continue;
        var tile = t.el;
        tile.onload = L.Util.falseFn;
        tile.onerror = L.Util.falseFn;
        if (!tile.complete) {
          tile.removeAttribute('src');
          L.DomUtil.remove(tile);
          delete this._tiles[key];
          this.fire('tileabort', { tile: tile, coords: t.coords });
        }
      }
    };
  }

  // Extent of East Are'are, West Are'are and Small Malaita (south-west, north-east corners).
  var STUDY_BOUNDS = [[-9.74, 160.94], [-8.98, 161.59]];

  // True when the operating system asks for less motion. Checked per call, so a change applies to later moves.
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // Frame the study area. opts.clearControls: also keep the outlines clear of the attribution along the bottom edge
  // (two lines tall on phones), measured as it is now.
  function fitStudy(map, opts) {
    var pad = 8, bottom = pad;
    if (opts && opts.clearControls && map.attributionControl) bottom += map.attributionControl.getContainer().offsetHeight;
    map.fitBounds(L.latLngBounds(STUDY_BOUNDS), { paddingTopLeft: [pad, pad], paddingBottomRight: [pad, bottom], animate: false });
  }

  // Keep people near the study area: a minimum zoom one step below the one that frames it, and soft pan limits.
  // Depends on the map's size, so a map that changes size calls it again.
  function limitStudy(map) {
    var study = L.latLngBounds(STUDY_BOUNDS);
    map.setMinZoom(Math.floor(map.getBoundsZoom(study, false, L.point(16, 16))) - 1);
    map.setMaxBounds(study.pad(0.5));
  }

  // opts.center + opts.zoom: start there; otherwise frame the study area.
  // opts.limit: keep people near the study area (minimum zoom, and soft pan limits).
  function baseMap(id, opts) {
    opts = opts || {};
    var study = L.latLngBounds(STUDY_BOUNDS);
    // With reduced motion, zooms, fades and pans jump instead of animating (read once, when the map is made).
    var still = reducedMotion();
    var map = L.map(id, { scrollWheelZoom: false, zoomSnap: 0.25, maxBoundsViscosity: 0.8,
      zoomAnimation: !still, fadeAnimation: !still, markerZoomAnimation: !still, inertia: !still });
    if (still) {
      // Keyboard arrows and popups pan with panBy, which animates unless told not to.
      var panBy = map.panBy;
      map.panBy = function (offset, options) { return panBy.call(this, offset, L.extend({}, options, { animate: false })); };
    }
    // A hidden map (e.g. print styles) has no size, so fitting or limiting the view would give NaN zooms.
    var size = map.getSize(), visible = size.x > 0 && size.y > 0;
    if (opts.center) map.setView(opts.center, opts.zoom);
    else if (visible) fitStudy(map);
    else map.setView(study.getCenter(), 9);
    if (opts.limit && visible) limitStudy(map);
    L.tileLayer(TILE_URL, { maxZoom: 17, attribution: TILE_ATTR }).addTo(map);
    // Enable wheel zoom only after the user clicks the map, so the page can still scroll.
    map.on('focus click', function () { map.scrollWheelZoom.enable(); });
    map.on('blur mouseout', function () { map.scrollWheelZoom.disable(); });
    return map;
  }

  // A point well inside a ring ([lng, lat] pairs), for placing a label: on a coarse grid over the
  // ring's box, the inside point furthest from any edge. Good enough for three label positions.
  function labelPoint(ring) {
    var xs = ring.map(function (p) { return p[0]; }), ys = ring.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    function inside(x, y) {
      var c = false;
      for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var a = ring[i], b = ring[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
      }
      return c;
    }
    function edgeDist(x, y) {
      var best = Infinity;
      for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var a = ring[i], b = ring[j], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
        var t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
        var ex = x - a[0] - t * dx, ey = y - a[1] - t * dy;
        best = Math.min(best, ex * ex + ey * ey);
      }
      return best;
    }
    var best = null, bestD = -1, n = 24;
    for (var gx = 0; gx <= n; gx++) {
      for (var gy = 0; gy <= n; gy++) {
        var x = x0 + (x1 - x0) * gx / n, y = y0 + (y1 - y0) * gy / n;
        if (!inside(x, y)) continue;
        var d = edgeDist(x, y);
        if (d > bestD) { bestD = d; best = [y, x]; }
      }
    }
    return best;
  }

  // Fade everything outside the three constituencies, then outline, tint and label each one.
  // The fade, outlines and labels sit in panes below site circles and pins, and none is interactive.
  // If the boundary file fails to load, the map simply stays unfaded.
  var BOUNDARY_ATTR = 'Constituencies: SINSO 2009 census via <a href="https://data.humdata.org/dataset/cod-ab-slb">OCHA HDX</a> (CC BY-IGO)';
  function addStudyArea(map) {
    return loadJSON('data/constituencies.geojson').then(function (g) {
      map.createPane('fade').style.zIndex = 350;
      map.createPane('constLabels').style.zIndex = 360;
      var world = [[-40, 130], [-40, 190], [20, 190], [20, 130]];
      var holes = [];
      g.features.forEach(function (f) {
        f.geometry.coordinates.forEach(function (poly) {
          poly.forEach(function (ring) { holes.push(ring.map(function (p) { return [p[1], p[0]]; })); });
        });
      });
      L.polygon([world].concat(holes), {
        pane: 'fade', stroke: false, fillColor: token('--map-fade'), fillOpacity: 0.55, interactive: false
      }).addTo(map);
      L.geoJSON(g, {
        pane: 'fade', interactive: false, attribution: BOUNDARY_ATTR,
        style: function (f) {
          var c = token((CONSTITUENCY_STYLE[f.properties.ADM2_NAME] || {}).token || '--neutral-border');
          return { color: c, weight: 1.75, opacity: 1, fillColor: c, fillOpacity: 0.12 };
        }
      }).addTo(map);
      // Name each constituency on the map, so the outline colours are never the only clue.
      var replace = [];
      g.features.forEach(function (f) {
        var st = CONSTITUENCY_STYLE[f.properties.ADM2_NAME];
        if (!st) return;
        var biggest = f.geometry.coordinates.reduce(function (a, b) { return b[0].length > a[0].length ? b : a; });
        var at = labelPoint(biggest[0]);
        if (!at) return;
        var opts = { permanent: true, direction: 'center', className: 'const-label ' + st.cls, pane: 'constLabels' };
        var label = function (o, ll) { return L.tooltip(o).setLatLng(ll).setContent(esc(st.name)).addTo(map); };
        if (st.labelOffshore === 'east') {
          // Anchor on the easternmost coast point near the label's latitude and draw the label to its right.
          var band = biggest[0].filter(function (p) { return Math.abs(p[1] - at[0]) < 0.03; });
          var edge = band.reduce(function (a, p) { return p[0] > a[0] ? p : a; }, [at[1], at[0]]);
          var tip = null;
          var place = function () {
            if (tip) map.removeLayer(tip);
            tip = label(L.extend({}, opts, { direction: 'right', offset: [6, 0] }), [edge[1], edge[0]]);
            // On a narrow map there may be no room offshore: then sit on the island, just below the base map's name.
            var box = map.getContainer().getBoundingClientRect(), el = tip.getElement();
            if (el && el.getBoundingClientRect().right > box.right - 4) {
              map.removeLayer(tip);
              tip = label(L.extend({}, opts, { offset: [0, 20] }), at);
            }
          };
          place();
          replace.push(place);
          return;
        }
        label(opts, at);
      });
      // Resolves with a function that makes the offshore-or-on-island choice again, for a map that changed size.
      return function () { replace.forEach(function (f) { f(); }); };
    }).catch(function () {});
  }

  // Map marker for a site: a circle in the kind colour, solid, ring or ring with a centre dot.
  // The tappable box is 28px (--pin-hit in styles.css); the 20px marker is drawn in its centre.
  var PIN_HIT = 28;
  function pinIcon(tier) {
    return L.divIcon({ className: 'pin-hit', html: '<div class="pin shape-' + esc(tier) + '"></div>', iconSize: [PIN_HIT, PIN_HIT], iconAnchor: [PIN_HIT / 2, PIN_HIT / 2], popupAnchor: [0, -PIN_HIT / 2] });
  }

  // Short accessible name for a marker: the site name and its kind in words.
  function pinLabel(name, tier) { return name + ' (' + (LABELS.tier[tier] || tier) + ')'; }

  // Dashed circle for a location known only roughly (bay, village or generalised area). Always neutral grey, so dashed
  // means "approximate" and colour means "kind of site". Callers may still pass the kind; it is not used.
  function zoneCircle(latlng, radius) {
    var c = token('--neutral-ink');
    return L.circle(latlng, { radius: radius, color: c, weight: 2, dashArray: '6 6', fillColor: c, fillOpacity: 0.05, interactive: false });
  }

  window.Atlas = {
    LABELS: LABELS, CONSTITUENCIES: CONSTITUENCIES, esc: esc, loadAll: loadAll, loadJSON: loadJSON,
    showLoadError: showLoadError, srcLinks: srcLinks, statusWord: statusWord, statusText: statusText, fmtDate: fmtDate,
    badge: badge, emptyState: emptyState, tierTag: tierTag, chip: chip, confMark: confMark, token: token,
    baseMap: baseMap, fitStudy: fitStudy, limitStudy: limitStudy, reducedMotion: reducedMotion, addStudyArea: addStudyArea, pinIcon: pinIcon, pinLabel: pinLabel, zoneCircle: zoneCircle
  };

  // Forms on this site never submit (they filter or build entries in the page). This replaces inline onsubmit handlers,
  // which the Content-Security-Policy blocks.
  document.querySelectorAll('form[data-no-submit]').forEach(function (f) {
    f.addEventListener('submit', function (e) { e.preventDefault(); });
  });

  document.querySelectorAll('[data-site-date]').forEach(function (el) { el.textContent = ' · prepared ' + fmtDate(SITE_PREPARED); });
})();
