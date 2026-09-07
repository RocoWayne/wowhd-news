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
  newsItemsPerBlock: 3,                // cuantas noticias seguidas se muestran en cada bloque
  newsDisplayMs: 30 * 1000,           // cuánto queda visible cada noticia dentro del bloque
  newsOutroMs: 15 * 1000,             // cuánto dura el mensaje de cierre al terminar una tanda de noticias
  newsContentFadeMs: 500,             // crossfade del contenido (no de la barra de progreso) entre una noticia y la siguiente
  newsMediaTimeoutMs: 3000,           // cuanto se espera como maximo a que carguen la imagen/QR entrantes antes de revelar el contenido igual
  newsMaxAgeDays: 7,                  // noticias con "date" mas viejo que esto se dejan de mostrar
  backgroundsRefreshMs: 2 * 60 * 1000,  // re-chequear /backgrounds cada 2 min
  backgroundImageDurationMs: 35 * 1000, // cuanto queda cada imagen antes de pasar a la siguiente
  maxVideoDurationMs: 6 * 60 * 1000,    // watchdog: si un video se cuelga, forzar avance despues de esto
  qrSize: 200,
  qrUtmParams: "utm_source=youtube&utm_medium=qrscan&utm_campaign=lasociacomar", // tracking del QR de noticias
  audioCrossfadeMs: 3000, // duracion del crossfade de audio entre una cancion y la siguiente
  subscribeFirstDelayMs: 60 * 1000,     // primera aparicion: al minuto de abrir la pagina
  subscribeIntervalMs: 10 * 60 * 1000,  // despues, cada 10 minutos
  subscribeDisplayMs: 15 * 1000,        // cuanto queda visible cada vez
  clockRotationMs: 5 * 60 * 1000,       // cada cuanto cambia de pais el reloj
  clockZones: [                         // paises que va mostrando el reloj (y el clima, ver mas abajo), en este orden
    { flag: "🇦🇷", label: "Buenos Aires", timeZone: "America/Argentina/Buenos_Aires", lat: -34.6037, lon: -58.3816 },
    { flag: "🇵🇪", label: "Lima", timeZone: "America/Lima", lat: -12.0464, lon: -77.0428 },
    { flag: "🇨🇴", label: "Bogotá", timeZone: "America/Bogota", lat: 4.7110, lon: -74.0721 },
    { flag: "🇲🇽", label: "Ciudad de México", timeZone: "America/Mexico_City", lat: 19.4326, lon: -99.1332 },
    { flag: "🇺🇸", label: "Nueva York", timeZone: "America/New_York", lat: 40.7128, lon: -74.0060 },
  ],
  weatherApiUrl: "https://api.open-meteo.com/v1/forecast", // API publica de Open-Meteo, sin API key
  weatherRefreshMs: 30 * 60 * 1000,     // re-consultar el clima cada 30 min (no hace falta mas seguido)
  // weatherIntervalMs (20 min) es divisor exacto de 60, igual que el
  // resto de los intervalos de las pantallas a pantalla completa
  // (15/20/60/90/60 min: noticias/clima/cotizacion/mercados/camara en
  // vivo) - todos son multiplos o divisores de 60, asi la posicion de
  // cada bloque dentro de cada hora queda FIJA para siempre (no
  // "flota" de hora en hora). Eso permite elegir a mano un huequito
  // libre para cada uno y garantizar que nunca se pisen entre si
  // (verificado con una simulacion de 5 horas: cero colisiones, margen
  // minimo real ~59s). Si se cambia cualquiera de los
  // *FirstDelayMs/*IntervalMs/*DisplayMs de estos 5 bloques, conviene
  // volver a chequear que siguen sin pisarse.
  weatherFirstDelayMs: 8 * 60 * 1000,   // primera pantalla de clima a los 8 min de abrir la pagina (cae en :08/:28/:48 de cada hora)
  weatherIntervalMs: 20 * 60 * 1000,
  weatherDisplayMs: 60 * 1000,          // cuanto queda visible la pantalla de clima
  currencyApiUrl: "https://open.er-api.com/v6/latest/USD", // API publica de tipo de cambio, sin API key
  currencyBaseCode: "USD",
  currencyCurrencies: [                 // monedas que se muestran (mismos paises que el reloj/clima + euro)
    { flag: "🇦🇷", label: "Peso argentino", code: "ARS" },
    { flag: "🇵🇪", label: "Sol peruano", code: "PEN" },
    { flag: "🇨🇴", label: "Peso colombiano", code: "COP" },
    { flag: "🇲🇽", label: "Peso mexicano", code: "MXN" },
    { flag: "🇪🇺", label: "Euro", code: "EUR" },
  ],
  currencyRefreshMs: 60 * 60 * 1000,    // re-consultar la cotizacion cada 1 hora
  currencyFirstDelayMs: 35 * 60 * 1000, // primera pantalla de cotizacion a los 35 min (cae en :35 de cada hora, lejos de todo lo demas)
  currencyIntervalMs: 60 * 60 * 1000,   // despues, cada 1 hora aprox
  currencyDisplayMs: 30 * 1000,         // cuanto queda visible la pantalla de cotizacion
  marketsApiUrl: "https://api.coingecko.com/api/v3/simple/price", // API publica de CoinGecko, sin API key
  marketsAssets: [                      // criptomonedas que se muestran (id de CoinGecko + simbolo/nombre)
    { id: "bitcoin", symbol: "BTC", label: "Bitcoin" },
    { id: "ethereum", symbol: "ETH", label: "Ethereum" },
    { id: "binancecoin", symbol: "BNB", label: "BNB" },
    { id: "solana", symbol: "SOL", label: "Solana" },
    { id: "ripple", symbol: "XRP", label: "XRP" },
  ],
  marketsRefreshMs: 30 * 60 * 1000,     // re-consultar los precios cada 30 min
  marketsFirstDelayMs: 41 * 60 * 1000,  // primera pantalla de mercados a los 41 min (al ser cada 90 min, alterna entre :41 y :11 de cada hora, ambos verificados libres)
  marketsIntervalMs: 90 * 60 * 1000,    // despues, cada 1 hora y media
  marketsDisplayMs: 30 * 1000,          // cuanto queda visible la pantalla de mercados
  liveCamsUrl: "livecams/livecams.json", // lista curada a mano de camaras publicas (titulo + URL de YouTube)
  liveCamsRefreshMs: 10 * 60 * 1000,    // re-leer livecams.json cada 10 min (para que una edicion se vea sin recargar OBS)
  liveCamFirstDelayMs: 17 * 60 * 1000,  // primera camara a los 17 min (deja las 3 apariciones/hora en :17, :37, :57 - la mejor combinacion posible)
  liveCamIntervalMs: 20 * 60 * 1000,    // despues, cada 20 min (3 veces por hora)
  liveCamDisplayMs: 7 * 60 * 1000,      // cuanto queda visible cada camara (7 min)
  // Nota sobre colisiones: con 3 apariciones/hora de 7 min cada una (21 de
  // los 60 min de la hora ocupados), ya no hay una combinacion que evite
  // TODOS los cruces con noticias/clima/cotizacion/mercados (la cuenta no
  // cierra: ver detalle en README). Con :17/:37/:57 el unico cruce que
  // queda es la camara de :57 tapando la tanda de noticias de :00 en punto
  // (se resume normal en :15) y un roce menor con mercados a las :41. El
  // resto de las pantallas queda intacto. Si se necesita volver a "cero
  // colisiones total", hay que bajar la duracion o subir el intervalo.
  tickerEnabled: false,                 // apagado momentaneamente a pedido - poner en true para reactivar el ticker de redes
  autoReloadMs: 24 * 60 * 60 * 1000,    // recarga la pagina sola cada 24 horas, para que la fuente de OBS tome cambios de codigo sin refrescar a mano
};

