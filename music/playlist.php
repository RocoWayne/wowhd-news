<?php
/**
 * Escanea esta misma carpeta en cada request y devuelve el listado de
 * canciones en JSON. Reemplaza la necesidad de correr
 * scripts/generate_playlist.py a mano: alcanza con subir/borrar mp3s
 * en esta carpeta y la pagina los detecta solos.
 *
 * Si music/playlist.json existe, sus entradas se usan para forzar
 * titulo/artista de un archivo puntual (ej. bancos de musica libre que
 * nombran "Titulo - Artista" al reves). No hace falta que liste todos
 * los archivos: solo los que querés corregir.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$musicDir = __DIR__;
$validExt = ['mp3', 'm4a', 'ogg', 'wav', 'flac'];

function parseFromFilename($filename) {
    $base = pathinfo($filename, PATHINFO_FILENAME);
    if (strpos($base, ' - ') !== false) {
        [$artist, $title] = explode(' - ', $base, 2);
        return [trim($artist), trim($title)];
    }
    return ['', trim($base)];
}

$overrides = [];
$overridesFile = $musicDir . '/playlist.json';
if (is_readable($overridesFile)) {
    $data = json_decode((string) file_get_contents($overridesFile), true);
    if (is_array($data)) {
        $rawTracks = array_key_exists('tracks', $data) ? $data['tracks'] : $data;
        foreach ((array) $rawTracks as $t) {
            if (is_array($t) && !empty($t['file'])) {
                $overrides[$t['file']] = $t;
            }
        }
    }
}

$tracks = [];
foreach (scandir($musicDir) ?: [] as $file) {
    if ($file === '.' || $file === '..') continue;
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    if (!in_array($ext, $validExt, true)) continue;

    if (isset($overrides[$file])) {
        $title = $overrides[$file]['title'] ?? '';
        $artist = $overrides[$file]['artist'] ?? '';
        if ($title === '' && $artist === '') {
            [$artist, $title] = parseFromFilename($file);
        }
    } else {
        [$artist, $title] = parseFromFilename($file);
    }

    $tracks[] = ['file' => $file, 'title' => $title, 'artist' => $artist];
}

usort($tracks, function ($a, $b) {
    return strcasecmp($a['file'], $b['file']);
});

echo json_encode($tracks, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
