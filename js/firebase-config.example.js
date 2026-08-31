/* Firebase config EXAMPLE — NO COMMITEAR credenciales reales
   Para desarrollo: copia esto a firebase-config-dev.js (gitignored) y llena con tus credenciales
   Para Vercel: configura env vars en el dashboard de Vercel */

firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  databaseURL: "YOUR_DATABASE_URL",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
});

const db = () => firebase.database();
const auth = () => firebase.auth();
const storage = () => firebase.storage();

let CURRENT_USER = null;

function loginLocal() {
  let uid = localStorage.getItem('runbound.uid');
  if (!uid) {
    uid = 'user_' + Math.random().toString(36).slice(2, 15) + Date.now().toString(36);
    localStorage.setItem('runbound.uid', uid);
  }
  CURRENT_USER = { uid, isLocal: true, isAnonymous: true };
  console.log('[FB] Login local:', uid.slice(0, 8));
}

setTimeout(() => { if (!CURRENT_USER) loginLocal(); }, 100);

async function saveToFirebase() { /* ... */ }
async function loadFromFirebase() { /* ... */ }
async function uploadPhoto(dataUrl) { /* ... */ }

if (typeof window !== 'undefined') {
  const origSave = window.save;
  window.save = async function() {
    localStorage.setItem('runbound.v1', JSON.stringify(ST));
    await saveToFirebase();
  };
}
