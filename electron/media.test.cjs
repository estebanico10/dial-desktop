const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const { zipSync, strToU8 } = require('fflate');
const ffmpegPath = require('ffmpeg-static');
const { convertBatch, supportedInputs, toVtt, toSrt, docxToHtml } = require('./media.cjs');
const { LocalRepository } = require('./repository.cjs');
const execFileAsync = promisify(execFile);

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dial-test-'));
  return { root, cleanup: () => fs.rm(root, { recursive: true, force: true }) };
}

test('the file picker advertises only implemented source families', () => {
  const formats = supportedInputs();
  for (const extension of ['png', 'mp4', 'mp3', 'pdf', 'docx', 'csv', 'xlsx', 'srt', 'vtt', 'zip']) assert.ok(formats.includes(extension));
  assert.ok(!formats.includes('rar'));
});

test('subtitle conversion preserves cues while changing timestamp syntax', () => {
  const vtt = toVtt('1\n00:00:01,200 --> 00:00:02,500\nHola\n');
  assert.match(vtt, /^WEBVTT/);
  assert.match(vtt, /00:00:01\.200 --> 00:00:02\.500/);
  const srt = toSrt('WEBVTT\n\n00:00:01.200 --> 00:00:02.500\nHola\n');
  assert.match(srt, /00:00:01,200 --> 00:00:02,500/);
});

test('DOCX XML conversion escapes markup while retaining readable paragraphs', () => {
  const html = docxToHtml('<w:document><w:p><w:r><w:t>Hola &amp; mundo &lt;3</w:t></w:r></w:p></w:document>');
  assert.match(html, /<p>Hola &amp; mundo &lt;3<\/p>/);
  assert.ok(!html.includes('<p>Hola & mundo <3</p>'));
});

test('batch image conversion makes a new file and preserves the original', async (t) => {
  const temp = await fixture(); t.after(temp.cleanup);
  const source = path.join(temp.root, 'foto.png');
  await sharp({ create: { width: 12, height: 10, channels: 3, background: '#87a36d' } }).png().toFile(source);
  const original = await fs.readFile(source);
  const [result] = await convertBatch({ files: [source], format: 'webp', operation: 'convert', jobId: 'image-test' });
  assert.equal(result.status, 'done');
  assert.equal(path.extname(result.output), '.webp');
  assert.deepEqual(await fs.readFile(source), original);
  assert.ok((await fs.stat(result.output)).size > 0);
});

test('PDF split creates one local file for each page', async (t) => {
  const temp = await fixture(); t.after(temp.cleanup);
  const source = path.join(temp.root, 'two-pages.pdf'); const pdf = await PDFDocument.create();
  pdf.addPage(); pdf.addPage(); await fs.writeFile(source, await pdf.save());
  const [result] = await convertBatch({ files: [source], format: 'pdf', operation: 'split-pdf', jobId: 'pdf-test' });
  assert.equal(result.status, 'done');
  const pages = await fs.readdir(result.output);
  assert.equal(pages.length, 2);
});

test('audio conversion creates an MP3 with the bundled FFmpeg engine', async (t) => {
  const temp = await fixture(); t.after(temp.cleanup);
  const source = path.join(temp.root, 'tone.wav');
  await execFileAsync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:a', 'pcm_s16le', '-y', source]);
  const [result] = await convertBatch({ files: [source], format: 'mp3', operation: 'convert', jobId: 'audio-test' });
  assert.equal(result.status, 'done');
  assert.equal(path.extname(result.output), '.mp3');
  assert.ok((await fs.stat(result.output)).size > 1000);
  assert.ok((await fs.stat(source)).size > 1000);
});

test('CSV export, ZIP creation and safe extraction work locally', async (t) => {
  const temp = await fixture(); t.after(temp.cleanup);
  const csv = path.join(temp.root, 'datos.csv'); await fs.writeFile(csv, 'nombre,valor\nAna,5\n', 'utf8');
  const [sheet] = await convertBatch({ files: [csv], format: 'xlsx', operation: 'convert', jobId: 'sheet-test' });
  assert.equal(sheet.status, 'done'); assert.ok((await fs.stat(sheet.output)).size > 100);
  const [archive] = await convertBatch({ files: [csv], format: 'zip', operation: 'create-zip', jobId: 'zip-test' });
  assert.equal(archive.status, 'done');
  const [extracted] = await convertBatch({ files: [archive.output], format: 'zip', operation: 'extract-zip', jobId: 'unzip-test' });
  assert.equal(extracted.status, 'done'); assert.ok(await fs.stat(path.join(extracted.output, 'datos.csv')));
  const hostile = path.join(temp.root, 'hostile.zip'); await fs.writeFile(hostile, zipSync({ '../escape.txt': strToU8('no') }));
  await convertBatch({ files: [hostile], format: 'zip', operation: 'extract-zip', jobId: 'hostile-test' });
  await assert.rejects(() => fs.access(path.join(temp.root, 'escape.txt')));
});

test('local form responses and optimized attachments keep original files', async (t) => {
  const temp = await fixture(); t.after(temp.cleanup);
  const repo = new LocalRepository(temp.root); await repo.init();
  const form = await repo.saveForm({ title: 'Visita', fields: [] });
  assert.equal((await repo.listForms())[0].title, 'Visita');
  const source = path.join(temp.root, 'source.png');
  await sharp({ create: { width: 16, height: 16, channels: 3, background: '#75a2d1' } }).png().toFile(source);
  const saved = await repo.storeAttachment({ filePath: source, formId: form.id }, { optimizeImages: true, imageQuality: 80 });
  assert.ok(saved.optimized);
  assert.ok(await fs.stat(saved.originalPath));
  assert.ok(await fs.stat(saved.path));
  const response = await repo.saveResponse({ formId: form.id, formTitle: form.title, values: {}, attachments: [saved] });
  assert.equal((await repo.listResponses())[0].id, response.id);
});

test('sync refuses to claim success until a compatible replication protocol exists', async () => {
  const temp = await fixture();
  try {
    const repo = new LocalRepository(temp.root); await repo.init();
    await assert.rejects(() => repo.sync({ remoteUrl: 'https://example.invalid', remoteDatabase: 'group' }), /aún no está conectada/);
  } finally { await temp.cleanup(); }
});
