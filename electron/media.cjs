const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');
const { PDFDocument } = require('pdf-lib');
const ExcelJS = require('exceljs');
const { zipSync, unzipSync, strFromU8 } = require('fflate');

const active = new Map();
const cancelled = new Set();
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tif', 'tiff', 'bmp', 'gif', 'svg'];
const IMAGE_OUTPUT_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tif', 'tiff', 'gif'];
const MEDIA_EXTENSIONS = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'wmv', 'mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus', 'aiff', 'wma'];
const DOC_EXTENSIONS = ['docx', 'txt', 'md', 'csv', 'xlsx'];
const PDF_EXTENSIONS = ['pdf'];
const ARCHIVE_EXTENSIONS = ['zip'];
const SUBTITLE_EXTENSIONS = ['srt', 'vtt'];
const ALL_EXTENSIONS = [...IMAGE_EXTENSIONS, ...MEDIA_EXTENSIONS, ...DOC_EXTENSIONS, ...PDF_EXTENSIONS, ...ARCHIVE_EXTENSIONS, ...SUBTITLE_EXTENSIONS];

function supportedInputs() { return ALL_EXTENSIONS; }
function extension(file) { return path.extname(file).slice(1).toLowerCase(); }
function uniqueOutput(file, format, suffix = '') {
  const ext = format === 'jpeg' ? 'jpg' : format;
  return path.join(path.dirname(file), `${path.basename(file, path.extname(file))}${suffix}.${ext}`);
}
async function availableOutput(candidate) {
  let result = candidate; let index = 2;
  while (true) {
    try { await fs.access(result); result = `${candidate.slice(0, candidate.lastIndexOf('.'))} (${index++})${path.extname(candidate)}`; }
    catch { return result; }
  }
}
function report(onProgress, jobId, file, progress, status = 'processing', extra = {}) {
  onProgress?.({ jobId, file, progress: Math.max(0, Math.min(100, Math.round(progress))), status, ...extra });
}

function probeMedia(input) {
  return new Promise((resolve) => {
    if (!ffmpegPath) return resolve({ duration: 0 });
    const child = spawn(ffmpegPath, ['-hide_banner', '-nostdin', '-i', input], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-12000); });
    child.on('error', () => resolve({ duration: 0 }));
    child.on('close', () => {
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      resolve({ duration: match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : 0 });
    });
  });
}

function previewFrame(input, timestamp = 0) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('El motor de video no está disponible.'));
    const seconds = Math.max(0, Number(timestamp) || 0).toFixed(3);
    const child = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-ss', seconds, '-i', input, '-frames:v', '1', '-vf', 'scale=520:-2', '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = []; let size = 0; let stderr = '';
    child.stdout.on('data', (chunk) => { size += chunk.length; if (size <= 5 * 1024 * 1024) chunks.push(chunk); else child.kill(); });
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-3000); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 && chunks.length) return resolve(`data:image/jpeg;base64,${Buffer.concat(chunks).toString('base64')}`);
      reject(new Error(stderr.trim() || 'No se pudo generar la vista previa de este fotograma.'));
    });
  });
}

function previewWaveform(input, start = 0, duration = 15) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('El motor de audio no está disponible.'));
    const begin = Math.max(0, Number(start) || 0).toFixed(3); const length = Math.max(0.2, Number(duration) || 15).toFixed(3);
    const child = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-ss', begin, '-t', length, '-i', input, '-filter_complex', 'aformat=channel_layouts=mono,showwavespic=s=720x110:colors=0xe55c2a', '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', 'pipe:1'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = []; let stderr = '';
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-3000); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 && chunks.length) return resolve(`data:image/png;base64,${Buffer.concat(chunks).toString('base64')}`);
      reject(new Error(stderr.trim() || 'No se pudo generar la forma de onda.'));
    });
  });
}

