/* ═══════════════════════════════════════════════════════════
   RUNBOUND · Capa de datos
   ───────────────────────────────────────────────────────────
   TODO lo que la app muestra sale de un RunRecord. Esa forma
   es el contrato: cuando entre Strava, lo único que se escribe
   es un traductor Strava→RunRecord y se cambia `source`.
   Nada más en la app tiene que enterarse.

   RunRecord {
     id            string
     distance_m    number   metros            (Strava: distance)
     moving_s      number   segundos          (Strava: moving_time)
     elapsed_s     number   segundos          (Strava: elapsed_time)
     avg_hr        number|null  bpm           (Strava: average_heartrate)
     max_hr        number|null  bpm           (Strava: max_heartrate)
     cadence_spm   number|null  pasos/min     (Strava: average_cadence × 2 ← ojo)
     elev_m        number   metros            (Strava: total_elevation_gain)
     start_iso     string   ISO local         (Strava: start_date_local)
     tz            string   IANA              (Strava: timezone)
     source        'manual'|'strava'
     external_id   string|null                (Strava: activity id)
     manual        bool     subida a mano en Strava → no cuenta
   }
   ═══════════════════════════════════════════════════════════ */

const M_PER_MI = 1609.344;
const KEY = 'runbound.v1';

/* ── conversión / formato ─────────────────────────────────── */
const U = {
  mi: m => m / M_PER_MI,
  km: m => m / 1000,
  ft: m => m * 3.28084,
  dist(m, d = 2) { return (ST.settings.units === 'mi' ? U.mi(m) : U.km(m)).toFixed(d); },
  distU() { return ST.settings.units === 'mi' ? 'MI' : 'KM'; },
  elev(m) { return ST.settings.units === 'mi' ? Math.round(U.ft(m)) : Math.round(m); },
  elevU() { return ST.settings.units === 'mi' ? 'FT' : 'M'; },
  /* pace en segundos por unidad de distancia */
  paceSec(r) {
    const d = ST.settings.units === 'mi' ? U.mi(r.distance_m) : U.km(r.distance_m);
    return d > 0 ? r.moving_s / d : 0;
  },
  pace(sec) {
    if (!sec || !isFinite(sec)) return '--';
    const m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return m + "'" + String(s).padStart(2, '0') + '"';
  },
  clock(s) {
    s = Math.round(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(ss).padStart(2, '0');
  },
  n(x) { return Math.round(x).toLocaleString('en-US'); }
};

/* ── fechas (día local del atleta) ────────────────────────── */
const D = {
  key: d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); },
  today: () => D.key(new Date()),
  startOfWeek(d = new Date()) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; },
  startOfMonth: (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1),
  startOfYear: (d = new Date()) => new Date(d.getFullYear(), 0, 1),
  /* Una fecha "2026-05-18" se parsea como medianoche UTC y en PR (UTC-4)
     retrocede un día. Se fuerza a medianoche LOCAL. */
  parse(d) { return (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) ? new Date(d + 'T00:00:00') : new Date(d); },
  fmt(d) { return D.parse(d).toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(); },
  until(iso) {
    const ms = new Date(iso) - new Date();
    if (ms <= 0) return 'AHORA';
    const dd = Math.floor(ms / 864e5), hh = Math.floor(ms % 864e5 / 36e5), mm = Math.floor(ms % 36e5 / 6e4);
    return dd ? `${dd}D ${hh}H` : hh ? `${hh}H ${mm}M` : `${mm}M`;
  }
};

/* ── estado ───────────────────────────────────────────────── */
let ST = null;

function newRun(o = {}) {
  return {
    id: o.id || 'r' + Math.random().toString(36).slice(2, 10),
    distance_m: o.distance_m || 0,
    moving_s: o.moving_s || 0,
    elapsed_s: o.elapsed_s || o.moving_s || 0,
    avg_hr: o.avg_hr ?? null,
    max_hr: o.max_hr ?? null,
    cadence_spm: o.cadence_spm ?? null,
    elev_m: o.elev_m || 0,
    start_iso: o.start_iso || new Date().toISOString(),
    tz: o.tz || Intl.DateTimeFormat().resolvedOptions().timeZone,
    source: o.source || 'manual',
    external_id: o.external_id || null,
    manual: !!o.manual
  };
}

