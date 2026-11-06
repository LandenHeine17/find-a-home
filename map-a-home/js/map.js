/* Map tab: every home as a pin colored by match %, a pop-up card, full info, and tour booking. */
const MapTab = {
  map: null, layer: null, homeLayer: null, openId: null,
  FILTERS: [
    ['all', 'All'], ['nursing', 'Nursing'], ['memory', 'Memory care'],
    ['assisted_memory', 'Assisted + memory'], ['hearts', '❤️ Saved'], ['top', '⭐ 70%+']
  ],

  init() {
    if (this.map || !window.L) return;
    this.map = L.map('map', { zoomControl: false, attributionControl: true }).setView(home(), 11);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    // Esri street tiles: free, no API key, and they load even when the page is opened as a file
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors'
    }).addTo(this.map);
    this.layer = L.layerGroup().addTo(this.map);
    this.homeLayer = L.layerGroup().addTo(this.map);
    this.map.on('click', () => this.close());
    this.renderLegend();
    this.render();
    this.fit();
  },

  /* Show the family's ZIP and nearby homes */
  fit() {
    if (!this.map) return;
    const near = DATA.facilities.filter(p => dist(p) <= (S.care.maxMiles || 20));
    const pts = (near.length ? near : DATA.facilities).map(p => [p.lat, p.lon]);
    pts.push(home());
    this.map.fitBounds(pts, { padding: [40, 40], maxZoom: 13 });
  },

  visible() {
    const f = S.mapFilter;
    return ranked().filter(({ p, m }) =>
      f === 'all' ? true : f === 'hearts' ? S.hearts.includes(p.id) : f === 'top' ? m.score >= 70 : p.type === f);
  },

  render() {
    $('#map-filters').innerHTML = this.FILTERS.map(([k, t]) =>
      `<button class="chip ${S.mapFilter === k ? 'on' : ''}" data-action="map-filter" data-f="${k}">${t}</button>`).join('');
    if (!this.map) return;
    this.layer.clearLayers();
    this.homeLayer.clearLayers();
    // Family's home + drive radius
    L.circle(home(), { radius: (S.care.maxMiles || 20) * 1609, color: '#1d4ed8', weight: 2, dashArray: '6 6', fillOpacity: 0.04 }).addTo(this.homeLayer);
    L.marker(home(), { icon: L.divIcon({ className: '', html: '<div class="pin-home">🏠</div>', iconSize: [40, 40], iconAnchor: [20, 20] }), zIndexOffset: -100 })
      .bindTooltip(S.care.zip ? `Your ZIP: ${S.care.zip}` : 'Lincoln (add your ZIP in the profile)').addTo(this.homeLayer);
    // Lowest scores first so the best ones draw on top
    this.visible().slice().reverse().forEach(({ p, m }) => {
      const heart = S.hearts.includes(p.id);
      const icon = L.divIcon({
        className: '',
        html: `<div class="pin ${this.openId === p.id ? 'sel' : ''}" style="--c:${scoreColor(m.score)}">${m.score}${heart ? '<i>❤</i>' : ''}</div>`,
        iconSize: [38, 38], iconAnchor: [19, 19]
      });
      L.marker([p.lat, p.lon], { icon, zIndexOffset: m.score * 10 })
        .on('click', e => { L.DomEvent.stopPropagation(e); this.open(p.id); })
        .bindTooltip(`${p.name} · ${m.score}%`, { direction: 'top', offset: [0, -16] })
        .addTo(this.layer);
    });
  },

  renderLegend() {
    $('#legend').innerHTML = `
      <b>Match</b>
      <div class="legend-bar" style="background:linear-gradient(90deg, ${SCALE.map(s => s[1]).join(',')})"></div>
      <div class="legend-ends"><span>Poor</span><span>Great</span></div>`;
  },

  /* ---------- pop-up card ---------- */
  open(id, { fly = true } = {}) {
    const p = byId(id); if (!p) return;
    this.openId = id;
    const m = match(p);
    const heart = S.hearts.includes(id);
    const sheet = $('#sheet');
    sheet.hidden = false;
    sheet.innerHTML = `
      <div class="sheet-card" style="--c:${scoreColor(m.score)}">
        <button class="sheet-x" data-action="close-sheet" aria-label="Close">✖</button>
        <div class="sheet-head">
          <div class="score-badge"><b>${m.score}%</b><small>${scoreWord(m.score)}</small></div>
          <div class="sheet-title">
            <h3>${esc(p.name)}</h3>
            <div class="sub">${LBL.type[p.type]} · ${esc(p.city)} · ${m.d.toFixed(1)} mi</div>
            <div class="stars">${this.stars(p)}</div>
          </div>
        </div>
        <div class="why">
          ${m.good.slice(0, 4).map(g => `<span class="tag tg">✔ ${esc(g)}</span>`).join('')}
          ${m.warn.slice(0, 3).map(w => `<span class="tag tw">⚠ ${esc(w)}</span>`).join('')}
        </div>
        <div class="facts">
          <div><small>Cost</small><b>$${fmt(p.priceLow)}${p.priceHigh ? `–${fmt(p.priceHigh)}` : '+'}</b><small>/mo${p.priceEstimated ? ' est.' : ''}</small></div>
          <div><small>Medicaid</small><b>${LBL.pay[p.payment.medicaid]}</b></div>
          <div><small>Memory unit</small><b>${p.memoryCare === 'dedicated' ? 'Whole building' : p.memoryCare === 'unit' ? 'Yes' : 'Ask'}</b></div>
          <div><small>Openings</small><b>${p.openings.est != null ? '~' + p.openings.est : 'Ask'}</b></div>
        </div>
        <div class="actions">
          <button class="btn ${heart ? 'btn-pink' : 'btn-white'}" data-action="heart" data-id="${id}">${heart ? '❤️ Saved' : '🤍 Heart'}</button>
          <button class="btn btn-blue" data-action="info" data-id="${id}">ℹ️ Info</button>
          <a class="btn btn-green" href="${telUrl(p)}">📞 Call</a>
          <button class="btn btn-gold" data-action="tour" data-id="${id}">📅 Tour</button>
        </div>
        <button class="linkish" data-action="ask-about" data-id="${id}">🤖 Ask the Care Guide about this home</button>
      </div>`;
    if (fly && this.map) {
      const z = Math.max(this.map.getZoom(), 13);
      // offset so the pin sits above the card
      const pt = this.map.project([p.lat, p.lon], z).add([0, sheet.offsetHeight / 2.5]);
      this.map.flyTo(this.map.unproject(pt, z), z, { duration: 0.6 });
    }
    this.render();
  },

  close() {
    if (!this.openId) return;
    this.openId = null;
    $('#sheet').hidden = true;
    this.render();
  },

  stars(p) {
    const v = p.rating && p.rating.value;
    if (!v) return '<span class="muted">No rating yet</span>';
    const full = Math.round(v);
    return `<span class="st">${'★'.repeat(full)}<span class="off">${'★'.repeat(5 - full)}</span></span> <small>${esc(p.rating.source)}${p.rating.count ? ` (${p.rating.count})` : ''}</small>`;
  },

  /* ---------- full info ---------- */
  info(id) {
    const p = byId(id), m = match(p), c = p.cms;
    const bar = (label, v) => v ? `<div class="kv"><span>${label}</span><b class="st">${'★'.repeat(v)}<span class="off">${'★'.repeat(5 - v)}</span></b></div>` : '';
    App.modal(`
      <div class="info-top" style="--c:${scoreColor(m.score)}">
        <div class="score-badge"><b>${m.score}%</b><small>${scoreWord(m.score)}</small></div>
        <div><h2>${esc(p.name)}</h2><div class="sub">${esc(p.address)}</div></div>
      </div>
      <p>${esc(p.bio)}</p>

      <h3>Why this score for ${esc(lovedName())}</h3>
      <div class="why">
        ${m.good.map(g => `<span class="tag tg">✔ ${esc(g)}</span>`).join('')}
        ${m.warn.map(w => `<span class="tag tw">⚠ ${esc(w)}</span>`).join('')}
      </div>

      <h3>Cost & payment</h3>
      <div class="kv"><span>Monthly cost</span><b>$${fmt(p.priceLow)}${p.priceHigh ? `–$${fmt(p.priceHigh)}` : '+'}</b></div>
      <p class="muted small">${esc(p.priceNote)}</p>
      ${Object.entries(p.payment).map(([k, v]) => `<div class="kv"><span>${LBL.payment[k]}</span><b class="pay-${v}">${LBL.pay[v]}</b></div>`).join('')}

      <h3>Dementia care</h3>
      <div class="kv"><span>Memory care</span><b>${p.memoryCare === 'dedicated' ? 'Dementia care is all they do' : p.memoryCare === 'unit' ? 'Has a secured unit' : 'Not listed: ask on tour'}</b></div>
      ${p.memoryUnits ? `<div class="kv"><span>Memory care rooms</span><b>${p.memoryUnits}</b></div>` : ''}
      ${p.beds ? `<div class="kv"><span>Beds</span><b>${p.beds}</b></div>` : ''}
      <div class="kv"><span>Openings</span><b>${p.openings.est != null ? `About ${p.openings.est}` : 'Ask'}</b></div>
      <p class="muted small">${esc(p.openings.note || '')}</p>

      ${c ? `
      <h3>Safety (Medicare)</h3>
      ${bar('Overall', c.overall)}${bar('Health inspections', c.inspection)}${bar('Staffing', c.staffing)}${bar('Quality of care', c.quality)}
      <div class="kv"><span>Problems found at last inspection</span><b>${c.deficiencies}</b></div>
      <div class="kv"><span>Staff turnover</span><b>${c.turnover != null ? c.turnover + '%' : '—'}</b></div>
      <div class="kv"><span>Ownership</span><b>${esc(c.ownership || '—')}</b></div>
      ${p.quality.map(q => `<div class="kv"><span>${esc(q.label)}</span><b class="${q.value > q.ne ? 'bad' : 'ok'}">${q.value ?? '—'}% <small>(NE avg ${q.ne}%)</small></b></div>`).join('')}
      ${p.citations.length ? `<h4>Latest inspection (${esc(c.inspectionDate)})</h4><ul class="cites">${p.citations.map(x => `<li class="lv${x.sev}">${esc(x.title)}</li>`).join('')}</ul>` : ''}
      ` : ''}

      <div class="actions sticky">
        <button class="btn ${S.hearts.includes(id) ? 'btn-pink' : 'btn-white'}" data-action="heart" data-id="${id}">${S.hearts.includes(id) ? '❤️' : '🤍'}</button>
        <a class="btn btn-green" href="${telUrl(p)}" title="${esc(p.phone)}">📞 Call</a>
        <a class="btn btn-blue" href="${mapsUrl(p)}" target="_blank" rel="noopener">🧭 Directions</a>
        ${p.website ? `<a class="btn btn-gray" href="${esc(p.website)}" target="_blank" rel="noopener">🌐 Website</a>` : ''}
        ${p.careCompare ? `<a class="btn btn-gray" href="${esc(p.careCompare)}" target="_blank" rel="noopener">🏛️ Medicare page</a>` : ''}
        <button class="btn btn-gold" data-action="tour" data-id="${id}">📅 Schedule tour</button>
      </div>
      <p class="fine">Sources: ${p.sources.map(esc).join('; ')}</p>`, 'wide');
  },

  /* ---------- tour booking ---------- */
  tour(id) {
    const p = byId(id);
    const days = [];
    const d = new Date();
    while (days.length < 8) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0) days.push(new Date(d));
    }
    const iso = x => x.toISOString().slice(0, 10);
    App.modal(`
      <h2>📅 Tour ${esc(p.name)}</h2>
      <form id="tour-form" class="form">
        <fieldset><legend>Pick a day</legend>
          <div class="days">${days.map((x, i) => `
            <label class="day"><input type="radio" name="date" value="${iso(x)}" ${i === 0 ? 'checked' : ''}>
              <span><small>${x.toLocaleDateString('en-US', { weekday: 'short' })}</small><b>${x.getDate()}</b><small>${x.toLocaleDateString('en-US', { month: 'short' })}</small></span></label>`).join('')}
          </div>
        </fieldset>
        <fieldset><legend>Time</legend>
          <div class="checks">${['10:00 AM', '11:30 AM', '1:00 PM', '2:30 PM', '4:00 PM'].map((t, i) =>
            `<label class="check"><input type="radio" name="time" value="${t}" ${i === 2 ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
        </fieldset>
        <fieldset><legend>How</legend>
          <div class="checks">
            <label class="check"><input type="radio" name="mode" value="person" checked><span>🚶 In person</span></label>
            <label class="check"><input type="radio" name="mode" value="video"><span>📹 Video call</span></label>
          </div>
        </fieldset>
        <label>Who's coming?<input name="who" value="${esc(S.caregiver.name || '')}" placeholder="Your name, family members"></label>
        <label>Anything they should know?<textarea name="notes" rows="2" placeholder="e.g. Grandma wanders at night; we want to see the secured unit"></textarea></label>
        <details class="tip"><summary>💡 Questions to ask on the tour</summary>
          <ul>
            <li>How many staff per resident on the memory unit, day and night?</li>
            <li>Is the unit locked/secured? What happens if someone tries to leave?</li>
            <li>Do you accept Medicaid now, or after private pay runs out?</li>
            <li>What dementia training do aides get?</li>
            <li>What would make you ask a resident to move out?</li>
            <li>Can we visit any time? Can we eat a meal here?</li>
          </ul>
        </details>
        <div class="cta-row">
          <button type="button" class="btn btn-gray" data-action="close">Cancel</button>
          <button type="submit" class="btn btn-green grow">Request tour</button>
        </div>
        <p class="fine">Prototype: no request is actually sent. In the real app the home would confirm by phone or email.</p>
      </form>`);
    $('#tour-form').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      S.tours.push({ tid: Date.now().toString(36), id, date: f.get('date'), time: f.get('time'), mode: f.get('mode'), who: f.get('who'), notes: f.get('notes') });
      if (!S.hearts.includes(id)) S.hearts.push(id);
      save(); App.closeModal(); App.refresh();
      App.celebrate('Tour requested!', `${p.name}<br>${new Date(f.get('date') + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${f.get('time')}`);
    });
  }
};
