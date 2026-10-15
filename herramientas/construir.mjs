// Construye la galería a partir de la carpeta de Drive.
//   node herramientas/construir.mjs              → solo prepara los archivos
//   node herramientas/construir.mjs --publicar   → además sube los cambios a GitHub
//
// Carpeta de origen (por defecto "G:\Mi unidad\Vía Hub Studio\Galería web"):
//   Reels\<Marca>\video.mp4               (+ video.png/.jpg opcional como portada)
//   Motion graphics\<Marca>\video.mp4
//   Afiches\<Marca>\imagen.png            (una subcarpeta con varias imágenes = carrusel)
//   Marcas\<Marca>\datos.txt + "1 Paso"\, "2 Paso"\…   (proceso de identidad)
// El nombre de la subcarpeta se muestra como etiqueta de la marca.
// El título sale del nombre del archivo (lo que va después del último " · ").

import { readdir, stat, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const PUBLICAR = args.includes('--publicar');
const iOrigen = args.indexOf('--origen');
const ORIGEN = iOrigen >= 0 ? args[iOrigen + 1] : 'G:\\Mi unidad\\Vía Hub Studio\\Galería web';

const EXT_VIDEO = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv']);
const EXT_IMAGEN = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const LIMITE_MB = 95; // GitHub rechaza archivos de más de 100 MB

function buscarBinario(nombre) {
  const r = spawnSync('where', [nombre], { encoding: 'utf8' });
  const ruta = r.stdout?.split(/\r?\n/).find(Boolean);
  if (ruta) return ruta.trim();
  const winget = path.join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WinGet', 'Packages');
  if (existsSync(winget)) {
    for (const d of readdirSync(winget).filter(n => n.startsWith('Gyan.FFmpeg'))) {
      for (const sub of readdirSync(path.join(winget, d))) {
        const exe = path.join(winget, d, sub, 'bin', `${nombre}.exe`);
        if (existsSync(exe)) return exe;
      }
    }
  }
  throw new Error(`No encontré ${nombre}. Instalalo con: winget install Gyan.FFmpeg`);
}

const FFMPEG = buscarBinario('ffmpeg');
const FFPROBE = buscarBinario('ffprobe');

function correr(bin, argumentos) {
  const r = spawnSync(bin, argumentos, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${path.basename(bin)} falló:\n${(r.stderr || '').slice(-1500)}`);
  return r.stdout;
}

function sondear(archivo) {
  const salida = correr(FFPROBE, ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:stream_side_data=rotation:format=duration', '-of', 'json', archivo]);
  const j = JSON.parse(salida);
  const s = j.streams?.[0] ?? {};
  let w = s.width, h = s.height;
  const rot = Math.abs(Number(s.side_data_list?.find(x => 'rotation' in x)?.rotation ?? 0));
  if (rot === 90 || rot === 270) [w, h] = [h, w];
  return { w, h, dur: Number(j.format?.duration ?? 0) };
}

async function recorrer(dir) {
  if (!existsSync(dir)) return [];
  const salida = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name.startsWith('~')) continue;
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) salida.push(...await recorrer(ruta));
    else salida.push(ruta);
  }
  return salida;
}

const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'pieza';

function titulo(archivo) {
  let t = path.parse(archivo).name;
  if (t.includes('·')) t = t.split('·').pop();
  t = t.replace(/^\s*\d+\s*[-_.)]\s*/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Imagen con el mismo nombre que el video (Titanium.mp4 → Titanium.png).
function portadaPropia(video) {
  const { dir, name } = path.parse(video);
  for (const ext of EXT_IMAGEN) {
    const p = path.join(dir, name + ext);
    if (existsSync(p)) return p;
  }
  return null;
}

async function describir(archivo, carpetaTipo, extra = []) {
  const st = await stat(archivo);
  const rel = path.relative(carpetaTipo, archivo);
  const partes = rel.split(path.sep);
  const cliente = partes.length > 1 ? partes[0] : '';
  let huella = `${rel}|${st.size}|${st.mtimeMs}`;
  for (const f of extra) { const s = await stat(f); huella += `|${s.size}|${s.mtimeMs}`; }
  const id = `${slug(path.parse(rel).name)}-${crypto.createHash('sha1').update(huella).digest('hex').slice(0, 6)}`;
  return { archivo, id, cliente, titulo: titulo(archivo), fecha: st.mtime.toISOString(), _orden: rel };
}

async function procesarReel(p, portadaOrigen) {
  const dir = path.join(RAIZ, 'media', 'reels');
  const video = path.join(dir, `${p.id}.mp4`);
  const portada = path.join(dir, `${p.id}.jpg`);
  if (!existsSync(video)) {
    console.log(`  🎬 ${p.titulo} — comprimiendo (puede tardar unos minutos)…`);
    const info = sondear(p.archivo);
    const escala = info.h >= info.w ? "scale='min(720,iw)':-2" : "scale=-2:'min(720,ih)'";
    correr(FFMPEG, ['-y', '-v', 'error', '-i', p.archivo, '-vf', escala, '-fpsmax', '30',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-movflags', '+faststart', video]);
  }
  const final = sondear(video);
  if (!existsSync(portada)) {
    if (portadaOrigen) {
      correr(FFMPEG, ['-y', '-v', 'error', '-i', portadaOrigen, '-frames:v', '1',
        '-vf', `scale=${final.w}:${final.h}:force_original_aspect_ratio=increase,crop=${final.w}:${final.h}`,
        '-q:v', '3', portada]);
    } else {
      // Un cuadro a un tercio del video: suele evitar la placa del logo del inicio
      const t = Math.min(8, (final.dur || 3) / 3).toFixed(2);
      correr(FFMPEG, ['-y', '-v', 'error', '-ss', t, '-i', video, '-frames:v', '1', '-q:v', '3', portada]);
    }
  }
  const mb = (await stat(video)).size / 1048576;
  if (mb > LIMITE_MB) {
    console.warn(`  ⚠ ${p.titulo} pesa ${mb.toFixed(0)} MB comprimido; GitHub no lo acepta. Recortalo y volvé a correr.`);
    await rm(video, { force: true }); await rm(portada, { force: true });
    return null;
  }
  return { id: p.id, titulo: p.titulo, cliente: p.cliente, fecha: p.fecha, _orden: p._orden,
    video: `media/reels/${p.id}.mp4`, portada: `media/reels/${p.id}.jpg`,
    w: final.w, h: final.h, dur: Math.round(final.dur) };
}

async function procesarAfiche(p) {
  const dir = path.join(RAIZ, 'media', 'afiches');
  const grande = path.join(dir, `${p.id}.webp`);
  const mini = path.join(dir, `${p.id}-mini.webp`);
  if (!existsSync(grande)) {
    console.log(`  🖼  ${p.titulo}`);
    correr(FFMPEG, ['-y', '-v', 'error', '-i', p.archivo, '-frames:v', '1',
      '-vf', 'scale=w=1600:h=2400:force_original_aspect_ratio=decrease',
      '-c:v', 'libwebp', '-quality', '88', grande]);
  }
  if (!existsSync(mini)) {
    correr(FFMPEG, ['-y', '-v', 'error', '-i', p.archivo, '-frames:v', '1',
      '-vf', 'scale=w=720:h=1400:force_original_aspect_ratio=decrease',
      '-c:v', 'libwebp', '-quality', '80', mini]);
  }
  const { w, h } = sondear(grande);
  return { id: p.id, titulo: p.titulo, cliente: p.cliente, fecha: p.fecha, _orden: p._orden,
    imagen: `media/afiches/${p.id}.webp`, mini: `media/afiches/${p.id}-mini.webp`, w, h };
}

// Carrusel: Afiches\<Marca>\<Nombre del carrusel>\01.png, 02.png…
async function procesarCarrusel(dirCarrusel, archivos, dirAfiches) {
  archivos.sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  const laminas = [];
  for (const f of archivos) laminas.push(await procesarAfiche(await describir(f, dirAfiches)));
  const rel = path.relative(dirAfiches, dirCarrusel);
  const huella = crypto.createHash('sha1').update(laminas.map(l => l.id).join('|')).digest('hex').slice(0, 6);
  const fecha = laminas.map(l => l.fecha).sort().pop();
  return {
    ...laminas[0], id: `${slug(path.basename(dirCarrusel))}-${huella}`, titulo: titulo(dirCarrusel), fecha, _orden: rel,
    laminas: laminas.map(({ imagen, mini, w, h }) => ({ imagen, mini, w, h })),
    _ids: laminas.map(l => l.id),
  };
}

function tieneTransparencia(archivo) {
  const fmt = correr(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=pix_fmt',
    '-of', 'csv=p=0', archivo]).trim();
  return /a|pal8/.test(fmt.replace('gray', ''));
}

// ---------- Marcas ----------
// datos.txt: líneas "clave: valor" (nombre, instagram, web, descripcion, concepto, lema,
// colores, tipografia, fondo claro, fondo oscuro).
async function leerDatos(archivo) {
  const datos = {};
  if (!existsSync(archivo)) return datos;
  const texto = (await readFile(archivo, 'utf8')).replace(/^﻿/, '');
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(/^\s*([^:#]+?)\s*:\s*(.*)$/);
    if (m) datos[slug(m[1]).replace(/-/g, '_')] = m[2].trim();
  }
  return datos;
}

function colores(texto = '') {
  return texto.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const hex = s.match(/#[0-9a-f]{3,8}/i)?.[0];
    return hex ? { nombre: s.replace(hex, '').trim(), hex: hex.toUpperCase() } : null;
  }).filter(Boolean);
}

// Las imágenes con transparencia se centran sobre un lienzo 4:3 con el color de la marca
// (claro, u oscuro si el archivo dice "oscuro"); las que traen fondo propio quedan igual.
async function procesarImagenMarca(archivo, id, carpetaSalida, fondos) {
  const dir = path.join(RAIZ, 'media', 'marcas', carpetaSalida);
  await mkdir(dir, { recursive: true });
  const grande = path.join(dir, `${id}.webp`);
  const mini = path.join(dir, `${id}-mini.webp`);
  const oscuro = /oscuro/i.test(path.basename(archivo));
  if (!existsSync(grande)) {
    if (tieneTransparencia(archivo)) {
      const fondo = (oscuro ? fondos.oscuro : fondos.claro).replace('#', '0x');
      correr(FFMPEG, ['-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=${fondo}:s=1600x1200`, '-i', archivo,
        '-filter_complex', '[1]scale=w=1040:h=700:force_original_aspect_ratio=decrease[l];[0][l]overlay=(W-w)/2:(H-h)/2:format=auto',
        '-frames:v', '1', '-c:v', 'libwebp', '-quality', '90', grande]);
    } else {
      correr(FFMPEG, ['-y', '-v', 'error', '-i', archivo, '-frames:v', '1',
        '-vf', 'scale=w=1800:h=1800:force_original_aspect_ratio=decrease', '-c:v', 'libwebp', '-quality', '90', grande]);
    }
  }
  if (!existsSync(mini)) {
    correr(FFMPEG, ['-y', '-v', 'error', '-i', grande, '-frames:v', '1',
      '-vf', 'scale=w=900:h=900:force_original_aspect_ratio=decrease', '-c:v', 'libwebp', '-quality', '82', mini]);
  }
  const { w, h } = sondear(grande);
  return { id, imagen: `media/marcas/${carpetaSalida}/${id}.webp`, mini: `media/marcas/${carpetaSalida}/${id}-mini.webp`,
    w, h, oscuro, titulo: titulo(archivo).replace(/\s*oscuro\s*/i, ' ').replace(/\s+/g, ' ').trim() + (oscuro ? ' · fondo oscuro' : '') };
}

