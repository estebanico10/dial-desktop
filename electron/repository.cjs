const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { runOne } = require('./media.cjs');

class LocalRepository {
  constructor(appData) {
    this.root = path.join(appData, 'DIAL');
    this.formsPath = path.join(this.root, 'forms.json');
    this.responsesPath = path.join(this.root, 'responses.json');
    this.jobsPath = path.join(this.root, 'jobs.json');
    this.attachmentPath = path.join(this.root, 'attachments');
    this.jobWrites = Promise.resolve();
  }
  async init() {
    await fs.mkdir(this.attachmentPath, { recursive: true });
    for (const file of [this.formsPath, this.responsesPath, this.jobsPath]) {
      try { await fs.access(file); } catch { await fs.writeFile(file, '[]', 'utf8'); }
    }
    const jobs = await this.read(this.jobsPath);
    const recovered = jobs.map((job) => job.status === 'processing' ? { ...job, status: 'interrupted', error: 'DIAL se cerró mientras este trabajo se procesaba. Puedes reintentarlo.' } : job);
    if (recovered.some((job, index) => job !== jobs[index])) await this.write(this.jobsPath, recovered);
  }
  async read(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
  async write(file, value) {
    const temp = `${file}.tmp`;
    await fs.writeFile(temp, JSON.stringify(value, null, 2), 'utf8');
    await fs.rename(temp, file);
  }
  async listForms() { return this.read(this.formsPath); }
  async saveForm(form) {
    const items = await this.read(this.formsPath);
    const value = { ...form, id: form.id || randomUUID(), updatedAt: new Date().toISOString() };
    const index = items.findIndex((item) => item.id === value.id);
    if (index < 0) items.unshift(value); else items[index] = value;
    await this.write(this.formsPath, items); return value;
  }
  async deleteForm(id) {
    await this.write(this.formsPath, (await this.read(this.formsPath)).filter((item) => item.id !== id)); return true;
  }
  async saveResponse(response) {
    const responses = await this.read(this.responsesPath);
    const saved = { ...response, id: randomUUID(), createdAt: new Date().toISOString(), syncStatus: 'local' };
    responses.unshift(saved); await this.write(this.responsesPath, responses); return saved;
  }
  async listResponses() { return this.read(this.responsesPath); }
  async listJobs() { return this.read(this.jobsPath); }
  async saveJob(job) {
    this.jobWrites = this.jobWrites.then(async () => {
      const items = await this.read(this.jobsPath);
      const index = items.findIndex((item) => item.id === job.id);
      const value = { ...job, updatedAt: new Date().toISOString() };
      if (index < 0) items.unshift(value); else items[index] = { ...items[index], ...value };
      await this.write(this.jobsPath, items.slice(0, 100));
      return value;
    });
    return this.jobWrites;
  }
  async updateJob(id, patch) {
    this.jobWrites = this.jobWrites.then(async () => {
      const items = await this.read(this.jobsPath);
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) return null;
      const value = { ...items[index], ...patch, id, updatedAt: new Date().toISOString() };
      items[index] = value; await this.write(this.jobsPath, items); return value;
    });
    return this.jobWrites;
  }
  async deleteJob(id) {
    this.jobWrites = this.jobWrites.then(async () => {
      const items = await this.read(this.jobsPath);
      await this.write(this.jobsPath, items.filter((item) => item.id !== id));
      return true;
    });
    return this.jobWrites;
  }
  async storeAttachment({ filePath, formId }, settings = {}) {
    const ext = path.extname(filePath).toLowerCase(); const id = randomUUID();
    const folder = path.join(this.attachmentPath, formId || 'sin-formulario');
    await fs.mkdir(folder, { recursive: true });
    const original = path.join(folder, `${id}-original${ext}`);
    const optimize = (['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff'].includes(ext) && settings.optimizeImages)
      || (['.mp3', '.m4a', '.wav', '.flac', '.ogg', '.opus', '.aiff', '.wma'].includes(ext) && settings.optimizeAudio)
      || (['.mp4', '.mov', '.mkv', '.webm', '.avi', '.wmv'].includes(ext) && settings.optimizeVideo);
    await fs.copyFile(filePath, original);
    if (!optimize) return { id, name: path.basename(filePath), path: original, originalPath: original, optimized: false };
    const format = ext.slice(1) || 'bin';
    const processed = await runOne({ input: filePath, operation: 'optimize', format, settings: { ...settings, outputFolder: folder }, options: { quality: settings.imageQuality || 84, crf: settings.videoCrf || 25, bitrate: settings.audioBitrate || '160k' }, jobId: `attachment-${id}` });
    const stored = path.join(folder, `${id}${path.extname(processed.output)}`);
    await fs.rename(processed.output, stored);
    return { id, name: path.basename(stored), path: stored, originalPath: original, optimized: true };
  }
  async syncStatus(settings) {
    return { configured: Boolean(settings.remoteUrl && settings.remoteDatabase), state: 'not-connected', message: settings.remoteUrl ? 'La conexión aún no se ha validado.' : 'Configura un servidor Tangerine compatible para habilitar la sincronización.' };
  }
  async sync(settings) {
    if (!settings.remoteUrl || !settings.remoteDatabase) throw new Error('Configura la URL y la base de datos remota primero.');
    throw new Error('La replicación compatible con el protocolo de Tangerine aún no está conectada. Tus datos locales están guardados y no se han enviado.');
  }
}

module.exports = { LocalRepository };
