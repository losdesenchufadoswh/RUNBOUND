/* Firebase init. Por ahora, login local + localStorage.
   Cuando configures la autenticación anónima en Firebase Console,
   descomentas el signInAnonymously() real. */

/* Inicializar Firebase */
firebase.initializeApp({
  apiKey: "AIzaSyBSw8tzlG3MzPdKUEilCqAHd6mEl2__1EU",
  authDomain: "runbound-66838.firebaseapp.com",
  projectId: "runbound-66838",
  databaseURL: "https://runbound-66838-default-rtdb.firebaseio.com",
  storageBucket: "runbound-66838.firebasestorage.app",
  messagingSenderId: "866266403470",
  appId: "1:866266403470:web:af463a55cd33cab58eafdf"
});

const db = () => firebase.database();
const auth = () => firebase.auth();
const storage = () => firebase.storage();

let CURRENT_USER = null;

/* Login local (fallback mientras configuras Firebase). */
function loginLocal() {
  let uid = localStorage.getItem('runbound.uid');
  if (!uid) {
    uid = 'user_' + Math.random().toString(36).slice(2, 15) + Date.now().toString(36);
    localStorage.setItem('runbound.uid', uid);
  }
  CURRENT_USER = { uid, isLocal: true, isAnonymous: true };
  console.log('[FB] Login local:', uid.slice(0, 8));
}

/* Boot: esperar un poco, luego login local (el app trabaja con Firebase Console después). */
setTimeout(() => {
  if (!CURRENT_USER) loginLocal();
}, 100);

/* Guardar a Firebase (cuando esté conectado). */
async function saveToFirebase() {
  if (!CURRENT_USER) return;
  if (CURRENT_USER.isLocal) {
    /* Por ahora, solo localStorage */
    return;
  }
  try {
    const uid = CURRENT_USER.uid;
    const profileCopy = { ...ST.profile };
    if (profileCopy.photo && profileCopy.photo.startsWith('data:')) {
      profileCopy.photoURL = await uploadPhoto(profileCopy.photo);
      delete profileCopy.photo;
    }
    await db().ref(`users/${uid}`).set({
      profile: profileCopy,
      collection: ST.collection,
      runs: ST.runs,
      challenges: ST.challenges,
      gacha: ST.gacha,
      log: ST.log,
      lastSync: new Date().toISOString()
    });
  } catch (err) {
    console.error('[FB] Error guardando:', err);
  }
}

/* Cargar desde Firebase. */
async function loadFromFirebase() {
  if (!CURRENT_USER || CURRENT_USER.isLocal) return;
  try {
    const uid = CURRENT_USER.uid;
    const snap = await db().ref(`users/${uid}`).once('value');
    if (snap.exists()) {
      const data = snap.val();
      if (data.profile) ST.profile = { ...ST.profile, ...data.profile };
      if (data.collection) ST.collection = data.collection;
      if (data.runs) ST.runs = data.runs;
      if (data.challenges) ST.challenges = data.challenges;
      if (data.gacha) ST.gacha = data.gacha;
      if (data.log) ST.log = data.log;
      console.log('[FB] Datos cargados desde Firebase');
    }
  } catch (err) {
    console.error('[FB] Error cargando:', err);
  }
}

/* Foto en Storage. */
async function uploadPhoto(dataUrl) {
  if (!CURRENT_USER || !dataUrl || CURRENT_USER.isLocal) return null;
  try {
    const blob = await fetch(dataUrl).then(r => r.blob());
    const filename = `${CURRENT_USER.uid}-profile.jpg`;
    const ref_path = storage().ref(`profiles/${filename}`);
    await ref_path.put(blob);
    return await ref_path.getDownloadURL();
  } catch (err) {
    console.error('[FB] Error foto:', err);
    return null;
  }
}

/* Hookear save() */
if (typeof window !== 'undefined') {
  const origSave = window.save;
  window.save = async function() {
    localStorage.setItem('runbound.v1', JSON.stringify(ST));
    await saveToFirebase();
  };
}
