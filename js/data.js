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
    manual: !!o.manual,
    /* Datos que piden los retos nuevos. Todos opcionales: una actividad
       vieja sin ellos sigue valiendo, solo no cuenta para esos retos. */
    tipo: o.tipo || 'run',        // run | walk | strength | bike | swim | other
    carrera: !!o.carrera,         // fue una carrera oficial
    negSplit: !!o.negSplit        // segunda mitad más rápida que la primera
  };
}

/* ── generador determinista (lo usa el rival de la Liga) ─── */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ── retos por defecto ────────────────────────────────────── */
/* Sin retos de fábrica. El plan lo arma el coach: los que había
   (Easy Run, Activity Streak, Weekly Volume…) eran ejemplos míos y se
   mezclaban con los suyos sin poder distinguirlos. */
function seedChallenges() {
  return [];
}

const UPCOMING = {
  id:'boss_wyrm', name:'Shadow Wyrm', sub:'THE ENDLESS ASCENT', em:'🐉',
  art:'fenrir', artScene:'grave_mist',
  blurb:'Conquista la montaña. Derrota al Wyrm. Prueba tu resistencia.',
  dist_m:5000, cost:300,
  starts: new Date(Date.now() + (2 * 864e5) + (14 * 36e5)).toISOString()
};


/* ── store ────────────────────────────────────────────────── */
/* ── PERFILES ──────────────────────────────────────────────
   La app la usan varias personas en el mismo dispositivo: el coach
   (que es el GM y existe desde el arranque) y los atletas que él crea.
   Al abrir se elige quién eres — sin contraseñas, esto es una libreta
   compartida, no un banco.

   Cada persona guarda lo suyo en `atletas[id]`. Los datos del que está
   activo se COPIAN a la raíz de ST (profile, runs, collection…) para que
   el resto de la app siga leyendo `ST.runs` como siempre; al cambiar de
   usuario se guardan de vuelta y se hidratan los del otro. Así el cambio
   de perfil no obligó a tocar ni una de las pantallas. */
const CAMPOS_ATLETA = ['profile', 'runs', 'collection', 'gacha', 'signin', 'claimed', 'log', 'historial', 'badges'];
const ID_COACH = 'coach';

/* hrMax/hrRest son TUYAS: el esfuerzo se calcula con reserva cardiaca
   (Karvonen), que ya es relativa a la persona. Sin esto, un pulso de
   150 lpm significaría lo mismo para todo el mundo, y no es así. */