const VALID_AUDIO_EXT = [".mp3", ".m4a", ".ogg", ".wav", ".flac"];
const VALID_IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const VALID_VIDEO_EXT = [".mp4", ".webm", ".mov", ".m4v"];
const VALID_BACKGROUND_EXT = [...VALID_IMAGE_EXT, ...VALID_VIDEO_EXT];

// ---------------- Reproductor ----------------

const audioA = document.getElementById("audioA");
const audioB = document.getElementById("audioB");
const trackTitleEl = document.getElementById("trackTitle");
const trackArtistEl = document.getElementById("trackArtist");
const trackCreditEl = document.getElementById("trackCredit");
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

  // Ademas de no repetir la misma cancion, tratamos de no repetir el
  // mismo artista seguido (notorio en playlists chicas). Si excluir al
  // artista actual dejara el pool vacio (ej. toda la playlist es del
  // mismo artista), nos quedamos con el pool anterior en vez de trabar
  // la seleccion.
  if (currentTrack && currentTrack.artist) {
    const currentArtist = currentTrack.artist.trim().toLowerCase();
    const withoutSameArtist = pool.filter(
      (t) => (t.artist || "").trim().toLowerCase() !== currentArtist
    );
    if (withoutSameArtist.length > 0) pool = withoutSameArtist;
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
        credit: t.credit || "",
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
      credit: override.credit || "",
    };
  });
}

function updateNowPlayingUI(track) {
  playerEl.classList.add("fading");
  setTimeout(() => {
    trackTitleEl.textContent = track.title || track.file;
    trackArtistEl.textContent = track.artist || "";
    trackCreditEl.textContent = track.credit || "";
    playerEl.classList.remove("fading");
  }, 220);
}

// Dos elementos <audio> (misma idea que las dos capas de fondo): uno
// suena de punta a punta mientras el otro precarga y hace fade-in del
// siguiente tema, para que el corte entre canciones no sea seco.
// `frontAudio` es el que se esta por terminar (el que dispara el
// crossfade); `displayAudio` es el que corresponde a lo que se ve en
// pantalla como "sonando ahora" (cambia apenas arranca el crossfade,
// no cuando termina).
let frontAudio = audioA;
let displayAudio = audioA;
let crossfading = false;

function otherAudio(el) {
  return el === audioA ? audioB : audioA;
}

function applyNowPlaying(track) {
  currentTrack = track;
  updateNowPlayingUI(track);
}

// Arranca la primera cancion de la transmision (o la retoma si el
// audio se habia quedado sin nada por cualquier motivo). Sin fade: no
// hay una cancion anterior de la que despedirse.
function startPlayback() {
  const track = pickNextTrack();
  if (!track) return;
  frontAudio.volume = 1;
  frontAudio.src = "music/" + encodeURIComponent(track.file);
  frontAudio.currentTime = 0;
  displayAudio = frontAudio;
  frontAudio.play().then(() => {
    autoplayGate.classList.add("hidden");
  }).catch((err) => {
    console.warn("Autoplay bloqueado, esperando interacción:", err);
    autoplayGate.classList.remove("hidden");
  });
  applyNowPlaying(track);
}

// Corte de respaldo sin fade, para cuando el crossfade no se pudo
// disparar a tiempo (ej. no llegamos a conocer la duracion del audio
// antes de que termine). Reutiliza el mismo elemento para no perder
// continuidad.
function hardSwitchToNext() {
  const next = pickNextTrack();
  if (!next) return;
  frontAudio.volume = 1;
  frontAudio.src = "music/" + encodeURIComponent(next.file);
  frontAudio.currentTime = 0;
  displayAudio = frontAudio;
  frontAudio.play().catch(() => {});
  applyNowPlaying(next);
}

// Guardados a nivel modulo (no locales a beginCrossfade) para que
// handleAudioError pueda abortar un cruce en curso de forma prolija -
// ver abortCrossfade().
let crossfadeTimer = null;
let crossfadePreviousTrack = null;