// Acepta "@usuario", "usuario" o el enlace completo; devuelve enlaces listos.
function redes(d) {
  const usuario = (v = '', dominio) => v.trim().replace(/^@/, '')
    .replace(new RegExp(`^https?://(www\\.)?${dominio.replace('.', '\\.')}/(@)?`, 'i'), '').replace(/[/?].*$/, '');
  const salida = [];
  const ig = usuario(d.instagram, 'instagram.com');
  if (ig) salida.push({ red: 'instagram', texto: `@${ig}`, url: `https://www.instagram.com/${ig}/` });
  const fb = usuario(d.facebook, 'facebook.com');
  if (fb) salida.push({ red: 'facebook', texto: 'Facebook', url: `https://www.facebook.com/${fb}` });
  const tt = usuario(d.tiktok, 'tiktok.com');
  if (tt) salida.push({ red: 'tiktok', texto: `@${tt}`, url: `https://www.tiktok.com/@${tt}` });
  const wa = (d.whatsapp || '').replace(/\D/g, '');
  if (wa) salida.push({ red: 'whatsapp', texto: 'WhatsApp', url: `https://wa.me/${wa}` });
  if (d.web) salida.push({ red: 'web', texto: d.web.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    url: /^https?:/.test(d.web) ? d.web : `https://${d.web}` });
  if (d.correo) salida.push({ red: 'correo', texto: d.correo, url: `mailto:${d.correo}` });
  return salida;
}

