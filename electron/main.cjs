const { app, BrowserWindow, dialog, globalShortcut, ipcMain, screen, shell } = require('electron');
const { spawn } = require('node:child_process');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const fs = require('node:fs/promises');
const { convertBatch, cancelJob, supportedInputs, probeMedia, previewFrame, previewWaveform } = require('./media.cjs');
const { LocalRepository } = require('./repository.cjs');
const devServerUrl = process.env.DIAL_DEV_SERVER_URL || 'http://127.0.0.1:5173';

const defaults = {
  appearance: 'dark', outputFolder: '', keepOriginal: true,
  optimizeImages: true, optimizeAudio: true, optimizeVideo: true,
  imageQuality: 84, audioBitrate: '192k', videoCrf: 24,
  remoteUrl: '', remoteDatabase: '', remoteUsername: '', remotePassword: '',
};
let mainWindow;
let quickWindow;
let repo;
let settingsFile;
let settings = { ...defaults };
let quickMode = false;
let quickShortcutRegistered = false;
let quitting = false;
let pendingQuickPaths = [];
let quickRestoreMain = false;
let quickDragActive = false;
let quickDragCloseTimer;
let shiftDragMonitor;
let updaterStatus = { state: 'idle', version: app.getVersion() };
const allowedExtensions = new Set(supportedInputs());
const instanceLock = app.requestSingleInstanceLock();
if (!instanceLock) app.quit();

function quickOpen(paths = [], { fromDrag = false } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  if (!quickWindow || quickWindow.isDestroyed()) createQuickWindow();
  if (!quickMode) quickRestoreMain = Boolean(mainWindow?.isVisible());
  if (quickDragCloseTimer) clearTimeout(quickDragCloseTimer);
  quickMode = true;
  quickDragActive = fromDrag;
  pendingQuickPaths = [...new Set(paths.filter((item) => typeof item === 'string'))];
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const bounds = display.workArea;
  const width = 620; const height = 620;
  quickWindow.setBounds({
    x: Math.max(bounds.x, Math.min(cursor.x - Math.round(width / 2), bounds.x + bounds.width - width)),
    y: Math.max(bounds.y, Math.min(cursor.y - Math.round(height / 2), bounds.y + bounds.height - height)),
    width, height,
  });
  quickWindow.setAlwaysOnTop(true, 'screen-saver');
  quickWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
  quickWindow.show();
  quickWindow.focus();
  if (!quickWindow.webContents.isLoading()) quickWindow.webContents.send('quick:open', pendingQuickPaths);
}

function closeQuick({ restoreMain = true } = {}) {
  quickMode = false;
  quickDragActive = false;
  if (quickDragCloseTimer) clearTimeout(quickDragCloseTimer);
  if (quickWindow && !quickWindow.isDestroyed()) quickWindow.hide();
  if (restoreMain && quickRestoreMain && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
  quickRestoreMain = false;
}

function startShiftDragMonitor() {
  if (process.platform !== 'win32' || shiftDragMonitor) return;
  const monitorScript = String.raw`
$source = @'
using System;
using System.Runtime.InteropServices;
public static class DialDragInput {
  [StructLayout(LayoutKind.Sequential)] public struct Point { public int X; public int Y; }
  [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
  [DllImport("user32.dll")] private static extern bool GetCursorPos(out Point point);
  public static bool Down(int key) { return (GetAsyncKeyState(key) & 0x8000) != 0; }
  public static Point Cursor() { Point point; GetCursorPos(out point); return point; }
}
'@
Add-Type -TypeDefinition $source
$tracking = $false
$started = $false
$originX = 0
$originY = 0
while ($true) {
  $left = [DialDragInput]::Down(1)
  $shift = [DialDragInput]::Down(16)
  if ($left -and $shift -and -not $tracking) {
    $point = [DialDragInput]::Cursor()
    $originX = $point.X
    $originY = $point.Y
    $tracking = $true
    $started = $false
  }
  if ($tracking -and $left -and $shift -and -not $started) {
    $point = [DialDragInput]::Cursor()
    $dx = $point.X - $originX
    $dy = $point.Y - $originY
    if (($dx * $dx + $dy * $dy) -ge 256) {
      [Console]::WriteLine("START|$($point.X)|$($point.Y)")
      [Console]::Out.Flush()
      $started = $true
    }
  }
  if ($tracking -and (-not $left -or -not $shift)) {
    if ($started) { [Console]::WriteLine('END'); [Console]::Out.Flush() }
    $tracking = $false
    $started = $false
  }
  Start-Sleep -Milliseconds 16
}`;
  shiftDragMonitor = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', monitorScript], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  let output = '';
  shiftDragMonitor.stdout.setEncoding('utf8');
  shiftDragMonitor.stdout.on('data', (chunk) => {
    output += chunk;
    const lines = output.split(/\r?\n/);
    output = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('START|') && !quickMode) quickOpen([], { fromDrag: true });
      else if (line === 'END' && quickDragActive) {
        quickDragCloseTimer = setTimeout(() => {
          if (quickDragActive) closeQuick();
        }, 1400);
      }
    }
  });
  shiftDragMonitor.on('error', () => { shiftDragMonitor = null; });
  shiftDragMonitor.on('exit', () => { shiftDragMonitor = null; });
}

