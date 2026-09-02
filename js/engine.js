/* ═══════════════════════════════════════════════════════════
   RUNBOUND · Motor
   Todo se DERIVA de ST.runs. Nada de progreso se guarda a mano,
   así que da igual si el run entró manual o por Strava después.
   ═══════════════════════════════════════════════════════════ */

/* ── nivel / XP ───────────────────────────────────────────── */
const xpNeeded = L => L * 300 + 600;

function levelOf(totalXp) {
  let L = 1, left = totalXp;
  while (left >= xpNeeded(L) && L < 999) { left -= xpNeeded(L); L++; }
  return { level: L, into: left, need: xpNeeded(L) };
}

/* ── ventanas de tiempo ───────────────────────────────────── */
function windowStart(period) {
  const n = new Date();
  if (period === 'daily')   { const d = new Date(n); d.setHours(0,0,0,0); return d; }
  if (period === 'weekly')  return D.startOfWeek(n);
  if (period === 'monthly') return D.startOfMonth(n);
  return D.startOfYear(n);
}

function runsIn(period) {
  const from = windowStart(period);
  return ST.runs.filter(r => !r.manual && new Date(r.start_iso) >= from);
}

/* ── CAMBIO DE PERFIL ─────────────────────────────────────── */
function guardarActivo() {
  if (!ST.quienSoy) return;
  if (!ST.atletas) ST.atletas = {};
  const d = {};
  for (const k of CAMPOS_ATLETA) d[k] = ST[k];
  ST.atletas[ST.quienSoy] = d;
}

function nombreDe(id) {
  if (id === ID_COACH) return 'Coach';
  const a = (ST.roster || []).find(x => x.id === id);
  return a ? a.name : 'Runner';
}

/* Rellena lo que falte contra un perfil recién hecho.

   Hace falta porque Firebase NO guarda arrays ni objetos vacíos: un
   `log: []` o un `collection: {}` simplemente no existen al volver de la
   nube, y el código que hace `ST.log.unshift(...)` revienta. Todo lo que
   pase por la nube tiene que pasar por aquí. */
function normalizarAtleta(d, nombre, esCoach) {
  const base = perfilNuevo(nombre, esCoach);
  const out = { ...base, ...(d || {}) };
  for (const k of CAMPOS_ATLETA) if (out[k] == null) out[k] = base[k];
  out.profile = { ...base.profile, ...(out.profile || {}) };
  out.gacha   = { ...base.gacha,   ...(out.gacha   || {}) };
  out.signin  = { ...base.signin,  ...(out.signin  || {}) };
  return out;
}

/* Entra como esa persona: guarda lo del anterior y carga lo suyo.
   Si es la primera vez, le crea el perfil con sus 300 shards. */
function entrarComo(id) {
  guardarActivo();
  if (!ST.atletas) ST.atletas = {};
  ST.atletas[id] = normalizarAtleta(ST.atletas[id], nombreDe(id), id === ID_COACH);
  for (const k of CAMPOS_ATLETA) ST[k] = ST.atletas[id][k];
  ST.quienSoy = id;
  save();
}

function salirDePerfil() {
  guardarActivo();
  ST.quienSoy = null;
  save();
}

/* El coach es el GM: solo él ve Modo Coach y crea atletas. */
const soyCoach = () => ST.quienSoy === ID_COACH;

/* Quién puede entrar: el coach siempre, más los atletas del roster. */
function personas() {
  return [{ id:ID_COACH, name:'Coach', coach:true },
          ...(ST.roster || []).map(a => ({ id:a.id, name:a.name, coach:false }))];
}

/* ── racha por ACTIVIDADES ────────────────────────────────
   Antes esto contaba días seguidos, y siete días seguidos es una
   exigencia dura: un solo día de descanso —o de vida— te borraba la
   racha entera. Ahora cuenta actividades completadas, que es lo que
   de verdad quieres premiar: que sigas apareciendo, no que no faltes
   nunca. Descansar un martes ya no te castiga. */
