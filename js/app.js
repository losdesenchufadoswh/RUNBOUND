/* ═══════════════════════════════════════════════════════════
   RUNBOUND · UI
   Inicio · Desafíos · Competir · Entrenamiento · Tienda
   ═══════════════════════════════════════════════════════════ */

const $  = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

let VIEW = 'inicio';
let PERIOD = 'daily';          // Diario / Semanal / Mensual (Inicio y Entrenamiento)
let CHAL_TAB = 'daily';
let SHOP_TAB = 'cofres';
let INV_TAB = 'title';
let TRAINER_TAB = 'daily';
let EDITING = null;
let TIPO_RUN = 'run';   // tipo de la actividad que se está registrando
let EXTRA_CARRERA = false, EXTRA_NEG = false;
let PARA = [];          // a qué atletas va la sesión que se está creando
let DIA_SEL = null;     // qué día de la semana le toca (null = cualquiera)

const NAV = [
  { id:'inicio',        ic:'🏠', label:'Home' },
  { id:'desafios',      ic:'🎯', label:'Challenges' },
  { id:'standings',     ic:'🏆', label:'Standings' },
  { id:'entrenamiento', ic:'📊', label:'Training' },
  { id:'tienda',        ic:'🛒', label:'Shop' }
];

const PERIOD_LABEL = { daily:'Daily', weekly:'Weekly', monthly:'Monthly', yearly:'Yearly' };

/* ── utilidades ───────────────────────────────────────────── */
function toast(msg) {
  const t = $('#toast');
  t.innerHTML = msg; t.classList.add('on');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2800);
}
function openModal(html) {
  $('#modal').innerHTML = html;
  $('#ov').classList.add('on'); $('#ov').classList.remove('sheet');
}
/* Igual que openModal pero anclado abajo, estilo bottom sheet. */
function openSheet(html) {
  $('#modal').innerHTML = html;
  $('#ov').classList.add('on', 'sheet');
}
function closeModal() { $('#ov').classList.remove('on', 'sheet'); EDITING = null; }
function bar(pct, cls = '') { return `<div class="bar ${cls}"><i style="width:${Math.max(0,Math.min(100,pct))}%"></i></div>`; }

/* Caja de arte con glyph de respaldo (láminas de SOVEREIGN). */
function artBox(key, { cls = '', style = '', tint = '', fb = '◈', y = '' } = {}) {
  if (!key) return `<div class="${cls}" style="${style}">${fb}</div>`;
  const s = [style, tint ? `filter:${tint}` : '', y ? `--artY:${y}` : ''].filter(Boolean).join(';');
  return `<div class="art ${cls}" style="${s}">
    <span class="afb">${fb}</span>
    <img src="${artSrc(key)}" alt="" loading="lazy" onerror="this.style.display='none'">
  </div>`;
}
/* Círculo del perfil: foto (o glyph) dentro, y el marco PNG encima.
   Cuando hay marco, el disco se encoge para caber en el hueco del arte. */
function caraPerfil(cls = '') {
  const f = ST.profile.frame ? LOOT_BY_ID[ST.profile.frame] : null;
  const dentro = ST.profile.photo
    ? `<img class="pphoto" src="${ST.profile.photo}" alt="">`
    : '🏃';
  return `<div class="pav ${f ? 'framed' : ''} ${cls}">
    <div class="disc">${dentro}</div>
    ${f && f.frame ? `<img class="fimg" src="${frameSrc(f.frame)}" alt="" onerror="this.style.display='none'">` : ''}
  </div>`;
}

/* Cartera del topbar: shards para cofres, millas para comprar directo. */
function wallet() {
  return `<div class="wallet">
    <span class="s">💎 ${U.n(ST.profile.shards)}</span>
    <i></i>
    <span class="c">🏃 ${U.n(millasDisponibles())}</span>
  </div>`;
}

/* La cara visual de un objeto de loot. Una sola definición para la
   tienda, el inventario, la compra con millas y el reveal del cofre —
   antes estaba duplicada en tres sitios y se desincronizaba. */
function caraLoot(i) {
  if (i.frame)  return `<img class="fthumb" src="${frameSrc(i.frame)}" alt="" loading="lazy" onerror="this.style.display='none'">`;
  if (i.banner) return `<img class="bthumb" src="${bannerSrc(i.banner)}" alt="" loading="lazy" onerror="this.style.display='none'">`;
  if (i.art)    return artBox(i.art, { cls:'', fb:i.em });
  if (i.type === 'background') return `<div style="position:absolute;inset:0;background:${i.css}"></div>`;
  return `<span>${i.em}</span>`;
}

/* Placa de identidad: el banner equipado, al lado del círculo. */
function bannerBox(cls = '') {
  const b = ST.profile.banner ? LOOT_BY_ID[ST.profile.banner] : null;
  if (!b) return `<div class="pbanner vacio ${cls}">
    <span>Toca para escoger tu banner</span></div>`;
  return `<div class="pbanner ${cls}">
    <img src="${bannerSrc(b.banner)}" alt="${esc(b.name)}" onerror="this.style.display='none'">
  </div>`;
}

function segmented(active, keys, act, cls = '') {
  return `<div class="seg ${cls}">${keys.map(k => {
    const label = typeof k === 'string' ? PERIOD_LABEL[k] || k : k.l;
    const id = typeof k === 'string' ? k : k.k;
    const pip = (typeof k === 'object' && k.pip) ? '<i class="pip"></i>' : '';
    return `<button class="${id === active ? 'on' : ''}" data-act="${act}" data-tab="${id}">${label}${pip}</button>`;
  }).join('')}</div>`;
}

/* ═══ INICIO ══════════════════════════════════════════════ */
function renderInicio() {
  const p = ST.profile;
  const L = levelOf(totalXp());
  const s = scoreTotal(PERIOD);
  const pct = Math.round(s.total / 1000 * 100);
  const fr = p.frame ? 'f-' + LOOT_BY_ID[p.frame].slug : '';
  const hoy = sesionDeHoy();
  const R = 76, C = 2 * Math.PI * R;

  return `
  <button class="phead" data-act="perfil">
    ${caraPerfil()}
    ${bannerBox()}
    <div class="editpen">✏️</div>
  </button>
  <div class="pline">
    <div>
      <div class="pgreet">¡Vamos, ${esc(p.name)}! <span class="lvlchip">${L.level}</span></div>
      <div class="prank">🏃 ${p.title ? esc(LOOT_BY_ID[p.title].name) : 'Rookie Runner'}</div>
      <div class="hoy">${fechaHoy()}</div>
    </div>
    <div class="streakchip"><div class="n">🔥 ${actividades()}</div><div class="l">Activities</div></div>
  </div>

  <div class="ringwrap">
    <button class="ringinfo" data-act="explica">i</button>
    <div class="ring">
      <svg viewBox="0 0 176 176" width="176" height="176">
        <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#2f9bff"/><stop offset="1" stop-color="#7cc4ff"/></linearGradient></defs>
        <circle class="trk" cx="88" cy="88" r="${R}"/>
        <circle class="val" cx="88" cy="88" r="${R}" stroke-dasharray="${C * pct / 100} ${C}"/>
      </svg>
      <div class="mid">
        <div class="pc">${pct}<span style="font-size:26px">%</span></div>
        <div class="k">PERSONAL PROGRESS</div>
        <div class="d">Mejora, plan, objetivos y esfuerzo</div>
      </div>
    </div>
  </div>

  ${segmented(PERIOD, ['daily','weekly','monthly'], 'period')}

  <div class="duo">
    <div class="card"><div class="kv">
      <div class="k">ACTIVIDADES</div>
      <div class="v">🔥 ${actividades()} <small style="font-family:var(--fu);font-size:13px;color:var(--muted)">total</small></div>
      <div class="s">${actividadesSemana()} esta semana</div>
    </div></div>
    <div class="card"><div class="kv">
      <div class="k">XP TOTAL</div>
      <div class="v">${U.n(totalXp())}</div>
      <div class="s" style="margin-top:6px">Nivel ${L.level}${bar(Math.round(L.into / L.need * 100))}</div>
    </div></div>
  </div>

  ${hoy ? `<button class="row" data-act="go" data-view="desafios">
    <div class="ic g">👟</div>
    <div class="b"><div class="kk">TODAY&rsquo;S SESSION</div>
      <div class="nn">${esc(hoy.name)}</div>
      <div class="ss">${esc(hoy.desc)}</div></div>
    <div class="check ${evalChallenge(hoy).done ? '' : 'off'}">✓</div>
  </button>` : ''}

  <button class="row ${signinPendiente() ? 'hot' : ''}" data-act="signin">
    <div class="ic ${signinPendiente() ? 'g' : ''}">🎁</div>
    <div class="b"><div class="kk">SIGN-IN BONUS</div>
      <div class="nn">Día ${signinProximo()} de ${SIGNIN_DIAS}</div>
      <div class="ss">${signinPendiente()
        ? (signinProximo() >= SIGNIN_DIAS ? '¡Cofre gratis esperándote!' : `+${SIGNIN_SHARDS} 💎 sin reclamar`)
        : 'Ya reclamaste hoy'}</div></div>
    ${signinPendiente() ? '<i class="dot"></i>' : '<div class="chev">›</div>'}
  </button>

  <button class="evt" data-act="go" data-view="competir">
    <div class="ic">🏆</div>
    <div class="b"><div class="kk" style="color:var(--violet2)">NEXT EVENT</div>
      <div class="nn">Improvement League</div>
      <div class="ss">Termina en ${D.until(ligaFin())}</div></div>
    <div class="chev">›</div>
  </button>

  <button class="row" data-act="source">
    <div class="ic">🔌</div>
    <div class="b"><div class="kk">DATA SOURCE</div>
      <div class="nn">Entrada manual</div>
      <div class="ss">Strava se conecta en la fase 2</div></div>
    <div class="chev">›</div>
  </button>`;
}

function ligaFin() {
  const d = D.startOfWeek(); d.setDate(d.getDate() + 7); return d.toISOString();
}

/* ═══ DESAFÍOS ════════════════════════════════════════════ */
function renderDesafios() {
  const cs = misRetos().filter(c => c.period === CHAL_TAB);
  const tabs = ['daily','weekly','monthly','yearly'].map(k => ({
    k, l: PERIOD_LABEL[k],
    pip: misRetos().some(c => c.period === k && evalChallenge(c).done && !ST.claimed[c.id])
  }));

  const fila = c => {
    const ev = evalChallenge(c), claimed = !!ST.claimed[c.id];
    const ic = { session:'🎽', runs:'✅', distance:'🏃', single_distance:'🎯', pace:'⏱️', elevation:'⛰️',
                 streak:'🔥', cadence:'👣', hr:'❤️', time:'⌛' }[c.goal.type] || '◈';
    return `<div class="chal ${ev.done ? 'done' : ''} ${esSesion(c) ? 'plan' : ''}">
      <div class="ic" style="width:42px;height:42px;flex:0 0 42px;border-radius:11px;display:grid;place-items:center;
        font-size:18px;background:rgba(47,155,255,.12);border:1px solid rgba(47,155,255,.24)">${ic}</div>
      <div class="cb">
        <div class="cn">${esc(c.name)} ${c.by === 'trainer' ? '<span class="tagt">COACH</span>' : ''}</div>
        <div class="cd">${esc(c.desc)}${c.params ? `<br><b style="color:var(--blue2)">${textoParams(c.params)}</b>` : ''}</div>
        <div class="cfoot">
          <div class="cp" style="color:${ev.done ? 'var(--green2)' : 'var(--muted)'}">${progressLabel(c, ev)}</div>
          ${bar(ev.pct, ev.done ? 'g' : '')}
          <div class="cx">${ev.pct}%</div>
        </div>
      </div>
      ${ev.done && !claimed
        ? `<button class="claim" data-act="claim" data-id="${c.id}">CLAIM</button>`
        : `<div class="rewards">
             <div class="pill"><div class="pi xp">XP</div><div class="pv">${U.n(c.xp)}</div></div>
             <div class="pill"><div class="pi sh">💎</div><div class="pv">${c.shards}</div></div>
           </div>`}
    </div>`;
  };

  const plan = cs.filter(esSesion), metas = cs.filter(c => !esSesion(c));
  const ad = scoreAdherencia(CHAL_TAB), ob = scoreObjetivos(CHAL_TAB);

  return `
  <div class="sub">PLAN &amp; GOALS</div>
  ${segmented(CHAL_TAB, tabs, 'ctab')}

  <div class="card">
    <div class="ctitle">PLAN SESSIONS
      <span style="color:var(--blue2)">${ad.pts} / ${CAPS.adherencia} pts</span></div>
    ${bar(ad.total ? ad.hechas / ad.total * 100 : 0)}
    <div class="hint">Aquí está el grueso de tus puntos. Una sesión solo cuenta si cumples
    <b>sus parámetros</b> — distancia, tiempo, subida o zona de pulso. Salir a caminar
    sin cumplirlos no suma nada.</div>
  </div>
  ${plan.map(fila).join('') || '<div class="empty">No hay sesiones en este período.</div>'}

  <div class="sect"><h2>VOLUME GOALS</h2>
    <span style="font-family:var(--fu);font-weight:700;font-size:11px;color:var(--blue2)">${ob.pts} / ${CAPS.objetivos} pts</span></div>
  ${metas.map(fila).join('') || '<div class="empty">Sin objetivos en este período.</div>'}`;
}

