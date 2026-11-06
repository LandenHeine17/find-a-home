/* Home tab: the loved one's profile, quests, top matches, saved homes and tours. */
const AVATARS = ['👵', '👴', '👵🏻', '👴🏻', '👵🏽', '👴🏽', '👵🏿', '👴🏿', '🧓', '🧓🏽'];

const Home = {
  render() {
    const P = S.person, C = S.care;
    const pct = completeness();
    const top = ranked().slice(0, 3);
    const hearts = S.hearts.map(byId).filter(Boolean);
    const tours = [...S.tours].sort((a, b) => a.date.localeCompare(b.date));
    const quests = [
      ['Fill out the profile', pct >= 75, `${pct}%`],
      ['Chat with the Care Guide', S.chat.some(m => m.from === 'me'), ''],
      ['Heart 3 homes', hearts.length >= 3, `${Math.min(hearts.length, 3)}/3`],
      ['Schedule a tour', tours.length > 0, ''],
      ['Tour 2 homes to compare', tours.length >= 2, `${Math.min(tours.length, 2)}/2`]
    ];
    const done = quests.filter(q => q[1]).length;

    $('#panel-home').innerHTML = `
    <div class="panel-inner">
      <div class="card hero">
        <button class="hero-avatar" data-action="pick-avatar" title="Change picture">${P.avatar}</button>
        <div class="hero-main">
          <div class="hero-name">${esc(P.name || 'Your loved one')}</div>
          <div class="hero-sub">${[P.relation, P.age ? `${P.age} years old` : '', C.zip ? `near ${C.zip}` : ''].filter(Boolean).map(esc).join(' · ') || 'Tell us who you are caring for'}</div>
          <div class="badges">
            ${P.stage ? `<span class="badge b-purple">${LBL.stage[P.stage]}</span>` : ''}
            ${P.behaviors.includes('wander') ? '<span class="badge b-orange">Wanders</span>' : ''}
            ${C.timeline ? `<span class="badge b-blue">${LBL.timeline[C.timeline]}</span>` : ''}
          </div>
        </div>
        <div class="hero-xp">
          <div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
          <small>Profile</small>
        </div>
      </div>
      ${pct < 100 ? `
      <div class="cta-row">
        <button class="btn btn-blue grow" data-action="go" data-tab="ai">🤖 Finish profile with the Care Guide</button>
        <button class="btn btn-gray" data-action="edit">✏️ Edit</button>
      </div>` : `<div class="cta-row"><button class="btn btn-gray grow" data-action="edit">✏️ Edit profile</button></div>`}

      <h2 class="section-title">🏆 Quests <span class="pill">${done}/${quests.length}</span></h2>
      <div class="card quests">
        ${quests.map(([t, ok, prog]) => `
          <div class="quest ${ok ? 'done' : ''}">
            <span class="q-check">${ok ? '✔' : ''}</span>
            <span class="q-title">${t}</span>
            ${prog ? `<span class="q-prog">${prog}</span>` : ''}
          </div>`).join('')}
      </div>

      <h2 class="section-title">⭐ Top matches for ${esc(lovedName())}</h2>
      <div class="match-row">
        ${top.map(({ p, m }) => this.matchCard(p, m)).join('')}
      </div>
      <button class="btn btn-green full" data-action="go" data-tab="map">🗺️ See all ${DATA.facilities.length} homes on the map</button>

      <h2 class="section-title">❤️ Saved homes <span class="pill">${hearts.length}</span></h2>
      ${hearts.length ? `<div class="list">${hearts.map(p => this.row(p)).join('')}</div>`
        : `<div class="card empty">Tap a home on the map and press ❤️ to save it here.</div>`}

      <h2 class="section-title">📅 Tours <span class="pill">${tours.length}</span></h2>
      ${tours.length ? `<div class="list">${tours.map(t => this.tourRow(t)).join('')}</div>`
        : `<div class="card empty">No tours yet. Open a home on the map and press <b>Schedule tour</b>.</div>`}

      <h2 class="section-title">📋 About ${esc(lovedName())}</h2>
      <div class="grid2">
        ${this.infoCard('🧠', 'Care needs', [
          ['Stage', LBL.stage[P.stage]],
          ['Behaviors', P.behaviors.map(b => LBL.behaviors[b]).join(', ') || (P._noBehaviors ? 'None' : '')],
          ['Mobility', LBL.mobility[P.mobility]],
          ['Medical', P.medical.map(b => LBL.medical[b]).join(', ') || (P._noMedical ? 'None' : '')]
        ])}
        ${this.infoCard('💵', 'Money & location', [
          ['Paying with', C.payment.map(x => LBL.payment[x]).join(', ')],
          ['Budget', C.budget ? `$${fmt(C.budget)}/month` : ''],
          ['ZIP code', C.zip],
          ['Max drive', C.maxMiles ? `${C.maxMiles} miles` : ''],
          ['Timeline', LBL.timeline[C.timeline]]
        ])}
        ${this.infoCard('🎨', 'What they love', [
          ['Likes', P.likes.join(', ')],
          ['Faith', P.faith],
          ['Personality', P.personality]
        ])}
        ${this.infoCard('📝', 'Notes', [['', P.notes || '']])}
      </div>

      <div class="card you">
        <div><b>You:</b> ${esc(S.caregiver.name || 'Caregiver')}${S.caregiver.relation ? ` (${esc(S.caregiver.relation)})` : ''}</div>
        <button class="btn btn-red small" data-action="reset">Start over</button>
      </div>
      <p class="fine">Prototype by IP Group 14. Nursing home data from Medicare Care Compare; memory care from Nebraska licensure lists and Caring.com. Prices marked "est." are area averages.</p>
    </div>`;
  },

  matchCard(p, m) {
    return `
    <button class="mcard" data-action="open-home" data-id="${p.id}" style="--c:${scoreColor(m.score)}">
      <div class="mcard-score">${m.score}<small>%</small></div>
      <div class="mcard-name">${esc(p.name)}</div>
      <div class="mcard-sub">${LBL.typeShort[p.type]} · ${m.d.toFixed(1)} mi</div>
      <div class="mcard-why">${esc(m.good[0] || scoreWord(m.score))}</div>
    </button>`;
  },

  row(p) {
    const m = match(p);
    return `
    <div class="row card">
      <span class="dot" style="background:${scoreColor(m.score)}">${m.score}</span>
      <button class="row-main" data-action="open-home" data-id="${p.id}">
        <b>${esc(p.name)}</b><small>${LBL.typeShort[p.type]} · ${esc(p.city)} · ${m.d.toFixed(1)} mi</small>
      </button>
      <a class="btn btn-green icon" href="${telUrl(p)}" title="Call">📞</a>
      <button class="btn btn-gray icon" data-action="heart" data-id="${p.id}" title="Remove">✖</button>
    </div>`;
  },

  tourRow(t) {
    const p = byId(t.id);
    const d = new Date(t.date + 'T12:00');
    return `
    <div class="row card">
      <span class="cal"><small>${d.toLocaleDateString('en-US', { month: 'short' })}</small><b>${d.getDate()}</b></span>
      <button class="row-main" data-action="open-home" data-id="${p.id}">
        <b>${esc(p.name)}</b><small>${d.toLocaleDateString('en-US', { weekday: 'long' })} at ${esc(t.time)} · ${t.mode === 'video' ? 'Video tour' : 'In person'} · <span class="status">Requested</span></small>
      </button>
      <button class="btn btn-gray icon" data-action="cancel-tour" data-tid="${t.tid}" title="Cancel">✖</button>
    </div>`;
  },

  infoCard(icon, title, rows) {
    const filled = rows.filter(r => r[1]);
    return `
    <div class="card info">
      <div class="info-head"><span>${icon} ${title}</span><button class="mini" data-action="edit">✏️</button></div>
      ${filled.length ? filled.map(([k, v]) => `<div class="kv">${k ? `<span>${k}</span>` : ''}<b>${esc(v)}</b></div>`).join('')
        : `<div class="muted">Not filled in yet. Ask the Care Guide or tap ✏️.</div>`}
    </div>`;
  },

  pickAvatar() {
    App.modal(`
      <h2>Pick a picture</h2>
      <div class="avatar-grid">${AVATARS.map(a => `<button data-action="set-avatar" data-a="${a}" class="${a === S.person.avatar ? 'on' : ''}">${a}</button>`).join('')}</div>
      <button class="btn btn-gray full" data-action="close">Close</button>`);
  },

  edit() {
    const P = S.person, C = S.care;
    const checks = (name, map, sel) => Object.entries(map).map(([k, v]) =>
      `<label class="check"><input type="checkbox" name="${name}" value="${k}" ${sel.includes(k) ? 'checked' : ''}><span>${v}</span></label>`).join('');
    const radios = (name, map, sel) => Object.entries(map).map(([k, v]) =>
      `<label class="check"><input type="radio" name="${name}" value="${k}" ${sel === k ? 'checked' : ''}><span>${v}</span></label>`).join('');
    App.modal(`
      <h2>Edit profile</h2>
      <form id="edit-form" class="form">
        <fieldset><legend>About them</legend>
          <div class="f2">
            <label>Name<input name="name" value="${esc(P.name)}" placeholder="e.g. Grandma Rose"></label>
            <label>They are my…<input name="relation" value="${esc(P.relation)}" placeholder="Grandma, Grandpa, Mom…"></label>
            <label>Age<input name="age" type="number" min="40" max="115" value="${P.age || ''}"></label>
          </div>
        </fieldset>
        <fieldset><legend>Dementia stage</legend><div class="checks">${radios('stage', LBL.stage, P.stage)}</div></fieldset>
        <fieldset><legend>Behaviors</legend><div class="checks">${checks('behaviors', LBL.behaviors, P.behaviors)}</div></fieldset>
        <fieldset><legend>Mobility</legend><div class="checks">${radios('mobility', LBL.mobility, P.mobility)}</div></fieldset>
        <fieldset><legend>Medical needs</legend><div class="checks">${checks('medical', LBL.medical, P.medical)}</div></fieldset>
        <fieldset><legend>Paying with</legend><div class="checks">${checks('payment', LBL.payment, C.payment)}</div></fieldset>
        <fieldset><legend>Money & location</legend>
          <div class="f2">
            <label>Monthly budget ($)<input name="budget" type="number" step="100" value="${C.budget || ''}"></label>
            <label>ZIP code<input name="zip" inputmode="numeric" maxlength="5" value="${esc(C.zip)}" placeholder="68502"></label>
            <label>Max drive (miles)<input name="maxMiles" type="number" min="1" max="200" value="${C.maxMiles || ''}"></label>
          </div>
        </fieldset>
        <fieldset><legend>Timeline</legend><div class="checks">${radios('timeline', LBL.timeline, C.timeline)}</div></fieldset>
        <fieldset><legend>What they love</legend>
          <label>Likes & hobbies (comma separated)<input name="likes" value="${esc(P.likes.join(', '))}" placeholder="gardening, polka music, cards"></label>
          <div class="f2">
            <label>Faith<input name="faith" value="${esc(P.faith)}" placeholder="Catholic, Lutheran…"></label>
            <label>Personality<input name="personality" value="${esc(P.personality)}" placeholder="social, quiet…"></label>
          </div>
          <label>Notes<textarea name="notes" rows="3">${esc(P.notes)}</textarea></label>
        </fieldset>
        <fieldset><legend>You</legend>
          <div class="f2">
            <label>Your name<input name="cgName" value="${esc(S.caregiver.name)}"></label>
            <label>You are their…<input name="cgRelation" value="${esc(S.caregiver.relation)}" placeholder="grandson, daughter…"></label>
          </div>
        </fieldset>
        <div class="cta-row">
          <button type="button" class="btn btn-gray" data-action="close">Cancel</button>
          <button type="submit" class="btn btn-green grow">Save</button>
        </div>
      </form>`);
    $('#edit-form').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const all = n => f.getAll(n);
      Object.assign(P, {
        name: f.get('name').trim(), relation: f.get('relation').trim(), age: +f.get('age') || null,
        stage: f.get('stage') || '', behaviors: all('behaviors'), mobility: f.get('mobility') || '',
        medical: all('medical'), likes: f.get('likes').split(',').map(s => s.trim()).filter(Boolean),
        faith: f.get('faith').trim(), personality: f.get('personality').trim(), notes: f.get('notes').trim()
      });
      P._noBehaviors = P.behaviors.length === 0; P._noMedical = P.medical.length === 0;
      Object.assign(C, {
        payment: all('payment'), budget: +f.get('budget') || null, zip: f.get('zip').trim(),
        maxMiles: +f.get('maxMiles') || 20, timeline: f.get('timeline') || ''
      });
      S.caregiver = { name: f.get('cgName').trim(), relation: f.get('cgRelation').trim() };
      save(); App.closeModal(); App.refresh();
      toast('✅ Profile saved. Matches updated!', 'good');
    });
  }
};
