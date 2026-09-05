<?php
/**
 * Escanea esta misma carpeta en cada request y devuelve el listado de
 * imagenes/videos de fondo en JSON. Igual que music/playlist.php: solo
 * funciona en un hosting con PHP (ej. WordPress). En GitHub Pages
 * (hosting estatico) se ignora solo, sin romper nada, y la pagina cae
 * a backgrounds/playlist.json.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$dir = __DIR__;
$validExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov', 'm4v'];

$files = [];
foreach (scandir($dir) ?: [] as $file) {
    if ($file === '.' || $file === '..') continue;
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    if (!in_array($ext, $validExt, true)) continue;
    $files[] = $file;
}

sort($files, SORT_STRING | SORT_FLAG_CASE);

echo json_encode($files, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