function perfilNuevo(nombre, esCoach = false) {
  return {
    profile: { name:nombre, esCoach, shards:300, millasGastadas:0, bonusXp:0,
               hrMax:188, hrRest:58,
               title:null, banner:null, frame:null, background:null, photo:null,
               tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
    runs: [],                  // se llena al registrar actividades
    collection: {},            // { lootId: cantidad }
    gacha: { pulls:0, sinceEpic:0, sinceMythic:0 },
    signin: { dia:0, ultimo:null },
    claimed: {},
    log: [],
    /* Cómo fue cada semana. Lo necesitan los retos mensuales que
       preguntan por semanas completas. */
    historial: { semanas: {} },
    /* Retos cuyo pop-up de logro ya se enseñó, para no repetirlo. */
    badges: {}
  };
}

/* Cuenta nueva de verdad: sin historial inventado, sin atletas de
   relleno y sin monedas regaladas. Todo lo que aparezca en pantalla
   tiene que haberlo puesto alguien — el que corre o su coach. */
function fresh() {
  return {
    quienSoy: null,            // null → la app pregunta quién eres
    roster: [],                // atletas — los crea el coach
    atletas: {},               // datos de cada persona, por id
    challenges: seedChallenges(),
    archive: [],               // carreras contra bosses, cuando existan
    season: { name:'Season of Ascent', points:0, target:20000, level:1,
              nextAt:15000, nextReward:'Ascender Frame',
              ends: new Date(Date.now() + 24 * 864e5).toISOString() },
    /* La semanal se deriva de la mensual (4.33 semanas/mes) para que las
       dos barras no se contradigan nunca. */
    goals: { weekly: 18 * M_PER_MI, monthly: 78 * M_PER_MI, yearly: 500 * M_PER_MI },
    settings: { units:'mi', trainerMode:false },
    /* Campos del atleta activo. Vacíos hasta que alguien entre. */
    ...perfilNuevo('', false)
  };
}

/* Limpieza de una vez: los retos de ejemplo que traía la app de fábrica
   (`by:'plan'` y `by:'system'`) se borran de los guardados que ya
   existen. Solo se conservan los del coach — `by:'trainer'` —, que son
   los que él creó o añadió del catálogo.

   Se distinguen por el origen, no por el nombre: si el coach crea un
   reto y lo llama "Easy Run", es suyo y se queda. */
function limpiarRetosDeFabrica() {
  if (!ST || !Array.isArray(ST.challenges)) return;
  const antes = ST.challenges.length;
  ST.challenges = ST.challenges.filter(c => c.by === 'trainer');
  if (ST.challenges.length !== antes) {
    console.log('[migración] Quitados', antes - ST.challenges.length, 'retos de ejemplo');
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { ST = JSON.parse(raw); if (!ST.profile) ST = fresh(); }
    else ST = fresh();
  } catch (e) { ST = fresh(); }
  limpiarRetosDeFabrica();
  return ST;
}
/* Antes de escribir a disco se vuelca el perfil activo a `atletas`, si no
   lo que se guardaría sería el mapa de perfiles desactualizado.
   El disco es la fuente de verdad inmediata; la nube va detrás y sin
   bloquear, para que la app no dependa de tener internet. */
function save() {
  try {
    if (typeof anotarSemana === 'function') anotarSemana();
    if (typeof guardarActivo === 'function') guardarActivo();
    /* Marca del último cambio: es lo que decide, al abrir en otro sitio,
       si manda el disco o la nube. */
    ST.tocado = Date.now();
    localStorage.setItem(KEY, JSON.stringify(ST));
  } catch (e) {}
  try { if (typeof sincronizar === 'function') sincronizar(); } catch (e) {}
}
function reset() { localStorage.removeItem(KEY); ST = fresh(); }

/* ── PRESETS DE RETOS ─────────────────────────────────────────
   Catálogo listo para que el coach los añada de un toque. Cada uno dice
   qué DATO necesita para poder cumplirse, porque varios dependen de
   campos que el atleta marca al registrar la actividad (tipo, carrera,
   negative split). Si ese dato no se llena, el reto no avanza — y eso
   es correcto: mejor que no avance a que cuente algo que no pasó. */
const PRESETS = [
  /* ── SEMANALES ─────────────────────────────────────────── */
  { id:'p_full',    period:'weekly', name:'Full Schedule',
    desc:'Completa 5 actividades durante la semana',
    goal:{ type:'runs', target:5 }, xp:1200, shards:150,
    necesita:'Nada extra: cuenta cualquier actividad registrada.' },

  { id:'p_iron',    period:'weekly', name:'Iron Legs',
    desc:'2 sesiones de fuerza o calistenia de 20+ min',
    goal:{ type:'tipo_min', target:2, tipo:'strength', minutos:20 }, xp:1400, shards:180,
    necesita:'Al registrar, marca el tipo Strength.' },

  { id:'p_triple',  period:'weekly', name:'Triple Threat',
    desc:'3 tipos diferentes de actividad en la semana',
    goal:{ type:'tipos', target:3 }, xp:1300, shards:160,
    necesita:'Marca el tipo en cada actividad (Run, Bike, Strength…).' },

  { id:'p_orders',  period:'weekly', name:"Coach's Orders",
    desc:'Completa el 100% de los workouts que te asignó el coach',
    goal:{ type:'plan', target:100 }, xp:2000, shards:250,
    necesita:'Nada extra: sale de las sesiones que te asignaron.' },

  /* ── MENSUALES ─────────────────────────────────────────── */
  { id:'p_easy',    period:'monthly', name:'Easy Means Easy',
    desc:'Completa 1 Easy Run quedándote en la zona de pulso pedida',
    goal:{ type:'session', target:1 },
    params:{ dist_m: 2 * M_PER_MI, hrMin:105, hrMax:145, hrObligatoria:true },
    xp:1500, shards:180,
    necesita:'Hay que registrar el pulso medio: sin pulso no se puede verificar.' },

  { id:'p_interval',period:'monthly', name:'Interval Survivor',
    desc:'Completa una sesión de intervalos entera',
    goal:{ type:'session', target:1 },
    params:{ minutes:25, dist_m: 2.5 * M_PER_MI },
    xp:1600, shards:200,
    necesita:'El coach define la sesión; se cumple al registrarla completa.' },

  { id:'p_neg',     period:'monthly', name:'Negative Split',
    desc:'Termina la segunda mitad más rápida que la primera',
    goal:{ type:'neg_split', target:1 }, xp:1800, shards:220,
    necesita:'Marca la casilla “negative split” al registrar la actividad.' },

  { id:'p_set',     period:'monthly', name:'Complete the Set',
    desc:'Easy + Quality + Strength en la misma semana',
    goal:{ type:'set_completo', target:3 }, xp:1700, shards:200,
    necesita:'Marca el tipo de cada actividad; “Quality” sale del plan del coach.' },

  { id:'p_race',    period:'monthly', name:'Race Day',
    desc:'Participa en 1 carrera o evento oficial en el mes',
    goal:{ type:'carrera', target:1 }, xp:2500, shards:350,
    necesita:'Marca la casilla “fue una carrera” al registrarla.' },

  { id:'p_20club',  period:'monthly', name:'20 Club',
    desc:'Completa 20 actividades en el mes',
    goal:{ type:'runs', target:20 }, xp:2200, shards:280,
    necesita:'Nada extra.' },

  { id:'p_ironm',   period:'monthly', name:'Iron Month',
    desc:'8 sesiones de fuerza o calistenia de 20+ min',
    goal:{ type:'tipo_min', target:8, tipo:'strength', minutos:20 }, xp:2400, shards:300,
    necesita:'Marca el tipo Strength en esas sesiones.' },

  { id:'p_4weeks',  period:'monthly', name:'Four Perfect Weeks',
    desc:'Cierra 4 semanas cumpliendo todo el plan',
    goal:{ type:'semanas_perfectas', target:4 }, xp:3000, shards:400,
    necesita:'Se anota solo al cerrar cada semana con el plan al 100%.' },

  { id:'p_consist', period:'monthly', name:'Consistency King',
    desc:'Registra actividad en 16 días distintos del mes',
    goal:{ type:'dias_activos', target:16 }, xp:2600, shards:320,
    necesita:'Nada extra: cuenta días distintos con actividad.' },

  { id:'p_pweeks',  period:'monthly', name:'Perfect Weeks ×2',
    desc:'2 semanas sin saltarte un workout asignado',
    goal:{ type:'semanas_perfectas', target:2 }, xp:2000, shards:250,
    necesita:'Se anota solo al cerrar cada semana con el plan al 100%.' },

  { id:'p_gaunt',   period:'monthly', name:'The Gauntlet',
    desc:'Completa 4 weekly challenges distintos en el mes',
    goal:{ type:'retos_semanales', target:4 }, xp:2800, shards:360,
    necesita:'Se anota solo según los retos semanales que vayas cerrando.' }
];