function beginCrossfade() {
  if (crossfading) return;
  const next = pickNextTrack();
  if (!next) return;

  const outgoing = frontAudio;
  const incoming = otherAudio(frontAudio);
  crossfading = true;
  crossfadePreviousTrack = currentTrack;

  incoming.volume = 0;
  incoming.src = "music/" + encodeURIComponent(next.file);
  incoming.currentTime = 0;
  const playPromise = incoming.play();
  if (playPromise && playPromise.catch) playPromise.catch(() => {});

  // El titulo/progreso ya pasa a mostrar el tema entrante desde que
  // arranca el cruce, como en una radio real.
  displayAudio = incoming;
  applyNowPlaying(next);

  const stepMs = 50;
  const steps = Math.max(1, Math.round(CONFIG.audioCrossfadeMs / stepMs));
  let step = 0;
  crossfadeTimer = setInterval(() => {
    step++;
    const t = Math.min(1, step / steps);
    outgoing.volume = 1 - t;
    incoming.volume = t;
    if (t >= 1) {
      clearInterval(crossfadeTimer);
      crossfadeTimer = null;
      outgoing.pause();
      outgoing.removeAttribute("src");
      outgoing.load();
      frontAudio = incoming;
      crossfading = false;
    }
  }, stepMs);
}

// Si el tema ENTRANTE de un cruce falla a mitad de camino (404,
// archivo corrupto, etc.), hay que abortar el cruce entero en vez de
// dejar el interval de arriba corriendo solo: si lo dejamos, termina
// igual pisando (pausando y sacandole el src) al tema que SI estaba
// sonando bien, y reasigna frontAudio/displayAudio al elemento roto
// (sin src) - a partir de ahi la musica queda muda para siempre, sin
// forma de auto-recuperarse (un <audio> sin src no dispara timeupdate
// ni error, asi que ni el proximo crossfade ni la red de seguridad de
// cada 15s pueden hacer nada). Volvemos frontAudio/displayAudio al
// tema que ya estaba andando, a volumen 1, y restauramos el "now
// playing" a ese tema.
function abortCrossfade() {
  if (crossfadeTimer) {
    clearInterval(crossfadeTimer);
    crossfadeTimer = null;
  }
  frontAudio.volume = 1;
  displayAudio = frontAudio;
  crossfading = false;
  if (crossfadePreviousTrack) applyNowPlaying(crossfadePreviousTrack);
}

function handleTimeUpdate(el) {
  if (el === displayAudio && el.duration && isFinite(el.duration)) {
    progressFill.style.width = (el.currentTime / el.duration) * 100 + "%";
  }
  // Solo el audio que esta "al frente" (el que se esta por terminar)
  // dispara el proximo cruce, y solo si dura lo suficiente como para
  // que un crossfade tenga sentido (evita temas muy cortos disparando
  // el cruce casi al arrancar).
  if (el === frontAudio && !crossfading && el.duration && isFinite(el.duration)) {
    const fadeSec = CONFIG.audioCrossfadeMs / 1000;
    const remaining = el.duration - el.currentTime;
    if (el.duration > fadeSec * 1.5 && remaining <= fadeSec) {
      beginCrossfade();
    }
  }
}

function handleEnded(el) {
  // Red de seguridad: si el tema que esta al frente termina sin haber
  // disparado el crossfade (ej. no se pudo leer la duracion a tiempo),
  // pasamos al siguiente con un corte seco en vez de quedar en silencio.
  if (el === frontAudio && !crossfading) {
    hardSwitchToNext();
  }
}

function handleAudioError(el) {
  console.warn("Error reproduciendo, salto a la siguiente canción.");
  el.pause();
  el.removeAttribute("src");
  if (el === frontAudio) {
    crossfading = false;
    setTimeout(hardSwitchToNext, 800);
  } else if (crossfading) {
    // Fallo el tema entrante a mitad de un cruce: abortamos el cruce
    // entero (ver abortCrossfade) en vez de dejar el interval huerfano
    // corriendo, que terminaria rompiendo tambien al que sí sonaba bien.
    abortCrossfade();
  }
}

for (const el of [audioA, audioB]) {
  el.addEventListener("timeupdate", () => handleTimeUpdate(el));
  el.addEventListener("ended", () => handleEnded(el));
  el.addEventListener("error", () => handleAudioError(el));
}

autoplayBtn.addEventListener("click", () => {
  autoplayGate.classList.add("hidden");
  displayAudio.play();
});

setInterval(async () => {
  await loadPlaylist();
  // Si al arrancar la pagina la playlist estaba vacia (playlist.json
  // todavia no listo, red lenta, etc.) y recien ahora aparecen temas,
  // arrancamos la reproduccion aca — si no, el audio quedaba mudo el
  // resto de la transmision porque nada mas vuelve a arrancar la
  // primera cancion.
  if (playlist.length > 0 && !currentTrack) {
    startPlayback();
  }
}, CONFIG.playlistRefreshMs);

// Red de seguridad: si el audio quedo pausado por cualquier motivo
// (autoplay bloqueado, error transitorio del navegador) reintentamos
// solos cada rato, en vez de quedar mudos el resto de la transmision
// esperando un click que en OBS nunca va a llegar.
setInterval(() => {
  if (currentTrack && displayAudio.paused) {
    displayAudio.play().then(() => autoplayGate.classList.add("hidden")).catch(() => {});
  }
}, 15000);

// ---------------- Reloj ----------------
// Va rotando cada CONFIG.clockRotationMs entre los paises de
// CONFIG.clockZones, mostrando la hora real de cada uno (via
// Intl.DateTimeFormat con su timeZone), no la hora local del navegador.

const clockEl = document.getElementById("clock");
let clockZoneIndex = 0;

function tickClock() {
  const zone = CONFIG.clockZones[clockZoneIndex];
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: zone.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hh = parts.find((p) => p.type === "hour").value;
  const mm = parts.find((p) => p.type === "minute").value;
  clockEl.textContent = `${zone.flag} ${hh}:${mm}`;
}
tickClock();
setInterval(tickClock, 15000);
setInterval(() => {
  clockZoneIndex = (clockZoneIndex + 1) % CONFIG.clockZones.length;
  tickClock();
}, CONFIG.clockRotationMs);

