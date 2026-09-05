# Hosting en WordPress y protección de acceso

Este documento junta lo que charlamos sobre subir el proyecto a un
hosting de WordPress (en una carpeta propia, fuera del sitio de
WordPress en sí) y cómo protegerlo con usuario/contraseña.

## El repo público vs. la página corriendo

Son dos cosas distintas:

- **El repositorio de GitHub siendo público** solo expone el código
  fuente (HTML/CSS/JS) y los archivos que subas (mp3, imágenes). No
  expone la página "en funcionamiento" en ningún lado por sí solo.
- **La página corriendo** es otra cosa: hoy, si la probás local con
  `python3 -m http.server`, solo es accesible desde tu propia PC/red.
  El día que subas la carpeta a un hosting con URL pública (como el
  de WordPress), ahí sí cualquiera con esa URL podría abrirla.

## Plan: carpeta propia dentro del hosting de WordPress

Idea: subir todo este repo a una carpeta tipo
`tudominio.com/laulive/` (fuera de `wp-content`, para no mezclarlo
con WordPress) y apuntar la fuente de navegador de OBS a esa URL.

Cosas a tener en cuenta con ese plan:

1. **El auto-escaneo de `/music` probablemente no funcione.** La
   mayoría de los hostings (incluidos los de WordPress, por Apache)
   tienen el listado de directorios deshabilitado por seguridad. Por
   eso `playlist.json` (generado con `scripts/generate_playlist.py`)
   es ahora la fuente principal de la playlist — funciona en
   cualquier hosting, no depende de listar la carpeta. Ver
   `README.md` para el flujo de trabajo.
2. **Protegé la carpeta con usuario y contraseña real (Basic Auth).**
   Es la forma correcta de que no cualquiera con la URL entre.

## Cómo proteger la carpeta con Basic Auth (Apache / cPanel)

### Opción A — Desde cPanel (más fácil, sin tocar archivos)

1. cPanel → **Privacidad de directorios** (Directory Privacy).
2. Navegá hasta la carpeta (ej. `laulive/`).
3. Activá "Proteger este directorio" y ponele un nombre.
4. Creá un usuario y contraseña para esa carpeta.

cPanel genera el `.htaccess` y `.htpasswd` solo.

### Opción B — A mano (`.htaccess` + `.htpasswd`)

En este repo dejé una plantilla en `hosting/.htaccess.example`. Para
usarla:

1. Generá la contraseña encriptada (necesitás `openssl`, viene en
   casi cualquier Mac/Linux; en Windows se puede generar con Git
   Bash o pedirle a tu hosting que lo haga por vos):

   ```bash
   openssl passwd -apr1 "tu-contraseña-elegida"
   ```

   Te va a tirar algo como `$apr1$xyz123$abcdefghijklmnopqrstuv`.

2. Creá un archivo `.htpasswd` **fuera de la carpeta pública del
   sitio** (por seguridad, muchos hostings lo ponen un nivel arriba
   del `public_html`) con una línea:

   ```
   usuario:$apr1$xyz123$abcdefghijklmnopqrstuv
   ```

3. Copiá `hosting/.htaccess.example` como `.htaccess` dentro de la
   carpeta `laulive/` del hosting, y editá la ruta
   `AuthUserFile` para que apunte al `.htpasswd` que creaste.

4. Listo: al entrar a `tudominio.com/laulive/` el navegador va a
   pedir usuario y contraseña.

### Usarlo en OBS

En el campo URL de la fuente de navegador, metés las credenciales
directo en la URL así OBS no te pide nada cada vez:

```
http://usuario:contraseña@tudominio.com/laulive/index.html
```

(Reemplazá `usuario` y `contraseña` por los que hayas creado.)

## Alternativa liviana (sin Basic Auth)

Si no querés lidiar con `.htaccess`, la otra opción es simplemente:

- No enlazar la carpeta desde ningún lado del sitio de WordPress.
- Agregar un `robots.txt` que la excluya de buscadores.
- Confiar en que nadie va a adivinar la URL exacta.