function createQuickWindow() {
  quickWindow = new BrowserWindow({
    width: 620, height: 620, minWidth: 540, minHeight: 540,
    show: false, frame: false, transparent: true, resizable: false,
    hasShadow: false, skipTaskbar: true, alwaysOnTop: true,
    backgroundColor: '#00000000', title: 'DIAL rápido',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  if (app.isPackaged) quickWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { overlay: '1' } });
  else quickWindow.loadURL(`${devServerUrl}/?overlay=1`);
  quickWindow.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://')) shell.openExternal(url); return { action: 'deny' }; });
  quickWindow.on('close', (event) => { if (!quitting) { event.preventDefault(); closeQuick(); } });
  quickWindow.on('closed', () => { quickWindow = null; quickMode = false; });
}

function publishUpdaterStatus(status) {
  updaterStatus = { ...status, checkedAt: new Date().toISOString() };
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('updates:status', updaterStatus);
  }
}

function configureUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => publishUpdaterStatus({ state: 'checking', version: app.getVersion() }));
  autoUpdater.on('update-available', (info) => publishUpdaterStatus({ state: 'downloading', version: info.version, percent: 0 }));
  autoUpdater.on('download-progress', (progress) => publishUpdaterStatus({ state: 'downloading', percent: progress.percent, transferred: progress.transferred, total: progress.total }));
  autoUpdater.on('update-downloaded', (info) => publishUpdaterStatus({ state: 'ready', version: info.version }));
  autoUpdater.on('update-not-available', () => publishUpdaterStatus({ state: 'current', version: app.getVersion() }));
  autoUpdater.on('error', (error) => publishUpdaterStatus({ state: 'error', message: error.message || 'No se pudo consultar el canal de actualizaciones.' }));
}

function receivedPaths(argv = []) {
  return argv.filter((item) => typeof item === 'string' && !item.startsWith('-') && path.isAbsolute(item));
}

async function getSettings() {
  const saved = JSON.parse(await fs.readFile(settingsFile, 'utf8').catch(() => '{}'));
  const { remotePasswordEncrypted, ...publicSettings } = { ...defaults, ...saved };
  return { ...publicSettings, remotePassword: '', hasSavedRemotePassword: Boolean(remotePasswordEncrypted) };
}

async function persistSettings(values) {
  const current = JSON.parse(await fs.readFile(settingsFile, 'utf8').catch(() => '{}'));
  const { remotePassword = '', ...publicValues } = values;
  const next = { ...current, ...publicValues };
  if (remotePassword) {
    const { safeStorage } = require('electron');
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows no tiene disponible el almacenamiento cifrado.');
    next.remotePasswordEncrypted = safeStorage.encryptString(remotePassword).toString('base64');
  }
  await fs.writeFile(settingsFile, JSON.stringify(next, null, 2), 'utf8');
  settings = await getSettings();
  return settings;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 930, minWidth: 1040, minHeight: 720,
    backgroundColor: '#0c1117', title: 'DIAL',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  if (app.isPackaged) mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  else mainWindow.loadURL(devServerUrl);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const local = app.isPackaged ? url.startsWith('file:') : url.startsWith(devServerUrl);
    if (!local) event.preventDefault();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (quickWindow && !quickWindow.isDestroyed()) quickWindow.destroy();
  });
}

