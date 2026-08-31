/* ═══════════════════════════════════════════════════════════
   RUNBOUND · Tabla de loot
   Todo cosmético. Nada afecta el rendimiento ni se compra con
   dinero real — los shards solo se ganan corriendo.
   Para añadir loot: empuja un objeto a LOOT. Nada más hay que tocar.
   ═══════════════════════════════════════════════════════════ */

const RARITY = {
  rare:   { key:'rare',   label:'RARE',   weight:79, color:'#7fa8d8', dust:75  },
  epic:   { key:'epic',   label:'EPIC',   weight:18, color:'#c99bff', dust:200 },
  mythic: { key:'mythic', label:'MYTHIC', weight:3,  color:'#f0d79a', dust:600 }
};

/* type: title | avatar | frame | background
   frame  → css class f-<slug> aplicada al avatar
   background → gradiente css                                  */
const LOOT = [
  /* ── TÍTULOS · rare ─────────────────────────── */
  { id:'t_manana',    type:'title', r:'rare', em:'🛌', name:'Mañana Sí Corro' },
  { id:'t_foto',      type:'title', r:'rare', em:'📸', name:"Solo Corro Pa' la Foto" },
  { id:'t_duele',     type:'title', r:'rare', em:'🥴', name:'Me Duele Todo' },
  { id:'t_kudos',     type:'title', r:'rare', em:'👍', name:'Kudos Farmer' },
  { id:'t_tenis',     type:'title', r:'rare', em:'👟', name:'Se Para a Amarrarse los Tenis' },
  { id:'t_restday',   type:'title', r:'rare', em:'😴', name:'Rest Day Abuser' },
  { id:'t_jeans',     type:'title', r:'rare', em:'👖', name:'El Que Corre Con Jeans' },
  { id:'t_nocuenta',  type:'title', r:'rare', em:'🙅', name:'Esa Milla No Contó' },

  /* ── TÍTULOS · epic ─────────────────────────── */
  { id:'t_ultimomi',  type:'title', r:'epic', em:'👑', name:'Rey de la Última Milla' },
  { id:'t_zone2',     type:'title', r:'epic', em:'💓', name:'Zone 2 Fundamentalist' },
  { id:'t_negsplit',  type:'title', r:'epic', em:'📉', name:'Negative Split Enjoyer' },
  { id:'t_muere',     type:'title', r:'epic', em:'⚰️', name:'Empieza Rápido y Muere' },
  { id:'t_guille',    type:'title', r:'epic', em:'😎', name:'Guille de Maratonista' },
  { id:'t_reloj',     type:'title', r:'epic', em:'⌚', name:'Se Me Dañó el Reloj' },
  { id:'t_hill',      type:'title', r:'epic', em:'⛰️', name:'Hill Repeat Survivor' },
  { id:'t_5am',       type:'title', r:'epic', em:'🌅', name:'5:00 AM (A Veces)' },

  /* ── TÍTULOS · mythic ───────────────────────── */
  { id:'t_fantasma',  type:'title', r:'mythic', em:'👻', name:'El Fantasma de Tu PR' },
  { id:'t_promuerte', type:'title', r:'mythic', em:'💀', name:'PR o Muerte' },
  { id:'t_malecon',   type:'title', r:'mythic', em:'🌊', name:'Leyenda del Malecón' },
  { id:'t_termine',   type:'title', r:'mythic', em:'🏁', name:'Último Lugar Pero Terminé' },

  /* ── BANNERS ─────────────────────────────────
     Van al lado del círculo del perfil, como una placa de identidad.
     `banner` es la ruta en art/banners/; `em` queda de respaldo.   */
  { id:'bn_manana',  type:'banner', r:'rare', em:'😴', name:'Hoy Sí Corro… Mañana Vemos', banner:'banner01' },
  { id:'bn_zone2',   type:'banner', r:'rare', em:'❤️‍🔥', name:'Zone 2… Supuestamente',   banner:'banner02' },
  { id:'bn_easy',    type:'banner', r:'rare', em:'🧑‍🏫', name:'Easy Run: Mentira del Coach', banner:'banner03' },
  { id:'bn_5k',      type:'banner', r:'rare', em:'🏁', name:'5K y Después Hablamos',      banner:'banner04' },
  { id:'bn_rest',    type:'banner', r:'epic', em:'👑', name:'Rest Day Champion',          banner:'banner05' },
  { id:'bn_pace',    type:'banner', r:'epic', em:'🥹', name:'Mi Pace Tiene Sentimientos', banner:'banner06' },
  { id:'bn_ambu',    type:'banner', r:'epic', em:'🚑', name:'PR o Ambulancia',            banner:'banner07' },
  { id:'bn_quejate', type:'banner', r:'epic', em:'⚡', name:'Corre Ahora, Quéjate Después', banner:'banner08' },
  { id:'bn_gps',     type:'banner', r:'mythic', em:'🛰️', name:'GPS Dijo Que Cuenta',      banner:'banner09' },
  { id:'bn_piernas', type:'banner', r:'mythic', em:'🦵', name:'Fantasy Running 1 – Mis Piernas 0', banner:'banner10' },

  /* ── MARCOS ──────────────────────────────────
     PNG con el centro transparente: rodean la foto del perfil.
     `frame` es la ruta en art/frames/.                          */
  { id:'f_circuito', type:'frame', r:'rare', em:'⭕', name:'Circuito',            frame:'frame06' },
  { id:'f_pulso',    type:'frame', r:'rare', em:'💠', name:'Pulso Neón',         frame:'frame01' },
  { id:'f_cuadros',  type:'frame', r:'rare', em:'🏁', name:'Bandera a Cuadros',  frame:'frame03' },
  { id:'f_carbono',  type:'frame', r:'rare', em:'🖤', name:'Fibra de Carbono',   frame:'frame02' },
  { id:'f_escarcha', type:'frame', r:'epic', em:'❄️', name:'Escarcha',           frame:'frame07' },
  { id:'f_cristal',  type:'frame', r:'epic', em:'🔮', name:'Cristal Oscuro',     frame:'frame04' },
  { id:'f_laurel',   type:'frame', r:'epic', em:'🥇', name:'Laurel Dorado',      frame:'frame05' },
  { id:'f_nebulosa', type:'frame', r:'mythic', em:'🌌', name:'Nebulosa',         frame:'frame08' },
  { id:'f_infierno', type:'frame', r:'mythic', em:'🔥', name:'Infierno',         frame:'frame09' },
  { id:'f_campeon',  type:'frame', r:'mythic', em:'🏆', name:'Corona del Campeón', frame:'frame10' },

  /* ── FONDOS ─────────────────────────────────── */
  { id:'b_asfalto',   type:'background', r:'rare',   em:'🌧️', name:'Asfalto Mojado',      art:'wither',
    css:'linear-gradient(160deg,#1a1f2e,#2b3346)' },
  { id:'b_amanecer',  type:'background', r:'epic',   em:'🌄', name:'Amanecer de Milla 1', art:'war_camp',
    css:'linear-gradient(160deg,#2a1a3e,#7a3b52 60%,#c96b3a)' },
  { id:'b_neonoche',  type:'background', r:'epic',   em:'🌃', name:'Neón Nocturno',       art:'king_wolf',
    css:'linear-gradient(160deg,#0d1b2a,#1b4965 55%,#5fa8d3)' },
  { id:'b_wyrm',      type:'background', r:'mythic', em:'🐲', name:'Guarida del Wyrm',    art:'grave_mist',
    css:'linear-gradient(160deg,#1a0b2e,#4c1d95 55%,#8b2fc9)' }
];

