// ============================================================
// Fuente de navegador OBS
// Reproductor de música 24/7 + bloques de noticias con QR
// ============================================================

const CONFIG = {
  musicScanUrl: "music/playlist.php", // metodo principal: escanea /music en vivo (requiere PHP)
  musicDirUrl: "music/",              // respaldo: listado de directorio del server (sin PHP)
  playlistUrl: "music/playlist.json", // overrides de titulo/artista + respaldo si no hay PHP ni listado
  newsUrl: "news/news.json",       // noticias cargadas a mano
  newsRssUrl: "news/rss.json",     // noticias auto-generadas desde el RSS del sitio (opcional)
  backgroundsScanUrl: "backgrounds/playlist.php", // metodo principal: escanea /backgrounds en vivo (requiere PHP)
  backgroundsDirUrl: "backgrounds/",              // respaldo: listado de directorio del server (sin PHP)
  backgroundsPlaylistUrl: "backgrounds/playlist.json", // respaldo si no hay PHP ni listado
  backgroundsExternalUrl: "backgrounds/external.json", // fondos alojados afuera del repo (opcional)
  playlistRefreshMs: 2 * 60 * 1000,   // re-chequear /music cada 2 min
  newsRefreshMs: 3 * 60 * 1000,       // releer news.json cada 3 min
  newsIntervalMs: 15 * 60 * 1000,     // cada cuanto se dispara un bloque de noticias
  newsItemsPerBlock: 2,                // cuantas noticias seguidas se muestran en cada bloque
  newsDisplayMs: 30 * 1000,           // cuánto queda visible cada noticia dentro del bloque
  newsMaxAgeDays: 7,                  // noticias con "date" mas viejo que esto se dejan de mostrar
  backgroundsRefreshMs: 2 * 60 * 1000,  // re-chequear /backgrounds cada 2 min
  backgroundImageDurationMs: 35 * 1000, // cuanto queda cada imagen antes de pasar a la siguiente
  maxVideoDurationMs: 6 * 60 * 1000,    // watchdog: si un video se cuelga, forzar avance despues de esto
  qrSize: 200,
  qrUtmParams: "utm_source=youtube&utm_medium=qrscan&utm_campaign=lasocia", // tracking del QR de noticias
  subscribeFirstDelayMs: 60 * 1000,     // primera aparicion: al minuto de abrir la pagina
  subscribeIntervalMs: 10 * 60 * 1000,  // despues, cada 10 minutos
  subscribeDisplayMs: 15 * 1000,        // cuanto queda visible cada vez
};

const VALID_AUDIO_EXT = [".mp3", ".m4a", ".ogg", ".wav", ".flac"];
const VALID_IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const VALID_VIDEO_EXT = [".mp4", ".webm", ".mov", ".m4v"];
const VALID_BACKGROUND_EXT = [...VALID_IMAGE_EXT, ...VALID_VIDEO_EXT];

// ---------------- Reproductor ----------------

const audio = document.getElementById("audio");
const trackTitleEl = document.getElementById("trackTitle");
const trackArtistEl = document.getElementById("trackArtist");
const progressFill = document.getElementById("progressFill");
const playerEl = document.getElementById("player");
const autoplayGate = document.getElementById("autoplayGate");
const autoplayBtn = document.getElementById("autoplayBtn");

let playlist = [];
let history = [];
let currentTrack = null;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickNextTrack() {
  if (playlist.length === 0) return null;
  if (playlist.length === 1) return playlist[0];

  let pool = playlist;
  if (currentTrack) {
    pool = playlist.filter((t) => t.file !== currentTrack.file);
  }
  const shuffled = shuffle(pool);
  return shuffled[0];
}

function titleFromFilename(filename) {
  const base = filename.replace(/\.[^/.]+$/, "");
  const parts = base.split(" - ");
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
  }
  return { artist: "", title: base.trim() };
}

