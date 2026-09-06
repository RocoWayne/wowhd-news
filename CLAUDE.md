# wowhd-news

Fuente de navegador (Browser Source) para OBS: transmisión 24/7 de
**MUNDO WOW 24/7**, un sitio de noticias/entretenimiento. Es una app
**100% estática** (HTML/CSS/JS vanilla, sin build ni framework) pensada
para correr como página cargada en OBS, con contenido editable vía
archivos JSON en el propio repo y automatización por GitHub Actions.

Este archivo documenta la arquitectura para trabajar en el código. Para
la guía de uso/edición de contenido (cómo cargar música, noticias,
publicidades) ver `README.md`; para hosting propio y protección con
contraseña, `HOSTING.md`.

## Estructura de alto nivel

```
index.html          página que se carga en OBS (una sola página, sin rutas)
stats.html           panel standalone para ver impresiones de /backgrounds
css/style.css        todos los estilos (variables de color en :root)
js/app.js            toda la lógica de la app (~800 líneas, sin módulos)
js/impressions.js    registro de impresiones de fondos en localStorage
music/, backgrounds/ assets subidos por el usuario + su playlist.json generado
news/                contenido editorial (news.json, rss.json)
scripts/*.py         generadores/mantenimiento de los .json de arriba
.github/workflows/   automatizan cuándo correr esos scripts
hosting/             plantilla .htaccess para Basic Auth en hosting propio
```

No hay `package.json`, build step, ni dependencias de servidor: todo el
JS corre en el navegador y consume archivos estáticos vía `fetch()`.
Por eso **hay que servir el sitio por HTTP** (nunca `file://`) para
probarlo: `python3 -m http.server 8080`.

## `js/app.js`: módulos internos (por sección, sin separación en archivos)

Todo vive en un único script cargado directo en `index.html` (junto con
`js/impressions.js`), sin bundler ni módulos ES. Se organiza en
secciones comentadas dentro del archivo:

- **`CONFIG`** (línea ~6): objeto único con todos los tiempos/URLs
  ajustables — es el primer lugar a mirar para cambiar comportamiento
  sin tocar lógica (intervalos de refresco, duración de bloques, tags,
  parámetros UTM del QR, etc).
- **Reproductor de música**: elige canciones al azar sin repetir la
  anterior ni, cuando es posible, el mismo artista seguido
  (`pickNextTrack`), intenta reproducir vía `music/playlist.php`
  (si el hosting soporta PHP) o listado de directorio (autoindex), y
  usa `music/playlist.json` como fuente de metadata/respaldo (incluye
  un campo opcional `credit` para atribución de licencias CC, que se
  muestra discreto en el player). Usa dos elementos `<audio>`
  (`audioA`/`audioB`, mismo patrón que las dos capas de fondo) para
  hacer crossfade real entre canciones (`beginCrossfade`), con un
  corte seco de respaldo (`hardSwitchToNext`) si el cruce no llega a
  dispararse a tiempo, y `abortCrossfade()` si el tema ENTRANTE de un
  cruce en curso falla a mitad de camino (crítico: sin esto, el
  interval del fundido queda huérfano y termina pisando también al
  tema que sí sonaba bien, dejando la música muda sin recuperación).
- **Noticias**: mezcla `news/news.json` (manual) + `news/rss.json`
  (auto-generado) y las muestra en bloques a pantalla completa
  (rotación temporizada, ver `CONFIG.newsIntervalMs` etc.), generando
  un QR client-side (via `api.qrserver.com`) para el link de cada nota.
  `#newsScreen` (con la barra de progreso `#newsProgress`, una por
  noticia de la tanda) queda visible de corrido durante todo el
  bloque; entre una noticia y la siguiente solo hace crossfade el
  contenido de adentro (`#newsContent`), no la pantalla completa, para
  que la barra de progreso no parpadee (`showNewsItem`/`runNewsBlock`).
  Al terminar la tanda se muestra un mensaje de cierre (`#newsOutro`).
- **Fondos/publicidades**: escanea `backgrounds/` (PHP, autoindex, o
  `playlist.json`) + `backgrounds/external.json` (URLs externas —
  sponsors cargados a mano y/o fotos automáticas de Wikimedia Commons
  por keyword, marcadas con `source: "wikimedia-auto"`), rota imágenes/videos
  con crossfade entre dos capas (`#bgLayerA`/`B`), fuerza mute en
  videos, muestra el `credit` del fondo actual (si trae uno cargado)
  en `#bgCredit`, y llama a `logImpression()` (de
  `impressions.js`) cada vez que un fondo entra en pantalla.
- **Popup de suscripción** y **ticker de redes**: temporizadores
  simples que muestran/ocultan elementos del DOM, coordinados para no
  superponerse con los bloques de noticias.
- **Resiliencia**: todos los `fetch()` de refresco están pensados para
  fallar en silencio y reintentar en el próximo ciclo (no hay caída
  dura de la página si un JSON o archivo puntual falla) — ver la
  sección "Resiliencia" del README para el detalle por caso.

`js/impressions.js` es independiente: expone `logImpression(name)` que
acumula conteos en `localStorage` (no hay backend), leído por
`stats.html` para mostrar tabla + export CSV + reinicio de período.

