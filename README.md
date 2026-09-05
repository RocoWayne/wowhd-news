# MUNDO WOW 24/7 — Fuente de navegador para OBS (Música + Noticias)

Página HTML pensada como **Browser Source** de OBS para la transmisión
24/7 de **MUNDO WOW 24/7**: reproduce música en aleatorio con el título
en pantalla, muestra noticias con foto + texto + código QR hacia la
nota, rota publicidades (imagen o video mudo) de fondo, y de tanto en
tanto un popup invitando a suscribirse.

## Estructura

```
index.html            página principal (la que se carga en OBS)
css/style.css          estilos
js/app.js               lógica: playlist, reproductor, noticias, fondos, QR
js/impressions.js        registro de impresiones de /backgrounds (localStorage)
stats.html              panel para ver/exportar las impresiones de publicidad
music/                 poné acá tus archivos de audio (mp3, m4a, ogg, wav, flac)
music/playlist.json     lista de canciones (se autogenera con el script)
news/news.json          noticias cargadas a mano
news/rss.json           noticias auto-generadas desde el RSS del sitio
news/images/            imágenes locales de noticias (opcional)
scripts/generate_news_from_rss.py        lee el RSS y actualiza news/rss.json
.github/workflows/update-news-rss.yml    corre ese script cada 4 horas (ver mas abajo)
scripts/prune_news.py                    saca de news.json las noticias de mas de 30 dias
.github/workflows/prune-news.yml         corre ese script una vez por semana
backgrounds/            poné acá las publicidades: imagen o video mudo
backgrounds/playlist.json   lista de fondos locales (se autogenera con el script)
backgrounds/external.json   fondos alojados afuera del repo (a mano, y/o fotos automáticas de Wikimedia Commons)
scripts/generate_playlist.py             escanea /music y actualiza playlist.json
scripts/generate_backgrounds_playlist.py escanea /backgrounds y actualiza su playlist.json
.github/workflows/update-playlists.yml   corre esos scripts solo al subir archivos (ver mas abajo)
scripts/generate_backgrounds_from_keywords.py       busca fotos en Wikimedia Commons por keyword y actualiza external.json
.github/workflows/update-backgrounds-keywords.yml   corre ese script una vez por día (ver mas abajo)
hosting/.htaccess.example      plantilla de usuario/contraseña para hosting público
HOSTING.md               guía de hosting en WordPress y protección de acceso
```

## 0. Subir música/fondos y que se actualice solo (configuración única)

Subir archivos a `music/` o `backgrounds/` (por ejemplo desde la web de
GitHub, con "Add file → Upload files") **actualiza la playlist sola**:
un GitHub Action detecta el cambio, corre los scripts de
`scripts/generate_playlist.py` / `scripts/generate_backgrounds_playlist.py`
y commitea el `playlist.json` actualizado — no hace falta correr nada a
mano ni pedirme que lo haga.

Esto requiere un **paso de configuración único** en el repositorio (ya
lo hizo Claude/alguien con acceso, pero por las dudas):

1. GitHub → **Settings → Actions → General**.
2. Bajar hasta **"Workflow permissions"**.
3. Elegir **"Read and write permissions"** y guardar.

Sin este permiso, el Action no puede commitear el `playlist.json`
actualizado (falla con un error de permisos, visible en la pestaña
**Actions** del repo). Se configura una sola vez.

## 1. Cargar canciones

1. Copiá tus archivos de audio a la carpeta `music/` (mp3, m4a, ogg, wav
   o flac) y subilos al repo (push, o "Add file → Upload files" desde
   la web de GitHub).
2. Nombralos idealmente como `Artista - Título.mp3` para que el
   reproductor detecte artista y título solo. Si no, se usa el nombre
   del archivo entero como título.
3. Listo. El GitHub Action (ver sección 0) regenera `music/playlist.json`
   solo en cuanto detecta el push — no hace falta correr nada a mano.
   La página relee esa lista cada 2 minutos, así que en un par de
   minutos el tema nuevo ya está sonando (sin cortar la canción que
   esté sonando en ese momento, y sin tocar OBS).