function actividades() {
  return ST.runs.filter(r => !r.manual).length;
}
/* Actividades de la semana en curso, para el sub-dato. */
function actividadesSemana() {
  return runsIn('weekly').length;
}

/* ── sesiones del plan ─────────────────────────────────────
   Una sesión NO se cumple por salir a caminar: hay que cumplir los
   parámetros que puso el coach. Todos son opcionales; solo se revisan
   los que la sesión define.

   params { dist_m, paceMax, minutes, elev_m, hrMin, hrMax }
   La tolerancia del 10% existe porque nadie clava 2.50 millas exactas. */
const TOL = 0.9;

function cumpleParams(r, p) {
  if (!p) return false;
  if (r.manual) return false;
  if (p.dist_m  && r.distance_m < p.dist_m * TOL) return false;
  if (p.minutes && r.moving_s   < p.minutes * 60 * TOL) return false;
  if (p.elev_m  && r.elev_m     < p.elev_m * TOL) return false;
  if (p.paceMax && U.paceSec(r) > p.paceMax) return false;
  /* La zona de pulso solo se revisa SI la actividad trae pulso. Mucha
     gente camina sin banda; si esto fuera obligatorio quedarían fuera
     de los 250 puntos de adherencia sin poder hacer nada. Se puede
     endurecer por sesión con `hrObligatoria`. */
  if (p.hrMin || p.hrMax) {
    if (!r.avg_hr) return !p.hrObligatoria;
    if (p.hrMin && r.avg_hr < p.hrMin) return false;
    if (p.hrMax && r.avg_hr > p.hrMax) return false;
  }
  return true;
}

/* Texto legible de los parámetros, para que el atleta sepa qué le piden. */
function textoParams(p) {
  if (!p) return '';
  const t = [];
  if (p.dist_m)  t.push(`${U.dist(p.dist_m, 1)} ${U.distU()}`);
  if (p.paceMax) t.push(`sub ${U.pace(p.paceMax)}/${U.distU().toLowerCase()}`);
  if (p.minutes) t.push(`${p.minutes} min`);
  if (p.elev_m)  t.push(`${U.elev(p.elev_m)} ${U.elevU()}`);
  if (p.hrMin)   t.push(`HR ${p.hrMin}–${p.hrMax}`);
  return t.join(' · ');
}

/* ¿Es una sesión del plan? (del coach o del plan por defecto) */
const esSesion = c => c.by === 'trainer' || c.by === 'plan';

/* ── A QUIÉN LE TOCA CADA RETO ────────────────────────────
   `c.para` es una lista de ids de atletas. Sin `para` (o vacío) el reto
   es para todo el mundo — así los retos que ya existían siguen valiendo
   para todos sin tener que migrarlos.

   Esto filtra lo que VE y lo que PUNTÚA cada quien: si el coach le puso
   Long Run solo a Leo, a Marisol no puede bajarle la adherencia una
   sesión que nunca le asignaron. */
function esParaMi(c, quien = ST.quienSoy) {
  if (!c.para || !c.para.length) return true;
  return c.para.includes(quien);
}
/* Una sesión puesta en un día solo aplica ESE día. Si no, el lunes
   verías el Tempo del miércoles como pendiente y la adherencia del lunes
   se hundiría por una sesión que hoy no toca. */
function tocaHoy(c) {
  return c.dia == null || c.dia === diaHoy();
}
function misRetos(quien = ST.quienSoy) {
  return (ST.challenges || []).filter(c => esParaMi(c, quien) && tocaHoy(c));
}
/* Nombres de a quién va dirigido, para pintarlo en Modo Coach. */
function textoPara(c) {
  if (!c.para || !c.para.length) return 'Todos';
  return c.para.map(id => nombreDe(id)).join(', ');
}

/* ── DÍAS DE LA SEMANA ────────────────────────────────────
   `c.dia` (0=lunes … 6=domingo) solo existe en retos DIARIOS: la semana
   se arma poniendo una sesión diaria en cada día. Los retos weekly y
   monthly son metas del período completo — pedirles un día no tendría
   sentido, porque su ventana ya es la semana o el mes entero. */