// Lee el listado de directorio que sirve el servidor HTTP para una
// carpeta dada (funciona con `python3 -m http.server`, Apache/nginx con
// autoindex, etc.) y devuelve los nombres de archivo que matcheen las
// extensiones validas pasadas.
async function scanDirectory(dirUrl, validExts) {
  try {
    const res = await fetch(dirUrl + "?t=" + Date.now());
    if (!res.ok) throw new Error("No se pudo listar " + dirUrl);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const anchors = Array.from(doc.querySelectorAll("a[href]"));
    const files = anchors
      .map((a) => {
        try {
          const url = new URL(a.getAttribute("href"), location.href);
          return decodeURIComponent(url.pathname.split("/").pop());
        } catch {
          return null;
        }
      })
      .filter((name) => {
        if (!name) return false;
        const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
        return validExts.includes(ext);
      });
    // sin duplicados
    return Array.from(new Set(files));
  } catch (err) {
    console.warn(`No se pudo auto-escanear ${dirUrl} (¿autoindex deshabilitado?):`, err);
    return [];
  }
}

function scanMusicDirectory() {
  return scanDirectory(CONFIG.musicDirUrl, VALID_AUDIO_EXT);
}

// Metodo PRINCIPAL: music/playlist.php escanea la carpeta /music en
// vivo, en cada request (ver ese archivo). Funciona en cualquier
// hosting con PHP, WordPress incluido, sin depender de que el server
// liste directorios ni de correr ningun script a mano: basta con subir
// o borrar mp3s en /music.
async function loadPlaylistFromPhp() {
  try {
    const res = await fetch(CONFIG.musicScanUrl + "?t=" + Date.now());
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    return data.filter((t) => t && t.file);
  } catch {
    return null; // PHP no disponible en este hosting (ej. server estatico local)
  }
}

// Metodo de RESPALDO (sin PHP): playlist.json generado a mano con
// scripts/generate_playlist.py. Devuelve tanto la lista de archivos
// como overrides de titulo/artista para cada uno.
async function loadDeclaredPlaylist() {
  try {
    const res = await fetch(CONFIG.playlistUrl + "?t=" + Date.now());
    if (!res.ok) return {};
    const data = await res.json();
    const tracks = Array.isArray(data) ? data : data.tracks || [];
    const map = {};
    for (const t of tracks) {
      if (typeof t === "string") {
        map[t] = {};
      } else if (t.file) {
        map[t.file] = t;
      }
    }
    return map;
  } catch {
    return {};
  }
}

async function loadPlaylist() {
  const phpTracks = await loadPlaylistFromPhp();
  if (phpTracks && phpTracks.length > 0) {
    playlist = phpTracks.map((t) => {
      const parsed = titleFromFilename(t.file);
      return {
        file: t.file,
        title: t.title || parsed.title,
        artist: t.artist || parsed.artist,
      };
    });
    return;
  }

  const declared = await loadDeclaredPlaylist();
  let sourceFiles = Object.keys(declared);

  // Fallback SOLO para pruebas locales sin PHP: si playlist.json
  // todavia no fue generado (o esta vacio), intentamos auto-escanear
  // /music. Esto requiere que el servidor liste directorios (funciona
  // con `python3 -m http.server`), algo que casi ningun hosting de
  // produccion tiene habilitado.
  if (sourceFiles.length === 0) {
    sourceFiles = await scanMusicDirectory();
  }

  playlist = sourceFiles.map((file) => {
    const parsed = titleFromFilename(file);
    const override = declared[file] || {};
    return {
      file,
      title: override.title || parsed.title,
      artist: override.artist || parsed.artist,
    };
  });
}

function updateNowPlayingUI(track) {
  playerEl.classList.add("fading");
  setTimeout(() => {
    trackTitleEl.textContent = track.title || track.file;
    trackArtistEl.textContent = track.artist || "";
    playerEl.classList.remove("fading");
  }, 220);
}