/* ── generador determinista de historial ──────────────────── */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function seedRuns() {
  const rnd = mulberry32(20260828);
  const runs = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = D.startOfYear();
  const days = Math.round((today - start) / 864e5);

  for (let i = days; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const recent = i < 12;                       // streak de 12 días
    if (!recent && rnd() > 0.42) continue;       // ~3 runs/semana antes de eso

    const long = rnd() > 0.82;
    const mi = long ? 3.4 + rnd() * 2.4 : 1.4 + rnd() * 1.7;
    /* Perfil de alguien que empieza: mezcla de caminata y trote, con una
       tendencia LEVE de mejora hacia el presente (~1.5% por mes). Es lo que
       hace que el sistema de mejora personal tenga algo que medir. */
    const meses = 1 - (days - i) / days * 0.07;          // mejora lenta de fondo
    const reciente = i < 21 ? 1 - (21 - i) / 21 * 0.05 : 1; // últimas 3 semanas más marcadas
    const tendencia = meses * reciente;
    const paceSec = ((long ? 960 : 880) + rnd() * 200) * tendencia;   // seg/milla
    const dist = mi * M_PER_MI;
    const moving = mi * paceSec;
    const hasHr = rnd() > 0.18;
    d.setHours(6, 15 + Math.floor(rnd() * 40), 0, 0);

    runs.push(newRun({
      distance_m: dist,
      moving_s: moving,
      elapsed_s: moving * (1 + rnd() * 0.08),
      avg_hr: hasHr ? Math.round(138 + rnd() * 24) : null,
      max_hr: hasHr ? Math.round(168 + rnd() * 18) : null,
      cadence_spm: rnd() > 0.25 ? Math.round(160 + rnd() * 16) : null,
      elev_m: (long ? 60 : 22) + rnd() * 70,
      start_iso: d.toISOString(),
      source: 'manual'
    }));
  }
  return runs.sort((a, b) => new Date(b.start_iso) - new Date(a.start_iso));
}

/* ── retos por defecto ────────────────────────────────────── */
function seedChallenges() {
  const eod = () => { const d = new Date(); d.setHours(23, 59, 59, 0); return d.toISOString(); };
  const eow = () => { const d = D.startOfWeek(); d.setDate(d.getDate() + 7); return d.toISOString(); };
  const eom = () => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString();
  const eoy = () => new Date(new Date().getFullYear() + 1, 0, 1).toISOString();

  /* Ninguno pide velocidad absoluta — se puede completar TODO caminando.
     Pero tampoco hay puntos por "salir de la casa": lo que puntúa fuerte
     son las SESIONES del plan (`by:'plan'` / `by:'trainer'`), que exigen
     cumplir parámetros concretos. Los `by:'system'` son metas de volumen. */
  return [
    /* ── sesiones del plan (Adherencia) ─────────────────── */
    { id:'s_suave', period:'daily', name:'Easy Run', desc:'Ritmo cómodo, sin prisa',
      goal:{ type:'session', target:1 },
      params:{ dist_m: 2.2 * M_PER_MI, minutes: 30, hrMin: 105, hrMax: 145 },
      xp:600, shards:70, by:'plan', expires:eod() },
    { id:'s_cuesta', period:'weekly', name:'Hill Repeats', desc:'Busca subida y aguanta',
      goal:{ type:'session', target:2 },
      params:{ dist_m: 2 * M_PER_MI, elev_m: 250 / 3.28084 },
      xp:1400, shards:180, by:'plan', expires:eow() },
    { id:'s_larga',  period:'weekly', name:'Long Run', desc:'Una sola sesión, 50 minutos',
      goal:{ type:'session', target:1 },
      params:{ minutes: 50, dist_m: 3 * M_PER_MI },
      xp:1600, shards:200, by:'plan', expires:eow() },

    /* ── metas de volumen (Objetivos) ───────────────────── */
    { id:'c_dist',   period:'daily', name:'Daily Distance', desc:'Acumula 2.5 millas hoy',
      goal:{ type:'distance', target:2.5 * M_PER_MI }, xp:500, shards:50, by:'system', expires:eod() },
    { id:'c_time',   period:'daily', name:'Time on Feet', desc:'30 minutos en movimiento',
      goal:{ type:'time', target:1800 }, xp:500, shards:60, by:'system', expires:eod() },
    { id:'c_peak',   period:'daily', name:'Elevation Gain', desc:'Sube 200 ft de elevación',
      goal:{ type:'elevation', target:200 / 3.28084 }, xp:750, shards:75, by:'system', expires:eod() },
    { id:'c_streak', period:'daily', name:'7-Day Streak', desc:'Muévete 7 días seguidos',
      goal:{ type:'streak', target:7 }, xp:400, shards:40, by:'system', expires:eod() },

    { id:'c_wdist',  period:'weekly', name:'Weekly Volume', desc:'Acumula 10 millas esta semana',
      goal:{ type:'distance', target:10 * M_PER_MI }, xp:1200, shards:150, by:'system', expires:eow() },
    { id:'c_wruns',  period:'weekly', name:'Active Days', desc:'5 actividades esta semana',
      goal:{ type:'runs', target:5 }, xp:900, shards:110, by:'system', expires:eow() },
    { id:'c_hill',   period:'weekly', name:'Hill Work', desc:'600 ft de subida acumulados',
      goal:{ type:'elevation', target:600 / 3.28084 }, xp:500, shards:80, by:'trainer', expires:eow() },

    { id:'c_mile',   period:'monthly', name:'Monthly Goal', desc:'40 millas en el mes',
      goal:{ type:'distance', target:40 * M_PER_MI }, xp:2000, shards:300, by:'trainer', expires:eom() },
    { id:'c_long',   period:'monthly', name:'Long Effort', desc:'Una sola salida de 6 millas',
      goal:{ type:'single_distance', target:6 * M_PER_MI }, xp:1800, shards:250, by:'system', expires:eom() },

    { id:'c_year',   period:'yearly', name:'Yearly Goal', desc:'400 millas en el año',
      goal:{ type:'distance', target:400 * M_PER_MI }, xp:10000, shards:2000, by:'system', expires:eoy() },
    { id:'c_yhr',    period:'yearly', name:'Zone 2 Base', desc:'50 actividades en zona Z2–Z3',
      goal:{ type:'hr', target:50, min:110, max:155 }, xp:3000, shards:400, by:'system', expires:eoy() }
  ];
}