const DIAS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const DIAS_LARGO = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
/* Lunes = 0, para que cuadre con D.startOfWeek(). */
const diaHoy = () => (new Date().getDay() + 6) % 7;

/* ¿Se cumplió esa sesión EL DÍA QUE LE TOCABA, esta semana?

   `evalChallenge` de un diario mira solo las actividades de HOY, así que
   no sirve para pintar la rejilla: el lunes daría "sin hacer" la sesión
   del miércoles. Aquí se busca la fecha real de ese día en la semana en
   curso y se revisa lo que se hizo ESE día. */
function cumplidoPor(c, quien) {
  if (c.dia == null) return false;
  const inicio = D.startOfWeek();
  const fecha = new Date(inicio);
  fecha.setDate(fecha.getDate() + c.dia);
  if (fecha > new Date()) return false;                 // aún no ha llegado
  const clave = D.key(fecha);
  /* Las actividades de ESA persona, no las de quien está mirando: el
     coach ve la rejilla y sus propios runs no dicen nada de si su
     atleta cumplió. */
  const suyas = quien === ST.quienSoy
    ? ST.runs
    : (((ST.atletas || {})[quien] || {}).runs || []);
  const delDia = suyas.filter(r => !r.manual && D.key(r.start_iso) === clave);
  if (!delDia.length) return false;
  if (c.params) return delDia.some(r => cumpleParams(r, c.params));
  /* Sin parámetros basta con que ese día se hiciera algo. */
  return true;
}
const cumplidoEnSuDia = c => cumplidoPor(c, ST.quienSoy);

/* Cuántos de los asignados ya la cumplieron ese día. */
function avanceSesion(c) {
  const destinatarios = (c.para && c.para.length)
    ? c.para
    : personas().map(p => p.id);
  const hechos = destinatarios.filter(id => cumplidoPor(c, id)).length;
  return { hechos, total: destinatarios.length,
           completo: destinatarios.length > 0 && hechos === destinatarios.length };
}

/* Lo que toca hoy. `misRetos()` ya descartó lo de otros días, así que
   aquí solo hay que escoger entre lo que sí aplica hoy: primero la
   sesión asignada a este día, y si no, un diario suelto. */
function sesionDeHoy() {
  const mias = misRetos();
  const delDia = mias.filter(c => c.dia != null);
  return delDia.find(c => !evalChallenge(c).done)
      || delDia[0]
      || mias.find(c => c.period === 'daily' && !evalChallenge(c).done)
      || mias.find(c => c.period === 'daily');
}

/* ── HISTORIAL SEMANAL ────────────────────────────────────
   Hay retos mensuales que preguntan por SEMANAS ("4 semanas perfectas",
   "4 weekly challenges distintos"). Eso no se puede derivar mirando solo
   las actividades: hay que dejar constancia de cómo fue cada semana.

   Se anota la semana EN CURSO en cada guardado. Cuando cambia la semana,
   la clave cambia y la anterior queda congelada tal como terminó — sin
   tener que recalcular el pasado, que sería imposible porque el plan del
   coach pudo cambiar desde entonces. */
function claveSemana(d = new Date()) {
  const i = D.startOfWeek(d);
  return D.key(i);
}
function anotarSemana() {
  if (!ST || !ST.quienSoy) return;
  if (!ST.historial) ST.historial = { semanas: {} };
  if (!ST.historial.semanas) ST.historial.semanas = {};
  const ses = misRetos().filter(c => c.period === 'weekly' && esSesion(c));
  const hechas = ses.filter(c => evalChallenge(c).done).length;
  ST.historial.semanas[claveSemana()] = {
    inicio: claveSemana(),
    plan: ses.length ? hechas / ses.length : 0,
    retos: misRetos().filter(c => c.period === 'weekly' && !esSesion(c) && evalChallenge(c).done)
                     .map(c => c.id)
  };
}
const semanasGuardadas = () => Object.values((ST.historial && ST.historial.semanas) || {});
/* Semanas en que se cumplió el 100% del plan asignado. */
const semanasPerfectas = () => semanasGuardadas().filter(s => s.plan >= 1).length;
/* Retos semanales DISTINTOS completados dentro del mes en curso. */
function retosSemanalesDelMes() {
  const desde = D.startOfMonth();
  const ids = new Set();
  for (const s of semanasGuardadas()) {
    if (D.parse(s.inicio) < desde) continue;
    (s.retos || []).forEach(id => ids.add(id));
  }
  return ids.size;
}

