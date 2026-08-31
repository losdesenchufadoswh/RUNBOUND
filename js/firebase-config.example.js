/* Plantilla de firebase-config.js — copia esto y llena con lo tuyo.

   El config REAL sí va commiteado, a propósito. RUNBOUND es estático puro
   (sin build), así que el navegador carga este archivo tal cual: las env
   vars de Vercel no se pueden inyectar aquí, no hay quién las sustituya.

   Y no hace falta esconderlo: la apiKey web de Firebase es un
   IDENTIFICADOR, no un secreto. Lo que protege tus datos son las Security
   Rules ($uid === auth.uid) y los dominios autorizados en la consola.
   Si esas dos están bien, publicar el config no abre nada. */

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