Esto **no es seguridad real** (cualquiera con la URL entra), pero
como el contenido no es sensible (es un overlay de música y
noticias, no datos privados), puede alcanzar si no te preocupa que
alguien puntual la vea. La Opción A/B de arriba es la recomendada si
querés estar tranquilo.

## Correr todo local, con el repo privado

Otra opción — más privada todavía que cualquiera de las anteriores —
es no publicar la página en ningún lado con URL pública: pasar el
repositorio a **privado** en GitHub, y correr la página directamente
en la PC que tiene OBS abierto, como venimos haciendo para probar
(`python3 -m http.server`). Así:

- El código fuente queda privado (solo lo ven los colaboradores del
  repo).
- La página en funcionamiento **no tiene ninguna URL pública**: vive
  únicamente en `localhost` de esa PC, no accesible desde internet en
  absoluto. Es más privado que GitHub Pages, que — aunque el repo sea
  privado — en la mayoría de los planes de GitHub sigue publicando el
  sitio en una URL pública (`usuario.github.io/...`) salvo que tengas
  GitHub Enterprise.

Para que esto siga siendo "automático" como lo armamos (subís
archivos por GitHub y se reflejan solos, sin tocar la PC de
streaming), hace falta una pieza extra: la PC necesita bajar sola los
cambios del repo cada tanto (`git pull`), ya que a diferencia de
GitHub Pages, nadie los empuja hacia ella.

### 1. Pasar el repo a privado

**Settings → General → Danger Zone → Change visibility → Make
private.** Solo puede hacerlo alguien con permisos de administrador
del repositorio.

### 2. Clonar el repo en la PC de streaming (una sola vez)

Como el repo es privado, hace falta autenticarse. Lo más simple es
generar una clave SSH y agregarla a tu cuenta de GitHub (**Settings →
SSH and GPG keys**), y despues clonar con la URL SSH:

```bash
git clone git@github.com:tu-usuario/laulive.git
```

(La alternativa es un token de acceso personal en vez de SSH — sirve
igual, pero hay que volver a escribirlo cada vez que git lo pida a
menos que uses un gestor de credenciales.)

### 3. Sincronización automática (`git pull` cada 2-3 minutos)

Dejé listo `scripts/sync-local.sh`, que solo hace `git pull` y anota
un log. Se automatiza con `cron`:

```bash
crontab -e
```

Y agregar (ajustando la ruta a donde clonaste el repo):

```
*/2 * * * * /usr/bin/bash /ruta/a/laulive/scripts/sync-local.sh
```

### 4. Servidor local persistente

Igual que para probarlo, pero pensado para quedar corriendo 24/7:

```bash
python3 -m http.server 8080
```

Conviene dejarlo como un servicio de `systemd` (en vez de una
terminal abierta a mano), para que si la PC se reinicia, el servidor
vuelva a levantar solo. Un ejemplo mínimo de unit file:

```ini
# /etc/systemd/system/laulive.service
[Unit]
Description=Servidor local de laulive
After=network.target

[Service]
WorkingDirectory=/ruta/a/laulive
ExecStart=/usr/bin/python3 -m http.server 8080
Restart=always
User=tu-usuario

[Install]
WantedBy=multi-user.target
```

Y activarlo con:

```bash
sudo systemctl enable --now laulive.service
```

### 5. OBS

Sin cambios: la fuente de navegador sigue apuntando a
`http://localhost:8080/index.html`, exactamente como en las pruebas
locales que ya venimos haciendo.

**Con esto, todas las automatizaciones siguen funcionando igual**: el
GitHub Action sigue regenerando los `playlist.json` al subir archivos
(corre en los servidores de GitHub, no depende de que el repo sea
público), y el `git pull` cada 2 minutos en la PC de streaming hace
que esos cambios lleguen solos a la copia que lee OBS — el mismo
flujo de "subís un archivo y se refleja solo", sin URL pública de por
medio.