// ---------------- Noticias ----------------
// Pantalla completa que reemplaza el fondo de publicidades mientras
// esta activa. Se muestran CONFIG.newsItemsPerBlock noticias seguidas
// ("bloque"), pausando el slideshow de /backgrounds, y al terminar el
// bloque el slideshow continua solo. Arranca con un bloque apenas
// carga la pagina, y despues se repite cada CONFIG.newsIntervalMs.

const newsScreen = document.getElementById("newsScreen");
const newsProgress = document.getElementById("newsProgress");
const newsContent = document.getElementById("newsContent");
const newsTag = document.getElementById("newsTag");
const newsImage = document.getElementById("newsImage");
const newsText = document.getElementById("newsText");
const newsQr = document.getElementById("newsQr");
const newsOutro = document.getElementById("newsOutro");

// Arma las barras de progreso (una por noticia de la tanda actual).
function buildNewsProgress(count) {
  newsProgress.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const seg = document.createElement("div");
    seg.className = "news-progress-seg";
    const fill = document.createElement("div");
    fill.className = "news-progress-fill";
    seg.appendChild(fill);
    newsProgress.appendChild(seg);
  }
}

// Marca las barras anteriores a "index" como llenas, deja las
// siguientes vacias, y anima la de "index" de 0% a 100% a lo largo de
// durationMs (mismo tiempo que la noticia queda visible).
function fillNewsProgress(index, durationMs) {
  const fills = newsProgress.querySelectorAll(".news-progress-fill");
  fills.forEach((fill, i) => {
    if (i < index) {
      fill.style.transition = "none";
      fill.style.width = "100%";
    } else if (i === index) {
      fill.style.transition = "none";
      fill.style.width = "0%";
      void fill.offsetWidth; // fuerza reflow para que el 0% quede registrado antes de animar
      fill.style.transition = `width ${durationMs}ms linear`;
      fill.style.width = "100%";
    } else {
      fill.style.transition = "none";
      fill.style.width = "0%";
    }
  });
}

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

// Ticker inferior de redes: siempre visible (incluso durante noticias
// y clima, ya que su z-index queda por encima de esas pantallas) salvo
// que CONFIG.tickerEnabled este en false (apagado momentaneo a pedido).
// El CSS hace el resto (animacion de entrada y marquee corriendo).
if (CONFIG.tickerEnabled) document.body.classList.add("ticker-visible");

// Carga una imagen en "imgEl" y resuelve true/false segun si termino
// cargando bien o no (error, o se paso de timeoutMs sin resolver -
// asi una imagen colgada nunca bloquea la rotacion de noticias mas de
// la cuenta). Nunca rechaza la promesa.
function loadImageWithTimeout(imgEl, src, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      imgEl.onload = null;
      imgEl.onerror = null;
      resolve(ok);
    };
    imgEl.onload = () => finish(true);
    imgEl.onerror = () => finish(false);
    imgEl.src = src;
    setTimeout(() => finish(false), timeoutMs);
  });
}

// Muestra una noticia: primero hace un crossfade rapido de #newsContent
// (tag/imagen/texto/QR) hacia el contenido nuevo, esperando a que la
// imagen y el QR entrantes terminen de cargar (o fallen/venzan el
// timeout) ANTES de volver a mostrar el contenido - asi no aparece
// primero el texto y despues, de golpe, la imagen. Recien ahi arranca
// a llenarse la barra de progreso de esta noticia (index), y espera
// CONFIG.newsDisplayMs antes de resolver. La pantalla de noticias en si
// (y la barra de progreso) NO se ocultan entre noticias - solo el
// contenido de adentro hace el crossfade, para que la barra de
// progreso quede visible de corrido durante toda la tanda.
function showNewsItem(item, index) {
  if (!item || (!item.text && !item.image)) return Promise.resolve();

  newsContent.classList.add("fading");
  return wait(CONFIG.newsContentFadeMs).then(async () => {
    // Recien aca el fade de salida termino de verdad (opacity:0, ya
    // invisible) - es el momento seguro para cortar cualquier carga
    // pendiente y limpiar el src de la nota anterior. Hacerlo antes
    // (por ejemplo, apenas arranca el fade) se alcanza a ver: sacarle
    // el src a una imagen la "rompe" al instante, mientras el fade
    // todavia esta casi del todo opaco.
    newsImage.onload = null;
    newsImage.onerror = null;
    newsImage.removeAttribute("src");
    newsQr.onload = null;
    newsQr.onerror = null;
    newsQr.removeAttribute("src");

    // La categoria viene del RSS (<category> de WordPress) cuando la
    // noticia es automatica; si no hay, o es una noticia cargada a mano
    // sin categoria, se usa el tag generico de siempre.
    newsTag.textContent = item.category || "NOTICIA";
    newsText.textContent = item.text || "";

    const loaders = [];

    if (item.image) {
      loaders.push(
        loadImageWithTimeout(newsImage, item.image, CONFIG.newsMediaTimeoutMs).then((ok) => {
          newsImage.classList.toggle("news-image-hidden", !ok);
        })
      );
    } else {
      newsImage.removeAttribute("src");
      newsImage.classList.add("news-image-hidden");
    }

    if (item.link) {
      newsScreen.classList.remove("no-link");
      // Si el QR no carga (api.qrserver.com caido/lento/bloqueado),
      // ocultamos toda la fila en vez de mostrar el icono de imagen rota
      // a pantalla completa.
      loaders.push(
        loadImageWithTimeout(newsQr, qrUrlFor(item.link), CONFIG.newsMediaTimeoutMs).then((ok) => {
          if (!ok) newsScreen.classList.add("no-link");
        })
      );
    } else {
      newsScreen.classList.add("no-link");
    }

    await Promise.all(loaders);

    newsContent.classList.remove("fading");
    fillNewsProgress(index, CONFIG.newsDisplayMs);
    return wait(CONFIG.newsDisplayMs);
  });
}