4. Si preferís generarlo vos mismo en el momento (por ejemplo, para
   probarlo local antes de subir), corré:
   ```bash
   python3 scripts/generate_playlist.py
   ```
   Es seguro correrlo en cualquier momento: **no pisa** títulos/artistas
   que ya hayas corregido a mano, solo agrega los archivos nuevos y saca
   los que borraste.

> **Sobre `music/playlist.php`**: existe en el repo un endpoint PHP que
> escanea `/music` solo, en tiempo real, sin necesitar el paso 2 — pero
> **solo funciona en un hosting con PHP** (como el de WordPress), no en
> GitHub Pages. Por ahora queda ahí sin usarse (en GitHub Pages se
> ignora solo, no rompe nada) para cuando llegue el momento de migrar a
> ese hosting. Más detalle en [`HOSTING.md`](HOSTING.md).

### Corregir título/artista manualmente

Muchos bancos de música libre nombran los archivos al revés ("Título -
Artista" en vez de "Artista - Título"), y el script no tiene forma de
adivinar eso. Si ves un tema con el título/artista cambiado, editá
directamente su entrada en `music/playlist.json`:

```json
{ "file": "cancion1.mp3", "title": "Mi Título", "artist": "Mi Artista" }
```

Esa corrección queda guardada aunque vuelvas a correr el script.

### Crédito/atribución del artista

Muchos bancos de música libre de derechos exigen dejar constancia del
autor y/o la licencia al usar el tema. Para eso, agregá un campo
`credit` a la entrada de ese tema en `music/playlist.json` (opcional,
solo en los temas que lo necesiten):

```json
{ "file": "cancion1.mp3", "title": "Mi Título", "artist": "Mi Artista", "credit": "Música: Mi Artista (CC BY 4.0) — freemusicarchive.org" }
```

Se muestra como una línea chica y discreta debajo del artista, en el
reproductor. Si un tema no tiene `credit` cargado, esa línea
simplemente no aparece (no queda un hueco vacío). Igual que
`title`/`artist`, `scripts/generate_playlist.py` nunca pisa este campo
una vez cargado.

### No suenan los temas (o no rotan los fondos) — checklist rápido

- ¿Pasaron ya 1-2 minutos desde que subiste los archivos? El Action
  tarda un rato en correr y GitHub Pages otro poco en desplegar.
- Repositorio → pestaña **Actions**: ¿el workflow "Actualizar
  playlists de musica y fondos" corrió bien (✅) o falló (❌)? Si
  falló, seguramente falta el permiso de escritura — ver sección 0.
- Fijate que `music/playlist.json` (o `backgrounds/playlist.json`) no
  haya quedado vacío (`[]`) después de esto.
- ¿Estás probando local, abriendo la página con un servidor
  (`http://localhost:...`) y no como archivo (`file://...`)? Abierta
  como archivo local, el navegador bloquea la lectura de los `.json`.
- Revisá la consola del navegador (F12 → Console): ahí quedan los
  errores si algún archivo no carga.

## 2. Cargar noticias

Editá `news/news.json`. Es una lista: cargá ahí todas las noticias que
quieras tener disponibles y la página las va mostrando **en bloques**,
rotando en orden (y cuando termina la lista, vuelve a arrancar desde
la primera).

Pensada para verse bien en un TV: cuando le toca a un bloque de
noticias, ocupa **toda la pantalla** con un fondo de color plano
(reemplaza momentáneamente el slideshow de publicidades de fondo, que
sigue pausado hasta que termina el bloque) — título grande, foto
grande y un QR grande y legible para escanear desde lejos. La marca,
el reloj y el reproductor de música siguen visibles arriba de todo.

```json
[
  {
    "date": "2026-09-04",
    "image": "images/nota1.jpg",
    "text": "Texto o titular de la noticia que se muestra en pantalla.",
    "link": "https://ejemplo.com/nota-completa"
  },
  {
    "date": "2026-09-04",
    "image": "images/nota2.jpg",
    "text": "Otra noticia. Podés cargar tantas como quieras, se van turnando solas.",
    "link": "https://ejemplo.com/otra-nota"
  }
]
```

- **`date`** (opcional, formato `AAAA-MM-DD`): la fecha de la noticia.
  Pasados **7 días** desde esa fecha, la noticia deja de mostrarse
  sola — así la rotación no se llena de notas viejas si vas sumando
  una por día sin sacar nada. Una noticia **sin** `date` (o con una
  fecha mal escrita) **nunca expira**, para no romper nada que ya
  tengas cargado. El límite de días se ajusta en `js/app.js` →
  `CONFIG` → `newsMaxAgeDays`.
- **`image`**: una foto por noticia. Puede ser una ruta local (guardá
  el archivo en `news/images/` y referencialo como
  `images/nombre.jpg`) o una URL completa (`https://...`). Si el link
  se rompe o la imagen no carga, la página lo detecta sola y oculta
  el espacio de la foto en vez de mostrar un ícono roto.
- **`text`**: el titular/texto corto que se muestra. Si es muy largo,
  se corta con puntos suspensivos a partir de la 5ª línea — mejor
  mantenerlo breve (1-2 oraciones).
- **`category`** (opcional): reemplaza el tag "NOTICIA" de arriba del
  título por esta palabra (ej. "Gran Hermano", "Bailando"). Las
  noticias del RSS ya la traen sola —se completa automáticamente con
  la categoría de WordPress de la nota—; en `news.json` (a mano) es
  opcional, y si no la ponés queda el tag genérico "NOTICIA".
- **`link`**: la URL de la noticia completa en el sitio de noticias.
  Se convierte **automáticamente en un código QR** en pantalla (no
  hace falta generar el QR vos). Si una noticia no tiene `link`, se
  muestra sin QR.
  Antes de generar el QR, se le agregan automáticamente parámetros UTM
  para trackear en Analytics/YouTube cuánta gente escanea desde la
  transmisión (`?utm_source=youtube&utm_medium=qrscan&utm_campaign=lasociacomar`,
  o con `&` si el link ya tenía otros parámetros). Se ajusta en
  `js/app.js` → `CONFIG` → `qrUtmParams`.
  El QR tiene un fulgor pulsante alrededor para invitar a escanearlo
  — se ajusta en `css/style.css` → `@keyframes qr-glow`.
- La página relee `news.json` sola cada 3 minutos, así que agregar o
  sacar noticias de la lista se refleja solo (sin reiniciar OBS).
- **Al abrir la página** ya arranca mostrando un bloque de noticias
  (por defecto, las primeras 3 de la lista) antes de empezar el
  slideshow de fondos.
- Después, **cada 15 minutos** se dispara otro bloque de 3 noticias
  (retomando la rotación donde quedó la vez anterior), pausando el
  slideshow de fondos mientras dura y retomándolo solo al terminar.
  Cada noticia del bloque queda **30 segundos** en pantalla.
- Arriba del título se ve una **barra de progreso por noticia**
  (estilo "historias" de Instagram): una barrita por cada noticia de
  la tanda actual, que se va llenando en tiempo real mientras esa
  noticia está en pantalla, para que se note cuánto falta para la
  siguiente. Las anteriores quedan llenas y las que vienen después
  quedan vacías. La barra **persiste sin parpadear** durante toda la
  tanda: entre una noticia y la siguiente solo hace un crossfade
  rápido el contenido de abajo (título/imagen/texto/QR), no la
  pantalla completa (ajustable en `CONFIG.newsContentFadeMs`).
- Al terminar la tanda, antes de retomar el slideshow de fondos,
  aparece **15 segundos** un mensaje de cierre centrado en pantalla
  ("Estas fueron las noticias más importantes del momento. Seguimos
  en un rato."). El texto se edita directo en `index.html` →
  `#newsOutro`, y la duración en `js/app.js` → `CONFIG` →
  `newsOutroMs`.
- Todo esto se ajusta en `js/app.js` → `CONFIG`: `newsIntervalMs`
  (cada cuánto se dispara un bloque), `newsItemsPerBlock` (cuántas
  noticias seguidas por bloque), `newsDisplayMs` (cuánto dura cada
  una en pantalla) y `newsOutroMs` (duración del mensaje de cierre).
- El color de fondo plano de la pantalla de noticias (y del mensaje de
  cierre) se ajusta en `css/style.css` → `:root` → `--news-flat-bg`.

### Noticias automáticas desde un grupo de RSS internacionales

Además de `news.json` (a mano), la página lee `news/rss.json` y
mezcla ambas listas en la rotación. `news/rss.json` se genera solo:
un GitHub Action corre cada 2 horas, lee un **grupo de feeds RSS de
noticias internacionales en castellano** (configurado en
`scripts/generate_news_from_rss.py` → `RSS_FEEDS`) y actualiza el
archivo con las notas más recientes combinadas de todos ellos
(título, link, fecha, imagen destacada y categoría del feed, cuando
están disponibles) — sin pisar nunca lo que cargaste a mano en
`news.json`.

- Feeds actuales del grupo (probados en vivo): France 24 en Español,
  BBC Mundo, Infobae, El País (Internacional), RT en Español y
  Euronews en Español. Se pueden agregar o sacar feeds editando esa
  misma lista. DW en Español y CNN en Español se probaron y se
  sacaron: sus URLs conocidas devuelven un bloqueo de bot (DW) o 404
  (CNN) — si en algún momento se consigue una URL de RSS válida para
  alguno de los dos, se puede volver a agregar.
- Cada feed aporta hasta `MAX_ITEMS_PER_FEED` (12) noticias, y el
  archivo combinado se recorta a `MAX_TOTAL_ITEMS` (60) en total,
  ordenado por fecha (más nuevo primero). Ambos límites se ajustan en
  `scripts/generate_news_from_rss.py`.
- Si un feed puntual falla (caído, bloqueado, cambió de URL) o viene
  con un formato inesperado, el script lo saltea sin afectar a los
  demás feeds del grupo; solo si **todos** fallan a la vez, deja
  `news/rss.json` como estaba en vez de vaciarlo.
- Las notas del RSS expiran solas igual que las manuales (ver
  `newsMaxAgeDays` arriba), así que no hace falta limpiar nada.
- El trigger automático (`schedule`) de GitHub Actions solo corre
  sobre la **rama por defecto** del repo — si en algún momento cambia
  la rama por defecto del repositorio, hay que confirmar que el
  schedule siga corriendo ahí.
- Para forzar una actualización sin esperar, o para probarlo, andá a
  la pestaña **Actions** del repo → "Actualizar noticias desde el
  grupo de RSS internacionales" → **Run workflow**.
- Se puede correr a mano en cualquier momento con
  `python3 scripts/generate_news_from_rss.py`.
- El intervalo (2 horas) se ajusta en
  `.github/workflows/update-news-rss.yml` (línea `cron`).

### Limpieza automática de `news.json`

`news/news.json` (las noticias cargadas a mano) no tiene un tope de
cantidad como `rss.json` — crece con cada noticia que se agrega y
nunca se achica solo. Para que no crezca sin límite con los años, un
GitHub Action corre **una vez por semana** y saca físicamente del
archivo las noticias de **más de 30 días** (bastante más que los 7
días que ya usa la página para dejar de mostrarlas, así no se toca
nada que todavía pudiera importar). Una noticia sin `date` nunca se
borra.

- Se puede correr a mano con `python3 scripts/prune_news.py`.
- El plazo (30 días) se ajusta en `scripts/prune_news.py` →
  `PRUNE_AFTER_DAYS`. El intervalo (semanal) en
  `.github/workflows/prune-news.yml` (línea `cron`).

## 3. Cargar publicidades de fondo

Copiá las imágenes y/o videos a la carpeta `backgrounds/` y subilos al
repo. Igual que con la música, el GitHub Action (sección 0) regenera
`backgrounds/playlist.json` solo — no hace falta correr nada a mano.
Si querés generarlo vos en el momento (ej. para probar local), corré:

```bash
python3 scripts/generate_backgrounds_playlist.py
```

- Formatos de imagen válidos: `jpg`, `jpeg`, `png`, `webp`, `gif`.
- Formatos de video válidos: `mp4`, `webm`, `mov`, `m4v`. Los videos se
  reproducen **sin sonido** (aunque tengan audio, se silencia) y de
  fondo, ocupando toda la pantalla, con un velo oscuro encima para que
  el título de la canción y las noticias se sigan leyendo bien.
- Van rotando solas, en orden aleatorio (sin repetir la anterior):
  cada **imagen** queda 35 segundos y pasa a la siguiente; cada
  **video** se reproduce completo y recién ahí pasa al siguiente.
- La página relee la carpeta cada 2 minutos, así que agregar o sacar
  archivos se refleja solo, sin cortar el fondo que esté mostrando en
  ese momento.
- Si la carpeta está vacía, se ve el fondo degradado original (el de
  antes de esta función) — no hace falta tener archivos cargados para
  que la página funcione.
- El tiempo que queda cada imagen se ajusta en `js/app.js` → `CONFIG` →
  `backgroundImageDurationMs`.
- El cambio entre un fondo y el siguiente es un **crossfade real**
  (disolve, ~1.1s), no un corte — funciona igual pasando de imagen a
  imagen, de imagen a video o entre videos. Se ajusta en
  `css/style.css` → `.bg-layer` (duración de la transición) y en
  `js/app.js` → `BG_CROSSFADE_MS` (debe coincidir con ese valor).

### Videos alojados afuera del repo (evitar subir archivos pesados a git)

Si no querés inflar el repositorio con videos pesados, podés alojarlos
en otro lado (GitHub Releases, Google Drive, Dropbox, Cloudflare R2,
etc.) y declarar la URL en **`backgrounds/external.json`** en vez de
subir el archivo a `/backgrounds`:

```json
[
  "https://github.com/tu-usuario/tu-repo/releases/download/spots/sponsor1.mp4",
  { "url": "https://drive.google.com/uc?export=download&id=XXXX", "type": "video" }
]
```

- Podés poner directamente la URL como string si termina en una
  extensión reconocible (`.mp4`, `.jpg`, etc.).
- Si la URL no tiene extensión clara (por ejemplo, un link de descarga
  de Google Drive), usá el formato `{ "url": "...", "type": "video" }`
  para indicar el tipo a mano.
- Estos fondos externos se mezclan con los que ya haya en
  `/backgrounds` y rotan igual que el resto (mismos tiempos, mismo
  mute forzado en video, misma medición de impresiones en
  `stats.html`).
- **Recomendado para alojar el video**: GitHub Releases del mismo
  repo — es gratis, soporta hasta 2GB por archivo, y a diferencia de
  subir el archivo directo a `/backgrounds`, no infla el historial de
  git con binarios pesados en cada commit. Se crea desde la pestaña
  "Releases" del repositorio ("Add file" al crear un release) y se
  copia el link de descarga del archivo subido.
- Ojo con no usar YouTube para esto: al embeberlo, YouTube puede
  insertar sus propios anuncios sobre el video en cualquier momento,
  lo cual arruinaría el spot pago.

### Fotos automáticas de bancos gratuitos por keyword

Además de las publicidades/sponsors, un GitHub Action busca fotos
libres en **Wikimedia Commons** una vez por día y las agrega solo a
`backgrounds/external.json`, para tener variedad de fondos sin subir
imágenes a mano. Las keywords están en
`scripts/generate_backgrounds_from_keywords.py` → `KEYWORDS` (por
defecto, genéricas de noticias/entretenimiento: "news studio",
"television broadcast", "entertainment lights", "red carpet event",
"concert crowd" — se pueden cambiar libremente).

- **Sin configuración**: la API de Wikimedia Commons es pública y no
  requiere API key ni registro — el workflow funciona de una sin
  cargar ningún secret.
- Solo se toman imágenes horizontales (se descartan las verticales,
  pensado para fondo de pantalla) en formato jpg/png/webp (se
  descartan SVG, PDF u otros archivos que puedan aparecer en la
  búsqueda).
- Estas fotos se agregan **sin pisar** las entradas cargadas a mano en
  `external.json` (ej. un video de sponsor): se marcan internamente
  con `"source": "wikimedia-auto"`, y en cada corrida solo se
  regenera ese grupo, dejando el resto tal cual.
- Cada foto trae su **crédito de atribución** (`"credit": "Foto:
  Autor (Licencia) / Wikimedia Commons"`), que se muestra como un
  texto chico y discreto abajo a la derecha de la pantalla mientras
  esa foto está de fondo (se oculta solo si el fondo actual no tiene
  `credit` cargado, y queda tapado automáticamente durante los
  bloques de noticias). El mismo campo `credit` funciona para
  cualquier entrada de `external.json`, no solo para las automáticas
  — se puede usar igual en una entrada cargada a mano.
- Si alguna keyword puntual falla (o no devuelve resultados), se la
  saltea sin afectar a las demás; solo si **todas** fallan a la vez se
  deja `external.json` como estaba.
- Para forzar una actualización sin esperar al día siguiente, andá a
  la pestaña **Actions** del repo → "Actualizar fondos desde Wikimedia
  Commons por keywords" → **Run workflow**.
- Se puede correr a mano con
  `python3 scripts/generate_backgrounds_from_keywords.py`.
- La cantidad de fotos por keyword (`IMAGES_PER_KEYWORD`) y el
  intervalo (diario, en `.github/workflows/update-backgrounds-keywords.yml`
  → línea `cron`) se pueden ajustar.

### Contar impresiones (para reportarle a un sponsor)

Cada vez que un archivo de `/backgrounds` pasa a mostrarse, queda
registrado. Para ver cuántas veces se mostró cada uno, abrí
**[`stats.html`](stats.html)** — muestra una tabla ordenada por
impresiones, con botón para descargar un CSV y para reiniciar el
período (por ejemplo, una vez por semana, para armar el reporte y
arrancar el conteo de nuevo desde cero). Los períodos ya cerrados
quedan guardados abajo, en "Períodos anteriores".

**Importante**: como el sitio es estático (sin backend), este conteo
se guarda en el `localStorage` del navegador — es decir, en la PC
donde efectivamente corre la fuente de OBS. Para consultarlo hay que
abrir `stats.html` en esa misma PC (mismo navegador/perfil); no se ve
desde otra computadora.

## 4. Popup de suscripción

Un banner desciende desde arriba al centro de la pantalla invitando a
suscribirse, y vuelve a subir solo. Por ahora es solo texto (sin
link/QR — se puede agregar el día que haya un canal/link definido).

- Aparece **al minuto** de abrir la página, y después **cada 10
  minutos**.
- Queda visible **15 segundos** cada vez.
- Si coincide con un bloque de noticias (pantalla completa), se salta
  esa aparición para no superponerse — vuelve a aparecer en el
  siguiente turno, 10 minutos después.
- Texto, tiempos y color se ajustan en:
  - `index.html` → `#subscribePopup` (el texto)
  - `js/app.js` → `CONFIG` → `subscribeFirstDelayMs`,
    `subscribeIntervalMs`, `subscribeDisplayMs`
  - `css/style.css` → `.subscribe-popup` (usa el gradiente de acento
    de la marca por defecto)

## 5. Ticker de redes

Una franja al pie de la pantalla con un scroll infinito mostrando los
íconos de Facebook, Twitter/X e Instagram. Pensada para no competir
con las noticias: **solo aparece cuando NO hay un bloque de noticias
en pantalla** — se oculta sola apenas arranca un bloque, y vuelve a
aparecer al terminar (el reproductor de música sube un poco para no
quedar tapado por la franja).

- El texto usa `@tunombre` como usuario provisorio en las tres redes,
  a confirmar. Para actualizarlo (o poner un usuario distinto por
  red), editá el texto de cada `<span>Seguinos en ...</span>` en
  `index.html` — hay **dos bloques idénticos** (el ticker se arma
  repitiendo el contenido dos veces para que el scroll infinito no se
  note el corte), así que hay que cambiar las 6 apariciones.
- Velocidad del scroll y aspecto: `css/style.css` →
  `.social-ticker-track` (duración de `animation`) y `.social-ticker`.
- La lógica de mostrar/ocultar está en `js/app.js` →
  `setSocialTickerVisible()`, llamada al principio y al final de
  `runNewsBlock()`.

## 6. Probarlo / correrlo

Los `fetch()` a los `.json` necesitan que la página se sirva por HTTP,
no abierta como archivo local (`file://`). Desde la carpeta del
proyecto:

```bash
python3 -m http.server 8080
```

Y abrís `http://localhost:8080/index.html` en el navegador para
probarlo antes de meterlo en OBS.

## 7. Publicarlo en GitHub Pages

Esta es la forma en la que estamos usando el proyecto por ahora, así
no depende de tener un servidor corriendo en la PC de streaming:

1. En GitHub, andá a **Settings → Pages** del repositorio.
2. En "Build and deployment" → **Source**, elegí **Deploy from a
   branch**.
3. Elegí la rama con el código (esta rama, o `main` si mergeaste ahí)
   y carpeta `/ (root)`.
4. Guardá. GitHub te va a dar una URL tipo
   `https://tu-usuario.github.io/laulive/`.
5. Cada vez que hagas `git push` con cambios (temas nuevos, noticias,
   etc.), GitHub Pages se actualiza solo en un par de minutos.

Esa URL queda **pública** (cualquiera con el link puede abrirla) — a
diferencia de correrla local, donde solo vos podés acceder. Como el
contenido no es sensible (overlay de música y noticias, sin datos
privados), no debería ser un problema, pero tenelo presente. GitHub
Pages no soporta usuario/contraseña (Basic Auth) por su cuenta; si más
adelante eso importa, es otro argumento a favor de migrar a un hosting
propio como se explica en `HOSTING.md`.

## 8. Agregarlo en OBS

1. En OBS: **Fuentes → Agregar → Fuente de navegador**.
2. URL: la de GitHub Pages (`https://tu-usuario.github.io/laulive/`) o,
   si preferís correrlo local, `http://localhost:8080/index.html` con
   `python3 -m http.server 8080` corriendo.
3. Ancho/alto: `1920x1080` (o el tamaño de tu escena).
4. Marcá **"Controlar audio a través de OBS"** para poder mezclar el
   volumen de la música con el mixer de OBS.
5. Si el audio no arranca solo (política de autoplay), tildá también
   la opción de OBS que permite reproducción de medios sin interacción,
   o simplemente refrescá la fuente una vez al agregarla.

## 9. Más adelante: hosting propio (ej. WordPress)

Cuando llegue el momento de migrar a un hosting propio (por ejemplo,
una carpeta dentro del hosting de WordPress), ver
**[`HOSTING.md`](HOSTING.md)**: ahí está la guía de protección con
usuario/contraseña (Basic Auth) y el detalle de `music/playlist.php`,
que en ese tipo de hosting permite detectar mp3s nuevos sin correr
ningún script.

## Paleta de marca (`css/style.css` → `:root`)

Todos los colores de la página salen de 6 variables CSS en `:root`,
que reflejan la paleta simplificada de la marca MUNDO WOW 24/7. Para
ajustar algún color de marca, editar solo estas variables (no hay
colores de marca sueltos por otras partes del CSS):

| Variable | Color | Uso |
|---|---|---|
| `--bg-1` | `#02102A` Azul fondo principal | fondo degradado detrás del slideshow de publicidades |
| `--bg-2` / `--accent-2` | `#00245A` Azul secundario | segundo stop del fondo degradado, color plano de la pantalla de noticias (`--news-flat-bg`), y stop oscuro en los gradientes con el naranja |
| `--accent` | `#FF7A00` Naranja principal | punto de "en vivo", CTA (popup de suscripción, botón de autoplay, barra de progreso) |
| `--accent-3` | `#1673FF` Azul acento | texto/iconos destacados (reproductor, ticker) |
| `--text` | `#FFFFFF` Blanco | texto principal |
| `--text-dim` | `#D6DCE5` Gris claro | texto secundario (artista, separadores) |

## Personalización rápida (`js/app.js` → `CONFIG`)

| Parámetro | Qué hace |
|---|---|
| `playlistRefreshMs` | cada cuánto relee `playlist.json` |
| `audioCrossfadeMs` | duración del crossfade de audio entre una canción y la siguiente |
| `newsRefreshMs` | cada cuánto relee `news.json` |
| `newsIntervalMs` | cada cuánto se dispara un bloque de noticias |
| `newsItemsPerBlock` | cuántas noticias seguidas se muestran por bloque |
| `newsDisplayMs` | cuánto tiempo queda visible cada noticia dentro del bloque |
| `newsOutroMs` | cuánto dura el mensaje de cierre al terminar una tanda de noticias |
| `newsMaxAgeDays` | días desde `date` antes de que una noticia deje de mostrarse sola |
| `qrSize` | tamaño en px del QR generado |
| `backgroundsRefreshMs` | cada cuánto relee la carpeta `backgrounds/` |
| `backgroundImageDurationMs` | cuánto queda cada imagen de fondo antes de pasar a la siguiente |
| `maxVideoDurationMs` | watchdog: si un video de fondo se cuelga sin terminar, fuerza el avance después de esto |

## Resiliencia para transmisiones largas (24/7)

Pensado para no necesitar reinicios manuales de OBS. Salvo la caída
del audio (única que no tiene forma de resolverse sin un click en un
navegador normal, ver más abajo), la página se auto-recupera sola de:

- **Música que no arranca** porque `playlist.json` estaba vacío/lento
  al abrir la página: en cuanto el siguiente refresco (cada 2 min)
  encuentra temas, arranca la reproducción sola.
- **Audio pausado** por cualquier motivo (bloqueo de autoplay
  transitorio, error puntual): se reintenta solo cada 15 segundos.
  Si el navegador bloquea el autoplay de forma persistente (fuera de
  OBS, o sin la opción "Controlar audio a través de OBS" tildada),
  esto no lo puede resolver solo — ahí sí hace falta el click único en
  "Iniciar", como está documentado en la sección de OBS.
- **Fondos o canciones rotas**: si un archivo puntual falla, se
  saltea a la siguiente en vez de trabarse. Si un archivo de fondo
  falla repetidamente (roto, o un corte de red), se lo deja de
  intentar hasta el próximo refresco de la carpeta en vez de
  reintentar en loop sin parar.
- **Video de fondo colgado**: si un video nunca termina ni tira error
  (archivo corrupto a mitad de reproducción), hay un límite de tiempo
  máximo (`maxVideoDurationMs`) que fuerza pasar al siguiente fondo.
- **QR o imagen de noticia caídos** (ej. `api.qrserver.com` lento):
  se ocultan en vez de mostrar el ícono de imagen rota en pantalla
  completa.
- **Crossfade de audio que no llega a dispararse** (ej. no se pudo leer
  la duración del archivo a tiempo): en vez de quedar en silencio, se
  hace un corte seco directo al siguiente tema.