function runFfmpeg(jobId, input, output, args, onProgress, inputArgs = ['-i', input]) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('El motor FFmpeg no está disponible en este equipo.'));
    const fullArgs = ['-hide_banner', '-y', ...inputArgs, ...args, '-progress', 'pipe:1', '-nostats', output];
    const child = spawn(ffmpegPath, fullArgs, { windowsHide: true });
    const jobs = active.get(jobId) || new Set(); jobs.add(child); active.set(jobId, jobs);
    let stdout = ''; let stderr = ''; let durationSeconds = 0;
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      const matches = [...stdout.matchAll(/out_time_ms=(\d+)/g)];
      if (matches.length && durationSeconds > 0) report(onProgress, jobId, input, Number(matches.at(-1)[1]) / 1000000 / durationSeconds * 100, 'processing');
      stdout = stdout.slice(-4000);
    });
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-5000);
      const duration = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (duration) durationSeconds = Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      jobs.delete(child);
      if (jobs.size === 0) active.delete(jobId);
      if (code === 0) resolve(output);
      else reject(new Error(stderr.trim().split('\n').slice(-3).join(' ') || `FFmpeg terminó con código ${code}.`));
    });
  });
}

async function convertImage(input, output, format, options = {}) {
  const prepared = extension(input) === 'bmp' ? await prepareImageInput(input, options.jobId) : { path: input, cleanup: async () => {} };
  try {
  let image = sharp(prepared.path, { animated: false, failOn: 'none' });
  if (options.brightness !== undefined || options.saturation !== undefined) image = image.modulate({ brightness: Math.max(0.1, Math.min(2, Number(options.brightness ?? 100) / 100)), saturation: Math.max(0, Math.min(3, Number(options.saturation ?? 100) / 100)) });
  if (options.contrast !== undefined && Number(options.contrast) !== 100) { const contrast = Math.max(0.25, Math.min(2.5, Number(options.contrast) / 100)); image = image.linear(contrast, 128 * (1 - contrast)); }
  if (options.redact) {
    const meta = await sharp(input, { failOn: 'none' }).metadata(); const left = Math.max(0, Math.floor(Number(options.x) || 0)); const top = Math.max(0, Math.floor(Number(options.y) || 0));
    const width = Math.min(Math.floor(Number(options.redactWidth) || 0), (meta.width || 0) - left); const height = Math.min(Math.floor(Number(options.redactHeight) || 0), (meta.height || 0) - top);
    if (width < 1 || height < 1) throw new Error('Define un área válida dentro de la imagen para ocultarla.');
    const color = /^#[0-9a-f]{6}$/i.test(options.redactColor || '') ? options.redactColor : '#111111';
    image = image.composite([{ input: Buffer.from(`<svg width="${meta.width}" height="${meta.height}"><rect x="${left}" y="${top}" width="${width}" height="${height}" fill="${color}"/></svg>`), left: 0, top: 0 }]);
  }
  if (options.crop) {
    const metadata = await image.metadata();
    const left = Math.max(0, Number(options.x) || 0);
    const top = Math.max(0, Number(options.y) || 0);
    const width = Math.min(Number(options.width) || 0, (metadata.width || 0) - left);
    const height = Math.min(Number(options.height) || 0, (metadata.height || 0) - top);
    if (width < 1 || height < 1) throw new Error('El recorte debe quedar dentro de la imagen y tener ancho y alto mayores que cero.');
    image = image.extract({ left, top, width, height });
  }
  if (options.rotation) image = image.rotate(Number(options.rotation));
  if (options.stripMetadata && !options.rotation) image = image.rotate();
  if (options.width || options.height) image = image.resize({ width: Number(options.width) || undefined, height: Number(options.height) || undefined, fit: options.fit || 'inside', withoutEnlargement: true });
  const quality = Number(options.quality || 84);
  const target = format === 'jpg' ? 'jpeg' : format;
  image = image.toFormat(target, target === 'png' ? { compressionLevel: 9 } : { quality });
  await image.toFile(output);
  } finally { await prepared.cleanup(); }
}

async function prepareImageInput(input, jobId) {
  if (extension(input) !== 'bmp') return { path: input, cleanup: async () => {} };
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dial-image-'));
  const output = path.join(directory, 'source.png');
  try {
    await runFfmpeg(jobId || `image-${Date.now()}`, input, output, ['-frames:v', '1']);
    return { path: output, cleanup: () => fs.rm(directory, { recursive: true, force: true }) };
  } catch (error) { await fs.rm(directory, { recursive: true, force: true }); throw error; }
}