function playTrack(track) {
  if (!track) return;
  currentTrack = track;
  audio.src = "music/" + encodeURIComponent(track.file);
  audio.play().then(() => {
    autoplayGate.classList.add("hidden");
  }).catch((err) => {
    console.warn("Autoplay bloqueado, esperando interacción:", err);
    autoplayGate.classList.remove("hidden");
  });
  updateNowPlayingUI(track);
}

function playNext() {
  const next = pickNextTrack();
  if (next) playTrack(next);
}

audio.addEventListener("ended", playNext);
audio.addEventListener("error", () => {
  console.warn("Error reproduciendo, salto a la siguiente canción.");
  setTimeout(playNext, 800);
});
audio.addEventListener("timeupdate", () => {
  if (audio.duration) {
    progressFill.style.width = (audio.currentTime / audio.duration) * 100 + "%";
  }
});

autoplayBtn.addEventListener("click", () => {
  autoplayGate.classList.add("hidden");
  audio.play();
});

setInterval(async () => {
  await loadPlaylist();
  // Si al arrancar la pagina la playlist estaba vacia (playlist.json
  // todavia no listo, red lenta, etc.) y recien ahora aparecen temas,
  // arrancamos la reproduccion aca — si no, el audio quedaba mudo el
  // resto de la transmision porque nada mas vuelve a llamar a playNext().
  if (playlist.length > 0 && !currentTrack) {
    playNext();
  }
}, CONFIG.playlistRefreshMs);

// Red de seguridad: si el audio quedo pausado por cualquier motivo
// (autoplay bloqueado, error transitorio del navegador) reintentamos
// solos cada rato, en vez de quedar mudos el resto de la transmision
// esperando un click que en OBS nunca va a llegar.
setInterval(() => {
  if (currentTrack && audio.paused) {
    audio.play().then(() => autoplayGate.classList.add("hidden")).catch(() => {});
  }
}, 15000);

// ---------------- Reloj ----------------

const clockEl = document.getElementById("clock");
function tickClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  clockEl.textContent = `${hh}:${mm}`;
}
tickClock();
setInterval(tickClock, 15000);

// ---------------- Noticias ----------------
// Pantalla completa que reemplaza el fondo de publicidades mientras
// esta activa. Se muestran CONFIG.newsItemsPerBlock noticias seguidas
// ("bloque"), pausando el slideshow de /backgrounds, y al terminar el
// bloque el slideshow continua solo. Arranca con un bloque apenas
// carga la pagina, y despues se repite cada CONFIG.newsIntervalMs.

const newsScreen = document.getElementById("newsScreen");
const newsTag = document.getElementById("newsTag");
const newsImage = document.getElementById("newsImage");
const newsText = document.getElementById("newsText");
const newsQr = document.getElementById("newsQr");

let newsList = [];
let newsIndex = 0;
let newsBlockRunning = false;

// Una noticia con "date" mas vieja que newsMaxAgeDays se deja de
// mostrar sola (sin fecha, o con una fecha invalida, nunca expira —
// asi las noticias ya cargadas antes de esta funcion no desaparecen
// de golpe).
function isNewsItemFresh(item) {
  if (!item || !item.date) return true;
  const published = new Date(item.date);
  if (isNaN(published.getTime())) return true;
  const ageMs = Date.now() - published.getTime();
  return ageMs <= CONFIG.newsMaxAgeDays * 24 * 60 * 60 * 1000;
}

// Lee un archivo de noticias en JSON (array, o { news: [...] }). Si
// no existe o falla, devuelve una lista vacia en vez de romper todo -
// asi news/rss.json puede no existir todavia (o fallar el RSS puntual)
// sin afectar a las noticias cargadas a mano, y viceversa.
async function fetchNewsFile(url) {
  try {
    const res = await fetch(url + "?t=" + Date.now());
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.news || [];
  } catch {
    return [];
  }
}