// Corre un bloque completo de noticias: pausa el slideshow de fondos,
// muestra hasta newsItemsPerBlock noticias una atras de otra, muestra
// un mensaje de cierre (newsOutro) y al terminar retoma el slideshow.
// Si no hay noticias cargadas, no hace nada mas que asegurarse de que
// el slideshow este corriendo.
async function runNewsBlock() {
  // No pisar la pantalla de clima, cotizacion, mercados o camara en
  // vivo si justo estan en pantalla: esta tanda se saltea y arranca en
  // el proximo turno.
  if (newsBlockRunning || weatherBlockRunning || currencyBlockRunning || marketsBlockRunning || liveCamBlockRunning) return;
  newsBlockRunning = true;
  pauseBackgroundRotation();

  // try/finally: si algo de lo de adentro tirara una excepcion
  // inesperada, newsBlockRunning igual tiene que volver a false y el
  // slideshow tiene que retomar - si no, este bloque queda "trabado"
  // en true para siempre, lo que bloquearia en cascada a todos los
  // demas bloques (se avisan entre si) y hasta a la recarga automatica
  // (tambien espera a que ningun bloque este corriendo).
  try {
    if (newsList && newsList.length > 0) {
      const count = Math.min(CONFIG.newsItemsPerBlock, newsList.length);
      buildNewsProgress(count);
      newsScreen.classList.add("visible");
      for (let i = 0; i < count; i++) {
        const item = newsList[newsIndex % newsList.length];
        newsIndex++;
        await showNewsItem(item, i);
      }
      newsScreen.classList.remove("visible");
      await wait(700); // deja terminar el fade de salida del bloque antes del mensaje de cierre

      // Mensaje de cierre de la tanda, antes de retomar el slideshow de
      // fondos - solo si efectivamente hubo noticias para mostrar.
      newsOutro.classList.add("visible");
      await wait(CONFIG.newsOutroMs);
      newsOutro.classList.remove("visible");
      await wait(700); // deja terminar el fade antes de retomar fondos
    }
  } finally {
    newsBlockRunning = false;
    resumeBackgroundRotation();
  }
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
const bgCreditEl = document.getElementById("bgCredit");
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
// (GitHub Releases, Drive, Cloudflare R2, bancos de imagenes gratuitos
// traidos por keyword, etc.), para no subir videos pesados a git. Cada
// entrada es una URL completa, o { "url": "...", "type": "video" }
// cuando la URL no termina en una extension reconocible (ej. un link
// de descarga de Google Drive) y hace falta indicar el tipo a mano.
// El campo opcional "credit" (ej. "Foto: Fulano / Pexels") se muestra
// discreto en pantalla mientras ese fondo esta activo.
async function loadExternalBackgrounds() {
  try {
    const res = await fetch(CONFIG.backgroundsExternalUrl + "?t=" + Date.now());
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.items || [];
    return list
      .map((entry) => {
        if (typeof entry === "string") {
          return { file: entry, type: backgroundType(entry), credit: "" };
        }
        if (entry && entry.url) {
          return {
            file: entry.url,
            type: entry.type || backgroundType(entry.url),
            credit: entry.credit || "",
          };
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
    .map((file) => ({ file, type: backgroundType(file), credit: "" }))
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
// gastar red/CPU de mas reproduciendo un video invisible. Si para
// cuando este timer llega a correr la capa ya volvio a quedar activa
// (dos avances de fondo muy seguidos, uno detras de otro), no la
// tocamos - apagarla igual cortaria el fondo que se esta mostrando.
function deactivateLayer(layer) {
  if (layer.el.classList.contains("active")) return;
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
  bgCreditEl.textContent = item.credit || "";
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

// ---------------- Clima ----------------
// Pantalla completa que reemplaza el fondo de publicidades cada tanto
// (mismo mecanismo que las noticias), mostrando el clima actual de las
// mismas ciudades que rota el reloj (CONFIG.clockZones), en columnas.
// Usa la API publica de Open-Meteo (sin API key). Los datos se
// refrescan solos cada CONFIG.weatherRefreshMs; la pantalla se dispara
// aparte, cada CONFIG.weatherIntervalMs, usando el ultimo dato cargado.

const weatherScreen = document.getElementById("weatherScreen");
const weatherTitle = document.getElementById("weatherTitle");
const weatherColumns = document.getElementById("weatherColumns");

// Traduccion breve + icono para los codigos de clima WMO que devuelve
// Open-Meteo. Un codigo no listado (o sin dato) cae en el default.
const WEATHER_CODES = {
  0: ["Despejado", "☀️"],
  1: ["Mayormente despejado", "🌤️"],
  2: ["Parcialmente nublado", "⛅"],
  3: ["Nublado", "☁️"],
  45: ["Niebla", "🌫️"],
  48: ["Niebla helada", "🌫️"],
  51: ["Llovizna débil", "🌦️"],
  53: ["Llovizna", "🌦️"],
  55: ["Llovizna intensa", "🌧️"],
  61: ["Lluvia débil", "🌧️"],
  63: ["Lluvia", "🌧️"],
  65: ["Lluvia intensa", "🌧️"],
  71: ["Nieve débil", "🌨️"],
  73: ["Nieve", "🌨️"],
  75: ["Nieve intensa", "❄️"],
  80: ["Chubascos débiles", "🌦️"],
  81: ["Chubascos", "🌧️"],
  82: ["Chubascos intensos", "⛈️"],
  95: ["Tormenta", "⛈️"],
  96: ["Tormenta con granizo", "⛈️"],
  99: ["Tormenta fuerte con granizo", "⛈️"],
};
function weatherCodeInfo(code) {
  return WEATHER_CODES[code] || ["--", "🌡️"];
}

// Array paralelo a CONFIG.clockZones (mismo orden/indice), o null si
// todavia no se pudo cargar nada. Si una consulta falla, se deja el
// ultimo dato bueno en vez de romper la pantalla (fallo en silencio).
let weatherData = null;

async function loadWeather() {
  const lats = CONFIG.clockZones.map((z) => z.lat).join(",");
  const lons = CONFIG.clockZones.map((z) => z.lon).join(",");
  const url =
    `${CONFIG.weatherApiUrl}?latitude=${lats}&longitude=${lons}` +
    `&current=temperature_2m,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min` +
    `&timezone=auto&forecast_days=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    // Open-Meteo devuelve un array cuando se piden varias coordenadas
    // en una sola consulta (una entrada por ciudad, mismo orden).
    weatherData = Array.isArray(data) ? data : [data];
  } catch {
    // sin conexion o API caida: nos quedamos con weatherData anterior
  }
}

function buildWeatherColumns() {
  weatherColumns.innerHTML = "";
  CONFIG.clockZones.forEach((zone, i) => {
    const entry = weatherData ? weatherData[i] : null;
    const col = document.createElement("div");
    col.className = "weather-col";
    if (!entry || !entry.current) {
      col.innerHTML = `
        <div class="weather-flag">${zone.flag}</div>
        <div class="weather-city">${zone.label}</div>
        <div class="weather-icon">🌡️</div>
        <div class="weather-desc">Sin datos</div>
      `;
    } else {
      const [desc, icon] = weatherCodeInfo(entry.current.weather_code);
      const now = Math.round(entry.current.temperature_2m);
      const max = Math.round(entry.daily?.temperature_2m_max?.[0]);
      const min = Math.round(entry.daily?.temperature_2m_min?.[0]);
      col.innerHTML = `
        <div class="weather-flag">${zone.flag}</div>
        <div class="weather-city">${zone.label}</div>
        <div class="weather-icon">${icon}</div>
        <div class="weather-temp-now">${now}°</div>
        <div class="weather-desc">${desc}</div>
        <div class="weather-temp-range">Mín ${min}° · Máx ${max}°</div>
      `;
    }
    weatherColumns.appendChild(col);
  });
}

let weatherBlockRunning = false;

async function runWeatherBlock() {
  // No pisar un bloque de noticias, cotizacion, mercados o camara en
  // vivo que ya este en pantalla; se saltea esta vez y se reintenta en
  // el proximo turno.
  if (weatherBlockRunning || newsBlockRunning || currencyBlockRunning || marketsBlockRunning || liveCamBlockRunning) return;

  // Si todavia no hay ningun dato de clima cargado (API caida, sin
  // conexion, primera carga que no llego a tiempo), no mostramos la
  // pantalla vacia - se reintenta sola en el proximo turno con lo que
  // traiga el proximo loadWeather().
  const hasData = Array.isArray(weatherData) && weatherData.some((e) => e && e.current);
  if (!hasData) return;

  weatherBlockRunning = true;
  pauseBackgroundRotation();

  try {
    const today = new Intl.DateTimeFormat("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(new Date());
    weatherTitle.textContent = `Clima de hoy, ${today}`;
    buildWeatherColumns();

    weatherScreen.classList.add("visible");
    await wait(CONFIG.weatherDisplayMs);
    weatherScreen.classList.remove("visible");
    await wait(700); // deja terminar el fade de salida antes de retomar fondos
  } finally {
    weatherBlockRunning = false;
    resumeBackgroundRotation();
  }
}

setInterval(loadWeather, CONFIG.weatherRefreshMs);

setTimeout(() => {
  runWeatherBlock();
  setInterval(runWeatherBlock, CONFIG.weatherIntervalMs);
}, CONFIG.weatherFirstDelayMs);

// ---------------- Cotización del dólar ----------------
// Pantalla completa que reemplaza el fondo de publicidades cada tanto
// (mismo mecanismo que noticias/clima), mostrando a cuanto equivale
// 1 dolar en las monedas de CONFIG.currencyCurrencies. Usa la API
// publica open.er-api.com (sin API key). Mismo esquema que el clima:
// los datos se refrescan solos cada CONFIG.currencyRefreshMs, y la
// pantalla se dispara aparte cada CONFIG.currencyIntervalMs con el
// ultimo dato cargado.

const currencyScreen = document.getElementById("currencyScreen");
const currencyTitle = document.getElementById("currencyTitle");
const currencyColumns = document.getElementById("currencyColumns");

// { ARS: 1234.5, PEN: 3.7, ... } o null si todavia no se pudo cargar
// nada. Si una consulta falla, se deja el ultimo dato bueno.
let currencyRates = null;

async function loadCurrency() {
  try {
    const res = await fetch(CONFIG.currencyApiUrl);
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.rates) currencyRates = data.rates;
  } catch {
    // sin conexion o API caida: nos quedamos con currencyRates anterior
  }
}

// Los valores grandes (ej. ARS, COP, ya en cientos/miles) se redondean
// a entero con separador de miles; los menores a 100 (ej. PEN, MXN,
// EUR) muestran decimales para no perder precision (18.62 no debe
// verse como "19").
function formatCurrencyValue(value) {
  if (value == null || !isFinite(value)) return "--";
  if (value >= 100) return Math.round(value).toLocaleString("es-AR");
  return value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildCurrencyColumns() {
  currencyColumns.innerHTML = "";
  CONFIG.currencyCurrencies.forEach((currency) => {
    const value = currencyRates ? currencyRates[currency.code] : null;
    const col = document.createElement("div");
    col.className = "currency-col";
    if (value == null) {
      col.innerHTML = `
        <div class="currency-flag">${currency.flag}</div>
        <div class="currency-code">${currency.code}</div>
        <div class="currency-value">--</div>
        <div class="currency-label">Sin datos</div>
      `;
    } else {
      col.innerHTML = `
        <div class="currency-flag">${currency.flag}</div>
        <div class="currency-code">${currency.code}</div>
        <div class="currency-value">${formatCurrencyValue(value)}</div>
        <div class="currency-label">${currency.label}</div>
      `;
    }
    currencyColumns.appendChild(col);
  });
}

let currencyBlockRunning = false;

async function runCurrencyBlock() {
  // No pisar noticias, clima, mercados o camara en vivo si justo estan
  // en pantalla; se saltea esta vez y se reintenta en el proximo turno.
  if (currencyBlockRunning || newsBlockRunning || weatherBlockRunning || marketsBlockRunning || liveCamBlockRunning) return;

  // Si todavia no hay ningun dato de cotizacion cargado (API caida,
  // sin conexion), no mostramos la pantalla vacia - se reintenta sola
  // en el proximo turno con lo que traiga el proximo loadCurrency().
  const hasData =
    currencyRates && CONFIG.currencyCurrencies.some((c) => currencyRates[c.code] != null);
  if (!hasData) return;

  currencyBlockRunning = true;
  pauseBackgroundRotation();

  try {
    currencyTitle.textContent = `Cotización del dólar (1 ${CONFIG.currencyBaseCode})`;
    buildCurrencyColumns();

    currencyScreen.classList.add("visible");
    await wait(CONFIG.currencyDisplayMs);
    currencyScreen.classList.remove("visible");
    await wait(700); // deja terminar el fade de salida antes de retomar fondos
  } finally {
    currencyBlockRunning = false;
    resumeBackgroundRotation();
  }
}

setInterval(loadCurrency, CONFIG.currencyRefreshMs);

setTimeout(() => {
  runCurrencyBlock();
  setInterval(runCurrencyBlock, CONFIG.currencyIntervalMs);
}, CONFIG.currencyFirstDelayMs);

// ---------------- Resumen de mercados (cripto) ----------------
// Pantalla completa que reemplaza el fondo de publicidades cada tanto
// (mismo mecanismo que noticias/clima/cotizacion), mostrando precio y
// variacion 24hs de las criptomonedas de CONFIG.marketsAssets. Usa la
// API publica de CoinGecko (sin API key). Mismo esquema que las otras
// pantallas: los datos se refrescan solos cada CONFIG.marketsRefreshMs,
// y la pantalla se dispara aparte cada CONFIG.marketsIntervalMs con el
// ultimo dato cargado.

const marketsScreen = document.getElementById("marketsScreen");
const marketsTitle = document.getElementById("marketsTitle");
const marketsColumns = document.getElementById("marketsColumns");

// { bitcoin: { usd: 65000, usd_24h_change: 1.23 }, ... } o null si
// todavia no se pudo cargar nada. Si una consulta falla, se deja el
// ultimo dato bueno.
let marketsData = null;

async function loadMarkets() {
  const ids = CONFIG.marketsAssets.map((a) => a.id).join(",");
  const url = `${CONFIG.marketsApiUrl}?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    if (data && typeof data === "object") marketsData = data;
  } catch {
    // sin conexion o API caida: nos quedamos con marketsData anterior
  }
}

// Precios grandes (>=100, ej. Bitcoin) se redondean a entero con
// separador de miles; los menores muestran mas decimales para no
// perder precision (ej. XRP, que vale centavos de dolar).
function formatMarketPrice(value) {
  if (value == null || !isFinite(value)) return "--";
  if (value >= 100) return "$" + Math.round(value).toLocaleString("es-AR");
  if (value >= 1) return "$" + value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "$" + value.toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 4 });
}

function formatMarketChange(value) {
  if (value == null || !isFinite(value)) return "";
  const arrow = value >= 0 ? "▲" : "▼";
  const sign = value >= 0 ? "+" : "";
  return `${arrow} ${sign}${value.toFixed(2)}%`;
}

function buildMarketsColumns() {
  marketsColumns.innerHTML = "";
  CONFIG.marketsAssets.forEach((asset) => {
    const entry = marketsData ? marketsData[asset.id] : null;
    const price = entry ? entry.usd : null;
    const col = document.createElement("div");
    col.className = "markets-col";
    if (price == null) {
      col.innerHTML = `
        <div class="markets-symbol">${asset.symbol}</div>
        <div class="markets-label">Sin datos</div>
      `;
    } else {
      col.innerHTML = `
        <div class="markets-symbol">${asset.symbol}</div>
        <div class="markets-label">${asset.label}</div>
        <div class="markets-price">${formatMarketPrice(price)}</div>
        <div class="markets-change">${formatMarketChange(entry.usd_24h_change)}</div>
      `;
    }
    marketsColumns.appendChild(col);
  });
}

let marketsBlockRunning = false;

async function runMarketsBlock() {
  // No pisar noticias, clima, cotizacion o camara en vivo si justo
  // estan en pantalla; se saltea esta vez y se reintenta en el
  // proximo turno.
  if (marketsBlockRunning || newsBlockRunning || weatherBlockRunning || currencyBlockRunning || liveCamBlockRunning) return;

  // Si todavia no hay ningun dato de mercados cargado (API caida, sin
  // conexion), no mostramos la pantalla vacia - se reintenta sola en
  // el proximo turno con lo que traiga el proximo loadMarkets().
  const hasData =
    marketsData && CONFIG.marketsAssets.some((a) => marketsData[a.id] && marketsData[a.id].usd != null);
  if (!hasData) return;

  marketsBlockRunning = true;
  pauseBackgroundRotation();

  try {
    const today = new Intl.DateTimeFormat("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(new Date());
    marketsTitle.textContent = `Resumen de mercados, ${today}`;
    buildMarketsColumns();

    marketsScreen.classList.add("visible");
    await wait(CONFIG.marketsDisplayMs);
    marketsScreen.classList.remove("visible");
    await wait(700); // deja terminar el fade de salida antes de retomar fondos
  } finally {
    marketsBlockRunning = false;
    resumeBackgroundRotation();
  }
}

setInterval(loadMarkets, CONFIG.marketsRefreshMs);

setTimeout(() => {
  runMarketsBlock();
  setInterval(runMarketsBlock, CONFIG.marketsIntervalMs);
}, CONFIG.marketsFirstDelayMs);

// ---------------- Cámara pública en vivo ----------------
// Pantalla completa que reemplaza el fondo de publicidades cada tanto
// (mismo mecanismo que noticias/clima/cotizacion/mercados), embebiendo
// una camara de YouTube de la lista curada a mano en
// CONFIG.liveCamsUrl (livecams/livecams.json: array de
// { title, url }). A diferencia de las otras pantallas, no depende de
// ninguna API externa: la lista es un JSON del propio repo que se
// edita a mano.

const livecamScreen = document.getElementById("livecamScreen");
const livecamFrame = document.getElementById("livecamFrame");
const livecamCaption = document.getElementById("livecamCaption");
const livecamPlace = document.getElementById("livecamPlace");

let liveCams = [];
let liveCamIndex = 0;
let liveCamBlockRunning = false;

async function loadLiveCams() {
  try {
    const res = await fetch(CONFIG.liveCamsUrl + "?t=" + Date.now());
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data)) liveCams = data;
  } catch {
    // sin conexion o archivo no disponible: nos quedamos con la lista anterior
  }
}

// Acepta las formas mas comunes de URL de YouTube
// (watch?v=, youtu.be/, /live/, /embed/) y devuelve solo el ID del
// video, o null si no matchea ninguna.
function extractYoutubeVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/live\/)([\w-]{11})/);
  return match ? match[1] : null;
}