/* Rutas. Igual que en SOVEREIGN: si la clave no existe o la imagen no
   carga, se cae al glyph y nada se rompe. */
const artSrc    = key => key ? `art/${key}.jpg` : null;
const bannerSrc = key => key ? `art/banners/${key}.jpg` : null;
const frameSrc  = key => key ? `art/frames/${key}.png` : null;

const LOOT_BY_ID = Object.fromEntries(LOOT.map(i => [i.id, i]));

const TYPE_LABEL = { title:'Título', banner:'Banner', frame:'Marco', background:'Fondo' };

/* ── Paquetes de la tienda ────────────────────────────────────
   Se compran SOLO con Run Shards ganados corriendo.
   `pool` filtra qué puede salir; `rates` sobreescribe los pesos. */
const PACKS = [
  { id:'basico', name:'Paquete Básico', em:'🎁', img:'cofre_epico', pulls:1, cost:300,
    desc:'Un summon. Puede salir cualquier cosa de la colección.',
    rates:{ rare:79, epic:18, mythic:3 } },

  { id:'diez', name:'Paquete x10', em:'📦', img:'cofre_epico', badge:'10', pulls:10, cost:2700,
    desc:'Diez summons con 10% de descuento. Epic o mejor garantizado.',
    rates:{ rare:79, epic:18, mythic:3 }, guarantee:'epic' },

  { id:'titulos', name:'Cofre de Títulos', em:'📜', img:'pack_titulos', pulls:1, cost:400,
    desc:'Solo títulos. Mejores probabilidades de Epic.',
    pool:{ type:'title' }, rates:{ rare:64, epic:30, mythic:6 } },

  { id:'wyrm', name:'Cofre del Wyrm', em:'🐲', img:'pack_wyrm', pulls:1, cost:1500,
    desc:'Nada de Rare. O sale Epic, o sale Mythic.',
    rates:{ rare:0, epic:82, mythic:18 } }
];

/* ── Compra directa con MILLAS ────────────────────────────────
   Las millas son las que corriste de verdad (se derivan de ST.runs),
   así que son MUCHO más escasas que los shards.

   Los precios están altos a propósito: comprar directo es el camino
   caro. Un cofre cuesta 300 💎 y te puede dar cualquier cosa; aquí
   pagas de más por el privilegio de ESCOGER exactamente qué quieres.
   Si no te importa cuál sale, el cofre siempre rinde más. */
const MILE_PRICE = { rare:80, epic:250, mythic:750 };

const packImg = key => key ? `art/${key}.png` : null;

/* Pity: Epic garantizado cada 10 tiradas sin Epic+.
         Mythic garantizado a las 60 tiradas sin Mythic. */
const PITY = { epic:10, mythic:60 };

/* Duplicados devuelven `dust` shards según rareza (≈25% del costo). */