function seedArchive() {
  const y = new Date().getFullYear();
  /* `tint` ajusta la lámina al color del boss (el archivo de SOVEREIGN
     no tiene nada azul, así que el Frost Titan se logra rotando el matiz). */
  return [
    { id:'b1', name:'Infernal Colossus', loc:'Blazing Canyon', em:'🔥', art:'lionheart_titan',
      tint:'saturate(1.35) hue-rotate(-12deg)', bg:'linear-gradient(135deg,#3b1108,#8c2d0d)',
      dist_m:5000, time_s:1427, place:1, date:`${y}-05-18`, pr:true },
    { id:'b2', name:'Frost Titan', loc:'Glacial Pass', em:'❄️', art:'king_wolf',
      tint:'hue-rotate(165deg) saturate(1.5) brightness(1.12)', bg:'linear-gradient(135deg,#0a1f3d,#1d5fa8)',
      dist_m:5000, time_s:1531, place:2, date:`${y}-04-12`, pr:false },
    { id:'b3', name:'Venom Serpent', loc:'Jungle Depths', em:'🐍', art:'warden_of_dead',
      tint:'hue-rotate(55deg) saturate(1.5)', bg:'linear-gradient(135deg,#0d2b12,#2f7a1f)',
      dist_m:5000, time_s:1602, place:3, date:`${y}-03-09`, pr:false }
  ];
}

const UPCOMING = {
  id:'boss_wyrm', name:'Shadow Wyrm', sub:'THE ENDLESS ASCENT', em:'🐉',
  art:'fenrir', artScene:'grave_mist',
  blurb:'Conquista la montaña. Derrota al Wyrm. Prueba tu resistencia.',
  dist_m:5000, cost:300,
  starts: new Date(Date.now() + (2 * 864e5) + (14 * 36e5)).toISOString()
};

const RIVALS = [
  { name:'Vertex',      em:'🦅' }, { name:'AstraRunner', em:'🌟' },
  { name:'SwiftStride', em:'⚡' }, { name:'Trailblazer', em:'🔥' },
  { name:'NightOwl',    em:'🦉' }
];

/* ── store ────────────────────────────────────────────────── */
function fresh() {
  return {
    /* bonusXp = el historial anterior a la app.
       hrMax/hrRest son TUYAS: el esfuerzo se calcula con reserva cardiaca
       (Karvonen), que ya es relativa a la persona. Sin esto, un pulso de
       150 lpm significaría lo mismo para todo el mundo, y no es así. */
    profile: { name:'Ana', shards:1240, millasGastadas:0, bonusXp:32200,
               hrMax:188, hrRest:58,
               title:null, avatar:null, frame:null, background:null,
               tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
    runs: seedRuns(),
    challenges: seedChallenges(),
    archive: seedArchive(),
    claimed: {},
    collection: {},            // { lootId: cantidad }
    gacha: { pulls:0, sinceEpic:0, sinceMythic:0 },
    season: { name:'Season of Ascent', points:12680, target:20000, level:27,
              nextAt:15000, nextReward:'Ascender Frame',
              ends: new Date(Date.now() + 24 * 864e5).toISOString() },
    /* La semanal se deriva de la mensual (4.33 semanas/mes) para que las
       dos barras no se contradigan nunca. */
    goals: { weekly: 18 * M_PER_MI, monthly: 78 * M_PER_MI, yearly: 500 * M_PER_MI },
    settings: { units:'mi', trainerMode:false },
    log: []
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { ST = JSON.parse(raw); if (!ST.profile) ST = fresh(); }
    else ST = fresh();
  } catch (e) { ST = fresh(); }
  return ST;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (e) {} }
function reset() { localStorage.removeItem(KEY); ST = fresh(); }