## Flujo de datos: contenido vs. automatización

Cada tipo de contenido tiene la misma forma: **una fuente editable a
mano y/o un `.json` autogenerado**, que `app.js` relee por polling
(nunca websockets/push, todo es `setInterval` + `fetch`):

| Contenido | Fuente manual | Autogenerado por | Cuándo corre |
|---|---|---|---|
| Música | `music/playlist.json` (metadata override) | `scripts/generate_playlist.py` escaneando `music/` | GitHub Action al hacer push a `music/**` |
| Fondos (locales) | `backgrounds/external.json` (URLs externas, a mano) | `scripts/generate_backgrounds_playlist.py` escaneando `backgrounds/` | GitHub Action al hacer push a `backgrounds/**` |
| Fondos (Wikimedia) | — (conserva las entradas manuales de `external.json`) | `scripts/generate_backgrounds_from_keywords.py` → agrega al grupo `source: "wikimedia-auto"` de `external.json` | GitHub Action con cron diario (+ manual), sin API key |
| Noticias | `news/news.json` | `scripts/generate_news_from_rss.py` → `news/rss.json`, combinando el grupo de feeds RSS en `RSS_FEEDS` | GitHub Action con cron cada 2h (+ manual) |
| Noticias (limpieza) | — | `scripts/prune_news.py` borra de `news.json` lo de +30 días | GitHub Action con cron semanal |

Los tres workflows en `.github/workflows/` (`update-playlists.yml`,
`update-news-rss.yml`, `prune-news.yml`) siguen el mismo patrón: corren
el script Python correspondiente y commitean el resultado con el
usuario `github-actions[bot]` si hubo cambios, directo a la rama que
disparó el evento (`git push origin HEAD:${{ github.ref_name }}`).
Requieren `permissions: contents: write` en el workflow y "Read and
write permissions" habilitado en Settings → Actions → General del
repo (ver sección 0 del README).

Los scripts en `scripts/*.py` son idempotentes y no destructivos por
diseño: nunca pisan campos corregidos a mano (`title`/`artist` en
playlists, `category` en noticias del RSS), solo agregan/quitan
entradas según lo que encuentran en disco o en el feed.

## `scripts/*.py`

Sin dependencias externas más allá de la librería estándar (verificar
imports si se agrega algo nuevo, para no romper el workflow que solo
tiene `actions/checkout` + Python del runner, sin `pip install`).

- `generate_playlist.py`: escanea `music/`, arma/actualiza `playlist.json`
  preservando overrides manuales de `title`/`artist`.
- `generate_backgrounds_playlist.py`: mismo patrón para `backgrounds/`.
- `generate_backgrounds_from_keywords.py`: busca fotos en la API
  pública de Wikimedia Commons (sin API key) por cada keyword en
  `KEYWORDS`, con crédito de atribución (`credit`: autor + licencia).
  Descarta verticales y formatos no-imagen (SVG, PDF, etc). Una
  keyword que falla se saltea, y solo si fallan todas deja
  `backgrounds/external.json` sin tocar. Nunca pisa entradas manuales
  de `external.json`: solo regenera las que ya vinieran marcadas
  `source: "wikimedia-auto"` de una corrida anterior.
- `generate_news_from_rss.py`: parsea el grupo de feeds RSS en
  `RSS_FEEDS` (RSS 2.0 o Atom), combina y dedupea por link; un feed
  puntual que falla se saltea sin afectar a los demás, y solo si
  fallan todos deja `news/rss.json` sin tocar.
- `prune_news.py`: borra de `news.json` (no de `rss.json`, que no
  necesita poda porque el RSS ya trae solo notas recientes) lo más
  viejo que `PRUNE_AFTER_DAYS` (30).
- `sync-local.sh`: `git pull` + log, para el escenario de hosting local
  con `cron` (ver HOSTING.md, opción de repo privado sin URL pública).

## Convenciones a mantener

- Todo el código de UI (`index.html`, `js/*.js`, `css/style.css`, y los
  comentarios existentes en el código) está en **español**, coherente
  con el proyecto — mantener ese idioma al editar.
- `CONFIG` en `js/app.js` es la superficie de ajuste preferida: antes
  de hardcodear un tiempo/URL nuevo dentro de una función, agregarlo
  ahí.
- Paleta de marca: solo 6 colores, definidos como variables CSS en
  `css/style.css` → `:root` (`--bg-1`, `--bg-2`, `--accent`,
  `--accent-2`, `--accent-3`, `--text`, `--text-dim`; ver la tabla en
  el README). No introducir hex nuevos sueltos en el CSS — cualquier
  color de marca debe salir de esas variables (o de un `rgba()` de esos
  mismos valores, como en `.bg-glow`/`.social-ticker`).
- No introducir un build step ni dependencias de npm: el proyecto
  depende de que GitHub Pages pueda servir los archivos tal cual están
  en el repo, sin paso de compilación.
- Los workflows commitean directo a la rama que los disparó (no abren
  PR) — si se agrega un workflow nuevo que escribe al repo, seguir ese
  mismo patrón (`contents: write`, checkout con `ref: ${{ github.ref_name }}`,
  commit solo si `git diff --cached` no está vacío).