/* ═══ COMPETIR · Improvement League ══════════════════ */
function renderCompetir() {
  const mio = scoreTotal('weekly');
  const op = rival('weekly');
  const semana = Math.ceil((new Date() - D.startOfYear()) / 6048e5);

  /* Sin atletas en el roster no hay contra quién medirse. Se dice, en vez
     de inventar un rival: un marcador falso vuelve inútil el de verdad. */
  if (!op) {
    return `
    <div class="sub">SEMANA ${semana} · TERMINA EN ${D.until(ligaFin())}</div>
    <div class="fair">
      <h3>EL SISTEMA ES JUSTO</h3>
      <p>Los puntos salen de tu mejora personal y de <b style="color:var(--text)">cumplir el plan de tu coach</b> —
      <b style="color:var(--text)">no de tu velocidad</b>. Camines o corras, compites en igualdad.</p>
    </div>
    <div class="card" style="text-align:center;padding:26px 18px">
      <div style="font-size:40px;margin-bottom:8px">👥</div>
      <div style="font-family:var(--fb);font-weight:800;font-size:18px;margin-bottom:6px">Todavía no hay Liga</div>
      <div style="font-size:13px;line-height:1.6;color:#c3cede">
        La Liga necesita atletas. Entra a <b style="color:var(--blue2)">Modo Coach</b> y añade a tu gente —
        en cuanto haya alguien más, aquí aparece el enfrentamiento semanal.
      </div>
      <button class="btnbig" style="margin-top:14px" data-act="go" data-view="trainer">IR A MODO COACH</button>
    </div>
    <div class="card flat">
      <div class="ctitle">TUS PUNTOS ESTA SEMANA</div>
      <div class="kv"><div class="k">TOTAL</div>
        <div class="v" style="color:var(--blue2)">${mio.total} <small style="font-size:14px;color:var(--muted)">/ 1000</small></div>
        <div class="s" style="margin-top:7px">${bar(mio.total / 10)}</div></div>
      ${[['mejora','Personal Improvement'], ['adherencia','Plan Adherence'],
         ['objetivos','Goals Completed'], ['esfuerzo','Effort (HR relativo)']]
        .map(([k, l]) => `<div class="hrow"><div class="hb"><div class="ht">${l}</div></div>
          <div style="font-family:var(--fu);font-weight:700;font-size:12.5px;color:var(--blue2)">${mio[k].pts} / ${CAPS[k]}</div>
        </div>`).join('')}
    </div>`;
  }

  const gano = mio.total >= op.total;
  const dif = Math.abs(mio.total - op.total);
  const fr = ST.profile.frame ? 'f-' + LOOT_BY_ID[ST.profile.frame].slug : '';

  const filas = [
    ['mejora','Personal Improvement'], ['adherencia','Plan Adherence'],
    ['objetivos','Goals Completed'], ['esfuerzo','Effort (HR relativo)']
  ].map(([k, label]) => {
    const a = mio[k].pts, b = op.desglose[k], cap = CAPS[k];
    return `<div class="brk">
      <div class="n1">${a}</div>
      <div class="mb l"><i style="width:${a / cap * 100}%"></i></div>
      <div class="lb">${label}</div>
      <div class="mb r"><i style="width:${b / cap * 100}%"></i></div>
      <div class="n2">${b}</div>
    </div>`;
  }).join('');

  const mejoraPct = mio.mejora.sinDatos ? null : mio.mejora.pct;

  return `
  <div class="sub">SEMANA ${semana} · TERMINA EN ${D.until(ligaFin())}</div>

  <div class="fair">
    <h3>EL SISTEMA ES JUSTO</h3>
    <p>Los puntos salen de tu mejora personal y de <b style="color:var(--text)">cumplir el plan de tu coach</b> —
    <b style="color:var(--text)">no de tu velocidad</b>. Camines o corras, compites en igualdad.</p>
  </div>

  <div class="vs">
    <div class="fighter me">
      <div class="fav">${caraPerfil('big')}</div>
      <div class="fn">${esc(ST.profile.name)}</div>
      <div class="fr">${ST.profile.title ? esc(LOOT_BY_ID[ST.profile.title].name) : 'Rookie Runner'}</div>
      <div class="fl">Nivel ${levelOf(totalXp()).level}</div>
      <div class="pctbox">
        <div class="pctv">${mejoraPct === null ? '—' : (mejoraPct >= 0 ? '+' : '') + mejoraPct.toFixed(1) + '%'}</div>
        <div class="pctl">PERSONAL IMPROVEMENT</div>
      </div>
    </div>
    <div class="vsbadge">VS</div>
    <div class="fighter op">
      <div class="pav big"><div class="disc" style="border-color:var(--violet)">${op.em}</div></div>
      <div class="fn">${esc(op.nombre)}</div>
      <div class="fr">${op.rango}</div>
      <div class="fl">Nivel ${op.nivel}</div>
      <div class="pctbox">
        <div class="pctv">${(op.mejoraPct >= 0 ? '+' : '') + op.mejoraPct.toFixed(1)}%</div>
        <div class="pctl">PERSONAL IMPROVEMENT</div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="ctitle" style="justify-content:center">POINT BREAKDOWN (NORMALIZED)</div>
    ${filas}
    <div class="brk tot">
      <div class="n1">${U.n(mio.total)}</div><div></div>
      <div class="lb">Total Points</div>
      <div></div><div class="n2">${U.n(op.total)}</div>
    </div>
  </div>

  <div class="win ${gano ? '' : 'lose'}">
    <div class="ic" style="width:42px;height:42px;flex:0 0 42px;border-radius:11px;display:grid;place-items:center;font-size:20px">
      ${gano ? '🏆' : '💪'}</div>
    <div class="b">
      <div class="nn">${gano ? '¡Vas ganando!' : 'Vas por detrás'}</div>
      <div class="ss">${gano
        ? `Estás ${dif} puntos arriba. Sigue así para asegurar la victoria.`
        : `Te faltan ${dif} puntos. Completa una sesión del plan y los recuperas.`}</div>
    </div>
  </div>

  ${mio.mejora.sinDatos ? `<div class="card flat">
    <div class="ctitle">TU LÍNEA BASE</div>
    <div class="hint" style="margin:0">Necesitas al menos ${MIN_RUNS_PERIODO} actividades esta semana
    y una semana previa con datos para calcular tu mejora personal. Mientras tanto solo puntúan
    adherencia al plan, objetivos y esfuerzo.</div>
  </div>` : `<div class="card flat">
    <div class="ctitle">TU LÍNEA BASE <span style="color:var(--muted)">SEMANA PASADA</span></div>
    <div class="mets">
      <div class="met"><div class="mv">${U.pace(mio.mejora.base)}</div><div class="ml">BASE /${U.distU()}</div></div>
      <div class="met"><div class="mv">${U.pace(mio.mejora.actual)}</div><div class="ml">AHORA /${U.distU()}</div></div>
      <div class="met"><div class="mv" style="color:${mejoraPct >= 0 ? 'var(--green2)' : 'var(--red)'}">
        ${(mejoraPct >= 0 ? '+' : '') + mejoraPct.toFixed(1)}%</div><div class="ml">CAMBIO</div></div>
    </div>
    <div class="hint">Mantener tu nivel ya vale 300 de ${CAPS.mejora} puntos. Mejorar un 5% te da el máximo.</div>
  </div>`}`;
}

/* ═══ ENTRENAMIENTO ═══════════════════════════════════════ */
function renderEntrenamiento() {
  const hoy = ST.runs.filter(r => !r.manual && D.key(r.start_iso) === D.today());
  const act = hoy[0];
  const sem = totals('weekly');
  const objSemanal = ST.goals.weekly;
  const cons = scoreAdherencia('weekly');
  /* Pasarse del objetivo se muestra tope-con-tope: "5 de 5", no "6 de 5". */
  const cap = (v, m) => Math.min(v, m);
  const base = median(paceList(runsBetween(...periodBounds('weekly', 1))));

  const dias = ['L','M','X','J','V','S','D'];
  const ini = D.startOfWeek();
  const hechos = new Set(ST.runs.filter(r => !r.manual).map(r => D.key(r.start_iso)));
  const week = dias.map((d, i) => {
    const f = new Date(ini); f.setDate(f.getDate() + i);
    const es = D.key(f) === D.today();
    const ok = hechos.has(D.key(f));
    return `<div class="day ${ok ? 'ok' : ''} ${es ? 'today' : ''}">
      <div class="dl">${d}</div><div class="dc">${ok ? '✓' : es ? '•' : ''}</div></div>`;
  }).join('');

  const hist = ST.runs.filter(r => !r.manual).slice(0, 5).map(r => `
    <button class="hrow" data-act="run-detail" data-id="${r.id}" style="width:100%">
      <div class="hic">🏃</div>
      <div class="hb">
        <div class="ht">${new Date(r.start_iso).toLocaleDateString('es-PR',{weekday:'short'})} · ${U.dist(r.distance_m)} ${U.distU()}</div>
        <div class="hs">${U.pace(U.paceSec(r))}/${U.distU().toLowerCase()} · ${U.clock(r.moving_s)}${r.avg_hr ? ' · '+r.avg_hr+' bpm' : ''}</div>
      </div>
      <div style="font-family:var(--fu);font-weight:700;font-size:12px;color:var(--blue2);flex:0 0 auto">
        ${effortOf(r, base)}<span style="color:var(--dim)">/10</span></div>
    </button>`).join('');

  return `
  ${segmented(PERIOD, ['daily','weekly','monthly'], 'period')}

  <div class="card">
    <div class="ctitle">COACH PLAN</div>
    <div style="display:flex;align-items:center;gap:11px">
      <div class="ic" style="width:40px;height:40px;flex:0 0 40px;border-radius:11px;display:grid;place-items:center;
        font-size:18px;background:rgba(139,92,246,.15);border:1px solid rgba(139,92,246,.3)">🧑‍🏫</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:15px">Plan de ${esc(ST.profile.name)}</div>
        <div style="font-size:11.5px;color:var(--muted)">${cons.hechas} de ${cons.total} sesiones · Enfoque: Base</div>
      </div>
      <button class="btnw b" style="width:auto;margin:0;padding:8px 14px;font-size:12.5px"
        data-act="go" data-view="trainer">Ver plan</button>
    </div>
    <div class="week">${week}</div>
  </div>

  <div class="card">
    <div class="ctitle">TODAY&rsquo;S ACTIVITY ${act ? '<span class="pillok">Completado ✓</span>' : ''}</div>
    ${act ? `
      <div style="font-weight:700;font-size:15px;margin-bottom:2px">${act.distance_m > 8000 ? 'Long Run' : 'Easy Run'}</div>
      <div class="mets">
        <div class="met"><div class="mv">${U.dist(act.distance_m)}</div><div class="ml">DISTANCE</div></div>
        <div class="met"><div class="mv">${U.pace(U.paceSec(act))}</div><div class="ml">PACE</div></div>
        <div class="met"><div class="mv">${U.clock(act.moving_s)}</div><div class="ml">TIME</div></div>
      </div>
      <div class="mets" style="margin-top:14px">
        <div class="met"><div class="mv">${act.avg_hr || '—'}</div><div class="ml">AVG HR</div></div>
        <div class="met"><div class="mv">${act.cadence_spm || '—'}</div><div class="ml">CADENCE</div></div>
        <div class="met"><div class="mv">${effortOf(act, base)}<small> / 10</small></div><div class="ml">EFFORT</div></div>
      </div>`
      : `<div class="empty">Todavía no has registrado nada hoy.<br>Dale al <b>+</b> de arriba.</div>`}
  </div>

  <div class="card">
    <div class="ctitle">WEEKLY VOLUME</div>
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:8px">
      <div style="font-size:12.5px;color:var(--muted)">${sem.runs} actividades · ${cons.dias} días activos</div>
      <div style="text-align:right">
        <div style="font-family:var(--fb);font-weight:800;font-size:19px">${U.dist(sem.dist,1)}</div>
        <div style="font-family:var(--fu);font-weight:600;font-size:10px;color:var(--muted)">
          / ${U.dist(objSemanal,0)} ${U.distU()} GOAL</div>
      </div>
    </div>
    ${bar(sem.dist / objSemanal * 100)}
  </div>

  <div class="card">
    <div class="ctitle">RECENT ACTIVITY</div>
    ${hist || '<div class="empty">Sin actividades.</div>'}
  </div>`;
}