async function runLiveCamBlock() {
  // No pisar noticias, clima, cotizacion o mercados si justo estan en
  // pantalla; se saltea esta vez y se reintenta en el proximo turno.
  if (liveCamBlockRunning || newsBlockRunning || weatherBlockRunning || currencyBlockRunning || marketsBlockRunning) return;

  if (!liveCams || liveCams.length === 0) return;

  const cam = liveCams[liveCamIndex % liveCams.length];
  liveCamIndex++;
  const videoId = extractYoutubeVideoId(cam.url);
  if (!videoId) return; // URL mal cargada en livecams.json: se saltea en vez de romper

  liveCamBlockRunning = true;
  pauseBackgroundRotation();

  try {
    livecamPlace.textContent = cam.title || "";
    // mute=1 obligatorio (autoplay con audio esta bloqueado por los
    // navegadores) y ademas no queremos que compita con la musica.
    livecamFrame.src =
      `https://www.youtube.com/embed/${videoId}` +
      `?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&playsinline=1`;
    livecamScreen.classList.add("visible");

    await wait(CONFIG.liveCamDisplayMs);

    livecamScreen.classList.remove("visible");
    await wait(700); // deja terminar el fade de salida antes de retomar fondos
    livecamFrame.src = ""; // corta la carga/reproduccion del iframe fuera de pantalla
  } finally {
    liveCamBlockRunning = false;
    resumeBackgroundRotation();
  }
}