/* ── TIPOS DE ACTIVIDAD ───────────────────────────────────
   Sin esto no se pueden medir los retos de fuerza ni los de variedad:
   una caminata y una sesión de calistenia eran el mismo registro. */
const TIPOS = {
  run:      { label:'Run',      em:'🏃' },
  walk:     { label:'Walk',     em:'🚶' },
  strength: { label:'Strength', em:'💪' },
  bike:     { label:'Bike',     em:'🚴' },
  swim:     { label:'Swim',     em:'🏊' },
  other:    { label:'Other',    em:'✨' }
};
const tipoDe = r => r.tipo || 'run';
/* Fuerza y cross-training cuentan igual para "Complete the Set". */
const esFuerza = r => ['strength'].includes(tipoDe(r));
const esCross  = r => ['bike','swim','other'].includes(tipoDe(r));

/* ── evaluación de retos ──────────────────────────────────── */
/* Devuelve { cur, target, pct, done, label } — `cur` en unidad cruda. */
function evalChallenge(c) {
  const rs = runsIn(c.period);
  const g = c.goal;
  let cur = 0, done = false, lower = false;

  switch (g.type) {
    case 'runs':
      cur = rs.length; break;
    case 'distance':
      cur = rs.reduce((s, r) => s + r.distance_m, 0); break;
    case 'single_distance':
      cur = rs.reduce((m, r) => Math.max(m, r.distance_m), 0); break;
    case 'elevation':
      cur = rs.reduce((s, r) => s + r.elev_m, 0); break;
    case 'time':
      cur = rs.reduce((s, r) => s + r.moving_s, 0); break;
    case 'streak':
      cur = actividades(); break;
    case 'cadence':
      cur = rs.reduce((m, r) => Math.max(m, r.cadence_spm || 0), 0); break;
    case 'hr':
      cur = rs.filter(r => r.avg_hr && r.avg_hr >= g.min && r.avg_hr <= g.max).length; break;
    case 'session':
      /* cuántas actividades del período cumplieron TODOS los parámetros */
      cur = rs.filter(r => cumpleParams(r, c.params)).length; break;

    /* ── metas que necesitan los datos nuevos ──────────────── */
    case 'dias_activos':
      cur = new Set(rs.map(r => D.key(r.start_iso))).size; break;
    case 'tipos':
      cur = new Set(rs.map(tipoDe)).size; break;
    case 'tipo_min':
      /* p.ej. 2 sesiones de fuerza de 20+ min */
      cur = rs.filter(r => tipoDe(r) === g.tipo && r.moving_s >= (g.minutos || 20) * 60).length; break;
    case 'carrera':
      cur = rs.filter(r => r.carrera).length; break;
    case 'neg_split':
      cur = rs.filter(r => r.negSplit).length; break;
    case 'plan': {
      /* % de las sesiones que te asignó el coach, ya cumplidas.
         Se excluye este mismo reto para no entrar en bucle. */
      const ses = misRetos().filter(x => x.period === c.period && esSesion(x) && x.id !== c.id);
      cur = ses.length ? Math.round(ses.filter(x => evalChallenge(x).done).length / ses.length * 100) : 0;
      break;
    }
    case 'set_completo': {
      /* Easy + Quality + Strength/Cross en la misma semana. Se cuenta
         cuántas de las tres categorías aparecen. */
      const facil   = rs.some(r => ['run','walk'].includes(tipoDe(r)));
      const calidad = misRetos().filter(x => x.period === 'weekly' && esSesion(x))
                                .some(x => evalChallenge(x).done);
      const fuerte  = rs.some(r => esFuerza(r) || esCross(r));
      cur = [facil, calidad, fuerte].filter(Boolean).length;
      break;
    }
    case 'semanas_perfectas':
      cur = semanasPerfectas(); break;
    case 'retos_semanales':
      cur = retosSemanalesDelMes(); break;
    case 'pace': {
      lower = true;
      const paces = rs.filter(r => r.distance_m > 400).map(r => U.paceSec(r));
      cur = paces.length ? Math.min(...paces) : 0;
      break;
    }
  }

  if (lower) {
    done = cur > 0 && cur <= g.target;
    // en pace el progreso es "qué tan cerca estás por debajo del objetivo"
    const pct = cur === 0 ? 0 : Math.min(100, Math.round((g.target / cur) * 100));
    return { cur, target: g.target, pct, done, lower };
  }
  done = cur >= g.target;
  return { cur, target: g.target, pct: Math.min(100, Math.round(cur / g.target * 100)), done, lower:false };
}

