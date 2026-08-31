/* ═══════════════════════════════════════════════════════════
   RUNBOUND · Sistema de puntos normalizado
   ───────────────────────────────────────────────────────────
   REGLA DE ORO: nada se mide en valores absolutos. Todo se mide
   contra TU PROPIA línea base. Por eso alguien que camina a
   16'00"/mi puede ganarle a alguien que corre a 6'00"/mi — no
   compiten por velocidad, compiten por cuánto mejoraron sobre
   sí mismos, cuánto cumplieron el plan de su coach y cuánto esfuerzo pusieron.

   PUNTOS = Mejora(450) + Adherencia(250) + Objetivos(200) + Esfuerzo(100)
                                                          = 1000 máx
   ═══════════════════════════════════════════════════════════ */

const CAPS = { mejora: 450, adherencia: 250, objetivos: 200, esfuerzo: 100 };

/* Mínimos para que un período puntúe. Sin esto, una sola caminata
   corta de 400m podría inflar la "mejora" y romper todo el sistema. */
const MIN_RUNS_PERIODO = 2;
const MIN_DIST_M = 1200;

/* ── esfuerzo por run (0–10) ───────────────────────────────
   Con pulsómetro se usa el % de reserva cardiaca (Karvonen), que
   ya es relativo a la persona. Sin pulsómetro se cae al pace
   relativo a TU base — nunca a una tabla de paces absoluta. */
function effortOf(r, baselinePace) {
  if (r.avg_hr && ST.profile.hrMax && ST.profile.hrRest) {
    const reserva = (r.avg_hr - ST.profile.hrRest) / (ST.profile.hrMax - ST.profile.hrRest);
    /* 70% de reserva cardiaca ≈ esfuerzo 7 en la escala RPE de 10.
       El ×10 sale de ahí; con ×13 casi todo salía en 9-10 y el tope
       de esfuerzo se regalaba. */
    return Math.max(0, Math.min(10, Math.round(reserva * 10)));
  }
  if (!baselinePace) return 5;
  const p = r.moving_s / (r.distance_m / M_PER_MI);
  /* 10% más rápido que tu base ≈ esfuerzo 9; 10% más lento ≈ 3 */
  const rel = (baselinePace - p) / baselinePace;
  return Math.max(0, Math.min(10, Math.round(6 + rel * 30)));
}

/* ── línea base personal ───────────────────────────────────
   La mediana (no el promedio) del pace del período ANTERIOR.
   Mediana porque un solo run malo no debe mover tu base. */