async function createCollage(files, output, options = {}, jobId, onProgress) {
  if (files.length < 2) throw new Error('Selecciona al menos dos imágenes para crear un collage.');
  if (files.length > 20) throw new Error('El collage admite hasta 20 imágenes por vez.');
  const cellWidth = Math.max(160, Math.min(1600, Math.floor(Number(options.cellWidth) || 480)));
  const cellHeight = Math.max(160, Math.min(1600, Math.floor(Number(options.cellHeight) || 480)));
  const gap = Math.max(0, Math.min(96, Math.floor(Number(options.gap) || 0)));
  const columns = Math.max(1, Math.min(5, Math.floor(Number(options.columns) || 2)));
  const rows = Math.ceil(files.length / columns);
  const width = columns * cellWidth + (columns + 1) * gap;
  const height = rows * cellHeight + (rows + 1) * gap;
  if (width > 8192 || height > 8192) throw new Error('El tamaño total del collage supera 8192 px por lado.');
  const composites = [];
  for (const [index, file] of files.entries()) {
    if (cancelled.has(jobId)) throw new Error('Cancelado por el usuario.');
    if (!IMAGE_EXTENSIONS.includes(extension(file))) throw new Error(`El collage solo admite imágenes; ${path.basename(file)} no es compatible.`);
    const prepared = await prepareImageInput(file, jobId);
    let image;
    try { image = await sharp(prepared.path, { failOn: 'none' }).resize(cellWidth, cellHeight, { fit: 'cover', position: 'centre' }).png().toBuffer(); }
    finally { await prepared.cleanup(); }
    composites.push({ input: image, left: gap + (index % columns) * (cellWidth + gap), top: gap + Math.floor(index / columns) * (cellHeight + gap) });
    report(onProgress, jobId, files[0], 3 + ((index + 1) / files.length) * 90);
  }
  await sharp({ create: { width, height, channels: 4, background: options.background || '#fff7e8' } }).composite(composites).png().toFile(output);
}