setInterval(loadLiveCams, CONFIG.liveCamsRefreshMs);

setTimeout(() => {
  runLiveCamBlock();
  setInterval(runLiveCamBlock, CONFIG.liveCamIntervalMs);
}, CONFIG.liveCamFirstDelayMs);

// ---------------- Popup de suscripción ----------------
// Desciende desde el centro-arriba, queda visible subscribeDisplayMs
// y vuelve a subir. Arranca al minuto de abrir la pagina y despues se
// repite cada subscribeIntervalMs.

const subscribePopup = document.getElementById("subscribePopup");

function showSubscribePopup() {
  // Evitamos superponerlo con la pantalla de noticias, clima,
  // cotizacion, mercados o camara en vivo a pantalla completa; si
  // coincide, se salta esta vez y aparece en el proximo turno.
  if (newsBlockRunning || weatherBlockRunning || currencyBlockRunning || marketsBlockRunning || liveCamBlockRunning) return;

  subscribePopup.classList.add("visible");
  setTimeout(() => {
    subscribePopup.classList.remove("visible");
  }, CONFIG.subscribeDisplayMs);
}

setTimeout(() => {
  showSubscribePopup();
  setInterval(showSubscribePopup, CONFIG.subscribeIntervalMs);
}, CONFIG.subscribeFirstDelayMs);

