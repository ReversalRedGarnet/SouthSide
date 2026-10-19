/* Field Kit: draft a profile in the browser. Nothing is sent anywhere. */
(function () {
  var A = window.Atlas;
  var form = document.getElementById('builder');
  var out = document.getElementById('out');
  var warnings = document.getElementById('warnings');
  var note = document.getElementById('kitmap-note');
  var map = A.baseMap('kitmap', [-9.55, 161.3], 8);
  var pin = null, lastRecord = null;

  function val(n) { return form.elements[n].value.trim(); }
  function num(s) { var n = parseFloat(String(s).replace(',', '.')); return isNaN(n) ? null : n; }
  function round2(n) { return Math.round(n * 100) / 100; }
  function lines(s) { return s.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean); }

  function build() {
    var w = [];
    var lat = num(val('lat')), lng = num(val('lng'));
    var vis = val('visibility');
    var haveCoords = lat != null && lng != null;

    if (haveCoords) {
      if (lat > 0) w.push('Latitude is positive. Malaita is south of the equator, so latitude should be negative (about -8 to -10).');
      if (Math.abs(lat) < 7.5 || Math.abs(lat) > 11 || lng < 159.5 || lng > 163) w.push('These coordinates look outside the Malaita area. Check for a swapped latitude and longitude or a missing minus sign.');
    }
    if (vis === 'public') w.push('Exact point selected. Only publish this if the custodians clearly agreed in writing, and never for sacred, taboo or threatened-species sites.');
    if (vis !== 'withheld' && !haveCoords) w.push('No coordinates entered, so there will be no map point.');
    if (!val('name')) w.push('Add a site name.');
    if (!val('sources')) w.push('No sources listed. Every claim needs a source ID from your register, or be marked unknown.');
    if (val('consent') === 'not_yet_sought') w.push('Consent not yet sought. Keep this as a private draft; do not publish.');
    if (val('consent') === 'given_scoped' && !val('consent_note')) w.push('Consent is marked as given. Describe its scope and who gave it.');

    var location = { lat: null, lng: null, precision: 'unlocated', note: 'Location not shared.', source_ids: [] };
    var publicPoint = null;
    if (haveCoords && vis === 'generalised') {
      publicPoint = [round2(lat), round2(lng)];
      location = { lat: publicPoint[0], lng: publicPoint[1], precision: 'area', radius_m: 1500, note: 'Generalised to about 1 km. True coordinates are held privately.', source_ids: [] };
    } else if (haveCoords && vis === 'public') {
      publicPoint = [lat, lng];
      location = { lat: lat, lng: lng, precision: 'point', note: 'Exact point shared with custodians\' agreement.', source_ids: [] };
    }

    var ids = val('sources').split(/[\s,;]+/).filter(Boolean);
    var facts = [];
    var areaVal = num(val('area_value'));
    facts.push({
      key: 'area', label: 'Area',
      value: areaVal != null && val('area_unit') !== 'unknown' ? areaVal + (val('area_unit') === 'ha' ? ' hectares' : ' square km') : 'Not known.',
      confidence: areaVal != null ? 'reported' : 'unknown', source_ids: ids,
      note: val('area_method') || 'Measurement method not recorded.'
    });
    if (val('management')) facts.push({ key: 'management', label: 'Management', value: val('management'), confidence: 'reported', source_ids: ids });

    var rec = {
      id: 'NEW-001',
      name: val('name'),
      alt_names: [],
      constituency: val('constituency'),
      place_text: val('place_text'),
      tier: val('tier'),
      realm: 'land',
      location: location,
      summary_en: val('summary'),
      summary_pijin: null,
      facts: facts,
      visitor: { access: val('visitor'), note: val('visitor_note') || 'Not recorded.' },
      contact: { public: null, note: 'Add only with the person\'s agreement.' },
      consent: { status: val('consent'), note: val('consent_note') },
      open_questions: lines(val('questions')),
      verification_status: 'draft',
      last_reviewed: new Date().toISOString().slice(0, 10),
      public_visibility: vis === 'public' ? 'public' : vis
    };
    return { rec: rec, warnings: w, point: publicPoint, tier: rec.tier, radius: location.radius_m || 0 };
  }

  function update() {
    var r = build();
    lastRecord = r.rec;
    out.textContent = JSON.stringify(r.rec, null, 2);
    warnings.innerHTML = r.warnings.length
      ? r.warnings.map(function (x) { return '<li>' + A.esc(x) + '</li>'; }).join('')
      : '<li>No problems found. Remember: consent comes first.</li>';
    if (pin) { map.removeLayer(pin); pin = null; }
    if (r.point) {
      pin = L.layerGroup([
        L.marker(r.point, { icon: A.pinIcon(), alt: 'Draft public point' }),
        r.radius ? A.zoneCircle(r.point, r.radius) : null
      ].filter(Boolean)).addTo(map);
      map.setView(r.point, 11);
      note.textContent = 'The pin shows the point the public would see (' + r.point.join(', ') + ').' + (r.radius ? ' The dashed circle shows it is generalised.' : '');
    } else {
      note.textContent = 'No public point. That is the right choice for sensitive places.';
    }
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);

  document.getElementById('copy').addEventListener('click', function (e) {
    var btn = e.currentTarget;
    function done() { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1500); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(out.textContent).then(done, function () { selectOut(); });
    } else { selectOut(); }
  });
  function selectOut() {
    var r = document.createRange(); r.selectNodeContents(out);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  document.getElementById('dl').addEventListener('click', function () {
    var blob = new Blob([out.textContent], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (lastRecord && lastRecord.name ? lastRecord.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'draft-site') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);
  });

  update();
})();