function median(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function paceList(runs) {
  return runs.filter(r => !r.manual && r.distance_m >= MIN_DIST_M)
             .map(r => r.moving_s / (r.distance_m / M_PER_MI));
}

function periodBounds(period, back = 0) {
  const n = new Date();
  if (period === 'daily') {
    const a = new Date(n); a.setHours(0, 0, 0, 0); a.setDate(a.getDate() - back);
    const b = new Date(a); b.setDate(b.getDate() + 1); return [a, b];
  }
  if (period === 'weekly') {
    const a = D.startOfWeek(n); a.setDate(a.getDate() - 7 * back);
    const b = new Date(a); b.setDate(b.getDate() + 7); return [a, b];
  }
  if (period === 'monthly') {
    const a = new Date(n.getFullYear(), n.getMonth() - back, 1);
    const b = new Date(a.getFullYear(), a.getMonth() + 1, 1); return [a, b];
  }
  const a = new Date(n.getFullYear() - back, 0, 1);
  const b = new Date(a.getFullYear() + 1, 0, 1); return [a, b];
}

function runsBetween(a, b, runs = ST.runs) {
  return runs.filter(r => { const t = new Date(r.start_iso); return t >= a && t < b; });
}

/* ── 1· MEJORA PERSONAL (0–450) ───────────────────────────
   Mantener tu nivel ya vale 300. Eso es deliberado: si solo
   premiara mejorar, quien lleva años corriendo nunca podría ganar
   porque ya está cerca de su techo. El principiante tiene más
   margen de mejora; el veterano compite por mantenerse y por las
   otras tres categorías. */
function scoreMejora(period) {
  const [a, b]   = periodBounds(period, 0);
  const [pa, pb] = periodBounds(period, 1);
  const now  = paceList(runsBetween(a, b));
  const prev = paceList(runsBetween(pa, pb));

  if (now.length < MIN_RUNS_PERIODO || !prev.length)
    return { pts: 0, pct: null, base: median(prev) || null, actual: median(now) || null, sinDatos: true };

  const base = median(prev), actual = median(now);
  const pct = (base - actual) / base * 100;          // + = mejoraste

  let pts;
  if (pct >= 0) pts = 300 + Math.min(1, pct / 5) * 150;   // +5% ya es tope
  else          pts = Math.max(0, 1 + pct / 8) * 300;      // -8% cae a cero
  return { pts: Math.round(pts), pct, base, actual, sinDatos: false };
}

/* ── 2· ADHERENCIA AL PLAN (0–250) ────────────────────────
   NO se puntúa por salir a la calle. Se puntúa por cumplir las SESIONES
   del plan dentro de sus parámetros: la distancia, el tiempo, la subida
   y la zona de pulso que puso el coach. Salir a caminar 10 minutos
   cuando la sesión pedía 30 no cuenta.

   Aparte se guarda `dias` solo para mostrarlo, no puntúa por sí solo. */
function scoreAdherencia(period) {
  const plan = ST.challenges.filter(c => c.period === period && esSesion(c));
  const [a, b] = periodBounds(period, 0);
  const dias = new Set(runsBetween(a, b).filter(r => !r.manual).map(r => D.key(r.start_iso))).size;

  if (!plan.length) return { pts: 0, hechas: 0, total: 0, dias, sinPlan: true };
  const hechas = plan.filter(c => evalChallenge(c).done).length;
  return { pts: Math.round(hechas / plan.length * CAPS.adherencia),
           hechas, total: plan.length, dias, sinPlan: false };
}

/* ── 3· OBJETIVOS COMPLETADOS (0–200) ─────────────────────
   Metas de volumen (distancia, elevación, racha). Las sesiones del plan
   NO cuentan aquí — ya puntúan en Adherencia y contarían doble. */
function scoreObjetivos(period) {
  const cs = ST.challenges.filter(c => c.period === period && !esSesion(c));
  if (!cs.length) return { pts: 0, hechos: 0, total: 0 };
  const hechos = cs.filter(c => evalChallenge(c).done).length;
  return { pts: Math.round(hechos / cs.length * CAPS.objetivos), hechos, total: cs.length };
}

/* ── 4· ESFUERZO (0–100) ──────────────────────────────────
   Premia esfuerzo sostenido, no reventarse: el tope está en 7/10.
   Pasar de ahí no da más puntos (y a la larga te lesiona). */
function scoreEsfuerzo(period) {
  const [a, b] = periodBounds(period, 0);
  const [pa, pb] = periodBounds(period, 1);
  const base = median(paceList(runsBetween(pa, pb)));
  const rs = runsBetween(a, b).filter(r => !r.manual);
  if (!rs.length) return { pts: 0, prom: 0 };
  const prom = rs.reduce((s, r) => s + effortOf(r, base), 0) / rs.length;
  return { pts: Math.round(Math.min(1, prom / 7) * CAPS.esfuerzo), prom };
}

/* ── total ────────────────────────────────────────────────── */
function scoreTotal(period = 'weekly') {
  const m = scoreMejora(period), c = scoreAdherencia(period);
  const o = scoreObjetivos(period), e = scoreEsfuerzo(period);
  return {
    period, mejora: m, adherencia: c, objetivos: o, esfuerzo: e,
    total: m.pts + c.pts + o.pts + e.pts,
    caps: CAPS
  };
}

/* Anillo del Home: qué tan lleno está tu período sobre 1000. */
function progresoPersonal(period = 'daily') {
  return Math.round(scoreTotal(period).total / 1000 * 100);
}

/* ── rival de la Liga ──────────────────────────────────────
   Mock hasta que exista backend. Se genera determinista a partir
   de la semana para que no cambie en cada render.
   OJO: cuando entre Strava, aquí solo pueden viajar PUNTOS
   NORMALIZADOS, nunca la actividad cruda del otro atleta. */
function rival(period = 'weekly') {
  /* Sin roster no hay rival. Antes se sacaba de una lista de nombres
     inventados; ahora los atletas los añade el coach, y si no hay
     ninguno la Liga lo dice en vez de fabricar un contrincante falso. */
  const roster = ST.roster || [];
  if (!roster.length) return null;

  const semilla = Math.floor(Date.now() / 6048e5);
  const rnd = mulberry32(semilla * 7919);
  const r = roster[Math.floor(rnd() * roster.length)];
  const mio = scoreTotal(period);
  const pts = k => Math.round(Math.min(CAPS[k], mio[k].pts * (0.7 + rnd() * 0.55)));
  const d = { mejora: pts('mejora'), adherencia: pts('adherencia'),
              objetivos: pts('objetivos'), esfuerzo: pts('esfuerzo') };
  return {
    nombre: r.name, em: r.em || '🏃', nivel: 40 + Math.floor(rnd() * 40),
    rango: 'Pro Runner', desglose: d,
    total: d.mejora + d.adherencia + d.objetivos + d.esfuerzo,
    /* El % se DERIVA de sus puntos de mejora (fórmula inversa a scoreMejora),
       no se sortea aparte. Si no, los dos paneles se contradicen. */
    mejoraPct: pctDeMejora(d.mejora)
  };
}

/* Inversa de scoreMejora: de puntos a porcentaje. */
function pctDeMejora(pts) {
  return pts >= 300 ? (pts - 300) / 150 * 5 : (pts / 300 - 1) * 8;
}