// ---------------- Recarga automática ----------------
// La fuente de navegador en OBS carga la pagina una sola vez y la deja
// corriendo indefinidamente - un cambio de codigo (HTML/CSS/JS) subido
// al repo nunca se ve reflejado ahi hasta que alguien refresca la
// fuente a mano. Para no depender de eso, la pagina se recarga sola
// cada CONFIG.autoReloadMs. Si justo hay un bloque a pantalla completa
// en curso (noticias/clima/cotizacion/mercados/camara en vivo), espera
// a que termine en vez de cortarlo a la mitad.
function scheduleAutoReload() {
  // Tope de reintentos: los bloques ya se protegen solos con
  // try/finally (ver runNewsBlock etc.) para no quedar "trabados" en
  // true para siempre, pero esto es una segunda red de seguridad -
  // si por cualquier motivo no contemplado alguno quedara colgado,
  // preferimos forzar la recarga igual (cortando lo que sea que este
  // en pantalla) antes que dejar la recarga automatica esperando para
  // siempre y perder la razon de ser de esta funcionalidad.
  const MAX_RELOAD_RETRIES = 24; // 24 * 5s = 2 min de espera como mucho
  let retries = 0;
  setTimeout(function tryReload() {
    const anyBlockRunning =
      newsBlockRunning ||
      weatherBlockRunning ||
      currencyBlockRunning ||
      marketsBlockRunning ||
      liveCamBlockRunning;
    if (anyBlockRunning && retries < MAX_RELOAD_RETRIES) {
      retries++;
      setTimeout(tryReload, 5000); // reintenta en 5s si justo hay algo en pantalla
    } else {
      location.reload();
    }
  }, CONFIG.autoReloadMs);
}
scheduleAutoReload();

// ---------------- Arranque ----------------

(async function start() {
  await Promise.all([loadPlaylist(), loadNews(), loadBackgrounds(), loadWeather(), loadCurrency(), loadMarkets(), loadLiveCams()]);
  if (playlist.length > 0) startPlayback();
  else {
    trackTitleEl.textContent = "Sin canciones en /music";
    trackArtistEl.textContent = "Agregá archivos y actualizá playlist.json";
  }
  // Arranca con un bloque de noticias (newsItemsPerBlock seguidas); al
  // terminar, el propio bloque deja andando el slideshow de fondos.
  // El próximo bloque de noticias es a los newsIntervalMs desde acá.
  await runNewsBlock();
})();