const sinNumero = s => s.replace(/^\s*\d+\s*[-_.)·]?\s*/, '').trim();

async function procesarMarca(dirMarca) {
  const carpeta = path.basename(dirMarca);
  const d = await leerDatos(path.join(dirMarca, 'datos.txt'));
  const fondos = { claro: d.fondo_claro || '#F4F1EA', oscuro: d.fondo_oscuro || '#15191B' };
  const sal = slug(carpeta);
  const pasos = [];
  const subdirs = (await readdir(dirMarca, { withFileTypes: true }))
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => e.name).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  for (const nombre of subdirs) {
    const archivos = (await recorrer(path.join(dirMarca, nombre)))
      .filter(f => EXT_IMAGEN.has(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    const piezas = [];
    for (const f of archivos) {
      const st = await stat(f);
      const huella = crypto.createHash('sha1')
        .update(`${path.relative(dirMarca, f)}|${st.size}|${st.mtimeMs}|${fondos.claro}|${fondos.oscuro}`).digest('hex').slice(0, 6);
      piezas.push(await procesarImagenMarca(f, `${slug(sinNumero(nombre))}-${slug(path.parse(f).name)}-${huella}`, sal, fondos));
    }
    if (piezas.length) pasos.push({ titulo: sinNumero(nombre), piezas });
  }
  // Portada de la tarjeta: la primera imagen clara del paso de logotipo (o la primera que haya)
  const todas = pasos.flatMap(p => p.piezas);
  const pasoLogo = pasos.find(p => /logotipo/i.test(p.titulo) && !/lema/i.test(p.titulo)) ?? pasos[0];
  const portada = pasoLogo?.piezas.find(p => !p.oscuro) ?? pasoLogo?.piezas[0] ?? todas[0] ?? null;
  console.log(`  ◆ ${carpeta}: ${pasos.length} pasos, ${todas.length} imágenes`);
  return {
    clave: carpeta, slug: sal, nombre: d.nombre || carpeta, redes: redes(d),
    descripcion: d.descripcion || '', concepto: d.concepto || '', lema: d.lema || '',
    colores: colores(d.colores), tipografia: d.tipografia || '', fondos,
    portada, pasos, _ids: todas.map(p => p.id),
  };
}

async function limpiar(subdir, idsVigentes) {
  const dir = path.join(RAIZ, 'media', subdir);
  if (!existsSync(dir)) return;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) { await limpiar(path.join(subdir, e.name), idsVigentes); continue; }
    const id = e.name.replace(/(-mini)?\.(mp4|jpg|webp)$/, '');
    if (!idsVigentes.has(id)) { await rm(ruta); console.log(`  🗑  quitado ${e.name}`); }
  }
}