app.on('second-instance', (_event, argv) => {
  const paths = receivedPaths(argv);
  if (!repo) { pendingQuickPaths = paths; quickMode = true; return; }
  quickOpen(paths);
});
app.whenReady().then(async () => {
  if (!instanceLock) return;
  settingsFile = path.join(app.getPath('userData'), 'dial-settings.json');
  settings = await getSettings();
  repo = new LocalRepository(app.getPath('userData'));
  await repo.init();
  configureUpdater();
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  startShiftDragMonitor();
  if (app.isPackaged) autoUpdater.checkForUpdates().catch((error) => publishUpdaterStatus({ state: 'error', message: error.message }));
  const launchPaths = receivedPaths(process.argv).filter((item) => path.resolve(item).toLowerCase() !== path.resolve(process.execPath).toLowerCase());
  if (launchPaths.length) quickOpen(launchPaths);
  else if (quickMode) quickOpen(pendingQuickPaths);
  quickShortcutRegistered = globalShortcut.register('CommandOrControl+Shift+D', () => {
    if (quickMode) closeQuick();
    else quickOpen();
  });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('will-quit', () => { quitting = true; globalShortcut.unregisterAll(); if (shiftDragMonitor) shiftDragMonitor.kill(); });

ipcMain.handle('files:choose', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Archivos admitidos', extensions: supportedInputs() }] });
  return result.canceled ? [] : result.filePaths;
});
ipcMain.handle('files:expand-paths', async (_event, roots = []) => {
  const files = []; const directories = []; let unsupported = 0; let truncated = false;
  async function visit(target, depth = 0) {
    if (files.length >= 5000) { truncated = true; return; }
    let stat;
    try { stat = await fs.lstat(target); } catch { unsupported += 1; return; }
    if (stat.isSymbolicLink()) { unsupported += 1; return; }
    if (stat.isDirectory()) {
      if (depth === 0) directories.push(target);
      if (depth >= 24) { truncated = true; return; }
      let children;
      try { children = await fs.readdir(target, { withFileTypes: true }); } catch { unsupported += 1; return; }
      for (const child of children) {
        if (child.isDirectory() || child.isFile()) await visit(path.join(target, child.name), depth + 1);
        if (files.length >= 5000) { truncated = true; break; }
      }
      return;
    }
    if (!stat.isFile()) return;
    const ext = path.extname(target).slice(1).toLowerCase(); const supported = allowedExtensions.has(ext);
    if (!supported) unsupported += 1;
    files.push({ path: target, name: path.basename(target), ext, size: stat.size, supported });
  }
  for (const root of roots) await visit(root);
  return { files, directories, unsupported, truncated };
});
ipcMain.handle('files:info', async (_event, filePath) => {
  const stat = await fs.stat(filePath); return { size: stat.size, isFile: stat.isFile() };
});
ipcMain.handle('files:read-bytes', async (_event, filePath) => new Uint8Array(await fs.readFile(filePath)));
ipcMain.handle('files:media-info', async (_event, filePath) => probeMedia(filePath));
ipcMain.handle('files:preview-frame', async (_event, { filePath, timestamp }) => previewFrame(filePath, timestamp));
ipcMain.handle('files:preview-waveform', async (_event, { filePath, start, duration }) => previewWaveform(filePath, start, duration));
ipcMain.handle('files:save-text', async (_event, { suggestedName, content }) => {
  const result = await dialog.showSaveDialog(mainWindow, { defaultPath: suggestedName });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fs.writeFile(result.filePath, content, 'utf8'); return { canceled: false, filePath: result.filePath };
});
ipcMain.handle('responses:export-xlsx', async (_event, responses) => {
  const result = await dialog.showSaveDialog(mainWindow, { defaultPath: 'respuestas-dial.xlsx', filters: [{ name: 'Libro de Excel', extensions: ['xlsx'] }] });
  if (result.canceled || !result.filePath) return { canceled: true };
  const ExcelJS = require('exceljs'); const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Respuestas');
  const forms = await repo.listForms(); const labels = new Map(forms.flatMap((form) => (form.fields || []).map((field) => [field.id, field.label || field.id])));
  const fieldIds = [...new Set(responses.flatMap((response) => Object.keys(response.values || {})))];
  const columns = fieldIds.map((key) => ({ header: labels.get(key) || key, key, width: 26 }));
  sheet.columns = [{ header: 'Formulario', key: 'formTitle', width: 30 }, { header: 'Fecha', key: 'createdAt', width: 24 }, ...columns, { header: 'Adjuntos', key: 'attachments', width: 42 }];
  for (const response of responses) sheet.addRow({ formTitle: response.formTitle || '', createdAt: new Date(response.createdAt).toLocaleString(), ...response.values, attachments: (response.attachments || []).map((file) => file.name).join('; ') });
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF29251F' } }; sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + Math.min(sheet.columnCount, 26))}1` };
  await workbook.xlsx.writeFile(result.filePath); return { canceled: false, filePath: result.filePath };
});
ipcMain.handle('folder:choose', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
  return result.canceled ? '' : result.filePaths[0];
});
ipcMain.handle('folder:choose-for-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.canceled ? [] : result.filePaths;
});
ipcMain.handle('quick:close', () => closeQuick());
ipcMain.handle('quick:drop-received', () => {
  quickDragActive = false;
  if (quickDragCloseTimer) clearTimeout(quickDragCloseTimer);
  return true;
});
ipcMain.handle('quick:open', () => quickOpen());
ipcMain.handle('quick:state', () => ({ active: quickMode, paths: pendingQuickPaths }));
ipcMain.handle('quick:shortcut-status', () => quickShortcutRegistered);
ipcMain.handle('quick:open-files', (_event, paths = []) => {
  closeQuick({ restoreMain: false });
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  mainWindow.show(); mainWindow.focus();
  pendingQuickPaths = [...new Set(paths.filter((item) => typeof item === 'string'))];
  if (!mainWindow.webContents.isLoading()) mainWindow.webContents.send('files:open', pendingQuickPaths);
});
ipcMain.handle('convert:run', async (_event, options) => {
  const { jobId } = options;
  if (jobId) await repo.updateJob(jobId, { status: 'processing', progress: 0, error: '' });
  let lastSaved = 0;
  const results = await convertBatch({ ...options, onProgress: (item) => {
    mainWindow?.webContents.send('convert:progress', item);
    const now = Date.now();
    if (jobId && (item.status !== 'processing' || now - lastSaved > 1200)) {
      lastSaved = now;
      repo.updateJob(jobId, { status: 'processing', progress: item.progress, currentFile: item.file, currentFileStatus: item.status, output: item.output || '' }).catch(() => {});
    }
  } });
  if (jobId) {
    const status = results.some((item) => item.status === 'cancelled') ? 'cancelled' : results.length && results.every((item) => item.status === 'done') ? 'done' : 'error';
    await repo.updateJob(jobId, { status, progress: 100, results });
  }
  return results;
});
ipcMain.handle('convert:cancel', (_event, jobId) => cancelJob(jobId));
ipcMain.handle('path:open', (_event, targetPath) => shell.openPath(targetPath));
ipcMain.handle('path:reveal', (_event, targetPath) => shell.showItemInFolder(targetPath));
ipcMain.handle('settings:get', () => getSettings());
ipcMain.handle('settings:save', (_event, values) => persistSettings(values));
ipcMain.handle('updates:status', () => updaterStatus);
ipcMain.handle('updates:check', async () => {
  if (!app.isPackaged) return { state: 'development', version: app.getVersion() };
  publishUpdaterStatus({ state: 'checking', version: app.getVersion() });
  try { await autoUpdater.checkForUpdates(); } catch (error) { publishUpdaterStatus({ state: 'error', message: error.message }); }
  return updaterStatus;
});
ipcMain.handle('updates:install', () => {
  if (updaterStatus.state !== 'ready') return false;
  autoUpdater.quitAndInstall(false, true);
  return true;
});
ipcMain.handle('forms:list', () => repo.listForms());
ipcMain.handle('forms:save', (_event, form) => repo.saveForm(form));
ipcMain.handle('forms:delete', (_event, id) => repo.deleteForm(id));
ipcMain.handle('responses:save', (_event, response) => repo.saveResponse(response));
ipcMain.handle('responses:list', () => repo.listResponses());
ipcMain.handle('jobs:list', () => repo.listJobs());
ipcMain.handle('jobs:save', (_event, job) => repo.saveJob(job));
ipcMain.handle('jobs:delete', (_event, id) => repo.deleteJob(id));
ipcMain.handle('attachments:store', (_event, data) => repo.storeAttachment(data, settings));
ipcMain.handle('sync:status', () => repo.syncStatus(settings));
ipcMain.handle('sync:now', () => repo.sync(settings));
ipcMain.handle('external:open', (_event, url) => url.startsWith('https://') ? shell.openExternal(url) : Promise.resolve());
ipcMain.handle('app:info', () => ({ version: app.getVersion(), dataPath: app.getPath('userData'), isPackaged: app.isPackaged, upstream: 'Tangerine Community GPLv3' }));