async function loadNews() {
  const [manual, rss] = await Promise.all([
    fetchNewsFile(CONFIG.newsUrl),
    fetchNewsFile(CONFIG.newsRssUrl),
  ]);
  // Si una noticia cargada a mano ya cubre el mismo link que trajo el
  // RSS, no la repetimos: la version manual (curada) gana.
  const manualLinks = new Set(manual.map((item) => item && item.link).filter(Boolean));
  const dedupedRss = rss.filter((item) => !item || !item.link || !manualLinks.has(item.link));
  newsList = manual.concat(dedupedRss).filter(isNewsItemFresh);
}

// Agrega los parametros UTM de tracking al link antes de generar el QR,
// para poder medir en Analytics/YouTube cuanta gente escanea desde la
// transmision. Respeta query params que ya tenga el link.
function addUtmParams(link) {
  const separator = link.includes("?") ? "&" : "?";
  return link + separator + CONFIG.qrUtmParams;
}

function qrUrlFor(link) {
  const encoded = encodeURIComponent(addUtmParams(link));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${CONFIG.qrSize}x${CONFIG.qrSize}&data=${encoded}`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Ticker inferior de redes: visible solo mientras NO hay un bloque de
// noticias en pantalla (ver runNewsBlock). El CSS hace el resto
// (aparecer/desaparecer y correr el marquee solo cuando esta visible).
function setSocialTickerVisible(visible) {
  document.body.classList.toggle("ticker-visible", visible);
}

// Muestra una noticia y espera CONFIG.newsDisplayMs antes de resolver.
function showNewsItem(item) {
  if (!item || (!item.text && !item.image)) return Promise.resolve();

  // La categoria viene del RSS (<category> de WordPress) cuando la
  // noticia es automatica; si no hay, o es una noticia cargada a mano
  // sin categoria, se usa el tag generico de siempre.
  newsTag.textContent = item.category || "NOTICIA";

  // Si la imagen no carga (link roto, 404), la ocultamos en vez de
  // mostrar el ícono de imagen rota.
  if (item.image) {
    newsImage.onerror = () => { newsImage.style.display = "none"; };
    newsImage.onload = () => { newsImage.style.display = ""; };
    newsImage.src = item.image;
  } else {
    newsImage.style.display = "none";
  }

  newsText.textContent = item.text || "";

  if (item.link) {
    // Si el QR no carga (api.qrserver.com caido/lento/bloqueado),
    // ocultamos toda la fila en vez de mostrar el icono de imagen rota
    // a pantalla completa.
    newsQr.onerror = () => { newsScreen.classList.add("no-link"); };
    newsQr.onload = () => { newsScreen.classList.remove("no-link"); };
    newsScreen.classList.remove("no-link");
    newsQr.src = qrUrlFor(item.link);
  } else {
    newsScreen.classList.add("no-link");
  }

  newsScreen.classList.add("visible");
  return wait(CONFIG.newsDisplayMs);
}

// Corre un bloque completo de noticias: pausa el slideshow de fondos,
// muestra hasta newsItemsPerBlock noticias una atras de otra, y al
// terminar retoma el slideshow. Si no hay noticias cargadas, no hace
// nada mas que asegurarse de que el slideshow este corriendo.
async function runNewsBlock() {
  if (newsBlockRunning) return;
  newsBlockRunning = true;
  setSocialTickerVisible(false);
  pauseBackgroundRotation();

  if (newsList && newsList.length > 0) {
    const count = Math.min(CONFIG.newsItemsPerBlock, newsList.length);
    for (let i = 0; i < count; i++) {
      const item = newsList[newsIndex % newsList.length];
      newsIndex++;
      await showNewsItem(item);
      newsScreen.classList.remove("visible");
      await wait(700); // pausa breve entre una noticia y la siguiente (coincide con la transicion CSS)
      // Cortamos cualquier carga de imagen que siga pendiente y limpiamos
      // el src, asi una respuesta tardia no puede "colarse" mas adelante.
      newsImage.onload = null;
      newsImage.onerror = null;
      newsImage.removeAttribute("src");
      newsQr.onload = null;
      newsQr.onerror = null;
      newsQr.removeAttribute("src");
    }
  }

  newsBlockRunning = false;
  resumeBackgroundRotation();
  setSocialTickerVisible(true);
}

setInterval(async () => {
  await loadNews();
}, CONFIG.newsRefreshMs);

setInterval(runNewsBlock, CONFIG.newsIntervalMs);

// ---------------- Fondos rotativos (publicidades) ----------------
// Imagenes y video mudo de /backgrounds, a pantalla completa detras de
// todo lo demas. Mismo esquema de 3 metodos que la musica: PHP en vivo
// (WordPress) > backgrounds/playlist.json (GitHub Pages) > auto-escaneo
// de directorio (solo pruebas locales).

// Dos capas alternadas (cada una con su propio <img> y <video>) para
// poder hacer un crossfade real entre un fondo y el siguiente, en vez
// de cortar en seco al cambiar el src de un unico elemento.
function makeLayer(id) {
  const el = document.getElementById(id);
  const img = el.querySelector(".bg-layer-img");
  const video = el.querySelector(".bg-layer-video");
  video.muted = true; // nunca debe sonar, desde el primer momento
  video.volume = 0;
  return { el, img, video };
}

const bgLayers = [makeLayer("bgLayerA"), makeLayer("bgLayerB")];
let activeLayerIndex = 0;
const BG_CROSSFADE_MS = 1100; // debe coincidir con la transition de .bg-layer en CSS

let backgrounds = [];
let currentBackground = null;
let bgAdvanceTimer = null;

// Cuantas veces fallo cada archivo consecutivamente en esta sesion. Si
// un archivo esta roto o hay un corte de red, esto evita reintentar en
// loop rapido para siempre: despues de un par de fallos se lo saltea
// hasta el proximo refresh de la lista (que le da otra chance a todos).
let backgroundFailCounts = {};
const MAX_BACKGROUND_FAILS = 2;

function recordBackgroundFailure(file) {
  backgroundFailCounts[file] = (backgroundFailCounts[file] || 0) + 1;
}

function backgroundType(fileOrUrl) {
  // Corta query string / hash antes de mirar la extension (una URL
  // externa puede traer "?algo=valor" despues del nombre de archivo).
  const clean = fileOrUrl.split(/[?#]/)[0];
  const ext = clean.slice(clean.lastIndexOf(".")).toLowerCase();
  if (VALID_VIDEO_EXT.includes(ext)) return "video";
  if (VALID_IMAGE_EXT.includes(ext)) return "image";
  return null;
}

function isExternalUrl(fileOrUrl) {
  return /^https?:\/\//i.test(fileOrUrl);
}

// backgrounds/external.json (opcional): fondos alojados afuera del repo
// (GitHub Releases, Drive, Cloudflare R2, etc.), para no subir videos
// pesados a git. Cada entrada es una URL completa, o
// { "url": "...", "type": "video" } cuando la URL no termina en una
// extension reconocible (ej. un link de descarga de Google Drive) y
// hace falta indicar el tipo a mano.
async function loadExternalBackgrounds() {
  try {
    const res = await fetch(CONFIG.backgroundsExternalUrl + "?t=" + Date.now());
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.items || [];
    return list
      .map((entry) => {
        if (typeof entry === "string") {
          return { file: entry, type: backgroundType(entry) };
        }
        if (entry && entry.url) {
          return { file: entry.url, type: entry.type || backgroundType(entry.url) };
        }
        return null;
      })
      .filter((item) => item && item.type);
  } catch {
    return [];
  }
}

async function loadBackgroundsFromPhp() {
  try {
    const res = await fetch(CONFIG.backgroundsScanUrl + "?t=" + Date.now());
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    return data
      .map((t) => (typeof t === "string" ? t : t.file))
      .filter(Boolean);
  } catch {
    return null; // PHP no disponible en este hosting
  }
}

async function loadBackgroundsFromJson() {
  try {
    const res = await fetch(CONFIG.backgroundsPlaylistUrl + "?t=" + Date.now());
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.files || [];
    return list.map((t) => (typeof t === "string" ? t : t.file)).filter(Boolean);
  } catch {
    return [];
  }
}

async function loadBackgrounds() {
  let files = await loadBackgroundsFromPhp();

  if (!files || files.length === 0) {
    files = await loadBackgroundsFromJson();
  }
  if (files.length === 0) {
    files = await scanDirectory(CONFIG.backgroundsDirUrl, VALID_BACKGROUND_EXT);
  }

  const localItems = files
    .map((file) => ({ file, type: backgroundType(file) }))
    .filter((item) => item.type !== null);

  const externalItems = await loadExternalBackgrounds();

  backgrounds = localItems.concat(externalItems);
  backgroundFailCounts = {}; // le damos otra chance a todos en cada refresh
}

function pickNextBackground() {
  if (backgrounds.length === 0) return null;

  // Evitamos elegir archivos que vienen fallando en loop (roto, o un
  // corte de red puntual) hasta el proximo refresh de la lista.
  const usable = backgrounds.filter(
    (b) => (backgroundFailCounts[b.file] || 0) < MAX_BACKGROUND_FAILS
  );
  const pool = usable.length > 0 ? usable : backgrounds;
  if (pool.length === 1) return pool[0];

  let filtered = pool;
  if (currentBackground) {
    filtered = pool.filter((b) => b.file !== currentBackground.file);
  }
  return shuffle(filtered.length > 0 ? filtered : pool)[0];
}

function advanceBackground() {
  if (bgAdvanceTimer) {
    clearTimeout(bgAdvanceTimer);
    bgAdvanceTimer = null;
  }
  const next = pickNextBackground();
  if (next) showBackground(next);
}

// Apaga y limpia la capa que quedo debajo despues del cruce, para no
// gastar red/CPU de mas reproduciendo un video invisible.
function deactivateLayer(layer) {
  layer.el.classList.remove("active");
  layer.video.onended = null;
  layer.video.onerror = null;
  layer.video.pause();
  layer.video.removeAttribute("src");
  layer.img.onload = null;
  layer.img.onerror = null;
  layer.img.removeAttribute("src");
}

// Hace el crossfade real: la capa "idle" (ya con el contenido nuevo
// cargado/listo) pasa a activa con una transicion de opacity, mientras
// la que estaba activa se desvanece. Una vez terminado el cruce, se
// apaga la que quedo abajo.
function crossfadeTo(idleIndex) {
  const outgoingIndex = activeLayerIndex;
  bgLayers[idleIndex].el.classList.add("active");
  bgLayers[outgoingIndex].el.classList.remove("active");
  activeLayerIndex = idleIndex;
  setTimeout(() => deactivateLayer(bgLayers[outgoingIndex]), BG_CROSSFADE_MS + 100);
}

function showBackground(item) {
  currentBackground = item;
  recordBackgroundImpression(item.file); // para el reporte de impresiones (ver stats.html)
  const src = isExternalUrl(item.file)
    ? item.file
    : CONFIG.backgroundsDirUrl + encodeURIComponent(item.file);

  const idleIndex = 1 - activeLayerIndex;
  const idle = bgLayers[idleIndex];

  if (item.type === "video") {
    idle.img.style.display = "none";
    idle.video.style.display = "";
    // Los videos de /backgrounds NUNCA deben sonar, tengan o no pista
    // de audio. El atributo "muted" del <video> en el HTML ya lo hace,
    // pero lo reforzamos tambien por JS (propiedad, no solo atributo)
    // para que quede garantizado pase lo que pase.
    idle.video.muted = true;
    idle.video.volume = 0;
    idle.video.onended = advanceBackground;
    idle.video.onerror = () => {
      recordBackgroundFailure(item.file);
      setTimeout(advanceBackground, 1500);
    };
    // Recien cruzamos cuando el video efectivamente arranco a
    // reproducirse, para no hacer fade-in a un frame negro/vacio.
    idle.video.oncanplay = () => {
      idle.video.oncanplay = null;
      idle.video
        .play()
        .then(() => crossfadeTo(idleIndex))
        .catch(() => {
          recordBackgroundFailure(item.file);
          setTimeout(advanceBackground, 1500);
        });
    };
    idle.video.src = src;
    idle.video.currentTime = 0;
    // Watchdog: si el video se cuelga a mitad de reproduccion (nunca
    // dispara "ended" ni "error"), no queremos que el fondo quede
    // congelado ahi para siempre. advanceBackground() ya cancela este
    // timer si "ended" llega antes.
    bgAdvanceTimer = setTimeout(advanceBackground, CONFIG.maxVideoDurationMs);
  } else {
    idle.video.style.display = "none";
    idle.img.style.display = "";
    idle.img.onload = () => crossfadeTo(idleIndex);
    idle.img.onerror = () => {
      recordBackgroundFailure(item.file);
      setTimeout(advanceBackground, 1000);
    };
    idle.img.src = src;
    bgAdvanceTimer = setTimeout(advanceBackground, CONFIG.backgroundImageDurationMs);
  }
}

// Pausa el slideshow de fondos (usado mientras se muestra un bloque de
// noticias, que ocupa toda la pantalla y lo tapa). No hace falta
// ocultar nada explicitamente: la pantalla de noticias ya cubre todo.
function pauseBackgroundRotation() {
  if (bgAdvanceTimer) {
    clearTimeout(bgAdvanceTimer);
    bgAdvanceTimer = null;
  }
  const active = bgLayers[activeLayerIndex];
  if (!active.video.paused) active.video.pause();
}

// Retoma el slideshow de fondos despues de un bloque de noticias (o lo
// arranca por primera vez).
function resumeBackgroundRotation() {
  advanceBackground();
}

setInterval(async () => {
  await loadBackgrounds();
}, CONFIG.backgroundsRefreshMs);

// ---------------- Popup de suscripción ----------------
// Desciende desde el centro-arriba, queda visible subscribeDisplayMs
// y vuelve a subir. Arranca al minuto de abrir la pagina y despues se
// repite cada subscribeIntervalMs.

const subscribePopup = document.getElementById("subscribePopup");

function showSubscribePopup() {
  // Evitamos superponerlo con la pantalla de noticias a pantalla
  // completa; si coincide, se salta esta vez y aparece en el proximo turno.
  if (newsBlockRunning) return;

  subscribePopup.classList.add("visible");
  setTimeout(() => {
    subscribePopup.classList.remove("visible");
  }, CONFIG.subscribeDisplayMs);
}

setTimeout(() => {
  showSubscribePopup();
  setInterval(showSubscribePopup, CONFIG.subscribeIntervalMs);
}, CONFIG.subscribeFirstDelayMs);

// ---------------- Arranque ----------------

(async function start() {
  await Promise.all([loadPlaylist(), loadNews(), loadBackgrounds()]);
  if (playlist.length > 0) playNext();
  else {
    trackTitleEl.textContent = "Sin canciones en /music";
    trackArtistEl.textContent = "Agregá archivos y actualizá playlist.json";
  }
  // Arranca con un bloque de noticias (newsItemsPerBlock seguidas); al
  // terminar, el propio bloque deja andando el slideshow de fondos.
  // El próximo bloque de noticias es a los newsIntervalMs desde acá.
  await runNewsBlock();
})();