async function convertPdf(files, output, operation) {
  if (operation === 'merge-pdf') {
    const merged = await PDFDocument.create();
    for (const file of files) {
      const source = await PDFDocument.load(await fs.readFile(file));
      const pages = await merged.copyPages(source, source.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
    }
    await fs.writeFile(output, await merged.save());
    return output;
  }
  const source = await PDFDocument.load(await fs.readFile(files[0]));
  if (operation === 'split-pdf') {
    const dir = output.replace(/\.pdf$/i, ''); await fs.mkdir(dir, { recursive: true });
    for (let pageIndex = 0; pageIndex < source.getPageCount(); pageIndex += 1) {
      const page = await PDFDocument.create();
      const [copied] = await page.copyPages(source, [pageIndex]); page.addPage(copied);
      await fs.writeFile(path.join(dir, `pagina-${String(pageIndex + 1).padStart(3, '0')}.pdf`), await page.save());
    }
    return dir;
  }
  throw new Error('Esta operación PDF no está disponible.');
}

function toVtt(content) {
  const body = content.replace(/^\uFEFF/, '').replace(/^WEBVTT[^\n]*\n+/i, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${body.trim()}\n`;
}
function toSrt(content) {
  const body = content.replace(/^\uFEFF/, '').replace(/^WEBVTT[^\n]*\n+/i, '').replace(/(\d{2,}:\d{2}:\d{2})\.(\d{3})/g, '$1,$2');
  return body.trim().replace(/\n{3,}/g, '\n\n') + '\n';
}
function decodeXml(value) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function docxToHtml(xml) {
  const paragraphs = [...xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)].map(([, paragraph]) => {
    const text = [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(([, value]) => decodeXml(value)).join('');
    return text ? `<p>${escapeHtml(text)}</p>` : '';
  }).filter(Boolean).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font:16px/1.6 Segoe UI,Arial,sans-serif;max-width:850px;margin:48px auto;padding:0 24px;color:#20252a}p{margin:0 0 12px}</style></head><body>${paragraphs}</body></html>`;
}

async function runOne({ input, operation, format, options = {}, settings = {}, jobId, onProgress }) {
  const ext = extension(input);
  const outputFormat = operation === 'snapshot-video' || operation === 'create-collage' ? 'png'
    : operation === 'create-zip' ? 'zip'
      : operation === 'extract-audio' ? 'mp3'
        : operation !== 'convert' && ['bmp','svg'].includes(ext) ? 'webp'
          : (format || ext).toLowerCase();
  if (cancelled.has(jobId)) return { output: '', label: path.basename(input), input, status: 'cancelled' };
  if (['normalize-audio', 'mono-audio', 'volume-audio', 'trim-audio', 'speed-audio', 'extract-audio', 'fade-audio'].includes(operation) && !MEDIA_EXTENSIONS.includes(ext)) throw new Error('Esta herramienta requiere un archivo de audio o video.');
  if (['trim-video', 'speed-video'].includes(operation) && !MEDIA_EXTENSIONS.includes(ext)) throw new Error('Esta herramienta requiere un archivo de video o audio.');
  if (operation === 'snapshot-video' && !['mp4','mov','mkv','webm','avi','wmv'].includes(ext)) throw new Error('Guardar fotograma requiere un archivo de video.');
  if (['split-pdf', 'merge-pdf'].includes(operation) && ext !== 'pdf') throw new Error('Esta herramienta requiere archivos PDF.');
  if (operation === 'rotate-pdf' && ext !== 'pdf') throw new Error('Girar páginas requiere un archivo PDF.');
  if (operation === 'organize-pdf' && ext !== 'pdf') throw new Error('Organizar páginas requiere un archivo PDF.');
  if (operation === 'crop-video' && !['mp4','mov','mkv','webm','avi','wmv'].includes(ext)) throw new Error('Recortar el encuadre requiere un archivo de video.');
  if (operation === 'mute-video' && !['mp4','mov','mkv','webm','avi','wmv'].includes(ext)) throw new Error('Quitar audio requiere un archivo de video.');
  if (operation === 'extract-zip' && ext !== 'zip') throw new Error('Esta herramienta requiere un archivo ZIP.');
  if (operation === 'extract-zip') {
    const bytes = await fs.readFile(input); const files = unzipSync(new Uint8Array(bytes));
    const dir = input.replace(/\.zip$/i, '-extraido'); await fs.mkdir(dir, { recursive: true });
    for (const [name, data] of Object.entries(files)) {
      const target = path.resolve(dir, name);
      if (!target.startsWith(path.resolve(dir) + path.sep)) continue;
      await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, data);
    }
    return { output: dir, label: path.basename(input), input, status: 'done' };
  }
  if (operation === 'split-video') {
    if (!['mp4','mov','mkv','webm','avi','wmv'].includes(ext)) throw new Error('Dividir video requiere un archivo de video.');
    const seconds = Math.max(5, Math.min(3600, Number(options.segmentSeconds) || 60));
    const dir = await fs.mkdtemp(path.join(settings.outputFolder || path.dirname(input), `${path.basename(input, path.extname(input))}-partes-`));
    try { await runFfmpeg(jobId, input, path.join(dir, 'parte-%03d.mp4'), ['-f','segment','-segment_time',String(seconds),'-reset_timestamps','1','-c:v','libx264','-preset','fast','-crf','24','-c:a','aac','-b:a','160k'], onProgress); }
    catch (error) { await fs.rm(dir, { recursive: true, force: true }); throw error; }
    return { output: dir, label: path.basename(input), input, status: 'done' };
  }
  if (operation === 'join-video') {
    const inputs = options.files || [input];
    if (inputs.length < 2 || inputs.some((file) => !['mp4','mov','mkv','webm','avi','wmv'].includes(extension(file)))) throw new Error('Unir video requiere al menos dos archivos de video compatibles.');
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'dial-join-')); const list = path.join(temp, 'files.txt');
    const lines = inputs.map((file) => `file '${path.resolve(file).replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n');
    await fs.writeFile(list, lines, 'utf8');
    const destination = path.join(settings.outputFolder || path.dirname(input), `${path.basename(input, path.extname(input))}-unido.mp4`); const out = await availableOutput(destination);
    try { await runFfmpeg(jobId, input, out, ['-c:v','libx264','-preset','fast','-crf','24','-c:a','aac','-b:a','160k','-movflags','+faststart'], onProgress, ['-f','concat','-safe','0','-i',list]); }
    catch (error) { await fs.rm(out, { force: true }).catch(() => {}); throw error; }
    finally { await fs.rm(temp, { recursive: true, force: true }); }
    return { output: out, label: path.basename(input), input, status: 'done' };
  }
  if (operation === 'merge-pdf') {
    if (ext !== 'pdf') throw new Error('Para unir PDF, todos los archivos deben ser PDF.');
    const out = await availableOutput(path.join(settings.outputFolder || path.dirname(input), `${path.basename(input, '.pdf')}-unidos.pdf`));
    await convertPdf(options.mergeFiles || [input], out, operation); return { output: out, label: path.basename(input), input, status: 'done' };
  }
  if (operation === 'rotate-pdf') {
    const destination = path.join(settings.outputFolder || path.dirname(input), `${path.basename(input, path.extname(input))}-girado.pdf`);
    const out = await availableOutput(destination);
    const document = await PDFDocument.load(await fs.readFile(input));
    const turn = Number(options.rotation) || 90;
    for (const page of document.getPages()) page.setRotation({ angle: (page.getRotation().angle + turn + 360) % 360 });
    await fs.writeFile(out, await document.save());
    return { output: out, label: path.basename(input), input, status: 'done' };
  }
  if (operation === 'organize-pdf') {
    const source = await PDFDocument.load(await fs.readFile(input));
    const rawOrder = String(options.pageOrder || '').split(/[,\s]+/).filter(Boolean);
    if (!rawOrder.length || rawOrder.some((item) => !/^\d+$/.test(item))) throw new Error('Escribe los números de página en orden, separados por comas; por ejemplo: 3, 1, 2.');
    const indices = rawOrder.map((item) => Number(item) - 1);
    if (indices.some((index) => index < 0 || index >= source.getPageCount())) throw new Error(`El PDF tiene ${source.getPageCount()} páginas. Usa números entre 1 y ${source.getPageCount()}.`);
    const organized = await PDFDocument.create();
    const pages = await organized.copyPages(source, indices);
    pages.forEach((page) => organized.addPage(page));
    const destination = path.join(settings.outputFolder || path.dirname(input), `${path.basename(input, path.extname(input))}-organizado.pdf`);
    const out = await availableOutput(destination);
    await fs.writeFile(out, await organized.save());
    return { output: out, label: path.basename(input), input, status: 'done' };
  }
  if (operation === 'create-collage') {
    const files = options.files || [input];
    const destination = path.join(settings.outputFolder || path.dirname(input), `${path.basename(input, path.extname(input))}-collage.png`);
    const out = await availableOutput(destination);
    report(onProgress, jobId, input, 3);
    await createCollage(files, out, options, jobId, onProgress);
    report(onProgress, jobId, input, 100, 'done', { output: out });
    return { output: out, label: path.basename(input), input, status: 'done' };
  }

  let suffix = '';
  if (operation !== 'convert') suffix = operation === 'optimize' ? '-optimizado' : operation === 'create-zip' ? '-comprimido' : `-${operation}`;
  const zipBase = operation === 'create-zip' && options.archiveRoot ? options.archiveRoot : input;
  let out = options.outputPath || uniqueOutput(zipBase, outputFormat, suffix);
  if (!options.outputPath) out = path.join(settings.outputFolder || (operation === 'create-zip' && options.archiveRoot ? path.dirname(options.archiveRoot) : path.dirname(input)), path.basename(out));
  out = await availableOutput(out);
  report(onProgress, jobId, input, 3);

  if (operation === 'snapshot-video' && ['mp4','mov','mkv','webm','avi','wmv'].includes(ext)) {
    const seconds = String(options.timestamp || '00:00:01');
    await runFfmpeg(jobId, input, out, ['-ss', seconds, '-frames:v', '1'], onProgress);
  } else if (IMAGE_EXTENSIONS.includes(ext) && IMAGE_OUTPUT_FORMATS.includes(outputFormat)) {
    await convertImage(input, out, outputFormat, { jobId, quality: options.quality || settings.imageQuality, width: ['resize-image','crop-image'].includes(operation) ? options.width : undefined, height: ['resize-image','crop-image'].includes(operation) ? options.height : undefined, redactWidth: options.width, redactHeight: options.height, fit: options.fit, rotation: operation === 'rotate-image' ? options.rotation : undefined, stripMetadata: operation === 'remove-metadata', crop: operation === 'crop-image', redact: operation === 'redact-image', redactColor: options.redactColor, x: options.x, y: options.y, brightness: options.brightness, saturation: options.saturation, contrast: options.contrast });
  } else if (MEDIA_EXTENSIONS.includes(ext) && MEDIA_EXTENSIONS.includes(outputFormat)) {
    const args = [];
    if (operation === 'crop-video') {
      const width = Math.floor(Number(options.width) || 0); const height = Math.floor(Number(options.height) || 0);
      if (width < 2 || height < 2) throw new Error('Indica un ancho y alto de recorte mayores que 1 px.');
      args.push('-vf', `crop=${width}:${height}:${Math.max(0, Math.floor(Number(options.x) || 0))}:${Math.max(0, Math.floor(Number(options.y) || 0))}`);
    }
    if (operation === 'mute-video') args.push('-an');
    if (operation === 'trim-video' || operation === 'trim-audio') {
      if (options.start) args.push('-ss', String(options.start));
      if (options.duration) args.push('-t', String(options.duration));
    }
    if (operation === 'speed-video' || operation === 'speed-audio') {
      const speed = Math.max(0.25, Math.min(4, Number(options.speed) || 1.25));
      args.push('-filter:v', `setpts=${(1 / speed).toFixed(4)}*PTS`, '-filter:a', `atempo=${speed}`);
    }
    if (operation === 'normalize-audio') args.push('-af', 'loudnorm=I=-16:TP=-1.5:LRA=11');
    if (operation === 'mono-audio') args.push('-ac', '1');
    if (operation === 'volume-audio') args.push('-af', `volume=${Math.max(0.1, Math.min(3, Number(options.volume) || 1.25))}`);
    if (operation === 'fade-audio') {
      const fade = Math.max(0.2, Math.min(10, Number(options.fadeSeconds) || 2));
      const duration = (await probeMedia(input)).duration;
      if (!duration) throw new Error('No se pudo leer la duración para aplicar el fundido.');
      args.push('-af', `afade=t=in:st=0:d=${fade},afade=t=out:st=${Math.max(0, duration - fade).toFixed(3)}:d=${Math.min(fade, duration).toFixed(3)}`);
    }
    if (operation === 'metadata-media') {
      for (const [key, value] of Object.entries({ title: options.title, artist: options.artist, album: options.album, comment: options.comment })) if (String(value || '').trim()) args.push('-metadata', `${key}=${String(value).replace(/[\r\n]/g, ' ').slice(0, 250)}`);
    }
    if (operation === 'extract-audio') args.push('-vn');
    if (outputFormat === 'mp3') args.push('-c:a', 'libmp3lame', '-b:a', String(options.bitrate || settings.audioBitrate || '192k'));
    else if (outputFormat === 'mp4' || outputFormat === 'mov') args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', String(options.crf || settings.videoCrf || 24), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart');
    else if (outputFormat === 'webm') args.push('-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-c:a', 'libopus');
    else if (outputFormat === 'wav') args.push('-c:a', 'pcm_s16le');
    else if (outputFormat === 'flac') args.push('-c:a', 'flac');
    await runFfmpeg(jobId, input, out, args, onProgress);
  } else if (ext === 'pdf' && operation === 'split-pdf') {
    const dir = out.replace(/\.pdf$/i, ''); await convertPdf([input], `${dir}.pdf`, operation);
    return { output: dir, label: path.basename(input), input, status: 'done' };
  } else if (IMAGE_EXTENSIONS.includes(ext) && outputFormat === 'pdf') {
    const pdf = await PDFDocument.create(); const bytes = await fs.readFile(input);
    const prepared = await prepareImageInput(input, jobId);
    let imageBytes;
    try { imageBytes = ['jpg', 'jpeg'].includes(ext) ? bytes : await sharp(prepared.path).png().toBuffer(); }
    finally { await prepared.cleanup(); }
    const image = ['jpg', 'jpeg'].includes(ext) ? await pdf.embedJpg(imageBytes) : await pdf.embedPng(imageBytes);
    const page = pdf.addPage([image.width, image.height]); page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    await fs.writeFile(out, await pdf.save());
  } else if (ext === 'docx' && outputFormat === 'html') {
    const contents = unzipSync(new Uint8Array(await fs.readFile(input)));
    if (!contents['word/document.xml']) throw new Error('El archivo no contiene un documento DOCX válido.');
    await fs.writeFile(out, docxToHtml(strFromU8(contents['word/document.xml'])), 'utf8');
  } else if (['csv', 'xlsx'].includes(ext) && ['csv', 'xlsx'].includes(outputFormat)) {
    const workbook = new ExcelJS.Workbook();
    if (ext === 'csv') await workbook.csv.readFile(input); else await workbook.xlsx.readFile(input);
    if (outputFormat === 'csv') await workbook.csv.writeFile(out); else await workbook.xlsx.writeFile(out);
  } else if (SUBTITLE_EXTENSIONS.includes(ext) && SUBTITLE_EXTENSIONS.includes(outputFormat)) {
    const content = await fs.readFile(input, 'utf8');
    await fs.writeFile(out, outputFormat === 'vtt' ? toVtt(content) : toSrt(content), 'utf8');
  } else if (ext === 'txt' && outputFormat === 'md') {
    await fs.copyFile(input, out);
  } else if (ext === 'md' && outputFormat === 'txt') {
    await fs.copyFile(input, out);
  } else if (operation === 'create-zip') {
    const files = options.files || [input]; const entries = {};
    for (const file of files) {
      let name = options.archiveRoot ? path.relative(options.archiveRoot, file).split(path.sep).join('/') : path.basename(file);
      if (!name || name.startsWith('../') || path.isAbsolute(name)) name = path.basename(file);
      const original = name; let index = 2;
      while (Object.hasOwn(entries, name)) { const ext = path.posix.extname(original); name = `${original.slice(0, original.length - ext.length)} (${index++})${ext}`; }
      entries[name] = new Uint8Array(await fs.readFile(file));
    }
    const zip = zipSync(entries, { level: 6 }); await fs.writeFile(out, zip);
  } else {
    throw new Error(`No hay una conversión activa de ${ext.toUpperCase()} a ${outputFormat.toUpperCase()}.`);
  }
  report(onProgress, jobId, input, 100, 'done', { output: out });
  return { output: out, label: path.basename(input), input, status: 'done' };
}

async function convertBatch({ files = [], operation = 'convert', format, options = {}, settings = {}, jobId = `job-${Date.now()}`, onProgress }) {
  const results = [];
  cancelled.delete(jobId);
  if (['merge-pdf', 'create-zip', 'create-collage', 'join-video'].includes(operation) && files.length) {
    let result;
    try {
      result = await runOne({ input: files[0], operation, format, options: { ...options, mergeFiles: files, files }, settings, jobId, onProgress });
    } catch (error) {
      const wasCancelled = cancelled.has(jobId);
      result = { output: '', label: path.basename(files[0]), input: files[0], status: wasCancelled ? 'cancelled' : 'error', error: wasCancelled ? 'Cancelado por el usuario.' : error.message };
      report(onProgress, jobId, files[0], 100, result.status, { error: result.error });
    }
    cancelled.delete(jobId);
    return [result];
  }
  for (const input of files) {
    if (cancelled.has(jobId)) break;
    try {
      const result = await runOne({ input, operation, format, options: { ...options, mergeFiles: files }, settings, jobId, onProgress });
      results.push(result);
    } catch (error) {
      const wasCancelled = cancelled.has(jobId);
      results.push({ output: '', label: path.basename(input), input, status: wasCancelled ? 'cancelled' : 'error', error: wasCancelled ? 'Cancelado por el usuario.' : error.message });
      report(onProgress, jobId, input, 100, wasCancelled ? 'cancelled' : 'error', { error: wasCancelled ? 'Cancelado por el usuario.' : error.message });
    }
  }
  active.delete(jobId);
  cancelled.delete(jobId);
  return results;
}

function cancelJob(jobId) {
  cancelled.add(jobId);
  const jobs = active.get(jobId);
  if (!jobs) return true;
  for (const child of jobs) child.kill('SIGTERM');
  active.delete(jobId); return true;
}

module.exports = { convertBatch, cancelJob, supportedInputs, runOne, IMAGE_EXTENSIONS, MEDIA_EXTENSIONS, toVtt, toSrt, docxToHtml, probeMedia, previewFrame, previewWaveform };