/* Texto de progreso según tipo de meta.
   Un reto cumplido se muestra tope-con-tope (7/7, no 12/7) — pasarse
   de la meta no es información útil y se lee como error. */
function progressLabel(c, ev) {
  const g = c.goal;
  const cap = v => ev.done ? g.target : v;
  switch (g.type) {
    case 'session':return `${cap(ev.cur)} / ${g.target} SESSIONS`;
    case 'runs':   return `${cap(ev.cur)} / ${g.target} ACTIVITIES`;
    case 'streak': return `${cap(ev.cur)} / ${g.target} ACTIVITIES`;
    case 'dias_activos': return `${cap(ev.cur)} / ${g.target} DAYS`;
    case 'tipos':        return `${cap(ev.cur)} / ${g.target} TYPES`;
    case 'tipo_min':     return `${cap(ev.cur)} / ${g.target} SESSIONS`;
    case 'carrera':      return `${cap(ev.cur)} / ${g.target} RACES`;
    case 'neg_split':    return `${cap(ev.cur)} / ${g.target} NEG SPLITS`;
    case 'plan':         return `${cap(ev.cur)}% / ${g.target}% DEL PLAN`;
    case 'set_completo': return `${cap(ev.cur)} / ${g.target} CATEGORIES`;
    case 'semanas_perfectas': return `${cap(ev.cur)} / ${g.target} WEEKS`;
    case 'retos_semanales':   return `${cap(ev.cur)} / ${g.target} CHALLENGES`;
    case 'cadence':return `${Math.round(cap(ev.cur)) || 0} / ${g.target} SPM`;
    case 'hr':     return `${cap(ev.cur)} / ${g.target} RUNS`;
    case 'time':   return `${U.clock(cap(ev.cur))} / ${U.clock(g.target)}`;
    case 'elevation': return `${U.elev(cap(ev.cur))} / ${U.elev(g.target)} ${U.elevU()}`;
    case 'pace':   return `${U.pace(ev.cur)} / ${U.pace(g.target)} /${U.distU().toLowerCase()}`;
    default:       return `${U.dist(cap(ev.cur))} / ${U.dist(g.target)} ${U.distU()}`;
  }
}

/* ── MILLAS ────────────────────────────────────────────────
   La moneda de la tienda son las millas que CORRISTE, no un número
   que reparte un reto. Se derivan de ST.runs igual que todo lo demás;
   lo único que se guarda es cuántas has gastado.

   Consecuencia buscada: las millas son escasas de verdad. No se pueden
   farmear reclamando retos — solo saliendo a moverte. */
