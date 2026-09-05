// ============================================================
// Registro de impresiones de publicidad (/backgrounds)
// ------------------------------------------------------------
// Cuenta cuantas veces se mostro cada archivo de fondo (spot),
// para poder armar un reporte de "tu marca aparecio X veces" a un
// sponsor. Como el sitio es estatico (sin backend), el registro vive
// en el localStorage del MISMO navegador que corre la transmision
// (OBS es una unica instancia continua, no miles de visitantes, asi
// que esto alcanza). Ver stats.html para consultarlo.
//
// Usado por js/app.js (para registrar) y stats.html (para leer).
// ============================================================

const IMPRESSIONS_KEY = "laulive_impressions_v1";

function loadImpressionsData() {
  try {
    const raw = localStorage.getItem(IMPRESSIONS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return {
      periodStart: data.periodStart || new Date().toISOString(),
      counts: data.counts || {},
      lastShown: data.lastShown || {},
      history: Array.isArray(data.history) ? data.history : [],
    };
  } catch {
    return null;
  }
}

function emptyImpressionsData() {
  return {
    periodStart: new Date().toISOString(),
    counts: {},
    lastShown: {},
    history: [],
  };
}

function saveImpressionsData(data) {
  try {
    localStorage.setItem(IMPRESSIONS_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("No se pudo guardar el registro de impresiones:", err);
  }
}

// Llamar cada vez que un archivo de /backgrounds pasa a mostrarse.
function recordBackgroundImpression(file) {
  const data = loadImpressionsData() || emptyImpressionsData();
  data.counts[file] = (data.counts[file] || 0) + 1;
  data.lastShown[file] = new Date().toISOString();
  saveImpressionsData(data);
}

// Tope de periodos archivados (evita que localStorage crezca sin
// limite en un despliegue de meses/anios reiniciando seguido).
const MAX_IMPRESSIONS_HISTORY = 104; // ~2 anios reiniciando una vez por semana

// Archiva el periodo actual en el historial y arranca uno nuevo en cero.
// Usar, por ejemplo, cada vez que se cierra una semana de reporte.
function resetImpressionsPeriod() {
  const data = loadImpressionsData() || emptyImpressionsData();
  const hasData = Object.keys(data.counts).length > 0;
  if (hasData) {
    data.history.unshift({
      periodStart: data.periodStart,
      periodEnd: new Date().toISOString(),
      counts: data.counts,
    });
    if (data.history.length > MAX_IMPRESSIONS_HISTORY) {
      data.history.length = MAX_IMPRESSIONS_HISTORY;
    }
  }
  data.periodStart = new Date().toISOString();
  data.counts = {};
  data.lastShown = {};
  saveImpressionsData(data);
  return data;
}