/* ═══ TIENDA ══════════════════════════════════════════════ */
function renderTienda() {
  const tabs = [{k:'cofres',l:'Cofres'},{k:'cosmeticos',l:'Cosméticos'},{k:'millas',l:'Millas'}];
  let body = '';

  if (SHOP_TAB === 'cofres') {
    const packs = PACKS.map((p, i) => {
      const can = ST.profile.shards >= p.cost;
      const rates = Object.entries(p.rates).filter(([, v]) => v > 0)
        .map(([k, v]) => `<span class="tagt r-${k}" style="background:none;border-color:${RARITY[k].color}55;color:${RARITY[k].color}">${RARITY[k].label} ${v}%</span>`).join(' ');
      if (i === 0) {
        return `<div class="chest">
          <h3>COFRE ÉPICO</h3>
          <div class="cd">Contiene cosméticos exclusivos<br>para tu perfil y tus carreras.</div>
          <img class="chestimg" id="chestImg" src="art/cofre_epico.png" alt="Cofre épico">
          <div class="pedestal"></div>
          <button class="btnbig" data-act="pull" data-pack="${p.id}" ${can ? '' : 'disabled'}>
            ABRIR COFRE <span style="opacity:.85">💎 ${U.n(p.cost)}</span></button>
          <div class="have">Tienes ${U.n(ST.profile.shards)} 💎 · ${Math.floor(ST.profile.shards / p.cost)} cofre(s)</div>
        </div>`;
      }
      return `<div class="card">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="packic">
            ${p.img
              ? `<img src="${packImg(p.img)}" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode('${p.em}'))">`
              : p.em}
            ${p.badge ? `<b class="packx">×${p.badge}</b>` : ''}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:15px">${esc(p.name)}</div>
            <div style="font-size:11.5px;color:var(--muted);margin:2px 0 6px">${esc(p.desc)}</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap">${rates}
              ${p.guarantee ? '<span class="tagt" style="border-color:rgba(52,209,126,.4);background:rgba(52,209,126,.1);color:var(--green2)">EPIC+ SEGURO</span>' : ''}</div>
          </div>
        </div>
        <button class="btnw v" data-act="pull" data-pack="${p.id}" ${can ? '' : 'style="opacity:.45" disabled'}>
          ABRIR · 💎 ${U.n(p.cost)}</button>
      </div>`;
    }).join('');

    const posibles = ['bn_piernas','bn_gps','f_ascender','b_wyrm','bn_ambu','t_promuerte','bn_rest','b_amanecer']
      .map(id => rewardTile(LOOT_BY_ID[id], false)).join('');

    const recientes = Object.keys(ST.collection).slice(-4).reverse()
      .map(id => rewardTile(LOOT_BY_ID[id], true)).join('');

    body = `${packs}
      <div class="sect"><h2>POSIBLES RECOMPENSAS</h2></div>
      <div class="rgrid">${posibles}</div>
      <div class="sect"><h2>RECOMPENSAS RECIENTES</h2></div>
      ${recientes ? `<div class="rgrid">${recientes}</div>`
                  : '<div class="empty">Abre un cofre para empezar tu colección.</div>'}
      <div class="card flat" style="margin-top:12px">
        <div class="ctitle">PITY</div>
        <div class="duo" style="margin:0">
          <div><div class="kv"><div class="k">EPIC SEGURO EN</div>
            <div class="v" style="color:var(--violet2)">${PITY.epic - ST.gacha.sinceEpic}</div></div></div>
          <div><div class="kv"><div class="k">MYTHIC SEGURO EN</div>
            <div class="v" style="color:var(--gold2)">${PITY.mythic - ST.gacha.sinceMythic}</div></div></div>
        </div>
        <div class="hint">Duplicados devuelven shards: Rare ${RARITY.rare.dust} · Epic ${RARITY.epic.dust} · Mythic ${RARITY.mythic.dust}.</div>
      </div>`;
  }

  if (SHOP_TAB === 'cosmeticos') {
    const invTabs = [{k:'title',l:'Títulos'},{k:'banner',l:'Banners'},{k:'frame',l:'Marcos'},{k:'background',l:'Fondos'}];
    const items = LOOT.filter(i => i.type === INV_TAB).map(i => rewardTile(i, true, true)).join('');
    const owned = Object.keys(ST.collection).length;
    body = `${segmented(INV_TAB, invTabs, 'itab', 'v')}
      <div class="card flat"><div class="kv">
        <div class="k">COLECCIÓN</div><div class="v">${owned} <small style="font-family:var(--fu);font-size:14px;color:var(--muted)">/ ${LOOT.length}</small></div>
        <div class="s" style="margin-top:7px">${bar(owned / LOOT.length * 100, 'v')}</div></div></div>
      <div class="rgrid">${items}</div>
      <div class="hint" style="text-align:center">Toca un objeto que tengas para equiparlo o quitarlo.</div>`;
  }

  if (SHOP_TAB === 'millas') {
    const disp = millasDisponibles();
    /* Solo lo que NO tienes: comprar un duplicado no tendría sentido. */
    const faltantes = LOOT.filter(i => !ST.collection[i.id]);
    const tiles = faltantes.map(i => {
      const precio = MILE_PRICE[i.r];
      const puedo = disp >= precio;
      return `<button class="mbuy ${puedo ? '' : 'nope'}" data-act="buy-mile" data-id="${i.id}">
        <div class="mface bd-${i.r}">${caraLoot(i)}</div>
        <div class="mn">${esc(i.name)}</div>
        <div class="mr r-${i.r}">${RARITY[i.r].label}</div>
        <div class="mp">🏃 ${precio}</div>
      </button>`;
    }).join('');

    body = `<div class="card">
      <div class="ctitle">TUS MILLAS <span style="color:var(--green2)">🏃 ${U.n(disp)}</span></div>
      <div class="duo" style="margin:0 0 10px">
        <div><div class="kv"><div class="k">CORRIDAS</div>
          <div class="v" style="color:var(--green2)">${U.n(millasCorridas())}</div>
          <div class="s">Total histórico</div></div></div>
        <div><div class="kv"><div class="k">GASTADAS</div>
          <div class="v" style="color:var(--muted)">${U.n(ST.profile.millasGastadas || 0)}</div>
          <div class="s">En la tienda</div></div></div>
      </div>
      <div class="hint">Las millas <b>no se regalan</b>: son las que corriste o caminaste de verdad.
      Ningún reto te las da — solo salir.</div>
    </div>

    <div class="card" style="border-color:var(--line2)">
      <div class="ctitle" style="color:var(--gold2)">MILLAS O COFRE</div>
      <div style="font-size:13px;line-height:1.65;color:#c3cede">
        Aquí lo que compras es <b style="color:var(--gold2)">certeza</b>: escoges exactamente
        el objeto que quieres, sin depender de la suerte.
        <br><br>
        El cofre es la vía rápida — una sola tirada puede darte un Mythic. Pero es azar.
        <b style="color:var(--text)">Millas: seguro y lento. Cofre: rápido y con suerte.</b>
        <br><br>
        Y las millas no se regalan: solo salen de moverte.
      </div>
      <div class="hrow" style="margin-top:10px;border:0;padding-bottom:0">
        ${Object.entries(MILE_PRICE).map(([r, p]) =>
          `<div style="flex:1;text-align:center">
             <div class="r-${r}" style="font-family:var(--fu);font-weight:700;font-size:10px;letter-spacing:1px">${RARITY[r].label}</div>
             <div style="font-family:var(--fb);font-weight:800;font-size:17px;margin-top:2px">🏃 ${p}</div>
           </div>`).join('')}
      </div>
    </div>

    <div class="sect"><h2>COMPRAR CON MILLAS</h2>
      <span style="font-family:var(--fu);font-weight:700;font-size:11px;color:var(--muted)">${faltantes.length} disponibles</span></div>
    ${faltantes.length
      ? `<div class="mgrid">${tiles}</div>`
      : '<div class="empty">Ya tienes la colección completa. 🏆</div>'}`;
  }

  return `${segmented(SHOP_TAB, tabs, 'stab')}${body}`;
}

function rewardTile(i, showLocked, clickable) {
  if (!i) return '';
  const n = ST.collection[i.id] || 0;
  const eq = ST.profile[i.type] === i.id;
  const locked = showLocked && !n;
  const face = caraLoot(i);
  return `<${clickable ? 'button' : 'div'} class="rw bd-${i.r} ${locked ? 'locked' : ''} ${eq ? 'eq' : ''}"
      ${clickable ? `data-act="equip" data-id="${i.id}"` : ''} style="width:100%">
    <div class="rimg">${n > 1 ? `<div class="dup">×${n}</div>` : ''}${face}</div>
    <div class="rn">${locked ? '???' : esc(i.name)}</div>
    <div class="rr r-${i.r}">${RARITY[i.r].label}</div>
    ${eq ? '<span class="eqtag">EQUIPADO</span>' : ''}
  </${clickable ? 'button' : 'div'}>`;
}

/* ═══ TRAINER (plan del coach) ════════════════════════════ */
/* Tocar una sesión de la rejilla abre esto, en vez de meterte en modo
   edición sin avisar — que es lo que hacía antes y provocaba mover sin
   querer la sesión de un día a otro.

   Desde aquí el coach mueve, edita o borra: autoridad total sobre el
   plan sin tener que pasar por el formulario. */
function sheetSesion(id) {
  const c = ST.challenges.find(x => x.id === id); if (!c) return;
  const av = avanceSesion(c);
  openSheet(`
    <div class="mh">
      <div class="mt">${esc(c.name)}</div>
      <div class="msub">${esc(textoPara(c))}${c.dia != null ? ' · ' + DIAS_LARGO[c.dia] : ''}</div>
    </div>
    ${c.dia != null ? `<div class="hechochip ${av.completo ? '' : 'parcial'}">${
              av.completo ? '✓ Todos la cumplieron este día'
                          : av.hechos + ' de ' + av.total + ' la han cumplido'}</div>` : ''}
    <div class="fld txt" style="margin:10px 0"><div class="fl">MOVER A OTRO DÍA</div>
      <div class="chips">
        ${DIAS.map((d, i) => `<button class="chip ${c.dia === i ? 'on' : ''}"
           data-act="mover-sesion" data-id="${c.id}" data-dia="${i}">${d}</button>`).join('')}
        <button class="chip ${c.dia == null ? 'on' : ''}" data-act="mover-sesion" data-id="${c.id}" data-dia="">Todos</button>
      </div>
    </div>
    <div class="mrow2">
      <button class="btnbig" data-act="edit-ch" data-id="${c.id}">EDITAR</button>
      <button class="btnw" style="margin:0" data-act="del-ch" data-id="${c.id}">🗑️ Borrar</button>
    </div>
    <button class="btnw" style="margin:8px 0 0" data-act="close">Cerrar</button>`);
}

/* Rejilla de la semana: qué le toca a quién cada día. Se ve de un
   vistazo si el plan está cargado un día y vacío otro. */
function planSemanal() {
  /* La semana se arma con sesiones DIARIAS puestas en un día. Los retos
     weekly son metas del período completo y no van en la rejilla. */
  const semanales = (ST.challenges || []).filter(c => c.period === 'daily');
  const hoy = diaHoy();
  const cols = DIAS.map((d, i) => {
    const sesiones = semanales.filter(c => c.dia === i);
    return `<div class="pdia ${i === hoy ? 'hoy' : ''} ${sesiones.length ? 'lleno' : ''}">
      <div class="pdl">${d}</div>
      ${sesiones.length
        ? sesiones.map(c => {
            /* Gris cuando TODOS los asignados ya la hicieron ese día.
               Si va a medias se ve el conteo, que es más útil que un
               sí/no para un coach que lleva varios atletas. */
            const av = avanceSesion(c);
            return `<button class="pses ${av.completo ? 'hecho' : ''}" data-act="tocar-sesion" data-id="${c.id}">
              <div class="psn">${av.completo ? '✓ ' : ''}${esc(c.name)}</div>
              <div class="psq">${av.hechos}/${av.total} · ${esc(textoPara(c))}</div>
            </button>`;
          }).join('')
        : '<div class="pvacio">—</div>'}
    </div>`;
  }).join('');

  const sinDia = semanales.filter(c => c.dia == null);
  return `
  <div class="sect"><h2>PLAN DE LA SEMANA</h2>
    <span style="font-family:var(--fu);font-weight:700;font-size:11px;color:var(--muted)">${semanales.filter(c => c.dia != null).length} ASIGNADAS</span></div>
  <div class="psemana">${cols}</div>
  ${sinDia.length
    ? `<div class="hint" style="margin-top:8px">Todos los días: ${sinDia.map(c => esc(c.name)).join(' · ')}</div>`
    : ''}`;
}

function renderTrainer() {
  const asignados = ST.challenges.filter(c => c.by === 'trainer');
  const cons = scoreAdherencia('weekly');
  const sem = totals('weekly');
  const tabs = ['daily','weekly','monthly','yearly'].map(k => ({ k, l:PERIOD_LABEL[k] }));

  const rows = asignados.map(c => {
    const ev = evalChallenge(c);
    return `<div class="chal">
      <div class="cb">
        <div style="font-family:var(--fu);font-weight:700;font-size:9.5px;letter-spacing:1.4px;color:var(--blue2)">
          ${PERIOD_LABEL[c.period].toUpperCase()}</div>
        <div class="cn">${esc(c.name)}</div>
        <div class="cd" style="margin:1px 0 0">${progressLabel(c, ev)} · ${c.xp} XP</div>
        <div class="cpara">👥 ${esc(textoPara(c))}${c.dia != null ? ' · 📅 ' + DIAS[c.dia] : ''}</div>
      </div>
      <button class="icob ed" data-act="edit-ch" data-id="${c.id}">✏️</button>
      <button class="icob del" data-act="del-ch" data-id="${c.id}">🗑️</button>
    </div>`;
  }).join('');

  return `
  <div class="sub">MODO COACH · ${esc(ST.profile.name)}</div>
  <div class="tstat">
    <div><div class="kv"><div class="k">ACTIVIDADES</div><div class="v" style="color:var(--orange)">🔥 ${actividades()}</div>
      <div class="s">${actividadesSemana()} esta semana</div></div></div>
    <div><div class="kv"><div class="k">ADHERENCIA</div>
      <div class="v" style="color:var(--green2)">${cons.total ? Math.round(cons.hechas/cons.total*100) : 0}%</div>
      <div class="s">${cons.hechas}/${cons.total} sesiones</div></div></div>
    <div><div class="kv"><div class="k">SEMANA</div><div class="v">${U.dist(sem.dist,1)}</div>
      <div class="s">${sem.runs} act · ${U.distU()}</div></div></div>
  </div>

  <div class="sect"><h2>ATLETAS</h2>
    <span style="font-family:var(--fu);font-weight:700;font-size:11px;color:var(--muted)">${(ST.roster||[]).length}</span></div>
  <div class="card">
    <div class="addrow">
      <input id="a_name" type="text" placeholder="Nombre del atleta" maxlength="28">
      <button class="btnadd" data-act="add-atleta">AÑADIR</button>
    </div>
    ${(ST.roster || []).length
      ? `<div class="roster">${ST.roster.map(a => `
          <div class="rrow">
            <div class="rav">${esc(a.name.slice(0,1).toUpperCase())}</div>
            <div class="rb"><div class="rn2">${esc(a.name)}</div>
              <div class="rs">${a.dist_m ? U.dist(a.dist_m,1) + ' ' + U.distU() + ' este mes' : 'Sin actividad registrada'}</div></div>
            <button class="icob del" data-act="del-atleta" data-id="${a.id}">🗑️</button>
          </div>`).join('')}</div>`
      : `<div class="hint" style="margin-top:8px">Todavía no hay atletas. Añade el primero arriba —
         la Liga y el leaderboard salen de esta lista, así que hasta que agregues a alguien
         solo apareces tú.</div>`}
  </div>

  ${planSemanal()}

  <div class="sect"><h2>RETOS LISTOS</h2>
    <span style="font-family:var(--fu);font-weight:700;font-size:11px;color:var(--muted)">TOCA PARA AÑADIR</span></div>
  <div class="presets">
    ${PRESETS.map(p => {
      const puesto = ST.challenges.some(c => c.id === p.id);
      return `<button class="preset ${puesto ? 'puesto' : ''}" data-act="preset" data-id="${p.id}">
        <div class="prt">${esc(p.name)}${puesto ? ' <i class="okp">✓</i>' : ''}</div>
        <div class="prd">${esc(p.desc)}</div>
        <div class="prm"><span class="prp">${PERIOD_LABEL[p.period]}</span>
          <span class="prn">${esc(p.necesita)}</span></div>
      </button>`;
    }).join('')}
  </div>

  ${EDITING ? `<div class="editando">
    <div class="eb"><div class="et">EDITANDO</div>
      <div class="en">${esc((ST.challenges.find(x => x.id === EDITING) || {}).name || '')}</div>
      <div class="es">Al guardar se MODIFICA esta sesión, no se crea otra.</div></div>
    <button class="btnw" style="margin:0;flex:0 0 auto;padding:0 14px" data-act="clear-ch">Cancelar</button>
  </div>` : ''}

  <div class="sect"><h2>${EDITING ? 'EDITAR SESIÓN' : 'CREATE SESSION'}</h2></div>
  ${segmented(TRAINER_TAB, tabs, 'ttab')}

  <div class="fld txt" style="margin-bottom:9px"><div class="fl">👥 PARA QUIÉN</div>
    <div class="chips">
      <button class="chip ${!PARA.length ? 'on' : ''}" data-act="para" data-id="">Todos</button>
      ${(ST.roster || []).map(a =>
        `<button class="chip ${PARA.includes(a.id) ? 'on' : ''}" data-act="para" data-id="${a.id}">${esc(a.name)}</button>`).join('')}
    </div>
    ${!(ST.roster || []).length
      ? '<div class="hint" style="margin-top:6px">Añade atletas arriba para poder asignarles sesiones.</div>' : ''}
  </div>

  ${TRAINER_TAB === 'daily' ? `
  <div class="fld txt" style="margin-bottom:9px"><div class="fl">📅 QUÉ DÍA TOCA</div>
    <div class="chips">
      <button class="chip ${DIA_SEL === null ? 'on' : ''}" data-act="diasel" data-id="">Todos los días</button>
      ${DIAS.map((d, i) =>
        `<button class="chip ${DIA_SEL === i ? 'on' : ''}" data-act="diasel" data-id="${i}">${d}</button>`).join('')}
    </div>
    <div class="hint" style="margin-top:6px">Así se arma la semana: una sesión por día.
      Sin día, la sesión aparece todos los días.</div>
  </div>` : ''}
  <div class="fgrid">
    <div class="fld"><div class="fl">📏 DISTANCE</div><input id="f_dist" type="number" step="0.1" value="3.0"><div class="fu2">${U.distU()}</div></div>
    <div class="fld"><div class="fl">⏱️ PACE</div>
      <select id="f_pace" class="pacesel">${selectPace()}</select>
      <div class="fu2">/${U.distU()}</div></div>
    <div class="fld calc"><div class="fl">⌛ TIME</div><input id="f_time" type="text" value="36:00"><div class="fu2" id="f_timecalc">3 ${U.distU().toLowerCase()} × 12'00"</div></div>
    <div class="fld"><div class="fl">⛰️ ELEVATION</div><input id="f_elev" type="number" placeholder="opcional"><div class="fu2">${U.elevU()}</div></div>
    <div class="fld"><div class="fl">❤️ HR ZONE</div>
      <select id="f_hr"><option value="" selected>Ninguna</option><option>Z2</option><option>Z3</option><option>Z4</option><option>Z5</option></select>
      <div class="fu2">relativa a ti</div></div>
    <div class="fld"><div class="fl">✦ REWARD</div><input id="f_xp" type="number" step="50" value="250"><div class="fu2">XP</div></div>
  </div>
  <div class="fgrid" style="grid-template-columns:1fr 1fr">
    <div class="fld txt"><div class="fl">NOMBRE</div><input id="f_name" placeholder="Caminata Larga"></div>
    <div class="fld txt"><div class="fl">DESCRIPCIÓN</div><input id="f_desc" placeholder="Ritmo cómodo, sin prisa."></div>
  </div>
  <div class="fld txt" style="margin-bottom:10px"><div class="fl">QUÉ SE MIDE</div>
    <select id="f_goal" style="font-weight:500;font-size:13.5px">
      <option value="distance">Distancia acumulada</option>
      <option value="single_distance">Una sola actividad de X</option>
      <option value="runs">Cantidad de actividades</option>
      <option value="pace">Ritmo bajo X</option>
      <option value="elevation">Elevación acumulada</option>
      <option value="time">Tiempo en movimiento</option>
      <option value="streak">Actividades completadas</option>
      <option value="cadence">Cadencia sobre X</option>
      <option value="hr">Actividades en zona FC</option>
      <option value="session">Sesión con parámetros (usa los campos de arriba)</option>
    </select></div>
  <div class="hint" style="margin:0 0 10px">Con <b>“Sesión con parámetros”</b> la actividad tiene que cumplir
  TODO lo que llenes arriba — y <b>solo</b> eso. Los campos que dejes vacíos no se exigen,
  así que no pidas elevación o pulso si no los vas a medir. Es lo que puntúa en Adherencia al Plan.</div>
  <div class="acts">
    <button class="act ok" data-act="save-ch">${EDITING ? '💾 GUARDAR' : '✦ CREAR'}</button>
    <button class="act ed" data-act="pick-ch">✏️ EDITAR</button>
    <button class="act del" data-act="del-pick">🗑️ BORRAR</button>
    <button class="act" data-act="clear-ch">↺ LIMPIAR</button>
  </div>

  <div class="sect"><h2>ASSIGNED SESSIONS</h2>
    <span style="font-family:var(--fu);font-weight:700;font-size:11px;color:var(--muted)">${asignados.length} / 10</span></div>
  ${rows || '<div class="empty">Todavía no has asignado ninguno.</div>'}

  <div class="card">
    <div class="ctitle" style="color:var(--green2)">👥 PERMISOS</div>
    <div style="font-size:12.5px;line-height:1.6;color:#c3cede">Como coach puedes crear, editar y asignar
    desafíos. <b>No ves rutas ni mapas</b> del atleta — solo métricas.</div>
  </div>`;
}

/* ═══ MODALES ═════════════════════════════════════════════ */
function modalExplica() {
  const s = scoreTotal(PERIOD);
  const filas = [
    ['Mejora Personal', s.mejora.pts, CAPS.mejora,
      'Compara tu ritmo con TU propia semana anterior. Mantenerte ya vale 300; mejorar 5% da el máximo.'],
    ['Adherencia al Plan', s.adherencia.pts, CAPS.adherencia,
      `Sesiones del plan cumplidas DENTRO de sus parámetros (${s.adherencia.hechas}/${s.adherencia.total}). Salir a caminar sin cumplirlos no puntúa aquí.`],
    ['Objetivos Completados', s.objetivos.pts, CAPS.objetivos,
      `Desafíos cumplidos (${s.objetivos.hechos}/${s.objetivos.total}).`],
    ['Esfuerzo', s.esfuerzo.pts, CAPS.esfuerzo,
      `Esfuerzo relativo a ti, no ritmo absoluto. Tope en 7/10 — reventarse no da más puntos.`]
  ].map(([n, v, cap, d]) => `
    <div style="margin-bottom:13px">
      <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:5px">
        <b style="font-size:13.5px">${n}</b>
        <span style="font-family:var(--fu);font-weight:700;font-size:13px;color:var(--blue2)">${v} / ${cap}</span>
      </div>
      ${bar(v / cap * 100)}
      <div class="hint" style="margin-top:5px">${d}</div>
    </div>`).join('');

  openModal(`
    <h3>Cómo se calculan tus puntos</h3>
    <div class="msub">PERÍODO: ${PERIOD_LABEL[PERIOD].toUpperCase()} · ${s.total} / 1000</div>
    <div style="font-size:12.5px;line-height:1.6;color:#c3cede;margin-bottom:16px">
      Nada se mide en valores absolutos. Todo se mide contra <b>tu propia línea base</b>.
      Por eso alguien que camina puede ganarle a alguien que corre rápido: no compiten
      por velocidad, compiten por cuánto mejoraron sobre sí mismos.
    </div>
    ${filas}
    <button class="btnw" data-act="close">Entendido</button>`);
}

/* ── hoja de perfil (media pantalla) ──────────────────────── */
function sheetPerfil() {
  const p = ST.profile;
  const chips = tipo => {
    const items = LOOT.filter(i => i.type === tipo && ST.collection[i.id]);
    if (!items.length) return `<div class="hint" style="margin:0">Todavía no tienes ninguno. Abre un cofre.</div>`;
    return `<div class="chips">${items.map(i => `
      <button class="chip ${p[tipo] === i.id ? 'on' : ''}" data-act="pick" data-slot="${tipo}" data-id="${i.id}">
        ${i.em} ${esc(i.name)}</button>`).join('')}</div>`;
  };

  const banners = LOOT.filter(i => i.type === 'banner' && ST.collection[i.id]);
  const listaBanners = banners.length
    ? banners.map(b => `<button class="bpick ${p.banner === b.id ? 'on' : ''}"
        data-act="pick" data-slot="banner" data-id="${b.id}">
        <img src="${bannerSrc(b.banner)}" alt="" loading="lazy">
        <span class="bn">${esc(b.name)}</span>
        <span class="br r-${b.r}">${RARITY[b.r].label}</span>
      </button>`).join('')
    : `<div class="hint" style="margin:0">Todavía no tienes banners. Abre un cofre en la Tienda.</div>`;

  openSheet(`
    <div class="sheetgrab"></div>
    <h3>Editar perfil</h3>
    <div class="msub">FOTO, NOMBRE, BANNER, TÍTULO Y MARCO</div>

    <div class="pedit">
      <div class="pav ${p.frame ? 'f-' + LOOT_BY_ID[p.frame].slug : ''}" style="width:76px;height:76px;flex:0 0 76px;font-size:34px">
        ${caraPerfil()}</div>
      <div style="flex:1;min-width:0">
        <label class="btnw b" style="margin:0;cursor:pointer">
          Cambiar foto<input id="p_file" type="file" accept="image/*" hidden></label>
        ${p.photo ? `<button class="btnw" data-act="quitar-foto" style="margin-top:7px">Quitar foto</button>` : ''}
      </div>
    </div>

    <div class="fld txt" style="margin:12px 0"><div class="fl">TU NOMBRE</div>
      <input id="p_name" value="${esc(p.name)}" maxlength="18"></div>

    <div class="ctitle" style="margin-top:16px">BANNER</div>
    <div class="blist">${listaBanners}</div>

    <div class="ctitle" style="margin-top:16px">TÍTULO</div>
    ${chips('title')}

    <div class="ctitle" style="margin-top:16px">MARCO</div>
    ${chips('frame')}

    <div class="ctitle" style="margin-top:16px">FONDO</div>
    ${chips('background')}

    <div class="mrow2">
      <button class="btnbig b" data-act="guardar-perfil">GUARDAR</button>
      <button class="btnw" style="margin:0" data-act="close">Cerrar</button>
    </div>
    <button class="btnw" style="margin:8px 0 0" data-act="cambiar">⇄ Cambiar de perfil</button>`);

  /* La foto se reduce a 256px antes de guardarse: localStorage aguanta
     unos 5 MB y una foto de cámara sin reducir se lo come entero. */
  $('#p_file').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const lado = Math.min(img.width, img.height);          // recorte cuadrado central
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const x = c.getContext('2d');
        x.imageSmoothingQuality = 'high';
        x.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 256, 256);
        ST.profile.photo = c.toDataURL('image/jpeg', 0.85);
        save();
        const nombre = $('#p_name').value.trim();
        sheetPerfil();
        if (nombre) $('#p_name').value = nombre;
        toast('📸 Foto actualizada');
      };
      img.onerror = () => toast('No pude leer esa imagen');
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  });
}

function modalLogRun() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  openModal(`
    <h3>Registrar actividad</h3>
    <div class="msub">CAMINAR CUENTA IGUAL QUE CORRER</div>

    <div class="fld txt" style="margin-bottom:9px"><div class="fl">TIPO DE ACTIVIDAD</div>
      <div class="chips">
        ${Object.entries(TIPOS).map(([k, v]) =>
          `<button class="chip ${k === TIPO_RUN ? 'on' : ''}" data-act="tipo-run" data-id="${k}">${v.em} ${v.label}</button>`).join('')}
      </div>
    </div>

    <div class="fld txt" style="margin-bottom:9px"><div class="fl">EXTRAS</div>
      <div class="chips">
        <button class="chip ${EXTRA_CARRERA ? 'on' : ''}" data-act="extra-carrera">🏁 Fue una carrera</button>
        <button class="chip ${EXTRA_NEG ? 'on' : ''}" data-act="extra-neg">📉 Negative split</button>
      </div>
      <div class="hint" style="margin-top:6px">Marca lo que aplique — hay retos que solo
        avanzan con estos datos.</div>
    </div>

    <div class="fgrid">
      <div class="fld"><div class="fl">DISTANCE</div><input id="l_dist" type="number" step="0.01" value="3.0"><div class="fu2">${U.distU()}</div></div>
      <div class="fld"><div class="fl">TIME</div><input id="l_time" type="text" value="36:00"><div class="fu2">MM:SS</div></div>
      <div class="fld"><div class="fl">ELEVATION</div><input id="l_elev" type="number" value="80"><div class="fu2">${U.elevU()}</div></div>
      <div class="fld"><div class="fl">AVG HR</div><input id="l_hr" type="number" placeholder="opcional"><div class="fu2">BPM</div></div>
      <div class="fld"><div class="fl">CADENCE</div><input id="l_cad" type="number" placeholder="opcional"><div class="fu2">SPM</div></div>
      <div class="fld"><div class="fl">CUÁNDO</div><input id="l_when" type="datetime-local" value="${local}" style="font-size:12px;font-weight:500"></div>
    </div>
    <div class="mrow2">
      <button class="btnbig b" data-act="save-run">GUARDAR</button>
      <button class="btnw" style="margin:0" data-act="close">Cancelar</button>
    </div>`);
}

/* Fecha de hoy en español, para que se vea en qué día estás parado. */
function fechaHoy() {
  return new Date().toLocaleDateString('es-PR',
    { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

/* ── STANDINGS · tabla de la temporada ────────────────────────
   Todo lo que sale aquí es DERIVADO de las actividades registradas:
   millas del año, cuántas veces salió cada quien y su mejor salida.
   Nadie aparece con números que no se ganó. */
function statsDeAtleta(id) {
  const d = (ST.atletas || {})[id];
  const runs = d ? (d.runs || []).filter(r => !r.manual) : [];
  const desde = D.startOfYear();
  const season = runs.filter(r => new Date(r.start_iso) >= desde);
  return {
    millas: season.reduce((s, r) => s + U.mi(r.distance_m), 0),
    actividades: season.length,
    /* El récord personal: la salida más larga que ha hecho. */
    pr: runs.reduce((m, r) => Math.max(m, r.distance_m), 0),
    ultima: runs.length ? runs.reduce((m, r) =>
      new Date(r.start_iso) > new Date(m.start_iso) ? r : m).start_iso : null
  };
}

function renderStandings() {
  const filas = personas().map(p => ({ ...p, ...statsDeAtleta(p.id) }))
    .sort((a, b) => b.millas - a.millas);
  const lider = filas[0] ? filas[0].millas : 0;
  const medalla = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';

  const cuerpo = filas.map((f, i) => {
    const yo = f.id === ST.quienSoy;
    return `<div class="strow ${yo ? 'me' : ''}">
      <div class="stpos">${medalla(i) || (i + 1)}</div>
      <div class="stav ${f.coach ? 'gm' : ''}">${f.coach ? '★' : esc(f.name.slice(0,1).toUpperCase())}</div>
      <div class="stb">
        <div class="stn">${esc(f.name)}${yo ? ' <i class="yotag">TÚ</i>' : ''}</div>
        <div class="stbar">${bar(lider ? f.millas / lider * 100 : 0)}</div>
        <div class="stsub">${f.actividades} ${f.actividades === 1 ? 'actividad' : 'actividades'} · PR ${f.pr ? U.dist(f.pr,1) + ' ' + U.distU() : '—'}</div>
      </div>
      <div class="stmi"><b>${f.millas.toFixed(1)}</b><span>${U.distU()}</span></div>
    </div>`;
  }).join('');

  const totalMi = filas.reduce((s, f) => s + f.millas, 0);
  const totalAct = filas.reduce((s, f) => s + f.actividades, 0);

  return `
  <img class="stbanner" src="art/standings_banner.jpg" alt="Standings · Season Rankings"
       onerror="this.style.display='none'">
  <div class="sub">${fechaHoy().toUpperCase()}</div>

  <div class="duo">
    <div class="card"><div class="kv"><div class="k">TOTAL DEL EQUIPO</div>
      <div class="v" style="color:var(--green2)">${totalMi.toFixed(1)} <small style="font-size:13px;color:var(--muted)">${U.distU()}</small></div>
      <div class="s">Desde enero</div></div></div>
    <div class="card"><div class="kv"><div class="k">ACTIVIDADES</div>
      <div class="v">${totalAct}</div>
      <div class="s">${filas.length} corredores</div></div></div>
  </div>

  <button class="evt" data-act="go" data-view="competir">
    <div class="ic">⚔️</div>
    <div class="b"><div class="kk" style="color:var(--violet2)">DUELO DE LA SEMANA</div>
      <div class="nn">Improvement League</div>
      <div class="ss">Termina en ${D.until(ligaFin())}</div></div>
    <div class="chev">›</div>
  </button>

  <div class="sect"><h2>TABLA DE LA TEMPORADA</h2>
    <span style="font-family:var(--fu);font-weight:700;font-size:11px;color:var(--muted)">POR MILLAS</span></div>
  ${totalMi > 0
    ? `<div class="sttable">${cuerpo}</div>`
    : `<div class="sttable">${cuerpo}</div>
       <div class="hint" style="text-align:center;margin-top:10px">
         Todavía nadie ha registrado actividades. En cuanto alguien salga, la tabla se ordena sola.
       </div>`}`;
}

/* ── ¿QUIÉN ERES? ─────────────────────────────────────────────
   Antes de nada se elige la persona. El Coach es el GM: existe siempre
   y es el único que puede crear atletas. Sin contraseñas — esto es una
   libreta compartida entre gente que se conoce, no un banco; pedir
   claves aquí solo estorbaría antes de salir a correr. */
function pantallaQuienEres() {
  const gente = personas();
  const tarjeta = p => {
    const datos = (ST.atletas || {})[p.id];
    const sub = p.coach
      ? 'Crea atletas y arma el plan'
      : datos ? `${(datos.runs || []).length} ${(datos.runs||[]).length === 1 ? 'actividad' : 'actividades'}` : 'Primera vez — empieza con 300 💎';
    return `<button class="who ${p.coach ? 'gm' : ''}" data-act="entrar" data-id="${p.id}">
      <div class="wav">${p.coach ? '★' : esc(p.name.slice(0,1).toUpperCase())}</div>
      <div class="wb">
        <div class="wn">${esc(p.name)}${p.coach ? ' <i class="gmtag">GM</i>' : ''}</div>
        <div class="ws">${sub}</div>
      </div>
      <div class="chev">›</div>
    </button>`;
  };

  return `
  <div class="whowrap">
    <img class="wlogo" src="art/logo.png" alt="RUNBOUND" onerror="this.style.display='none'">
    <div class="wtitle">¿QUIÉN ERES?</div>
    <div class="wsub">Escoge tu perfil para entrar</div>
    <div class="wlist">${gente.map(tarjeta).join('')}</div>
    ${gente.length === 1
      ? `<div class="hint" style="text-align:center;margin-top:14px">
           Todavía no hay atletas. Entra como <b style="color:var(--gold2)">Coach</b> y créalos
           en Modo Coach — aparecerán aquí para que cada quien entre con lo suyo.
         </div>`
      : ''}
  </div>`;
}

/* ── SIGN-IN BONUS ────────────────────────────────────────────
   Siete casillas: seis de 100 💎 y la última un cofre gratis.
   El día reclamable brilla; los cobrados se apagan con un ✓.

   En móvil las siete casillas en fila quedarían de ~50px — ilegibles
   con el gema y el número dentro. Por eso van 3×2 y el día 7 a lo
   ancho, que además le da el peso visual que merece. */
/* El bonus se abre SOLO al entrar si hay algo sin reclamar. Dejarlo
   escondido detrás de un toque hacía que pasara desapercibido — que es
   justo lo que reportaste. */
function avisarSignin() {
  if (ST.quienSoy && signinPendiente()) setTimeout(modalSignin, 420);
}

function modalSignin() {
  const s = signinEstado();
  const prox = signinProximo();
  const puedo = signinPendiente();

  const casilla = dia => {
    const premio = signinPremio(dia);
    const cobrado = dia <= s.dia;
    const activo  = puedo && dia === prox;
    const cls = ['sday', premio.cofre ? 'big' : '', cobrado ? 'done' : '', activo ? 'now' : ''].filter(Boolean).join(' ');
    const cara = premio.cofre
      ? `<img src="art/cofre_epico.png" alt="" onerror="this.replaceWith(document.createTextNode('🎁'))">`
      : `<span class="sgem">💎</span>`;
    return `<button class="${cls}" ${activo ? 'data-act="reclamar-signin"' : 'disabled'}>
      <div class="sface">${cara}${cobrado ? '<i class="stick">✓</i>' : ''}</div>
      <div class="samt">${premio.cofre ? 'COFRE' : '+' + premio.shards}</div>
      <div class="slabel">Día ${dia}</div>
    </button>`;
  };

  openModal(`
    <div class="signin">
      <img class="stitle" src="art/signin_title.jpg" alt="Sign-In Bonus"
           onerror="this.replaceWith(Object.assign(document.createElement('h3'),{textContent:'SIGN-IN BONUS'}))">
      <div class="sgrid">${[1,2,3,4,5,6].map(casilla).join('')}</div>
      ${casilla(7)}
      <div class="hint" style="text-align:center;margin-top:10px">
        ${puedo
          ? `Toca el <b style="color:var(--gold2)">Día ${prox}</b> para reclamarlo.`
          : 'Ya reclamaste hoy. Vuelve mañana.'}
        <br>Faltar un día no reinicia la cuenta — son siete días que entraste, no siete seguidos.
      </div>
      <button class="btnw" data-act="close">Cerrar</button>
    </div>`);
}

/* ── Apertura de cofre a pantalla completa ────────────────────
   Toma la pantalla entera: el cofre grande, un destello que crece, y
   el objeto revelado en grande. Tres fases encadenadas por clases; un
   toque en cualquier momento salta al final (para el que tira x10 y no
   quiere ver la animación 10 veces). */
let OPEN_T = [];

function abrirCofre(results, pack) {
  OPEN_T.forEach(clearTimeout); OPEN_T = [];

  const best = results.reduce((b, r) => RARITY[r.item.r].weight < RARITY[b.item.r].weight ? r : b);
  const rar  = best.item.r;
  const news = results.filter(r => r.isNew).length;
  const dust = results.reduce((s, r) => s + r.dust, 0);
  const resto = results.filter(r => r !== best);

  const el = $('#opening');
  el.className = 'opening on fase-a rar-' + rar;
  el.innerHTML = `
    <div class="ostage">
      <div class="oray"></div>
      <div class="ospark">${Array.from({length:14},(_,i)=>`<i style="--a:${i*(360/14)}deg;--d:${i*45}ms"></i>`).join('')}</div>
      <img class="ochest" src="${packImg(pack && pack.img || 'cofre_epico')}" alt=""
           onerror="this.style.display='none'">
      <div class="oflash"></div>
    </div>

    <div class="oout">
      <div class="obadge r-${rar}">${RARITY[rar].label}</div>
      <div class="obig bd-${rar}">${caraLoot(best.item)}</div>
      <div class="oname">${esc(best.item.name)}</div>
      <div class="otype">${TYPE_LABEL[best.item.type]}${best.isNew ? ' · <b class="onew">NUEVO</b>' : ''}</div>
      ${resto.length ? `<div class="orest">${resto.map(r => `
        <div class="rc bd-${r.item.r}">
          ${r.isNew ? '<div class="newtag">NEW</div>' : ''}
          <div class="rimg">${caraLoot(r.item)}</div>
          <div class="rn">${esc(r.item.name)}</div>
        </div>`).join('')}</div>` : ''}
      <div class="osum">${news} nuevo(s) · ${results.length} objeto(s)${
        dust ? ` · duplicados <b style="color:var(--violet2)">+${dust}💎</b>` : ''}</div>
      <div class="obtns">
        <button class="btnbig" data-act="go-cosmeticos">VER COLECCIÓN</button>
        <button class="btnw" style="margin:0" data-act="cerrar-cofre">Cerrar</button>
      </div>
    </div>
    <div class="oskip">toca para saltar</div>`;

  OPEN_T.push(setTimeout(() => el.classList.replace('fase-a', 'fase-b'), 1350));
  OPEN_T.push(setTimeout(() => el.classList.replace('fase-b', 'fase-c'), 1950));

  /* Saltar: cualquier toque fuera de los botones finales adelanta al reveal. */
  el.onclick = ev => {
    if (ev.target.closest('.obtns')) return;
    if (el.classList.contains('fase-c')) return;
    OPEN_T.forEach(clearTimeout); OPEN_T = [];
    el.classList.remove('fase-a', 'fase-b'); el.classList.add('fase-c');
  };
}

function cerrarCofre() {
  OPEN_T.forEach(clearTimeout); OPEN_T = [];
  const el = $('#opening');
  el.classList.remove('on'); el.onclick = null;
  setTimeout(() => { if (!el.classList.contains('on')) el.innerHTML = ''; }, 300);
}

function modalReveal(results) {
  const cards = results.map((r, i) => `
    <div class="rc bd-${r.item.r}" style="animation-delay:${i * 70}ms">
      ${r.isNew ? '<div class="newtag">NEW</div>' : ''}
      <div class="rimg">${r.item.frame
        ? `<img class="fthumb" src="${frameSrc(r.item.frame)}" alt="" onerror="this.style.display='none'">`
        : r.item.banner
        ? `<img class="bthumb" src="${bannerSrc(r.item.banner)}" alt="" onerror="this.style.display='none'">`
        : r.item.art ? artBox(r.item.art, { fb:r.item.em }) : r.item.em}</div>
      <div class="rn">${esc(r.item.name)}</div>
      <div class="rr r-${r.item.r}" style="font-family:var(--fu);font-weight:700;font-size:7.5px;padding-bottom:5px">${RARITY[r.item.r].label}</div>
      ${r.dust ? `<div style="font-family:var(--fu);font-weight:700;font-size:8px;color:var(--gold2);padding-bottom:4px">+${r.dust}💎</div>` : ''}
    </div>`).join('');
  const best = results.reduce((b, r) => RARITY[r.item.r].weight < RARITY[b.item.r].weight ? r : b);
  const news = results.filter(r => r.isNew).length;
  const dust = results.reduce((s, r) => s + r.dust, 0);

  openModal(`
    <div style="text-align:center">
      <h3 style="color:${RARITY[best.item.r].color}">${best.item.r === 'mythic' ? '¡MYTHIC!' : best.item.r === 'epic' ? '¡EPIC!' : 'Cofre abierto'}</h3>
      <div class="msub">${news} NUEVO(S) · ${results.length} OBJETO(S)</div>
      <div class="revgrid">${cards}</div>
      ${dust ? `<div class="hint">Duplicados convertidos: <b style="color:var(--violet2)">+${dust} 💎</b></div>` : ''}
      <div class="mrow2">
        <button class="btnbig" data-act="go-cosmeticos">VER COLECCIÓN</button>
        <button class="btnw" style="margin:0" data-act="close">Cerrar</button>
      </div>
    </div>`);
}

function modalRunDetail(id) {
  const r = ST.runs.find(x => x.id === id); if (!r) return;
  const base = median(paceList(runsBetween(...periodBounds('weekly', 1))));
  openModal(`
    <h3>Actividad</h3>
    <div class="msub">${new Date(r.start_iso).toLocaleString('es-PR')} · ${r.source.toUpperCase()}</div>
    <div class="mets">
      <div class="met"><div class="mv">${U.dist(r.distance_m)}</div><div class="ml">${U.distU()}</div></div>
      <div class="met"><div class="mv">${U.clock(r.moving_s)}</div><div class="ml">TIME</div></div>
      <div class="met"><div class="mv">${U.pace(U.paceSec(r))}</div><div class="ml">/${U.distU()}</div></div>
    </div>
    <div class="mets" style="margin-top:16px">
      <div class="met"><div class="mv">${r.avg_hr || '—'}</div><div class="ml">BPM</div></div>
      <div class="met"><div class="mv">${r.cadence_spm || '—'}</div><div class="ml">SPM</div></div>
      <div class="met"><div class="mv">${effortOf(r, base)}<small> / 10</small></div><div class="ml">EFFORT</div></div>
    </div>
    <button class="btnw" data-act="close">Cerrar</button>`);
}

function modalSource() {
  openModal(`
    <h3>Fuente de datos</h3>
    <div class="msub">FASE 1 · ENTRADA MANUAL</div>
    <div style="font-size:13px;line-height:1.65;color:#c3cede">
      Las actividades entran a mano y todo el progreso se calcula del mismo
      <b>RunRecord</b> que Strava va a llenar después.<br><br>
      Cuando conectemos Strava solo cambia de dónde sale ese objeto —
      ninguna pantalla, desafío ni punto se toca.
    </div>
    <div class="card flat" style="margin-top:14px">
      <div class="ctitle">LO QUE SE LE PEDIRÁ</div>
      <div class="hint" style="margin:0">Distancia · tiempo en movimiento · cadencia (×2) · FC promedio y máxima ·
      elevación. <b>Rutas y GPS no.</b></div>
    </div>
    <button class="btnw" data-act="close">Entendido</button>`);
}

function modalPickChallenge(mode) {
  const list = ST.challenges.filter(c => c.by === 'trainer');
  if (!list.length) { toast('No hay desafíos de coach'); return; }
  openModal(`
    <h3>${mode === 'del' ? 'Borrar' : 'Editar'} desafío</h3>
    <div class="msub">SOLO LOS QUE TÚ CREASTE</div>
    ${list.map(c => `<button class="chal" style="width:100%;text-align:left"
      data-act="${mode === 'del' ? 'del-ch' : 'edit-ch'}" data-id="${c.id}">
      <div class="cb"><div style="font-family:var(--fu);font-weight:700;font-size:9.5px;letter-spacing:1.3px;color:var(--blue2)">
        ${PERIOD_LABEL[c.period].toUpperCase()}</div>
        <div class="cn">${esc(c.name)}</div><div class="cd" style="margin:0">${esc(c.desc)}</div></div>
      <div class="icob ${mode === 'del' ? 'del' : 'ed'}">${mode === 'del' ? '🗑️' : '✏️'}</div>
    </button>`).join('')}
    <button class="btnw" data-act="close">Cancelar</button>`);
}

/* ═══ ACCIONES ════════════════════════════════════════════ */
function parseClock(s) {
  const p = String(s).split(':').map(Number);
  if (p.length === 3) return p[0]*3600 + p[1]*60 + p[2];
  if (p.length === 2) return p[0]*60 + p[1];
  return Number(s) || 0;
}
function parsePace(s) { const m = String(s).match(/(\d+)\D+(\d+)/); return m ? +m[1]*60 + +m[2] : 0; }

/* ── Paces del coach, de 30 en 30 segundos ────────────────────
   Escribir 12'00" a mano invita a erratas y a paces raros. La lista va
   de 6:00 a 22:00 porque el rango tiene que cubrir desde quien corre
   fuerte hasta quien camina — RUNBOUND no es solo para corredores.
   El `value` son SEGUNDOS, así no hay que parsear nada al guardar. */
const PACE_MIN = 6 * 60, PACE_MAX = 22 * 60, PACE_PASO = 30;
const PACE_DEFECTO = 12 * 60;
const PACE_OPCIONES = (() => {
  const out = [];
  for (let s = PACE_MIN; s <= PACE_MAX; s += PACE_PASO) out.push(s);
  return out;
})();
function selectPace(sel = PACE_DEFECTO) {
  /* Un pace guardado que no caiga en la rejilla se acerca al más próximo. */
  const cerca = PACE_OPCIONES.reduce((a, b) => Math.abs(b - sel) < Math.abs(a - sel) ? b : a);
  return PACE_OPCIONES.map(s =>
    `<option value="${s}"${s === cerca ? ' selected' : ''}>${U.pace(s)}</option>`).join('');
}

/* Tiempo = distancia × pace. Se recalcula al mover cualquiera de los dos,
   pero el campo sigue editable: un coach puede querer "30 minutos" sin
   fijar distancia, y bloquearlo se lo impediría. */
function recalcTiempo() {
  const d = Number($('#f_dist') && $('#f_dist').value);
  const p = Number($('#f_pace') && $('#f_pace').value);
  const campo = $('#f_time');
  if (!campo || !d || !p) return;
  campo.value = U.clock(d * p);
  const nota = $('#f_timecalc');
  if (nota) nota.textContent = `${d} ${U.distU().toLowerCase()} × ${U.pace(p)}`;
}
const toM = v => Number(v) * (ST.settings.units === 'mi' ? M_PER_MI : 1000);
const toElevM = v => Number(v) / (ST.settings.units === 'mi' ? 3.28084 : 1);

const TYPE_GOAL_LABEL = {
  distance:'distancia', single_distance:'una actividad larga', runs:'cantidad de actividades',
  pace:'ritmo', elevation:'elevación', streak:'actividades completadas', cadence:'cadencia',
  hr:'zona de frecuencia cardiaca', time:'tiempo en movimiento', session:'sesión del plan'
};
const HR_ZONES = { Z2:[110,135], Z3:[135,155], Z4:[155,172], Z5:[172,195] };

function saveRun() {
  const dist = toM($('#l_dist').value), time = parseClock($('#l_time').value);
  if (!dist || !time) { toast('Falta distancia o tiempo'); return; }
  addRun({
    distance_m:dist, moving_s:time, elapsed_s:time,
    elev_m:toElevM($('#l_elev').value || 0),
    avg_hr:Number($('#l_hr').value) || null,
    cadence_spm:Number($('#l_cad').value) || null,
    start_iso:new Date($('#l_when').value || Date.now()).toISOString(),
    source:'manual',
    tipo:TIPO_RUN, carrera:EXTRA_CARRERA, negSplit:EXTRA_NEG
  });
  /* Los extras se limpian: son de esa actividad, no del formulario. */
  TIPO_RUN = 'run'; EXTRA_CARRERA = false; EXTRA_NEG = false;
  closeModal(); render();
  toast('✅ Actividad registrada — puntos actualizados');
}

function saveChallenge() {
  const name = $('#f_name').value.trim() || 'Desafío sin nombre';
  const type = $('#f_goal').value, xp = Number($('#f_xp').value) || 250;
  const goal = { type }; let target; let PARAMS = null;
  switch (type) {
    case 'pace':      target = Number($('#f_pace').value); break;
    case 'elevation': target = toElevM($('#f_elev').value); break;
    case 'time':      target = parseClock($('#f_time').value); break;
    case 'runs': case 'streak': target = Number($('#f_dist').value) || 1; break;
    case 'cadence':   target = Number($('#f_dist').value) || 170; break;
    case 'hr': {
      const z = HR_ZONES[$('#f_hr').value];
      if (!z) { toast('Escoge una zona FC'); return; }
      goal.min = z[0]; goal.max = z[1]; target = Number($('#f_dist').value) || 1; break;
    }
    case 'session': {
      /* Los campos del formulario se convierten en parámetros reales que
         la actividad tiene que cumplir. Solo se guardan los que llenó. */
      const p = {};
      const d = Number($('#f_dist').value), t = parseClock($('#f_time').value);
      const e = Number($('#f_elev').value), pc = Number($('#f_pace').value);
      if (d)  p.dist_m  = toM(d);
      if (t)  p.minutes = Math.round(t / 60);
      if (e)  p.elev_m  = toElevM(e);
      if (pc) p.paceMax = pc;
      const z = HR_ZONES[$('#f_hr').value];
      if (z) { p.hrMin = z[0]; p.hrMax = z[1]; }
      if (!Object.keys(p).length) { toast('Llena al menos un parámetro'); return; }
      PARAMS = p; target = 1;
      break;
    }
    default: target = toM($('#f_dist').value);
  }
  if (!target) { toast('Esa meta necesita un valor'); return; }
  goal.target = target;

  const exp = { daily:1, weekly:7, monthly:30, yearly:365 }[TRAINER_TAB];
  const ch = {
    id: EDITING || 'c_t' + Math.random().toString(36).slice(2, 8),
    period:TRAINER_TAB, name, desc:$('#f_desc').value.trim() || (TYPE_GOAL_LABEL[type] ? `Meta de ${TYPE_GOAL_LABEL[type]}` : 'Sesión asignada por tu coach'),
    goal, params:PARAMS, xp, shards:Math.round(xp/5), by:'trainer',
    para: PARA.slice(),
    dia: TRAINER_TAB === 'daily' ? DIA_SEL : null,
    expires:new Date(Date.now() + exp*864e5).toISOString()
  };
  if (EDITING) {
    const i = ST.challenges.findIndex(c => c.id === EDITING);
    ST.challenges[i] = { ...ST.challenges[i], ...ch };
    toast('💾 Desafío actualizado');
  } else { ST.challenges.push(ch); toast('✦ Desafío creado y asignado'); }
  EDITING = null; PARA = []; DIA_SEL = null; save(); render();
}

function editChallenge(id) {
  const c = ST.challenges.find(x => x.id === id); if (!c) return;
  closeModal(); EDITING = id; TRAINER_TAB = c.period;
  /* Recuperar a quién iba y qué día, si no editar borraría la asignación. */
  PARA = (c.para || []).slice();
  DIA_SEL = (c.dia == null) ? null : c.dia;
  VIEW = 'trainer'; render();
  $('#f_name').value = c.name; $('#f_desc').value = c.desc;
  $('#f_goal').value = c.goal.type; $('#f_xp').value = c.xp;
  if (c.goal.type === 'pace') $('#f_pace').innerHTML = selectPace(c.goal.target);
  if (c.params && c.params.paceMax) $('#f_pace').innerHTML = selectPace(c.params.paceMax);
  else if (c.goal.type === 'elevation') $('#f_elev').value = U.elev(c.goal.target);
  else if (['runs','streak','cadence','hr'].includes(c.goal.type)) $('#f_dist').value = c.goal.target;
  else $('#f_dist').value = U.dist(c.goal.target);
  toast('Editando: ' + c.name);
}

function delChallenge(id) {
  const c = ST.challenges.find(x => x.id === id); if (!c) return;
  ST.challenges = ST.challenges.filter(x => x.id !== id);
  delete ST.claimed[id]; save(); closeModal(); render();
  toast('🗑️ Borrado: ' + c.name);
}

function doPull(packId) {
  const pack = PACKS.find(p => p.id === packId); if (!pack) return;
  if (ST.profile.shards < pack.cost) { toast('No tienes suficientes shards'); return; }
  const out = openPack(pack);
  if (out.error) { toast('No tienes suficientes shards'); return; }
  /* La pantalla de apertura arranca de una: la animación ES la espera. */
  abrirCofre(out.results, pack);
  render();
}

/* ═══ RENDER ══════════════════════════════════════════════ */

function showLoginScreen() {
  if (!CURRENT_USER) {
    const html = `
      <div style="text-align:center;padding:40px 24px">
        <img src="art/logo.png" alt="RUNBOUND" style="width:min(70vw,280px);margin-bottom:30px">
        <h2 style="margin-bottom:8px">RUNBOUND</h2>
        <p style="color:var(--muted);margin-bottom:30px">Fantasy de correr · Gamificado</p>
        <button class="btnbig" data-act="login-anon" style="width:100%;margin-bottom:12px">
          Jugar Como Invitado
        </button>
        <div class="hint" style="font-size:12px">Los datos se guardan en la nube.<br>Puedes jugar desde cualquier dispositivo.</div>
      </div>
    `;
    openModal(html);
  }
}

const TITLES = {
  inicio:null, desafios:'CHALLENGES', competir:'IMPROVEMENT LEAGUE',
  entrenamiento:'TRAINING', tienda:'REWARDS SHOP', trainer:'COACH MODE', standings:'STANDINGS'
};

function renderTop() {
  const ready = misRetos().some(c => evalChallenge(c).done && !ST.claimed[c.id]);
  const t = TITLES[VIEW];
  const back = (VIEW === 'trainer');
  return `
    <button class="topbtn" data-act="${back ? 'go' : (soyCoach() ? 'menu' : 'cambiar')}" ${back ? 'data-view="entrenamiento"' : ''}>${back ? '‹' : (soyCoach() ? '☰' : '⇄')}</button>
    ${t ? `<div class="screenttl">${t}</div>` : '<div class="brand">RUNBOUND</div>'}
    <button class="wallet" data-act="go" data-view="tienda">
      <span class="s">💎 ${U.n(ST.profile.shards)}</span><i></i>
      <span class="c">🏃 ${U.n(millasDisponibles())}</span></button>
    <button class="topbtn" data-act="log">+${ready ? '<i class="pip"></i>' : ''}</button>`;
}

function renderNav() {
  const ready = misRetos().some(c => evalChallenge(c).done && !ST.claimed[c.id]);
  $('#nav').innerHTML = NAV.map(n => `
    <button class="${VIEW === n.id ? 'on' : ''}" data-act="go" data-view="${n.id}">
      ${n.id === 'desafios' && ready ? '<i class="pip"></i>' : ''}
      <span class="ni">${n.ic}</span><span class="nl">${n.label}</span>
    </button>`).join('');
}

function render() {
  /* Sin perfil elegido no hay app: ni topbar ni nav, solo la pregunta.
     Pintar el resto significaría enseñar datos de nadie. */
  if (!ST.quienSoy) {
    $('#topbar').innerHTML = '';
    $('#screens').innerHTML = `<div class="screen on">${pantallaQuienEres()}</div>`;
    $('#nav').innerHTML = '';
    document.body.style.backgroundImage = '';
    return;
  }

  const map = { inicio:renderInicio, desafios:renderDesafios, competir:renderCompetir,
                standings:renderStandings,
                entrenamiento:renderEntrenamiento, tienda:renderTienda, trainer:renderTrainer };
  /* Modo Coach es solo del GM: si un atleta llega ahí, se le manda a Home. */
  if (VIEW === 'trainer' && !soyCoach()) VIEW = 'inicio';
  $('#topbar').innerHTML = renderTop();
  $('#screens').innerHTML = `<div class="screen on">${(map[VIEW] || renderInicio)()}</div>`;
  renderNav();

  const b = ST.profile.background ? LOOT_BY_ID[ST.profile.background] : null;
  document.body.style.backgroundImage = !b ? ''
    : b.art ? `linear-gradient(rgba(7,11,20,.93),rgba(7,11,20,.96)), url("${artSrc(b.art)}")`
            : `${b.css}`;
  document.body.style.backgroundSize = (b && b.art) ? 'cover' : '';
  window.scrollTo({ top:0, behavior:'instant' });
}

/* ═══ EVENTOS ═════════════════════════════════════════════ */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const a = t.dataset.act, id = t.dataset.id;
  switch (a) {
    case 'go':      VIEW = t.dataset.view; render(); break;
    case 'period':  PERIOD = t.dataset.tab; render(); break;
    case 'ctab':    CHAL_TAB = t.dataset.tab; render(); break;
    case 'stab':    SHOP_TAB = t.dataset.tab; render(); break;
    case 'itab':    INV_TAB = t.dataset.tab; render(); break;
    case 'ttab':    TRAINER_TAB = t.dataset.tab; render(); break;
    case 'para': {
      /* "Todos" es la ausencia de destinatarios, no un id más. */
      if (!id) PARA = [];
      else PARA = PARA.includes(id) ? PARA.filter(x => x !== id) : [...PARA, id];
      render(); break;
    }
    case 'diasel':  DIA_SEL = id === '' ? null : Number(id); render(); break;
    case 'signin':   modalSignin(); break;
    case 'reclamar-signin': {
      const r = reclamarSignin();
      if (!r.ok) { toast(r.msg); break; }
      if (r.cofre) {
        /* El día 7 abre un Paquete Básico sin cobrar shards. */
        closeModal();
        const pack = PACKS.find(p => p.id === 'basico');
        const out = openPack(pack, { gratis:true });
        abrirCofre(out.results, pack);
        render();
      } else {
        modalSignin(); render();
        toast(`✦ Día ${r.dia} · +${r.shards} 💎`);
      }
      break;
    }
    case 'add-atleta': {
      const inp = $('#a_name');
      const r = addAtleta(inp ? inp.value : '');
      if (!r.ok) { toast(r.msg); break; }
      render(); toast(`✅ ${esc(r.name)} añadido`);
      break;
    }
    case 'del-atleta': delAtleta(id); render(); toast('Atleta quitado'); break;
    case 'login-anon':
      if (typeof auth === 'function') {
        auth().signInAnonymously().catch(err => toast('Error: ' + err.message));
      }
      break;
    case 'signin':   modalSignin(); break;
    case 'reclamar-signin': {
      const r = reclamarSignin();
      if (!r.ok) { toast(r.msg); break; }
      if (r.cofre) {
        /* El día 7 abre un Paquete Básico sin cobrar shards. */
        closeModal();
        const pack = PACKS.find(p => p.id === 'basico');
        const out = openPack(pack, { gratis:true });
        abrirCofre(out.results, pack);
        render();
      } else {
        modalSignin(); render();
        toast(`✦ Día ${r.dia} · +${r.shards} 💎`);
      }
      break;
    }
    case 'add-atleta': {
      const inp = $('#a_name');
      const r = addAtleta(inp ? inp.value : '');
      if (!r.ok) { toast(r.msg); break; }
      render(); toast(`✅ ${esc(r.name)} añadido`);
      break;
    }
    case 'del-atleta': delAtleta(id); render(); toast('Atleta quitado'); break;
    case 'login-anon':
      if (typeof auth === 'function') {
        auth().signInAnonymously().catch(err => toast('Error: ' + err.message));
      }
      break;
    case 'go-cosmeticos': closeModal(); cerrarCofre(); VIEW = 'tienda'; SHOP_TAB = 'cosmeticos'; render(); break;
    case 'cerrar-cofre':  cerrarCofre(); render(); break;
    case 'buy-mile': {
      const r = comprarConMillas(id);
      if (!r.ok) { toast(r.msg); break; }
      render();
      toast(`✅ ${esc(r.item.name)} comprado · −${r.precio} 🏃`);
      break;
    }
    case 'menu':    VIEW = 'trainer'; render(); break;
    case 'entrar':  entrarComo(id); VIEW = 'inicio'; render(); avisarSignin(); break;
    case 'cambiar': salirDePerfil(); closeModal(); render(); break;
    case 'log':     modalLogRun(); break;
    case 'perfil':  sheetPerfil(); break;
    case 'explica': modalExplica(); break;
    case 'pick': {
      const slot = t.dataset.slot;
      ST.profile[slot] = ST.profile[slot] === id ? null : id;
      save();
      const nombre = $('#p_name') ? $('#p_name').value.trim() : null;
      sheetPerfil();
      if (nombre) $('#p_name').value = nombre;
      break;
    }
    case 'quitar-foto':
      ST.profile.photo = null; save(); sheetPerfil(); toast('Foto quitada'); break;
    case 'guardar-perfil': {
      const n = $('#p_name').value.trim();
      if (n) ST.profile.name = n;
      save(); closeModal(); render(); toast('✅ Perfil guardado');
      break;
    }
    case 'source':  modalSource(); break;
    case 'claim': {
      const c = claim(id);
      if (c) { render(); toast(`✦ +${U.n(c.xp)} XP · +${c.shards} 💎`); }
      break;
    }
    case 'equip': {
      if (!ST.collection[id]) { toast('Todavía no tienes ese objeto'); break; }
      equip(id); render();
      toast(ST.profile[LOOT_BY_ID[id].type] === id ? '✅ Equipado' : 'Quitado');
      break;
    }
    case 'pull':       doPull(t.dataset.pack); break;
    case 'run-detail': modalRunDetail(id); break;
    case 'save-run':   saveRun(); break;
    case 'save-ch':    saveChallenge(); break;
    case 'pick-ch':    modalPickChallenge('edit'); break;
    case 'del-pick':   modalPickChallenge('del'); break;
    case 'edit-ch':    editChallenge(id); break;
    case 'del-ch':     delChallenge(id); break;
    case 'clear-ch':   EDITING = null; PARA = []; DIA_SEL = null; render(); toast('Formulario limpio'); break;
    case 'tocar-sesion': sheetSesion(id); break;
    case 'preset': {
      const p = PRESETS.find(x => x.id === id); if (!p) break;
      if (ST.challenges.some(c => c.id === p.id)) {
        ST.challenges = ST.challenges.filter(c => c.id !== p.id);
        delete ST.claimed[p.id];
        save(); render(); toast('Quitado: ' + p.name);
        break;
      }
      const fin = { weekly:'eow', monthly:'eom' }[p.period];
      const d = new Date();
      const expira = fin === 'eow'
        ? (() => { const x = D.startOfWeek(); x.setDate(x.getDate() + 7); return x.toISOString(); })()
        : new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
      ST.challenges.push({
        id:p.id, period:p.period, name:p.name, desc:p.desc,
        goal:{ ...p.goal }, params:p.params || null,
        xp:p.xp, shards:p.shards, by:'trainer',
        para:PARA.slice(), dia:null, expires:expira
      });
      save(); render(); toast('✦ Añadido: ' + p.name);
      break;
    }
    case 'tipo-run':     TIPO_RUN = id; modalLogRun(); break;
    case 'extra-carrera':EXTRA_CARRERA = !EXTRA_CARRERA; modalLogRun(); break;
    case 'extra-neg':    EXTRA_NEG = !EXTRA_NEG; modalLogRun(); break;
    case 'mover-sesion': {
      const c = ST.challenges.find(x => x.id === id); if (!c) break;
      const d = t.dataset.dia;
      c.dia = d === '' ? null : Number(d);
      save(); closeModal(); render();
      toast(c.dia == null ? `${esc(c.name)} → todos los días` : `${esc(c.name)} → ${DIAS_LARGO[c.dia]}`);
      break;
    }
    case 'close':      closeModal(); break;
  }
});

$('#ov').addEventListener('click', e => { if (e.target.id === 'ov') closeModal(); });

/* Delegado en document a propósito: render() reconstruye el formulario
   entero, así que un listener puesto sobre los campos moriría al primer
   repintado. */
document.addEventListener('input',  e => { if (e.target.id === 'f_dist' || e.target.id === 'f_pace') recalcTiempo(); });
document.addEventListener('change', e => { if (e.target.id === 'f_pace') recalcTiempo(); });
/* Boot se hace en el HTML, en el listener de Firebase. */
