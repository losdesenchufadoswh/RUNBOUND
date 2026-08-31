/* ═══════════════════════════════════════════════════════════
   RUNBOUND · Firebase

   El config va commiteado a propósito: esto es un sitio estático sin
   build, el navegador carga este archivo tal cual y no hay quién
   sustituya variables de entorno. Además la apiKey web de Firebase es
   un IDENTIFICADOR, no un secreto — lo que protege los datos son las
   Security Rules y los dominios autorizados en la consola.
   ═══════════════════════════════════════════════════════════ */

firebase.initializeApp({
  apiKey: "AIzaSyBSw8tzlG3MzPdKUEilCqAHd6mEl2__1EU",
  authDomain: "runbound-66838.firebaseapp.com",
  projectId: "runbound-66838",
  databaseURL: "https://runbound-66838-default-rtdb.firebaseio.com",
  storageBucket: "runbound-66838.firebasestorage.app",
  messagingSenderId: "866266403470",
  appId: "1:866266403470:web:af463a55cd33cab58eafdf"
});

const db      = () => firebase.database();
const auth    = () => firebase.auth();
const storage = () => firebase.storage();

let CURRENT_USER = null;
let FB_LISTO     = false;   // ¿hay sesión real de Firebase?

/* Identidad local de respaldo. Si Firebase no responde (sin internet,
   auth anónima apagada) la app tiene que seguir funcionando: RUNBOUND
   guarda en localStorage de todas formas y la nube es un extra. */
function loginLocal() {
  let uid = localStorage.getItem('runbound.uid');
  if (!uid) {
    uid = 'local_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    localStorage.setItem('runbound.uid', uid);
  }
  CURRENT_USER = { uid, isLocal:true };
  FB_LISTO = false;
  console.log('[FB] Sin nube — identidad local', uid.slice(0, 10));
}

/* Arranque: se intenta sesión anónima real; si falla, identidad local. */
async function iniciarFirebase() {
  try {
    const cred = await auth().signInAnonymously();
    CURRENT_USER = cred.user;
    FB_LISTO = true;
    console.log('[FB] Sesión anónima', cred.user.uid.slice(0, 10));
    await cargarDeNube();
  } catch (e) {
    console.warn('[FB] No se pudo autenticar:', e.code || e.message);
    loginLocal();
  }
}

/* ── SUBIR ────────────────────────────────────────────────
   Se guarda TODO el estado bajo users/{uid}: perfiles, roster y plan.
   Así el coach no tiene que tocar la consola de Firebase — crear un
   atleta en Modo Coach ya lo escribe en la nube, y borrarlo lo quita. */
async function guardarEnNube() {
  if (!FB_LISTO || !CURRENT_USER || !ST) return;
  try {
    if (typeof guardarActivo === 'function') guardarActivo();
    /* Las fotos son data URLs pesados: van a Storage, no a la base. */
    const atletas = JSON.parse(JSON.stringify(ST.atletas || {}));
    for (const id of Object.keys(atletas)) {
      const p = atletas[id].profile;
      if (p && typeof p.photo === 'string' && p.photo.startsWith('data:')) {
        const url = await subirFoto(id, p.photo);
        if (url) { p.photoURL = url; delete p.photo; }
      }
    }
    await db().ref(`users/${CURRENT_USER.uid}`).set({
      quienSoy: ST.quienSoy || null,
      roster:   ST.roster || [],
      atletas,
      challenges: ST.challenges || [],
      goals: ST.goals, settings: ST.settings, season: ST.season,
      lastSync: new Date().toISOString()
    });
  } catch (e) {
    console.error('[FB] No se pudo guardar:', e.code || e.message);
  }
}

/* ── BAJAR ────────────────────────────────────────────────
   Solo pisa lo local si la nube trae algo. Una cuenta nueva no debe
   borrar el progreso que ya existe en el dispositivo. */
async function cargarDeNube() {
  if (!FB_LISTO || !CURRENT_USER || !ST) return false;
  try {
    const snap = await db().ref(`users/${CURRENT_USER.uid}`).once('value');
    if (!snap.exists()) { console.log('[FB] Nada en la nube todavía'); return false; }
    const d = snap.val();
    if (d.roster)     ST.roster     = d.roster;
    /* Firebase devuelve sin los arrays/objetos vacíos, así que cada
       atleta se rellena contra un perfil base antes de usarse. */
    if (d.atletas) {
      ST.atletas = {};
      for (const id of Object.keys(d.atletas)) {
        const nom = id === ID_COACH ? 'Coach'
                  : ((ST.roster || []).find(a => a.id === id) || {}).name || 'Runner';
        ST.atletas[id] = normalizarAtleta(d.atletas[id], nom, id === ID_COACH);
      }
    }
    if (d.challenges) ST.challenges = d.challenges;
    if (d.goals)      ST.goals      = d.goals;
    if (d.settings)   ST.settings   = d.settings;
    if (d.season)     ST.season     = d.season;
    /* Rehidratar el perfil activo desde el mapa recién bajado. */
    if (d.quienSoy && ST.atletas && ST.atletas[d.quienSoy]) {
      ST.quienSoy = d.quienSoy;
      for (const k of CAMPOS_ATLETA) {
        if (ST.atletas[d.quienSoy][k] !== undefined) ST[k] = ST.atletas[d.quienSoy][k];
      }
      /* La foto vuelve como URL de Storage. */
      if (ST.profile && ST.profile.photoURL && !ST.profile.photo) ST.profile.photo = ST.profile.photoURL;
    }
    console.log('[FB] Estado recuperado de la nube');
    return true;
  } catch (e) {
    console.error('[FB] No se pudo cargar:', e.code || e.message);
    return false;
  }
}

async function subirFoto(id, dataUrl) {
  if (!FB_LISTO || !CURRENT_USER) return null;
  try {
    const blob = await fetch(dataUrl).then(r => r.blob());
    const ref = storage().ref(`profiles/${CURRENT_USER.uid}/${id}.jpg`);
    await ref.put(blob);
    return await ref.getDownloadURL();
  } catch (e) {
    console.error('[FB] Foto:', e.code || e.message);
    return null;
  }
}

/* save() escribe a disco al instante y empuja a la nube sin bloquear.
   Se agrupa: guardar diez veces seguidas no dispara diez escrituras. */
let colaNube = null;
function sincronizar() {
  if (!FB_LISTO) return;
  clearTimeout(colaNube);
  colaNube = setTimeout(guardarEnNube, 700);
}
