# Fuente de navegador para OBS — Música 24/7 + Noticias

Página HTML pensada como **Browser Source** de OBS para una transmisión
24/7: reproduce música en aleatorio con el título en pantalla, muestra
noticias con foto + texto + código QR hacia la nota, rota publicidades
(imagen o video mudo) de fondo, y de tanto en tanto un popup invitando
a suscribirse.

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
news/rss.json           noticias auto-generadas desde el RSS de laubfal.com
news/birthdays/01.json..12.json   efemérides (cumpleaños) por mes, a mano
news/images/            imágenes locales de noticias (opcional)
scripts/generate_news_from_rss.py        lee el RSS y actualiza news/rss.json
.github/workflows/update-news-rss.yml    corre ese script cada 4 horas (ver mas abajo)
scripts/prune_news.py                    saca de news.json las noticias de mas de 30 dias
.github/workflows/prune-news.yml         corre ese script una vez por semana
backgrounds/            poné acá las publicidades: imagen o video mudo
backgrounds/playlist.json   lista de fondos locales (se autogenera con el script)
backgrounds/external.json   fondos alojados afuera del repo (opcional, a mano)
scripts/generate_playlist.py             escanea /music y actualiza playlist.json
scripts/generate_backgrounds_playlist.py escanea /backgrounds y actualiza su playlist.json
.github/workflows/update-playlists.yml   corre esos scripts solo al subir archivos (ver mas abajo)
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
  transmisión (`?utm_source=youtube&utm_medium=qrscan&utm_campaign=lasocia`,
  o con `&` si el link ya tenía otros parámetros). Se ajusta en
  `js/app.js` → `CONFIG` → `qrUtmParams`.
  El QR tiene un fulgor pulsante alrededor para invitar a escanearlo
  — se ajusta en `css/style.css` → `@keyframes qr-glow`.
- La página relee `news.json` sola cada 3 minutos, así que agregar o
  sacar noticias de la lista se refleja solo (sin reiniciar OBS).
- **Al abrir la página** ya arranca mostrando un bloque de noticias
  (por defecto, las primeras 2 de la lista) antes de empezar el
  slideshow de fondos.
- Después, **cada 15 minutos** se dispara otro bloque de 2 noticias
  (retomando la rotación donde quedó la vez anterior), pausando el
  slideshow de fondos mientras dura y retomándolo solo al terminar.
  Cada noticia del bloque queda **30 segundos** en pantalla.
- Todo esto se ajusta en `js/app.js` → `CONFIG`: `newsIntervalMs`
  (cada cuánto se dispara un bloque), `newsItemsPerBlock` (cuántas
  noticias seguidas por bloque) y `newsDisplayMs` (cuánto dura cada
  una en pantalla).
- El color de fondo plano de la pantalla de noticias se ajusta en
  `css/style.css` → `:root` → `--news-flat-bg`.

### Noticias automáticas desde el RSS de laubfal.com

Además de `news.json` (a mano), la página lee `news/rss.json` y
mezcla ambas listas en la rotación. `news/rss.json` se genera solo:
un GitHub Action corre cada 4 horas, lee
`https://laubfal.com/feed/`, y actualiza el archivo con las notas más
recientes del sitio (título, link, fecha e imagen destacada si el
feed la trae) — sin pisar nunca lo que cargaste a mano en
`news.json`.

- Si el feed falla puntualmente o viene con un formato inesperado, el
  script no toca `news/rss.json` (queda como estaba) en vez de
  vaciarlo.
- Las notas del RSS expiran solas igual que las manuales (ver
  `newsMaxAgeDays` arriba), así que no hace falta limpiar nada.
- El trigger automático (`schedule`) de GitHub Actions solo corre
  sobre la **rama por defecto** del repo — en este repositorio esa
  rama por defecto ya es `claude/obs-music-browser-laura-1hda5z` (no
  hay una rama `main` separada), así que el schedule ya está activo
  sin pasos extra. Si en algún momento cambian la rama por defecto
  (por ejemplo, al mergear a un `main` nuevo), hay que confirmar que
  el schedule siga corriendo ahí.
- Para forzar una actualización sin esperar, o para probarlo, andá a
  la pestaña **Actions** del repo → "Actualizar noticias desde el RSS
  de laubfal.com" → **Run workflow**.
- Se puede correr a mano en cualquier momento con
  `python3 scripts/generate_news_from_rss.py`.
- El intervalo (4 horas) se ajusta en
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

### Efemérides ("Hoy cumple años...")

Los cumpleaños tienen **su propia pantalla y su propio horario**,
separados de las noticias (no se mezclan en esa rotación): mismo
mecanismo de pantalla completa, pero con **fondo de otro color**
(`--birthday-flat-bg` en `css/style.css`, magenta más brillante que
el burdeos de las noticias) y sin fila de QR (no hay nota que leer).
Se cargan en `news/birthdays/`, **un archivo por mes** (`01.json` a
`12.json`, enero a diciembre):

```json
[
  { "day": 15, "name": "Nombre Apellido", "photo": "https://ejemplo.com/foto.jpg" },
  { "day": 22, "name": "Otra Persona" }
]
```

- **`day`**: el día del mes (número, sin ceros a la izquierda).
- **`name`**: se arma solo el texto "¡Feliz cumpleaños, `name`!".
- **`photo`** (opcional): si no la tenés, se muestra sin foto (no
  hace falta borrar el campo, alcanza con omitirlo).
- La página lee **solo el archivo del mes actual** y se queda con los
  que coincidan con el día de hoy — no hace falta ninguna lógica de
  medianoche: al pasar la fecha, el chequeo siguiente ya toma el día
  nuevo solo.
- **Frecuencia**: se chequea a los 5 minutos de abrir la página, y
  después **como mínimo cada 1 hora**. Si ese día no hay ningún
  cumpleaños cargado, no se muestra nada (no tiene sentido repetir
  cuando hay pocos). Si el chequeo coincide justo con un bloque de
  noticias en curso, no espera a la próxima hora entera: reintenta a
  los 2 minutos para igual garantizar el mínimo de una vez por hora.
  Se ajusta en `js/app.js` → `CONFIG` → `birthdayIntervalMs`
  (frecuencia), `birthdayFirstDelayMs` (primer chequeo) y
  `birthdayDisplayMs` (cuánto quedan visibles).
- **Importante sobre las fechas**: no cargues cumpleaños "a ojo" — una
  fecha de nacimiento incorrecta de una persona real, mostrada en
  vivo, es un error real. Cargalos verificados, igual que hacés con
  las noticias.
- El tag ("CUMPLEAÑOS") se ajusta en `js/app.js` → `CONFIG` →
  `birthdaysCategory`.

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

- El texto usa `@laubfal` como usuario provisorio en las tres redes,
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

## Personalización rápida (`js/app.js` → `CONFIG`)

| Parámetro | Qué hace |
|---|---|
| `playlistRefreshMs` | cada cuánto relee `playlist.json` |
| `newsRefreshMs` | cada cuánto relee `news.json` |
| `newsIntervalMs` | cada cuánto se dispara un bloque de noticias |
| `newsItemsPerBlock` | cuántas noticias seguidas se muestran por bloque |
| `newsDisplayMs` | cuánto tiempo queda visible cada noticia dentro del bloque |
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

## Ideas para seguir sumando

- Historial de "últimas canciones" en pantalla.
- Pedidos de canciones vía chat de Twitch/YouTube.
- Franja de texto (ticker) con más noticias corriendo abajo.
- Distintos "temas" visuales (día/noche, fechas especiales).