function millasCorridas() {
  return ST.runs.filter(r => !r.manual)
                .reduce((s, r) => s + U.mi(r.distance_m), 0);
}
function millasDisponibles() {
  return Math.max(0, millasCorridas() - (ST.profile.millasGastadas || 0));
}

/* Compra directa de un cosmético con millas. */
function comprarConMillas(id) {
  const it = LOOT_BY_ID[id];
  if (!it) return { ok:false, msg:'Ese objeto no existe' };
  if (ST.collection[id]) return { ok:false, msg:'Ya tienes ese objeto' };
  const precio = MILE_PRICE[it.r];
  if (millasDisponibles() < precio)
    return { ok:false, msg:`Te faltan ${Math.ceil(precio - millasDisponibles())} millas` };
  ST.profile.millasGastadas = (ST.profile.millasGastadas || 0) + precio;
  ST.collection[id] = 1;
  ST.log.unshift({ t:new Date().toISOString(), kind:'buy',
                   txt:`${it.name} comprado por ${precio} millas` });
  save();
  return { ok:true, item:it, precio };
}

/* ── XP total ganado (retos reclamados) ───────────────────── */
function totalXp() {
  return Object.keys(ST.claimed).reduce((s, id) => {
    const c = ST.challenges.find(x => x.id === id);
    return s + (c ? c.xp : 0);
  }, 0) + (ST.profile.bonusXp || 0);
}

function claim(id) {
  const c = ST.challenges.find(x => x.id === id);
  if (!c || ST.claimed[id]) return null;
  const ev = evalChallenge(c);
  if (!ev.done) return null;
  ST.claimed[id] = new Date().toISOString();
  ST.profile.shards += c.shards;
  ST.season.points  += Math.round(c.xp / 4);
  ST.log.unshift({ t:new Date().toISOString(), kind:'claim', txt:`${c.name} · +${c.xp} XP · +${c.shards} shards` });
  save();
  return c;
}

/* ── PR / nemesis ─────────────────────────────────────────── */
function prFor(dist_m, tol = 0.06) {
  const cands = [
    ...ST.archive.filter(a => Math.abs(a.dist_m - dist_m) / dist_m < tol)
        .map(a => ({ time_s:a.time_s, src:a.name, date:a.date })),
    ...ST.runs.filter(r => !r.manual && Math.abs(r.distance_m - dist_m) / dist_m < tol)
        .map(r => ({ time_s:r.moving_s, src:'Entrenamiento', date:r.start_iso }))
  ];
  if (!cands.length) return null;
  return cands.reduce((b, x) => x.time_s < b.time_s ? x : b);
}

/* Nemesis: tu PR es el boss. Su HP baja según tu tiempo proyectado
   para esa distancia, sacado del pace de tus últimos 6 runs.

   RACE_FACTOR convierte pace de entrenamiento → pace de carrera.
   Un run de base normalmente va ~20% más lento que el pace de 5K, así
   que sin este factor el proyectado siempre sale peor que el PR y la
   barra se queda clavada en 100%. Es el número a calibrar con data real. */
const RACE_FACTOR = 0.80;

function nemesis(dist_m = 5000) {
  const pr = prFor(dist_m);
  if (!pr) return null;
  const recent = ST.runs.filter(r => !r.manual && r.distance_m > 1600).slice(0, 6);
  if (!recent.length) return null;
  const avgPace = recent.reduce((s, r) => s + r.moving_s / r.distance_m, 0) / recent.length;
  const projected = avgPace * RACE_FACTOR * dist_m;
  /* HP 100% = proyectado 8% más lento que el PR o peor. HP 0% = ya lo igualaste. */
  const gap = (projected - pr.time_s) / pr.time_s;
  const hp = Math.max(0, Math.min(100, Math.round(gap / 0.08 * 100)));
  return { pr, projected, hp, dist_m };
}