// Más reciente primero; a igual fecha, por nombre de archivo (97 antes que 100).
const porFecha = (a, b) => b.fecha.localeCompare(a.fecha) || a._orden.localeCompare(b._orden, 'es', { numeric: true });
const limpio = ({ _orden, _ids, ...resto }) => resto;

async function main() {
  console.log(`Origen: ${ORIGEN}`);
  if (!existsSync(ORIGEN)) throw new Error('No existe la carpeta de origen.');
  await mkdir(path.join(RAIZ, 'media', 'reels'), { recursive: true });
  await mkdir(path.join(RAIZ, 'media', 'afiches'), { recursive: true });

  const dirReels = path.join(ORIGEN, 'Reels');
  const dirAfiches = path.join(ORIGEN, 'Afiches');
  const dirMotion = path.join(ORIGEN, 'Motion graphics');
  const dirMarcas = path.join(ORIGEN, 'Marcas');
  const esImagen = f => EXT_IMAGEN.has(path.extname(f).toLowerCase());
  const esVideo = f => EXT_VIDEO.has(path.extname(f).toLowerCase());
  const archivosReels = (await recorrer(dirReels)).filter(esVideo);
  const archivosMotion = (await recorrer(dirMotion)).filter(esVideo);
  const archivosAfiches = (await recorrer(dirAfiches)).filter(esImagen);

  console.log(`Reels: ${archivosReels.length} · Motion graphics: ${archivosMotion.length} · Imágenes de afiches: ${archivosAfiches.length}`);
  const reels = [], motion = [], afiches = [], marcas = [];
  // Reels y motion graphics comparten procesamiento y carpeta media/reels
  for (const [archivos, dir, destino] of [[archivosReels, dirReels, reels], [archivosMotion, dirMotion, motion]]) {
    for (const f of archivos) {
      try {
        const portada = portadaPropia(f);
        const r = await procesarReel(await describir(f, dir, portada ? [portada] : []), portada);
        if (r) destino.push(r);
      } catch (e) { console.warn(`  ⚠ No pude procesar ${path.basename(f)}: ${e.message}`); }
    }
  }

  // Afiches sueltos (Marca\imagen) y carruseles (Marca\Carrusel\imagen)
  const carruseles = new Map();
  for (const f of archivosAfiches) {
    const partes = path.relative(dirAfiches, f).split(path.sep);
    if (partes.length > 2) {
      const dirC = path.join(dirAfiches, partes[0], partes[1]);
      carruseles.set(dirC, [...(carruseles.get(dirC) ?? []), f]);
      continue;
    }
    try { afiches.push(await procesarAfiche(await describir(f, dirAfiches))); }
    catch (e) { console.warn(`  ⚠ No pude procesar ${path.basename(f)}: ${e.message}`); }
  }
  for (const [dirC, archivos] of carruseles) {
    try { console.log(`  🎞  carrusel ${path.basename(dirC)} (${archivos.length})`); afiches.push(await procesarCarrusel(dirC, archivos, dirAfiches)); }
    catch (e) { console.warn(`  ⚠ No pude procesar el carrusel ${path.basename(dirC)}: ${e.message}`); }
  }

  if (existsSync(dirMarcas)) {
    for (const e of await readdir(dirMarcas, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue;
      try { marcas.push(await procesarMarca(path.join(dirMarcas, e.name))); }
      catch (err) { console.warn(`  ⚠ No pude procesar la marca ${e.name}: ${err.message}`); }
    }
  }
  marcas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  reels.sort(porFecha); motion.sort(porFecha); afiches.sort(porFecha);
  await limpiar('reels', new Set([...reels, ...motion].map(r => r.id)));
  await limpiar('afiches', new Set(afiches.flatMap(a => a._ids ?? [a.id])));
  await limpiar('marcas', new Set(marcas.flatMap(m => m._ids)));
  await rm(path.join(RAIZ, 'media', 'logos'), { recursive: true, force: true });

  const via = await leerDatos(path.join(ORIGEN, 'Vía Hub.txt'));
  const sitio = { lema: via.lema || 'Tráfico relevante', redes: redes(via) };

  const datos = { actualizado: new Date().toISOString(), sitio,
    reels: reels.map(limpio), motion: motion.map(limpio), afiches: afiches.map(limpio), marcas: marcas.map(limpio) };
  await mkdir(path.join(RAIZ, 'data'), { recursive: true });
  await writeFile(path.join(RAIZ, 'data', 'galeria.js'),
    `window.GALERIA = ${JSON.stringify(datos, null, 2)};\n`, 'utf8');
  const resumen = `${reels.length} reels, ${motion.length} motion graphics, ${afiches.length} afiches y ${marcas.length} marcas`;
  console.log(`Listo: ${resumen}.`);

  if (PUBLICAR) {
    const git = (...a) => spawnSync('git', a, { cwd: RAIZ, encoding: 'utf8', stdio: 'inherit' });
    git('add', '-A');
    const sinCambios = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: RAIZ }).status === 0;
    if (sinCambios) { console.log('No hay cambios para publicar.'); return; }
    git('commit', '-m', `Galería: ${resumen}`);
    if (git('push').status !== 0) throw new Error('No se pudo subir a GitHub.');
    console.log('Publicado. La página se actualiza en 1–2 minutos.');
  }
}

main().catch(e => { console.error(`\n✖ ${e.message}`); process.exit(1); });
