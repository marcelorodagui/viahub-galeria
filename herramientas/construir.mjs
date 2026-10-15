// Construye la galería a partir de la carpeta de Drive.
//   node herramientas/construir.mjs              → solo prepara los archivos
//   node herramientas/construir.mjs --publicar   → además sube los cambios a GitHub
//
// Carpeta de origen (por defecto "G:\Mi unidad\Vía Hub Studio\Galería web"):
//   Reels\<Cliente opcional>\video.mp4   (+ video.png/.jpg opcional como portada)
//   Afiches\<Cliente opcional>\imagen.png
// El nombre de la subcarpeta se muestra como etiqueta del cliente.
// El título sale del nombre del archivo (lo que va después del último " · ").

import { readdir, stat, mkdir, writeFile, rm } from 'node:fs/promises';
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

function tieneTransparencia(archivo) {
  const fmt = correr(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=pix_fmt',
    '-of', 'csv=p=0', archivo]).trim();
  return /a|pal8/.test(fmt.replace('gray', ''));
}

// Logos: los transparentes se centran sobre un lienzo 4:3 (claro por defecto, oscuro si el
// nombre dice "oscuro"); los que ya traen fondo se dejan tal cual.
async function procesarLogo(p) {
  const dir = path.join(RAIZ, 'media', 'logos');
  const grande = path.join(dir, `${p.id}.webp`);
  const mini = path.join(dir, `${p.id}-mini.webp`);
  if (!existsSync(grande)) {
    console.log(`  ✳  ${p.titulo}`);
    if (tieneTransparencia(p.archivo)) {
      const fondo = /oscuro/i.test(path.basename(p.archivo)) ? '0x15191b' : '0xf4f1ea';
      correr(FFMPEG, ['-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=${fondo}:s=1600x1200`, '-i', p.archivo,
        '-filter_complex', '[1]scale=w=1120:h=760:force_original_aspect_ratio=decrease[l];[0][l]overlay=(W-w)/2:(H-h)/2:format=auto',
        '-frames:v', '1', '-c:v', 'libwebp', '-quality', '90', grande]);
    } else {
      correr(FFMPEG, ['-y', '-v', 'error', '-i', p.archivo, '-frames:v', '1',
        '-vf', 'scale=w=1600:h=1600:force_original_aspect_ratio=decrease', '-c:v', 'libwebp', '-quality', '90', grande]);
    }
  }
  if (!existsSync(mini)) {
    correr(FFMPEG, ['-y', '-v', 'error', '-i', grande, '-frames:v', '1',
      '-vf', 'scale=w=720:h=720:force_original_aspect_ratio=decrease', '-c:v', 'libwebp', '-quality', '82', mini]);
  }
  const { w, h } = sondear(grande);
  return { id: p.id, titulo: p.titulo.replace(/\s*oscuro\s*/i, ' ').trim(), cliente: p.cliente, fecha: p.fecha, _orden: p._orden,
    imagen: `media/logos/${p.id}.webp`, mini: `media/logos/${p.id}-mini.webp`, w, h };
}

async function limpiar(subdir, idsVigentes) {
  const dir = path.join(RAIZ, 'media', subdir);
  if (!existsSync(dir)) return;
  for (const f of await readdir(dir)) {
    const id = f.replace(/(-mini)?\.(mp4|jpg|webp)$/, '');
    if (!idsVigentes.has(id)) { await rm(path.join(dir, f)); console.log(`  🗑  quitado ${f}`); }
  }
}

// Más reciente primero; a igual fecha, por nombre de archivo (97 antes que 100).
const porFecha = (a, b) => b.fecha.localeCompare(a.fecha) || a._orden.localeCompare(b._orden, 'es', { numeric: true });
const sinOrden = ({ _orden, ...resto }) => resto;

async function main() {
  console.log(`Origen: ${ORIGEN}`);
  if (!existsSync(ORIGEN)) throw new Error('No existe la carpeta de origen.');
  await mkdir(path.join(RAIZ, 'media', 'reels'), { recursive: true });
  await mkdir(path.join(RAIZ, 'media', 'afiches'), { recursive: true });
  await mkdir(path.join(RAIZ, 'media', 'logos'), { recursive: true });

  const dirReels = path.join(ORIGEN, 'Reels');
  const dirAfiches = path.join(ORIGEN, 'Afiches');
  const dirMotion = path.join(ORIGEN, 'Motion graphics');
  const dirLogos = path.join(ORIGEN, 'Logos');
  const esImagen = f => EXT_IMAGEN.has(path.extname(f).toLowerCase());
  const esVideo = f => EXT_VIDEO.has(path.extname(f).toLowerCase());
  const archivosReels = (await recorrer(dirReels)).filter(esVideo);
  const archivosMotion = (await recorrer(dirMotion)).filter(esVideo);
  const archivosAfiches = (await recorrer(dirAfiches)).filter(esImagen);
  const archivosLogos = (await recorrer(dirLogos)).filter(esImagen);

  console.log(`Reels: ${archivosReels.length} · Motion graphics: ${archivosMotion.length} · ` +
    `Afiches: ${archivosAfiches.length} · Logos: ${archivosLogos.length}`);
  const reels = [], motion = [], afiches = [], logos = [];
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
  for (const f of archivosAfiches) {
    try { afiches.push(await procesarAfiche(await describir(f, dirAfiches))); }
    catch (e) { console.warn(`  ⚠ No pude procesar ${path.basename(f)}: ${e.message}`); }
  }
  for (const f of archivosLogos) {
    try { logos.push(await procesarLogo(await describir(f, dirLogos))); }
    catch (e) { console.warn(`  ⚠ No pude procesar ${path.basename(f)}: ${e.message}`); }
  }
  reels.sort(porFecha); motion.sort(porFecha); afiches.sort(porFecha); logos.sort(porFecha);
  await limpiar('reels', new Set([...reels, ...motion].map(r => r.id)));
  await limpiar('afiches', new Set(afiches.map(a => a.id)));
  await limpiar('logos', new Set(logos.map(l => l.id)));

  const datos = { actualizado: new Date().toISOString(),
    reels: reels.map(sinOrden), motion: motion.map(sinOrden),
    afiches: afiches.map(sinOrden), logos: logos.map(sinOrden) };
  await mkdir(path.join(RAIZ, 'data'), { recursive: true });
  await writeFile(path.join(RAIZ, 'data', 'galeria.js'),
    `window.GALERIA = ${JSON.stringify(datos, null, 2)};\n`, 'utf8');
  console.log(`Listo: ${reels.length} reels, ${motion.length} motion graphics, ` +
    `${afiches.length} afiches y ${logos.length} logos.`);

  if (PUBLICAR) {
    const git = (...a) => spawnSync('git', a, { cwd: RAIZ, encoding: 'utf8', stdio: 'inherit' });
    git('add', '-A');
    const sinCambios = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: RAIZ }).status === 0;
    if (sinCambios) { console.log('No hay cambios para publicar.'); return; }
    git('commit', '-m', `Galería: ${reels.length} reels, ${motion.length} motion, ${afiches.length} afiches, ${logos.length} logos`);
    if (git('push').status !== 0) throw new Error('No se pudo subir a GitHub.');
    console.log('Publicado. La página se actualiza en 1–2 minutos.');
  }
}

main().catch(e => { console.error(`\n✖ ${e.message}`); process.exit(1); });