/* ── gacha ────────────────────────────────────────────────── */
function rollRarity(rates) {
  const g = ST.gacha;
  if (g.sinceMythic + 1 >= PITY.mythic && (rates.mythic ?? 0) >= 0) return 'mythic';
  if (g.sinceEpic + 1 >= PITY.epic) return (rates.mythic && Math.random() < 0.05) ? 'mythic' : 'epic';

  const pool = Object.entries(rates).filter(([, w]) => w > 0);
  const total = pool.reduce((s, [, w]) => s + w, 0);
  let x = Math.random() * total;
  for (const [k, w] of pool) { if ((x -= w) <= 0) return k; }
  return pool[0][0];
}

function pickItem(rarity, filter) {
  let pool = LOOT.filter(i => i.r === rarity);
  if (filter && filter.type) pool = pool.filter(i => i.type === filter.type);
  if (!pool.length) pool = LOOT.filter(i => i.r === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ── SIGN-IN BONUS ─────────────────────────────────────────
   Siete días: los primeros seis dan 100 💎 cada uno, el séptimo un
   cofre gratis. Se reclama UNA vez al día.

   A propósito NO se reinicia si faltas un día: la cuenta es "siete
   días que entraste", no "siete seguidos". Castigar el fallo empuja a
   abrir la app por abrir, y el punto de RUNBOUND es que salgas a
   moverte, no que hagas login religiosamente.

   Al reclamar el día 7 el ciclo vuelve a empezar. */
const SIGNIN_DIAS   = 7;
const SIGNIN_SHARDS = 100;

function signinEstado() {
  if (!ST.signin) ST.signin = { dia:0, ultimo:null };
  return ST.signin;
}
/* ¿Hay algo que reclamar hoy? */
function signinPendiente() {
  return signinEstado().ultimo !== D.key(new Date());
}
/* Qué día del ciclo se reclamaría ahora (1..7). */
function signinProximo() {
  return signinEstado().dia + 1;
}
/* Recompensa de cada casilla, para pintar el panel. */
function signinPremio(dia) {
  return dia >= SIGNIN_DIAS
    ? { cofre:true,  shards:0 }
    : { cofre:false, shards:SIGNIN_SHARDS };
}

function reclamarSignin() {
  if (!signinPendiente()) return { ok:false, msg:'Ya reclamaste hoy' };
  const s = signinEstado();
  const dia = s.dia + 1;
  const premio = signinPremio(dia);

  if (!premio.cofre) ST.profile.shards += premio.shards;

  /* Al cobrar el 7 el ciclo se reinicia. */
  s.dia = premio.cofre ? 0 : dia;
  s.ultimo = D.key(new Date());

  ST.log.unshift({ t:new Date().toISOString(), kind:'signin',
    txt: premio.cofre ? `Día ${dia}: cofre gratis`
                      : `Día ${dia}: +${premio.shards} shards` });
  save();
  return { ok:true, dia, ...premio };
}

/* `gratis` salta el cobro: lo usa el cofre del día 7. */
function openPack(pack, { gratis = false } = {}) {
  if (!gratis) {
    if (ST.profile.shards < pack.cost) return { error:'shards' };
    ST.profile.shards -= pack.cost;
  }

  const results = [];
  for (let i = 0; i < pack.pulls; i++) {
    let rarity = rollRarity(pack.rates);
    /* garantía del x10: si es la última y no salió Epic+, forzarla */
    if (pack.guarantee && i === pack.pulls - 1 && !results.some(r => r.item.r !== 'rare')) {
      rarity = pack.guarantee;
    }
    const item = pickItem(rarity, pack.pool);

    ST.gacha.pulls++;
    ST.gacha.sinceEpic   = (rarity === 'rare') ? ST.gacha.sinceEpic + 1 : 0;
    ST.gacha.sinceMythic = (rarity === 'mythic') ? 0 : ST.gacha.sinceMythic + 1;

    const owned = ST.collection[item.id] || 0;
    const isNew = owned === 0;
    ST.collection[item.id] = owned + 1;

    let dust = 0;
    if (!isNew) { dust = RARITY[item.r].dust; ST.profile.shards += dust; }
    results.push({ item, isNew, dust });
  }
  ST.log.unshift({ t:new Date().toISOString(), kind:'summon',
    txt:`${pack.name} · ${results.length} objeto(s)` });
  save();
  return { results };
}

/* ── equipar ──────────────────────────────────────────────── */
function equip(id) {
  const it = LOOT_BY_ID[id];
  if (!it || !ST.collection[id]) return;
  const slot = it.type;                      // title | avatar | frame | background
  ST.profile[slot] = (ST.profile[slot] === id) ? null : id;
  save();
}

/* ── métricas agregadas ───────────────────────────────────── */
function totals(period) {
  const rs = runsIn(period);
  return {
    dist: rs.reduce((s, r) => s + r.distance_m, 0),
    time: rs.reduce((s, r) => s + r.moving_s, 0),
    elev: rs.reduce((s, r) => s + r.elev_m, 0),
    runs: rs.length
  };
}

/* ── ROSTER ────────────────────────────────────────────────
   Los atletas los añade el coach. No hay nombres inventados de
   relleno: si el roster está vacío, la Liga lo dice en vez de
   fabricar rivales que no existen. */
function addAtleta(nombre) {
  const n = String(nombre || '').trim();
  if (!n) return { ok:false, msg:'Ponle nombre al atleta' };
  if (!ST.roster) ST.roster = [];
  if (ST.roster.some(a => a.name.toLowerCase() === n.toLowerCase()))
    return { ok:false, msg:'Ese atleta ya está en el roster' };
  ST.roster.push({ id:'a' + Math.random().toString(36).slice(2, 9), name:n });
  ST.log.unshift({ t:new Date().toISOString(), kind:'roster', txt:`${n} añadido al roster` });
  save();
  return { ok:true, name:n };
}
function delAtleta(id) {
  if (!ST.roster) return;
  ST.roster = ST.roster.filter(a => a.id !== id);
  save();
}

/* Leaderboard sobre el roster del coach.
   Cada atleta tiene su propio dispositivo, así que hasta que exista
   backend solo se conocen sus millas si el coach las anotó (`dist_m`).
   Quien no tenga nada aparece en 0 — nunca se inventa un número. */
function leaderboard() {
  const me = totals('monthly').dist;
  const rows = (ST.roster || []).map(a => ({
    name: a.name, em: a.em || '🏃', dist: a.dist_m || 0, me:false
  }));
  rows.push({ name:'Tú', em:'🏃', dist: me, me:true });
  return rows.sort((a, b) => b.dist - a.dist).map((r, i) => ({ ...r, rank: i + 1 }));
}

/* ── entrada de runs ──────────────────────────────────────── */
function addRun(r) {
  ST.runs.unshift(newRun(r));
  ST.runs.sort((a, b) => new Date(b.start_iso) - new Date(a.start_iso));
  ST.log.unshift({ t:new Date().toISOString(), kind:'run',
    txt:`Run registrado · ${U.dist(r.distance_m)} ${U.distU()}` });
  save();
}

/* ═══ HOOK PARA STRAVA (fase 2) ═══════════════════════════════
   Cuando llegue el webhook, el backend hará:

     const a = await fetchActivity(id, athleteToken);
     addRun(fromStrava(a));

   y NADA más de la app cambia. Ese es todo el punto de esta capa. */
function fromStrava(a) {
  return newRun({
    distance_m: a.distance,
    moving_s:   a.moving_time,
    elapsed_s:  a.elapsed_time,
    avg_hr:     a.average_heartrate ?? null,
    max_hr:     a.max_heartrate ?? null,
    /* Strava reporta cadencia POR PIERNA → ×2 para spm real */
    cadence_spm: a.average_cadence ? Math.round(a.average_cadence * 2) : null,
    elev_m:     a.total_elevation_gain || 0,
    start_iso:  a.start_date_local,
    tz:         a.timezone,
    source:     'strava',
    external_id: String(a.id),
    /* actividades subidas a mano en Strava no otorgan recompensas */
    manual:     !!a.manual
  });
}
