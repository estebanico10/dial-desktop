import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import dialIconUrl from '../build/icon.svg?url';
import {
  Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, AudioLines, BadgeCheck, BookOpen, Box, Check,
  ChevronDown, ChevronRight, CircleHelp, Clock3, Cloud, CloudOff, Command, Copy, File,
  FileArchive, FileAudio, FileImage, FilePlus2, FileSpreadsheet, FileText, FileVideo, FolderOpen,
  Gauge, HardDrive, Image, Layers3, ListFilter, LockKeyhole, MoreHorizontal, Pause, Play,
  Plus, RefreshCw, Scissors, Search, Settings2, ShieldCheck, Sparkles, Trash2, Upload,
  WandSparkles, X, Zap,
} from 'lucide-react';
import './style.css';


const IMAGE_TYPES = ['jpg','jpeg','png','webp','avif','tif','tiff','bmp','gif','svg'];
const FORMAT_MATRIX = {
  jpg: ['jpg', 'png', 'webp', 'avif', 'tiff', 'pdf'], jpeg: ['jpg', 'png', 'webp', 'avif', 'tiff', 'pdf'],
  png: ['jpg', 'png', 'webp', 'avif', 'tiff', 'pdf'], webp: ['jpg', 'png', 'webp', 'avif', 'tiff', 'pdf'],
  avif: ['jpg', 'png', 'webp', 'avif', 'tiff', 'pdf'], tif: ['jpg', 'png', 'webp', 'avif', 'tiff', 'pdf'], tiff: ['jpg', 'png', 'webp', 'avif', 'tiff', 'pdf'],
  bmp: ['jpg', 'png', 'webp', 'avif', 'tiff', 'pdf'], gif: ['jpg', 'png', 'webp', 'avif', 'tiff', 'pdf'], svg: ['jpg', 'png', 'webp', 'avif', 'tiff', 'pdf'],
  mp4: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'mp3'], mov: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'mp3'],
  mkv: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'mp3'], webm: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'mp3'],
  avi: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'mp3'], wmv: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'mp3'],
  mp3: ['mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus', 'aiff'], m4a: ['mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus', 'aiff'],
  wav: ['mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus', 'aiff'], flac: ['mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus', 'aiff'],
  ogg: ['mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus', 'aiff'], opus: ['mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus', 'aiff'],
  aiff: ['mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus', 'aiff'], wma: ['mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus', 'aiff'],
  csv: ['xlsx'], xlsx: ['csv'], docx: ['html'], txt: ['md'], srt: ['vtt'], vtt: ['srt'], pdf: ['pdf'], zip: ['zip'],
};
const FORM_TYPES = [
  ['text', 'Texto breve'], ['textarea', 'Texto largo'], ['number', 'Número'],
  ['select', 'Lista de opciones'], ['boolean', 'Sí / No'], ['date', 'Fecha'], ['file', 'Archivo adjunto'],
];
const id = () => crypto.randomUUID();
const extOf = (name) => name?.split('.').pop()?.toLowerCase() || '';
const formatSize = (value = 0) => value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;
const operationLabel = (operation) => ({ convert: 'Conversión', optimize: 'Compresión', 'trim-video': 'Recorte de video', 'trim-audio': 'Recorte de audio', 'organize-pdf': 'Orden PDF', 'split-pdf': 'Dividir PDF', 'merge-pdf': 'Unir PDF', 'create-collage': 'Collage', 'create-zip': 'Crear ZIP', 'extract-zip': 'Extraer ZIP', 'adjust-image': 'Ajustes de imagen', 'volume-audio': 'Volumen de audio', 'fade-audio': 'Fundido de audio', 'metadata-media': 'Metadatos', 'join-video': 'Unir videos', 'split-video': 'Dividir video' }[operation] || operation || 'Trabajo');
const formatTime = (seconds = 0) => { const value = Math.max(0, Number(seconds) || 0); const hours = Math.floor(value / 3600); const minutes = Math.floor((value % 3600) / 60); const secs = Math.floor(value % 60); return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}`; };

function PdfPagePicker({ filePath, value, onChange }) {
  const [pages, setPages] = useState([]); const [selected, setSelected] = useState([]); const [activePage, setActivePage] = useState(null); const [error, setError] = useState('');
  useEffect(() => {
    let alive = true; let loadingTask;
    setPages([]); setSelected([]); setError(''); onChange('');
    (async () => {
      try {
        const [bytes, pdfjsLib, worker] = await Promise.all([window.dial.readFileBytes(filePath), import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
        pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
        loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
        const pdfDocument = await loadingTask.promise; const next = [];
        for (let number = 1; number <= pdfDocument.numPages; number += 1) {
          if (!alive) break;
          const page = await pdfDocument.getPage(number); const viewport = page.getViewport({ scale: 104 / page.getViewport({ scale: 1 }).width });
          const canvas = window.document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
          await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;
          next.push({ number, thumbnail: canvas.toDataURL('image/jpeg', 0.72) });
        }
        if (alive) { const order = next.map((page) => page.number); setPages(next); setSelected(order); setActivePage(order[0] || null); onChange(order.join(', ')); }
      } catch (exception) { if (alive) setError(`No se pudo mostrar este PDF: ${exception.message}`); }
    })();
    return () => { alive = false; loadingTask?.destroy(); };
  }, [filePath]);
  const publish = (order) => { setSelected(order); onChange(order.join(', ')); };
  const toggle = (number) => publish(selected.includes(number) ? selected.filter((item) => item !== number) : [...selected, number]);
  const move = (number, direction) => { const index = selected.indexOf(number); const target = index + direction; if (index < 0 || target < 0 || target >= selected.length) return; const order = [...selected]; [order[index], order[target]] = [order[target], order[index]]; publish(order); };
  return <div className="pdf-page-picker"><div className="pdf-picker-heading"><b>Selecciona y ordena páginas</b><span>{selected.length} de {pages.length || '…'} incluidas</span></div>{error ? <p className="pdf-picker-error">{error}</p> : !pages.length ? <div className="pdf-picker-loading">Preparando miniaturas…</div> : <div className="pdf-thumbnail-grid">{pages.map((page) => { const order = selected.indexOf(page.number); return <div key={page.number} className={`pdf-page-tile ${order >= 0 ? 'included' : 'excluded'} ${activePage === page.number ? 'active' : ''}`}><button className="pdf-page-preview" onClick={() => { setActivePage(page.number); toggle(page.number); }} title={order >= 0 ? 'Quitar esta página' : 'Incluir esta página'}><img src={page.thumbnail} alt={`Página ${page.number} del PDF`}/><span className="pdf-page-number">{page.number}</span><span className="pdf-page-order">{order >= 0 ? order + 1 : '×'}</span></button>{order >= 0 && <div className="pdf-page-reorder"><button onClick={() => move(page.number, -1)} disabled={order === 0} aria-label={`Mover página ${page.number} antes`}>‹</button><button onClick={() => move(page.number, 1)} disabled={order === selected.length - 1} aria-label={`Mover página ${page.number} después`}>›</button></div>}</div>; })}</div>}<small className="pdf-picker-hint">Pulsa una miniatura para incluirla o quitarla. Usa las flechas para cambiar el orden.</small>{pages.length > 0 && selected.length === 0 && <p className="pdf-picker-error">Incluye al menos una página para crear el PDF.</p>}</div>;
}

function App() {
  const [page, setPage] = useState('home');
  const [quickPaths, setQuickPaths] = useState([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [forms, setForms] = useState([]);
  const [responses, setResponses] = useState([]);
  const [sync, setSync] = useState({ configured: false, message: 'Sin servidor conectado' });
  const [notice, setNotice] = useState(null);
  const [dataPath, setDataPath] = useState('');

  const refresh = useCallback(async () => {
    const [nextSettings, nextForms, nextResponses, nextSync, info] = await Promise.all([
      window.dial.settingsGet(), window.dial.formsList(), window.dial.responsesList(), window.dial.syncStatus(), window.dial.appInfo(),
    ]);
    setSettings(nextSettings); setForms(nextForms); setResponses(nextResponses); setSync(nextSync); setDataPath(info.dataPath);
  }, []);

  useEffect(() => { refresh().catch(() => {}); }, [refresh]);
  useEffect(() => {
    const open = (paths) => { setPage('files'); setQuickPaths(paths || []); };
    const stopOpen = window.dial.onFilesOpen(open);
    return () => stopOpen();
  }, []);
  useEffect(() => {
    if (!notice) return undefined;
    const timeout = setTimeout(() => setNotice(null), 4200);
    return () => clearTimeout(timeout);
  }, [notice]);

  const toast = (message, kind = 'success') => setNotice({ message, kind });
  const navigate = (next) => setPage(next);

  return <div className={`app-shell theme-${settings?.appearance || 'dark'}`}>
    <Sidebar page={page} navigate={navigate} />
    <main className="main-shell">
      <Header page={page} navigate={navigate} sync={sync} onHelp={() => setHelpOpen(true)} />
      <div className="page-content">
        {page === 'home' && <Home forms={forms} responses={responses} sync={sync} navigate={navigate} />}
        {page === 'files' && <FilesPage settings={settings} onToast={toast} quickPaths={quickPaths} />}
        {page === 'forms' && <FormsPage forms={forms} refresh={refresh} onToast={toast} />}
        {page === 'responses' && <ResponsesPage responses={responses} forms={forms} navigate={navigate} onToast={toast} />}
        {page === 'settings' && <SettingsPage settings={settings} setSettings={setSettings} dataPath={dataPath} sync={sync} onToast={toast} refresh={refresh} />}
        <footer className="creator-credit">
          <span>Hecho por <b>Esteban Nicola</b></span>
          <button className="creator-credit-link" onClick={() => window.dial.openExternal('https://estebanico.com')} aria-label="Visitar estebanico.com">
            estebanico.com <ArrowUpRight size={12}/>
          </button>
        </footer>
      </div>
    </main>
    {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    {notice && <div className={`toast ${notice.kind}`}><span className="toast-icon">{notice.kind === 'error' ? <X size={16}/> : <Check size={16}/>}</span>{notice.message}</div>}
  </div>;
}

function QuickOverlay({ paths = [], onToast = () => {}, onClose = () => window.dial.quickClose(), onOpenFiles = (items) => window.dial.openFiles(items) }) {
  const [files, setFiles] = useState([]); const [directories, setDirectories] = useState([]); const [unsupported, setUnsupported] = useState(0);
  const [truncated, setTruncated] = useState(false); const [scanning, setScanning] = useState(false); const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('formats'); const [format, setFormat] = useState(''); const [operation, setOperation] = useState('convert'); const [output, setOutput] = useState('');
  const first = files[0];
  const outputs = first ? files.slice(1).reduce((common, file) => common.filter((item) => (FORMAT_MATRIX[file.ext] || []).includes(item)), FORMAT_MATRIX[first.ext] || []) : [];
  const isAudio = files.some((file) => ['mp3','m4a','wav','flac','ogg','opus','aiff','wma'].includes(file.ext));
  const isVideo = files.some((file) => ['mp4','mov','mkv','webm','avi','wmv'].includes(file.ext));
  const toolItems = [
    ...(files.length ? [{ id: 'create-zip', label: 'Crear ZIP', icon: <FileArchive size={15}/> }] : []),
    ...(files.some((file) => IMAGE_TYPES.includes(file.ext)) ? [{ id: 'optimize', label: 'Comprimir', icon: <Zap size={15}/> }, { id: 'remove-metadata', label: 'Quitar datos', icon: <ShieldCheck size={15}/> }] : []),
    ...(isAudio || isVideo ? [{ id: 'optimize', label: 'Comprimir', icon: <Zap size={15}/> }] : []),
    ...(isVideo ? [{ id: 'mute-video', label: 'Quitar audio', icon: <AudioLines size={15}/> }, { id: 'snapshot-video', label: 'Fotograma', icon: <Image size={15}/> }, { id: 'extract-audio', label: 'Extraer audio', icon: <FileAudio size={15}/> }] : []),
  ];
  const operationFiles = operation === 'remove-metadata' ? files.filter((file) => IMAGE_TYPES.includes(file.ext))
    : ['mute-video','snapshot-video','extract-audio'].includes(operation) ? files.filter((file) => ['mp4','mov','mkv','webm','avi','wmv'].includes(file.ext))
      : files;
  const wheelItems = mode === 'formats' ? outputs.map((item) => ({ id: item, label: item.toUpperCase() })) : [...new Map(toolItems.map((item) => [item.id, item])).values()].slice(0, 8);
  const loadPaths = async (nextPaths) => {
    if (!nextPaths?.length) return;
    setScanning(true); setOutput('');
    try {
      const result = await window.dial.expandPaths(nextPaths);
      setFiles((current) => [...new Map([...current, ...result.files.filter((file) => file.supported)].map((file) => [file.path, file])).values()]);
      setDirectories((current) => [...new Set([...current, ...result.directories])]); setUnsupported((current) => current + result.unsupported); setTruncated((current) => current || result.truncated);
      if (result.truncated) onToast('El análisis se limitó a 5.000 archivos.', 'error');
      if (result.unsupported) onToast(`${result.unsupported} elementos sin herramienta se omitieron.`, 'error');
    } catch (error) { onToast(`No se pudo analizar la selección: ${error.message}`, 'error'); }
    finally { setScanning(false); }
  };
  useEffect(() => { if (paths.length) loadPaths(paths); }, [paths.join('|')]);
  useEffect(() => { const onKey = (event) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onClose]);
  useEffect(() => { if (outputs.length && !outputs.includes(format)) setFormat(outputs[0]); }, [outputs.join('|'), format]);
  const addFiles = async () => loadPaths(await window.dial.chooseFiles());
  const drop = async (event) => { event.preventDefault(); window.dial.quickDropReceived(); const dropped = Array.from(event.dataTransfer.files).map((file) => window.dial.pathForFile(file)).filter(Boolean); await loadPaths(dropped); };
  const run = async () => {
    if (!operationFiles.length || busy || (operation === 'convert' && !format)) return;
    setBusy(true); setOutput('');
    try {
      const settings = await window.dial.settingsGet();
      const selected = operationFiles.map((file) => file.path);
      const result = await window.dial.convert({ files: selected, format: operation === 'convert' ? format : undefined, operation, options: { quality: settings.imageQuality || 84, crf: settings.videoCrf || 24, bitrate: settings.audioBitrate || '192k', files: selected, archiveRoot: directories.length === 1 ? directories[0] : '' }, settings });
      const done = result.filter((item) => item.status === 'done'); if (!done.length) throw new Error(result.find((item) => item.error)?.error || 'No se pudo completar la acción.');
      setOutput(done[0].output); onToast(`${done.length} resultado${done.length === 1 ? '' : 's'} listo${done.length === 1 ? '' : 's'}.`);
    } catch (error) { onToast(error.message, 'error'); }
    finally { setBusy(false); }
  };
  const choose = (item) => { if (mode === 'formats') { setOperation('convert'); setFormat(item.id); } else { setOperation(item.id); setFormat(''); } };
  const centerLabel = files.length ? `${files.length} ARCHIVO${files.length === 1 ? '' : 'S'}` : 'SUELTA AQUÍ';
  const centerType = files.length > 1 ? 'DIAL' : first?.ext?.toUpperCase() || 'DIAL';
  return <main className="dial-overlay-root" onDragOver={(event) => event.preventDefault()} onDrop={drop}>
    <header className="overlay-head"><div className="overlay-brand"><img src={dialIconUrl} alt=""/><span><b>DIAL</b><small>ESPACIO RÁPIDO · LOCAL</small></span></div><div className="overlay-head-right"><kbd>Ctrl ⇧ D</kbd><button onClick={onClose} aria-label="Cerrar"><X size={17}/></button></div></header>
    <section className="overlay-wheel-wrap" aria-label="Acceso rápido de DIAL">
      <div className={`overlay-wheel ${scanning ? 'is-scanning' : ''}`}>
        <div className="overlay-wheel-rings"/>
        {wheelItems.slice(0, 8).map((item, index) => <button key={item.id} className={`overlay-wheel-item ${((mode === 'formats' && operation === 'convert' && format === item.id) || (mode === 'tools' && operation === item.id)) ? 'active' : ''}`} style={{ '--angle': `${360 / Math.max(wheelItems.length, 1) * index - 90}deg` }} title={mode === 'formats' ? `Convertir a ${item.label}` : item.label} onClick={() => choose(item)}>{mode === 'tools' && item.icon}<span>{item.label}</span></button>)}
        <button className="overlay-wheel-center" onClick={addFiles} title="Elegir archivos o soltarlos aquí"><span>{files.length ? fileIcon(first?.ext) : <Upload size={25}/>}</span><b>{centerType}</b><small>{scanning ? 'ANALIZANDO…' : centerLabel}</small></button>
      </div>
    </section>
    <nav className="overlay-toolbar"><div className="overlay-mode-switch"><button className={mode === 'formats' ? 'active' : ''} onClick={() => { setMode('formats'); setOperation('convert'); }}>Formatos</button><button className={mode === 'tools' ? 'active' : ''} onClick={() => { setMode('tools'); setOperation('optimize'); }}>Herramientas</button></div><button onClick={addFiles}><Plus size={14}/> Añadir</button></nav>
    <div className="overlay-selection">{files.length ? <><span title={files.map((file) => file.name).join('\n')}>{first.name}{files.length > 1 ? ` · +${files.length - 1}` : ''}{unsupported ? ` · ${unsupported} omitidos` : ''}</span><button onClick={() => { setFiles([]); setDirectories([]); setOutput(''); }} aria-label="Limpiar selección"><Trash2 size={13}/></button></> : <span>Arrastra un archivo aquí desde cualquier app o pulsa el centro</span>}</div>
    {truncated && <small className="overlay-warning">La carpeta supera el límite de 5.000 elementos.</small>}
    <footer className="overlay-footer"><span>{output ? <button onClick={() => window.dial.revealPath(output)}>Abrir resultado <ArrowUpRight size={12}/></button> : 'Originales intactos · procesamiento local'}</span><button className="overlay-full-tools" onClick={() => onOpenFiles(files.map((file) => file.path))}>Más opciones <ArrowRight size={13}/></button>{['convert','optimize','create-zip','remove-metadata','mute-video','snapshot-video','extract-audio'].includes(operation) && <button className="overlay-run" disabled={!operationFiles.length || busy || (operation === 'create-zip' && truncated) || (operation === 'convert' && !format)} onClick={run}>{busy ? 'Procesando…' : operation === 'convert' ? `Convertir ${format.toUpperCase()}` : operation === 'create-zip' ? 'Crear ZIP' : operation === 'remove-metadata' ? 'Quitar datos' : operation === 'mute-video' ? 'Quitar audio' : operation === 'snapshot-video' ? 'Fotograma' : operation === 'extract-audio' ? 'Extraer audio' : 'Comprimir'} <ArrowRight size={13}/></button>}</footer>
  </main>;
}

function QuickOverlayWindow() {
  const [paths, setPaths] = useState([]);
  const [session, setSession] = useState(0);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const open = (next) => { setPaths(next || []); setMessage(''); setSession((value) => value + 1); };
    const stop = window.dial.onQuickOpen(open);
    window.dial.quickState().then((state) => { if (state.active) open(state.paths); }).catch(() => {});
    return () => stop();
  }, []);
  return <><QuickOverlay key={session} paths={paths} onToast={setMessage}/>{message && <div className="overlay-message" role="status">{message}</div>}</>;
}

function HelpDialog({ onClose }) {
  const [tab, setTab] = useState('guide');
  const groups = [
    { title: 'Imágenes', items: [['Convertir y optimizar', 'Guarda una copia en otro formato o reduce su tamaño. BMP y SVG se rasterizan al exportar.'], ['Redimensionar y recortar', 'Cambia dimensiones o selecciona un rectángulo usando coordenadas en píxeles.'], ['Girar y ajustar color', 'Rota 90°, 180° o 270°; ajusta brillo, contraste y saturación.'], ['Ocultar área y quitar metadatos', 'Cubre una zona con un bloque opaco o exporta sin datos EXIF. Revisa el resultado antes de compartirlo.'], ['Collage', 'Combina hasta 20 imágenes en una cuadrícula configurable.'], ['GIF animado', 'Solo se procesa el primer fotograma; el resultado será una imagen fija.']] },
    { title: 'Audio y video', items: [['Convertir y comprimir', 'Usa FFmpeg incluido para recodificar medios compatibles. La calidad y el tamaño de salida dependen del formato y del archivo fuente.'], ['Recortar y cambiar velocidad', 'Selecciona un fragmento de audio o video, o ajusta su velocidad de reproducción.'], ['Audio', 'Normaliza volumen, cambia nivel, funde inicio/final, convierte a mono o edita etiquetas.'], ['Video', 'Quita el audio, recorta el encuadre, guarda un fotograma, extrae audio, divide o une videos.']] },
    { title: 'PDF, documentos y datos', items: [['PDF', 'Une documentos, divide páginas, gira o reordena páginas con miniaturas.'], ['Tablas', 'Convierte CSV a XLSX y XLSX a CSV.'], ['Texto', 'Convierte TXT a Markdown y Markdown a TXT; transforma subtítulos SRT y VTT.'], ['ZIP', 'Crea ZIP a partir de archivos o carpetas y extrae archivos ZIP.']] },
    { title: 'Formularios', items: [['Crear y editar', 'Diseña formularios con texto, números, listas, sí/no, fechas y adjuntos.'], ['Preguntas condicionales', 'Muestra una pregunta según la respuesta elegida en otra pregunta anterior.'], ['Respuestas', 'Guarda respuestas localmente y expórtalas a XLSX.']] },
  ];
  useEffect(() => { const onKey = (event) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onClose]);
  return <div className="help-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title"><header><div><span className="help-kicker"><BookOpen size={14}/> CENTRO DE AYUDA</span><h2 id="help-title">Conoce DIAL</h2><p>Guía rápida y explicación de las herramientas disponibles.</p></div><button className="icon-button" onClick={onClose} aria-label="Cerrar ayuda"><X size={18}/></button></header><nav className="help-tabs"><button className={tab === 'guide' ? 'active' : ''} onClick={() => setTab('guide')}>Tutorial</button><button className={tab === 'tools' ? 'active' : ''} onClick={() => setTab('tools')}>Herramientas</button><button className={tab === 'formats' ? 'active' : ''} onClick={() => setTab('formats')}>Formatos</button></nav><div className="help-content">{tab === 'guide' ? <><h3>Empieza en tres pasos</h3><ol className="help-steps"><li><b>Elige dónde trabajar</b><span>Usa Archivos para ver todas las opciones. Pulsa <kbd>Ctrl + Shift + D</kbd> desde cualquier aplicación para abrir solo la rueda flotante; la ventana principal se oculta mientras está activa.</span></li><li><b>Añade tu contenido</b><span>En Windows, mantén <kbd>Shift</kbd> mientras arrastras un archivo desde el Explorador para abrir la rueda cerca del cursor; suéltalo sobre el widget para analizarlo.</span></li><li><b>Elige una acción y revisa el resultado</b><span>Selecciona un formato o herramienta y pulsa el botón de acción. DIAL crea una copia y conserva el original; usa “Más opciones” para configurar detalles.</span></li></ol><div className="help-note"><ShieldCheck size={16}/><span><b>Privacidad local:</b> las conversiones se procesan en este equipo. Formularios y respuestas se guardan localmente. La sincronización requiere configurar un servidor aparte.</span></div><h3>Cola e historial</h3><p>En Archivos puedes ver el progreso, abrir resultados y reintentar trabajos fallidos o interrumpidos. Los trabajos se guardan en este equipo.</p></> : tab === 'tools' ? groups.map((group) => <section className="help-tool-group" key={group.title}><h3>{group.title}</h3>{group.items.map(([name, detail]) => <article key={name}><b>{name}</b><p>{detail}</p></article>)}</section>) : <><h3>Formatos que puedes seleccionar</h3><p className="help-format-intro">La rueda muestra solo salidas compatibles con el archivo seleccionado. Algunas combinaciones dependen de los códecs disponibles en el motor local; un formato admitido no garantiza que todo archivo fuente pueda convertirse.</p><div className="help-format-grid"><div><b>Imágenes</b><span>JPG, JPEG, PNG, WebP, AVIF, TIF, TIFF, BMP, GIF y SVG</span><small>GIF se aplana al primer fotograma; BMP y SVG se rasterizan.</small></div><div><b>Audio</b><span>MP3, M4A, WAV, FLAC, OGG, OPUS, AIFF, WMA</span></div><div><b>Video</b><span>MP4, MOV, MKV, WebM, AVI, WMV</span></div><div><b>Documentos y datos</b><span>PDF, DOCX, TXT, MD, CSV, XLSX, SRT, VTT, ZIP</span></div></div><p className="help-limits">DIAL no incluye aún sincronización completa con Tangerine/CouchDB ni envío directo a Blip. Consulta Ajustes para el estado de conexión y las actualizaciones.</p></>}</div><footer><span>DIAL · Procesamiento local</span><button className="primary-button" onClick={onClose}>Entendido</button></footer></section></div>;
}

function Sidebar({ page, navigate }) {
  const items = [
    { id: 'home', label: 'Inicio', icon: <Layers3/> },
    { id: 'files', label: 'Archivos', icon: <WandSparkles/> },
    { id: 'forms', label: 'Formularios', icon: <FilePlus2/> },
    { id: 'responses', label: 'Respuestas', icon: <ListFilter/> },
  ];
  return <aside className="sidebar">
    <div className="brand"><div className="brand-mark"><img src={dialIconUrl} alt="" /></div><div><b>DIAL</b><small>tu espacio local</small></div><button className="icon-button sidebar-more" aria-label="Más"><MoreHorizontal size={18}/></button></div>
    <div className="nav-label">ESPACIO DE TRABAJO</div>
    <nav>{items.map((item) => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}>{item.icon}<span>{item.label}</span>{item.id === 'responses' && <em>{item.id ? '' : ''}</em>}</button>)}</nav>
    <div className="sidebar-divider"></div>
    <div className="nav-label">HERRAMIENTAS RÁPIDAS</div>
    <button className="quick-card" onClick={() => navigate('files')}><div className="quick-icon violet"><AudioLines size={17}/></div><span>Audio y video</span><ChevronRight size={14}/></button>
    <button className="quick-card" onClick={() => navigate('files')}><div className="quick-icon blue"><FileText size={17}/></div><span>PDF y documentos</span><ChevronRight size={14}/></button>
    <div className="sidebar-spacer"></div>
    <div className="storage-card"><div className="storage-row"><span><HardDrive size={14}/> Datos en este equipo</span><LockKeyhole size={13}/></div><div className="storage-meter"><i/></div><small>Se guardan localmente</small></div>
    <button className={`nav-item settings-link ${page === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}><Settings2/><span>Ajustes</span></button>
    <div className="profile-row"><div className="avatar">D</div><div><b>Espacio personal</b><small>Windows · sin conexión</small></div><MoreHorizontal size={17}/></div>
  </aside>;
}

function Header({ page, navigate, sync, onHelp }) {
  const [shortcutReady, setShortcutReady] = useState(true);
  useEffect(() => { window.dial.quickShortcutStatus().then(setShortcutReady).catch(() => setShortcutReady(false)); }, []);
  const titles = { home: ['Resumen', 'Tu trabajo, en un solo lugar'], files: ['Herramientas de archivos', 'Convierte y edita en este equipo'], forms: ['Formularios', 'Diseña formularios y recopila respuestas offline'], responses: ['Respuestas', 'Registros guardados en este equipo'], settings: ['Ajustes', 'Personaliza DIAL para tu flujo'] };
  const [title, subtitle] = titles[page];
  return <header className="top-header"><div className="breadcrumb"><span>Espacio personal</span><ChevronRight size={14}/><b>{title}</b></div><div className="header-actions"><button className="quick-trigger" onClick={() => window.dial.quickOpen()} title={shortcutReady ? 'Abrir DIAL flotante con Ctrl+Shift+D' : 'Este atajo está ocupado. Usa este botón.'}><Command size={14}/> Rápido <kbd>{shortcutReady ? 'Ctrl+Shift+D' : 'atajo ocupado'}</kbd></button><div className={`sync-pill ${sync.configured ? 'connected' : ''}`}><i/>{sync.configured ? 'Servidor configurado' : 'Solo local'}</div><button className="help-button" onClick={onHelp} aria-label="Tutorial y herramientas" title="Tutorial y herramientas"><CircleHelp size={18}/></button><div className="header-avatar">D</div></div></header>;
}

function Home({ forms, responses, sync, navigate }) {
  return <div className="home-page page-enter">
    <section className="welcome-row"><div><div className="eyebrow"><Sparkles size={14}/> TU ESPACIO, A TU RITMO</div><h1>Todo listo para<br/><span>seguir creando.</span></h1><p>Trabaja con tus archivos y formularios. DIAL guarda tu trabajo aquí, en tu equipo.</p></div><div className="hero-art" aria-hidden="true"><div className="hero-orbit orbit-one"></div><div className="hero-orbit orbit-two"></div><div className="hero-core"><div className="brand-mark large"><img src={dialIconUrl} alt="" /></div></div><div className="float-chip chip-file"><FileImage size={17}/><span>archivo</span></div><div className="float-chip chip-form"><FileText size={17}/><span>formulario</span></div><div className="float-chip chip-wave"><AudioLines size={16}/></div></div></section>
    <section className="status-banner"><div className="status-icon"><ShieldCheck size={20}/></div><div><b>Tus archivos se procesan en este equipo</b><p>No se suben a un convertidor web. El servidor de formularios se configura aparte.</p></div><div className="status-right"><span className="status-dot"/>Guardado local</div></section>
    <section className="section-heading"><div><h2>¿Qué quieres hacer?</h2><p>Empieza con una tarea rápida.</p></div></section>
    <section className="action-grid">
      <button className="action-card files-action" onClick={() => navigate('files')}><div className="action-icon"><WandSparkles size={19}/></div><div className="action-title">Trabajar con archivos <ArrowUpRight size={16}/></div><p>Convierte imágenes, audio, video, PDF y más.</p><div className="action-footer"><span>Soltar archivos para empezar</span><ArrowRight size={15}/></div><div className="action-decoration decor-files"><FileAudio/><FileImage/><FileVideo/></div></button>
      <button className="action-card forms-action" onClick={() => navigate('forms')}><div className="action-icon"><FilePlus2 size={19}/></div><div className="action-title">Crear un formulario <ArrowUpRight size={16}/></div><p>Diseña preguntas y recopila respuestas offline.</p><div className="action-footer"><span>{forms.length} formularios · {responses.length} respuestas</span><ArrowRight size={15}/></div><div className="action-decoration decor-forms"><div className="decor-check"><Check/></div><div className="decor-lines"><i/><i/><i/></div></div></button>
    </section>
    <section className="home-bottom"><div className="recent-card"><div className="card-title-row"><div><h3>Actividad reciente</h3><p>Lo último que hiciste en DIAL.</p></div><button className="text-button" onClick={() => navigate('responses')}>Ver respuestas <ArrowRight size={14}/></button></div>{responses.length ? responses.slice(0, 3).map((item) => <div className="recent-item" key={item.id}><div className="recent-icon"><FileText size={17}/></div><div><b>{item.formTitle || 'Respuesta de formulario'}</b><small>{new Date(item.createdAt).toLocaleString()}</small></div><BadgeCheck size={16} className="recent-check"/></div>) : <div className="empty-recent"><div className="empty-stack"><FileText size={21}/></div><span>Tu actividad aparecerá aquí cuando guardes tu primer trabajo.</span></div>}</div>
      <div className="connection-card"><div className="card-title-row"><div><h3>Conexión</h3><p>Estado de tus datos y servidor.</p></div><div className={`connection-illustration ${sync.configured ? 'online' : ''}`}><Cloud size={19}/><i/></div></div><div className="connection-state"><span className="connection-indicator"/><b>{sync.configured ? 'Servidor configurado' : 'Modo local'}</b></div><p className="connection-description">{sync.configured ? sync.message : 'Configura una instancia compatible para sincronizar formularios y respuestas.'}</p><button className="outline-button" onClick={() => navigate('settings')}>Configurar conexión <ArrowRight size={14}/></button></div></section>
    <footer className="page-footer"><span>DIAL guarda tus archivos y respuestas en este equipo.</span><span>Acerca de DIAL <span className="footer-separator">·</span> Privacidad</span></footer>
  </div>;
}

function FilesPage({ settings, onToast, quickPaths = [] }) {
  const [files, setFiles] = useState([]); const [format, setFormat] = useState(''); const [operation, setOperation] = useState('convert');
  const [folderRoot, setFolderRoot] = useState(''); const [folderTruncated, setFolderTruncated] = useState(false);
  const [radialMode, setRadialMode] = useState('formats');
  const [wheelPage, setWheelPage] = useState(0);
  const [options, setOptions] = useState({ quality: settings?.imageQuality || 84, start: '00:00:00', duration: '00:00:15', startSeconds: 0, endSeconds: 15, speed: 1.25, volume: 1.25, fadeSeconds: 2, brightness: 100, contrast: 100, saturation: 100, title: '', artist: '', album: '', comment: '', width: 1280, height: 1280, x: 0, y: 0, rotation: 90, timestamp: '00:00:01', pageOrder: '', columns: 2, cellWidth: 480, cellHeight: 480, gap: 16, background: '#fff7e8' });
  const [jobs, setJobs] = useState([]); const [savedJobs, setSavedJobs] = useState([]); const [mediaDetails, setMediaDetails] = useState({}); const [framePreview, setFramePreview] = useState('');
  const [busy, setBusy] = useState(false); const [dragging, setDragging] = useState(false); const [jobId, setJobId] = useState('');
  const supportedFormats = useMemo(() => {
    if (operation === 'split-pdf' || operation === 'merge-pdf' || operation === 'extract-zip') return [operation === 'extract-zip' ? 'zip' : 'pdf'];
    if (operation === 'create-zip') return ['zip'];
    if (operation === 'create-collage') return ['png'];
    if (!files.length) return [];
    if (operation !== 'convert') return [];
    return files.map((file) => FORMAT_MATRIX[file.ext] || []).reduce((common, formats) => common.filter((item) => formats.includes(item)), FORMAT_MATRIX[files[0].ext] || []);
  }, [files, operation]);
  useEffect(() => { if (supportedFormats.length && !supportedFormats.includes(format)) setFormat(supportedFormats[0]); }, [supportedFormats, format]);
  useEffect(() => {
    if (!window.dial?.onProgress) return undefined;
    return window.dial.onProgress((progress) => {
      setJobs((items) => items.map((item) => item.path === progress.file ? { ...item, progress: progress.progress, status: progress.status, output: progress.output || item.output, error: progress.error } : item));
      setSavedJobs((items) => items.map((item) => item.id === progress.jobId ? { ...item, progress: progress.progress, currentFile: progress.file } : item));
    });
  }, []);
  useEffect(() => { window.dial.jobsList().then((items) => setSavedJobs(items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))).catch(() => {}); }, []);
  const addPaths = async (paths) => {
    const expanded = await window.dial.expandPaths(paths);
    if (expanded.truncated) setFolderTruncated(true);
    const existing = new Set(files.map((file) => file.path));
    const next = expanded.files.filter((file) => !existing.has(file.path));
    if (expanded.directories.length === 1) setFolderRoot(expanded.directories[0]);
    setFiles((items) => [...items, ...next]);
    next.forEach(async (file) => { if (['mp4','mov','mkv','webm','avi','wmv','mp3','m4a','wav','flac','ogg','opus','aiff','wma'].includes(file.ext)) { try { const details = await window.dial.mediaInfo(file.path); setMediaDetails((items) => ({ ...items, [file.path]: details })); } catch {} } });
    if (expanded.unsupported) onToast(`${expanded.unsupported} archivos se omitieron porque todavía no tienen una operación compatible.`, 'error');
    if (expanded.truncated) onToast('Se analizaron hasta 5.000 archivos para mantener DIAL ágil.', 'error');
  };
  useEffect(() => { if (quickPaths.length) addPaths(quickPaths); }, [quickPaths.join('|')]);
  const onDrop = async (event) => { event.preventDefault(); setDragging(false); const paths = Array.from(event.dataTransfer.files).map((file) => window.dial.pathForFile(file)).filter(Boolean); await addPaths(paths); };
  const selectFiles = async () => addPaths(await window.dial.chooseFiles());
  const selectFolder = async () => addPaths(await window.dial.chooseFolderForFiles());
  const start = async (savedJob = null) => {
    const activeOperation = savedJob?.operation || operation; const activeFormat = savedJob?.format || format;
    const activeOptions = savedJob?.options || (operation === 'create-zip' && folderRoot ? { ...options, archiveRoot: folderRoot } : options); const activeSettings = savedJob?.settings || settings;
    const selectedFiles = savedJob ? savedJob.files : operationFiles;
    if (!selectedFiles.length || (activeOperation === 'convert' && !activeFormat) || (activeOperation === 'create-zip' && folderTruncated) || busy) return;
    const id = crypto.randomUUID(); setJobId(id); setBusy(true);
    const jobSettings = { outputFolder: activeSettings?.outputFolder || '', imageQuality: activeSettings?.imageQuality, audioBitrate: activeSettings?.audioBitrate, videoCrf: activeSettings?.videoCrf, keepOriginal: activeSettings?.keepOriginal };
    const jobFiles = ['merge-pdf','create-zip','create-collage','join-video'].includes(activeOperation) ? [{ ...selectedFiles[0], name: activeOperation === 'merge-pdf' ? `${selectedFiles.length} archivos PDF` : activeOperation === 'create-zip' ? `ZIP · ${selectedFiles.length} archivos` : activeOperation === 'join-video' ? `${selectedFiles.length} videos unidos` : `Collage · ${selectedFiles.length} imágenes` }] : selectedFiles;
    const initial = jobFiles.map((file) => ({ ...file, progress: 0, status: 'processing', operation: activeOperation })); setJobs(initial);
    const jobRecord = { id, retryOf: savedJob?.id || '', operation: activeOperation, format: activeFormat, options: activeOptions, settings: jobSettings, files: selectedFiles, status: 'processing', progress: 0, createdAt: new Date().toISOString(), results: [] };
    try {
      await window.dial.jobSave(jobRecord); setSavedJobs((items) => [jobRecord, ...items]);
      const rawResults = await window.dial.convert({ files: selectedFiles.map((file) => file.path), format: activeOperation === 'convert' ? activeFormat : undefined, operation: activeOperation, options: activeOptions, settings: activeSettings, jobId: id });
      const aggregate = ['merge-pdf','create-zip','create-collage','join-video'].includes(activeOperation);
      const results = await Promise.all(rawResults.map(async (result) => { const source = selectedFiles.find((file) => file.path === result.input); let beforeSize = aggregate ? selectedFiles.reduce((total, file) => total + (file.size || 0), 0) : source?.size || 0; let afterSize = null; try { if (!beforeSize) beforeSize = (await window.dial.fileInfo(result.input)).size; const stat = result.output ? await window.dial.fileInfo(result.output) : null; if (stat?.isFile) afterSize = stat.size; } catch {} return { ...result, beforeSize, afterSize, changePercent: beforeSize && afterSize !== null ? Math.round((afterSize - beforeSize) / beforeSize * 100) : null }; }));
      setJobs(initial.map((file) => { const result = results.find((item) => item.input === file.path) || (aggregate ? results[0] : undefined); const status = result?.status || (results.some((item) => item.status === 'cancelled') ? 'cancelled' : 'error'); return { ...file, progress: status === 'done' ? 100 : 0, status, output: result?.output, error: result?.error || (status === 'cancelled' ? 'Cancelado por el usuario.' : undefined), beforeSize: result?.beforeSize, afterSize: result?.afterSize, changePercent: result?.changePercent }; }));
      const jobStatus = results.some((item) => item.status === 'cancelled') ? 'cancelled' : results.length && results.every((item) => item.status === 'done') ? 'done' : 'error';
      const completedJob = { ...jobRecord, status: jobStatus, progress: 100, results };
      await window.dial.jobSave(completedJob); setSavedJobs((items) => items.map((item) => item.id === id ? completedJob : item));
      const completed = results.filter((item) => item.status === 'done').length;
      onToast(results.some((item) => item.status === 'cancelled') ? 'Trabajo cancelado. Los originales se conservaron.' : `${completed} de ${results.length} archivos procesados${completed === results.length ? '' : ' · los fallidos conservan su original'}`, completed ? 'success' : 'error');
    } catch (error) { await window.dial.jobSave({ ...jobRecord, status: 'error', error: error.message }); setSavedJobs((items) => items.map((item) => item.id === id ? { ...item, status: 'error', error: error.message } : item)); onToast(error.message || 'No se pudo iniciar el trabajo.', 'error'); }
    finally { setBusy(false); }
  };
  const clear = () => { if (busy) return; setFiles([]); setJobs([]); setFormat(''); setFolderRoot(''); setFolderTruncated(false); };
  const mediaFiles = files.some((file) => [...IMAGE_TYPES,'mp3','m4a','wav','flac','ogg','opus','aiff','wma','mp4','mov','mkv','webm','avi','wmv'].includes(file.ext));
  const videoFiles = files.some((file) => ['mp4','mov','mkv','webm','avi','wmv'].includes(file.ext));
  const audioFiles = files.some((file) => ['mp3','m4a','wav','flac','ogg','opus','aiff','wma'].includes(file.ext));
  const operationFiles = operation === 'optimize' ? files.filter((file) => [...IMAGE_TYPES,'mp3','m4a','wav','flac','ogg','opus','aiff','wma','mp4','mov','mkv','webm','avi','wmv'].includes(file.ext))
    : ['normalize-audio','mono-audio','volume-audio','fade-audio'].includes(operation) ? files.filter((file) => ['mp3','m4a','wav','flac','ogg','opus','aiff','wma'].includes(file.ext))
    : ['trim-video','speed-video','split-video'].includes(operation) ? files.filter((file) => ['mp4','mov','mkv','webm','avi','wmv'].includes(file.ext))
    : operation === 'join-video' ? files.filter((file) => ['mp4','mov','mkv','webm','avi','wmv'].includes(file.ext))
    : ['trim-audio','speed-audio','normalize-audio','mono-audio','volume-audio','fade-audio'].includes(operation) ? files.filter((file) => ['mp3','m4a','wav','flac','ogg','opus','aiff','wma'].includes(file.ext))
    : operation === 'metadata-media' ? files.filter((file) => ['mp3','m4a','wav','flac','ogg','opus','aiff','wma','mp4','mov','mkv','webm','avi','wmv'].includes(file.ext))
    : operation === 'extract-audio' ? files.filter((file) => ['mp4','mov','mkv','webm','avi','wmv'].includes(file.ext))
    : operation === 'create-collage' ? files.filter((file) => IMAGE_TYPES.includes(file.ext)).slice(0, 20)
    : ['resize-image','rotate-image','remove-metadata','crop-image','adjust-image','redact-image'].includes(operation) ? files.filter((file) => IMAGE_TYPES.includes(file.ext))
    : ['snapshot-video','crop-video','mute-video'].includes(operation) ? files.filter((file) => ['mp4','mov','mkv','webm','avi','wmv'].includes(file.ext))
    : ['split-pdf','merge-pdf'].includes(operation) ? files.filter((file) => file.ext === 'pdf')
    : ['rotate-pdf','organize-pdf'].includes(operation) ? files.filter((file) => file.ext === 'pdf')
    : operation === 'extract-zip' ? files.filter((file) => file.ext === 'zip') : files;
  const trimFile = operationFiles[0]; const trimDuration = trimFile ? mediaDetails[trimFile.path]?.duration || 0 : 0;
  const trimStart = Math.min(Math.max(0, Number(options.startSeconds) || 0), Math.max(0, trimDuration - 1));
  const trimEnd = Math.max(trimStart + 1, Math.min(trimDuration || Number(options.endSeconds) || 15, Number(options.endSeconds) || 15));
  const setTrimPoint = (which, value) => { const point = Number(value); const startSeconds = which === 'start' ? Math.min(point, trimEnd - 1) : trimStart; const endSeconds = which === 'end' ? Math.max(point, startSeconds + 1) : trimEnd; setOptions((current) => ({ ...current, startSeconds, endSeconds, start: formatTime(startSeconds), duration: formatTime(endSeconds - startSeconds) })); };
  useEffect(() => {
    if (!['trim-video','trim-audio'].includes(operation) || !trimFile) { setFramePreview(''); return undefined; }
    let alive = true; const timer = setTimeout(() => {
      const preview = operation === 'trim-video' ? window.dial.previewFrame(trimFile.path, trimStart) : window.dial.previewWaveform(trimFile.path, trimStart, trimEnd - trimStart);
      preview.then((image) => { if (alive) setFramePreview(image); }).catch(() => { if (alive) setFramePreview(''); });
    }, 280);
    return () => { alive = false; clearTimeout(timer); };
  }, [operation, trimFile?.path, trimStart, trimEnd]);
  const radialTools = [
    ...(mediaFiles ? [{ id: 'optimize', label: 'Comprimir', icon: <Zap size={15}/>, detail: 'Reduce el tamaño' }] : []),
    ...(files.some((file) => IMAGE_TYPES.includes(file.ext)) ? [{ id: 'resize-image', label: 'Redimensionar', icon: <Image size={15}/>, detail: 'Ajusta ancho y alto' }, { id: 'crop-image', label: 'Recortar imagen', icon: <Scissors size={15}/>, detail: 'Define un área en píxeles' }, { id: 'rotate-image', label: 'Girar imagen', icon: <RefreshCw size={15}/>, detail: 'Rota en pasos de 90°' }, { id: 'adjust-image', label: 'Ajustar color', icon: <Image size={15}/>, detail: 'Brillo, contraste y saturación' }, { id: 'redact-image', label: 'Ocultar área', icon: <ShieldCheck size={15}/>, detail: 'Cubre con un bloque opaco' }, { id: 'remove-metadata', label: 'Quitar metadatos', icon: <File size={15}/>, detail: 'Elimina EXIF al exportar' }] : []),
    ...(files.filter((file) => IMAGE_TYPES.includes(file.ext)).length >= 2 ? [{ id: 'create-collage', label: 'Crear collage', icon: <Layers3 size={15}/>, detail: 'Combina de 2 a 20 imágenes en una cuadrícula' }] : []),
    ...(audioFiles ? [{ id: 'normalize-audio', label: 'Normalizar', icon: <AudioLines size={15}/>, detail: 'Iguala el volumen' }, { id: 'volume-audio', label: 'Volumen', icon: <AudioLines size={15}/>, detail: 'Ajusta el nivel de salida' }, { id: 'fade-audio', label: 'Fundido', icon: <AudioLines size={15}/>, detail: 'Suaviza inicio y final' }, { id: 'metadata-media', label: 'Metadatos audio', icon: <File size={15}/>, detail: 'Edita título, artista y álbum' }] : []),
    ...(audioFiles ? [{ id: 'trim-audio', label: 'Recortar audio', icon: <Scissors size={15}/>, detail: 'Guarda un fragmento' }, { id: 'mono-audio', label: 'Canal mono', icon: <AudioLines size={15}/>, detail: 'Convierte a un canal' }, { id: 'speed-audio', label: 'Velocidad audio', icon: <Gauge size={15}/>, detail: 'Cambia el ritmo' }] : []),
    ...(videoFiles ? [{ id: 'trim-video', label: 'Recortar video', icon: <Scissors size={15}/>, detail: 'Ajusta la duración' }, { id: 'crop-video', label: 'Recortar encuadre', icon: <Image size={15}/>, detail: 'Corta por coordenadas' }, { id: 'mute-video', label: 'Quitar audio', icon: <AudioLines size={15}/>, detail: 'Exporta el video sin sonido' }, { id: 'speed-video', label: 'Velocidad', icon: <Gauge size={15}/>, detail: 'Cambia el ritmo' }, { id: 'extract-audio', label: 'Extraer audio', icon: <FileAudio size={15}/>, detail: 'Guarda solo el audio' }, { id: 'snapshot-video', label: 'Fotograma', icon: <Image size={15}/>, detail: 'Guarda un cuadro como PNG' }, { id: 'metadata-media', label: 'Metadatos video', icon: <File size={15}/>, detail: 'Añade título y comentario' }, { id: 'split-video', label: 'Dividir video', icon: <Scissors size={15}/>, detail: 'Divide en partes iguales' }, ...(operationFiles.length > 1 ? [{ id: 'join-video', label: 'Unir videos', icon: <Layers3 size={15}/>, detail: 'Combina los videos seleccionados' }] : [])] : []),
    ...(files.some((file) => file.ext === 'pdf') ? [{ id: 'rotate-pdf', label: 'Girar páginas PDF', icon: <RefreshCw size={15}/>, detail: 'Rota todas las páginas' }] : []),
    ...(files.length === 1 && files[0].ext === 'pdf' ? [{ id: 'organize-pdf', label: 'Ordenar PDF', icon: <Layers3 size={15}/>, detail: 'Reordena o elimina páginas' }] : []),
    ...(files.length > 1 && files.every((file) => file.ext === 'pdf') ? [{ id: 'merge-pdf', label: 'Unir PDF', icon: <Layers3 size={15}/>, detail: 'Combina documentos' }] : []),
    ...(files.some((file) => file.ext === 'pdf') && files.every((file) => file.ext === 'pdf') ? [{ id: 'split-pdf', label: 'Dividir PDF', icon: <Scissors size={15}/>, detail: 'Una página por archivo' }] : []),
    ...(files.some((file) => file.ext === 'zip') ? [{ id: 'extract-zip', label: 'Extraer ZIP', icon: <FileArchive size={15}/>, detail: 'Descomprime aquí' }] : []),
    ...(files.length ? [{ id: 'create-zip', label: 'Crear ZIP', icon: <FileArchive size={15}/>, detail: 'Agrupa tus archivos' }] : []),
  ];
  const toolPageCount = Math.max(1, Math.ceil(radialTools.length / 8));
  const wheelItems = radialMode === 'formats' ? supportedFormats.slice(0, 8).map((item) => ({ id: item, label: item.toUpperCase() })) : radialTools.slice(wheelPage * 8, wheelPage * 8 + 8);
  const chooseWheelItem = (item) => {
    if (radialMode === 'formats') { setOperation('convert'); setFormat(item.id); }
    else { setOperation(item.id); setFormat(item.id === 'extract-audio' ? 'mp3' : item.id === 'create-collage' ? 'png' : ['create-zip','extract-zip'].includes(item.id) ? 'zip' : ['merge-pdf','split-pdf','rotate-pdf','organize-pdf'].includes(item.id) ? 'pdf' : ['join-video','split-video'].includes(item.id) ? 'mp4' : ''); }
  };

  return <div className="files-page page-enter">
    <div className="page-intro"><div><div className="eyebrow"><WandSparkles size={14}/> MOTOR LOCAL</div><h1>De archivo a <span>hecho.</span></h1><p>Arrastra, elige qué necesitas y sigue con tu trabajo. El original se queda intacto.</p></div><div className="local-badge"><LockKeyhole size={14}/> Procesamiento en este equipo</div></div>
    <div className="radial-workspace">
      <section className={`radial-stage ${dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={onDrop}>
        <div className="radial-stage-head"><div><span className="radial-kicker">ESPACIO DE ARCHIVOS</span><h2>{files.length ? '¿Qué hacemos con tus archivos?' : 'Suelta archivos o una carpeta'}</h2><p>{files.length ? `${files.length} ${files.length === 1 ? 'archivo listo' : 'archivos listos'}${folderRoot ? ' · carpeta analizada' : ''} · originales protegidos` : 'DIAL analiza los tipos y propone operaciones que puede ejecutar.'}</p></div><div className="radial-pick-actions"><button className="quiet-button" onClick={selectFolder}><FolderOpen size={16}/> Carpeta</button><button className="quiet-button" onClick={selectFiles}><FolderOpen size={16}/> Archivos</button></div></div>
        <div className="radial-control">
          <div className="format-wheel" aria-label={radialMode === 'formats' ? 'Formatos compatibles' : 'Herramientas disponibles'}>
            <div className="wheel-rings"/>
            {wheelItems.map((item, index) => { const angle = (360 / Math.max(wheelItems.length, 1)) * index - 90; const active = radialMode === 'formats' ? operation === 'convert' && format === item.id : operation === item.id; return <button key={item.id} title={item.detail || `Convertir a ${item.label}`} className={`wheel-item ${active ? 'selected' : ''} ${radialMode === 'tools' ? 'tool-wheel-item' : ''}`} style={{ '--angle': `${angle}deg`, '--count': wheelItems.length }} onClick={() => chooseWheelItem(item)} disabled={!files.length}>{radialMode === 'tools' && item.icon}<span>{item.label}</span></button>; })}
            <div className="wheel-center" onDragOver={(event) => event.preventDefault()}><div className="wheel-center-icon">{files.length ? fileIcon(files[0].ext) : <Upload size={22}/>}</div><b>{files.length ? files[0].ext.toUpperCase() : 'DIAL'}</b><small>{files.length ? `${files.length} archivo${files.length === 1 ? '' : 's'}` : 'SUELTA AQUÍ'}</small></div>
          </div>
        </div>
        <div className="radial-toolbar"><div className="wheel-mode-switch"><button className={radialMode === 'formats' ? 'active' : ''} onClick={() => { setRadialMode('formats'); setOperation('convert'); }}>Formatos</button><button className={radialMode === 'tools' ? 'active' : ''} onClick={() => { setRadialMode('tools'); setWheelPage(0); }}>Herramientas</button></div><span className="wheel-hint">{files.length ? (radialMode === 'formats' ? 'Elige el formato de salida' : 'Acciones para este tipo de archivo') : 'Acepta audio, video, imágenes, PDF y documentos'}</span>{radialMode === 'tools' && toolPageCount > 1 && <div className="wheel-pages"><button onClick={() => setWheelPage((page) => Math.max(0, page - 1))} disabled={wheelPage === 0} aria-label="Herramientas anteriores">‹</button><span>{wheelPage + 1}/{toolPageCount}</span><button onClick={() => setWheelPage((page) => Math.min(toolPageCount - 1, page + 1))} disabled={wheelPage >= toolPageCount - 1} aria-label="Más herramientas">›</button></div>}<button className="add-file-round" onClick={selectFiles}><Plus size={16}/> Añadir archivos</button></div>
      </section>
      <aside className="radial-side">
        <div className="radial-side-head"><div><span className="radial-kicker">SELECCIÓN</span><h3>Tus archivos</h3></div><span className="file-count-pill">{files.length}</span></div>
        {!files.length ? <button className="drop-hint-card" onClick={selectFiles}><span className="drop-hint-icon"><Upload size={19}/></span><b>Arrastra aquí</b><small>o selecciona desde tu equipo</small><span className="drop-hint-link">Explorar archivos <ArrowRight size={13}/></span></button> : <div className="radial-file-list">{files.map((file) => <div className="radial-file-row" key={file.path}><div className={`filetype ${category(file.ext).toLowerCase()}`}>{fileIcon(file.ext)}</div><div className="file-info"><b title={file.name}>{file.name}</b><span>{file.ext.toUpperCase()} · {formatSize(file.size)}</span></div><button className="icon-button small" aria-label={`Quitar ${file.name}`} onClick={() => setFiles((items) => items.filter((item) => item.path !== file.path))}><X size={14}/></button></div>)}<button className="add-more" onClick={selectFiles}><Plus size={14}/> Añadir más</button></div>}
        <div className="operation-card"><div className="operation-card-head"><span className="operation-card-icon">{radialMode === 'formats' ? <RefreshCw size={15}/> : <WandSparkles size={15}/>}</span><div><b>{operation === 'convert' ? `Convertir a ${format ? format.toUpperCase() : '…'}` : radialTools.find((tool) => tool.id === operation)?.label || 'Herramienta'}</b><small>{operation === 'convert' ? 'Se creará una copia nueva' : `${operationFiles.length} archivo${operationFiles.length === 1 ? '' : 's'} compatible${operationFiles.length === 1 ? '' : 's'}`}</small></div></div>
        {['trim-video','trim-audio'].includes(operation) && <div className="trim-editor"><div className="trim-editor-head"><b>Selecciona el fragmento</b><span>{trimDuration ? `${formatTime(trimStart)} — ${formatTime(trimEnd)} · ${formatTime(trimEnd - trimStart)}` : 'Leyendo duración…'}</span></div><div className="trim-preview">{framePreview ? <img src={framePreview} alt={operation === 'trim-video' ? 'Fotograma en el inicio seleccionado' : 'Forma de onda del segmento seleccionado'}/> : <div>{operation === 'trim-video' ? <FileVideo size={22}/> : <AudioLines size={22}/>}<span>{operation === 'trim-video' ? 'Vista previa del fotograma' : 'Vista previa de la forma de onda'}</span></div>}</div><label className="trim-slider-label">Inicio <b>{formatTime(trimStart)}</b><input type="range" min="0" max={Math.max(1, trimDuration - 1)} step="1" value={trimStart} disabled={!trimDuration} onChange={(event) => setTrimPoint('start', event.target.value)}/></label><label className="trim-slider-label">Fin <b>{formatTime(trimEnd)}</b><input type="range" min={Math.min(trimDuration || 1, trimStart + 1)} max={Math.max(1, trimDuration)} step="1" value={Math.min(trimEnd, trimDuration || trimEnd)} disabled={!trimDuration} onChange={(event) => setTrimPoint('end', event.target.value)}/></label><div className="trim-track"><i style={{ left: `${trimDuration ? trimStart / trimDuration * 100 : 0}%`, width: `${trimDuration ? (trimEnd - trimStart) / trimDuration * 100 : 0}%` }}/></div>{!trimDuration && <small>Comprueba que el archivo se pueda leer. También puedes indicar manualmente inicio y duración.</small>}<div className="option-fields trim-manual"><label>Inicio<input value={options.start} onChange={(event) => setOptions((current) => ({ ...current, start: event.target.value }))}/></label><label>Duración<input value={options.duration} onChange={(event) => setOptions((current) => ({ ...current, duration: event.target.value }))}/></label></div></div>}
        {['speed-video','speed-audio'].includes(operation) && <label className="range-field">Velocidad <b>{options.speed}×</b><input type="range" min="0.5" max="2" step="0.25" value={options.speed} onChange={(event) => setOptions({ ...options, speed: Number(event.target.value) })}/></label>}
        {operation === 'volume-audio' && <label className="range-field">Volumen de salida <b>{Math.round(options.volume * 100)}%</b><input type="range" min="10" max="300" step="5" value={Math.round(options.volume * 100)} onChange={(event) => setOptions({ ...options, volume: Number(event.target.value) / 100 })}/></label>}
        {operation === 'fade-audio' && <label className="range-field">Duración del fundido <b>{options.fadeSeconds} s</b><input type="range" min="1" max="10" step="0.5" value={options.fadeSeconds} onChange={(event) => setOptions({ ...options, fadeSeconds: Number(event.target.value) })}/><small>Aplica entrada y salida progresivas al audio.</small></label>}
        {operation === 'split-video' && <label className="range-field">Duración de cada parte <b>{options.segmentSeconds || 60} s</b><input type="range" min="5" max="600" step="5" value={options.segmentSeconds || 60} onChange={(event) => setOptions((current) => ({ ...current, segmentSeconds: Number(event.target.value) }))}/><small>Se crea una carpeta con segmentos MP4; el video original se conserva.</small></label>}
        {operation === 'adjust-image' && <div className="image-adjust-controls">{[['brightness','Brillo'],['contrast','Contraste'],['saturation','Saturación']].map(([key,label]) => <label className="range-field" key={key}>{label} <b>{options[key]}%</b><input type="range" min="0" max="200" step="5" value={options[key]} onChange={(event) => setOptions((current) => ({ ...current, [key]: Number(event.target.value) }))}/></label>)}</div>}
        {operation === 'metadata-media' && <div className="form-tool-fields"><label>Título<input value={options.title} onChange={(event) => setOptions((current) => ({ ...current, title: event.target.value }))} placeholder="Título del archivo"/></label><label>Artista<input value={options.artist} onChange={(event) => setOptions((current) => ({ ...current, artist: event.target.value }))} placeholder="Nombre del autor"/></label><label>Álbum<input value={options.album} onChange={(event) => setOptions((current) => ({ ...current, album: event.target.value }))} placeholder="Álbum o proyecto"/></label><label>Comentario<input value={options.comment} onChange={(event) => setOptions((current) => ({ ...current, comment: event.target.value }))} placeholder="Nota breve"/></label><small>El resultado se vuelve a codificar y conserva el archivo original.</small></div>}
        {operation === 'resize-image' && <div className="option-fields"><label>Ancho máximo<input type="number" min="1" max="20000" value={options.width} onChange={(event) => setOptions({ ...options, width: Number(event.target.value) })}/></label><label>Alto máximo<input type="number" min="1" max="20000" value={options.height} onChange={(event) => setOptions({ ...options, height: Number(event.target.value) })}/></label></div>}
        {['crop-image','crop-video','redact-image'].includes(operation) && <div className="option-fields crop-grid"><label>Izquierda · X<input type="number" min="0" value={options.x} onChange={(event) => setOptions({ ...options, x: Number(event.target.value) })}/></label><label>Arriba · Y<input type="number" min="0" value={options.y} onChange={(event) => setOptions({ ...options, y: Number(event.target.value) })}/></label><label>{operation === 'redact-image' ? 'Ancho a ocultar' : 'Ancho'}<input type="number" min="2" value={options.width} onChange={(event) => setOptions({ ...options, width: Number(event.target.value) })}/></label><label>{operation === 'redact-image' ? 'Alto a ocultar' : 'Alto'}<input type="number" min="2" value={options.height} onChange={(event) => setOptions({ ...options, height: Number(event.target.value) })}/></label></div>}
        {operation === 'organize-pdf' && operationFiles[0] && <PdfPagePicker key={operationFiles[0].path} filePath={operationFiles[0].path} value={options.pageOrder} onChange={(pageOrder) => setOptions((current) => ({ ...current, pageOrder }))}/>}
        {operation === 'create-collage' && <><div className="option-fields"><label>Columnas<input type="number" min="1" max="5" value={options.columns} onChange={(event) => setOptions({ ...options, columns: Number(event.target.value) })}/></label><label>Separación · px<input type="number" min="0" max="96" value={options.gap} onChange={(event) => setOptions({ ...options, gap: Number(event.target.value) })}/></label></div><div className="option-fields"><label>Ancho por cuadro<input type="number" min="160" max="1600" value={options.cellWidth} onChange={(event) => setOptions({ ...options, cellWidth: Number(event.target.value) })}/></label><label>Alto por cuadro<input type="number" min="160" max="1600" value={options.cellHeight} onChange={(event) => setOptions({ ...options, cellHeight: Number(event.target.value) })}/></label></div><label className="range-field">Color de fondo<input type="color" value={options.background} onChange={(event) => setOptions({ ...options, background: event.target.value })}/><small>Se usarán las primeras 20 imágenes compatibles.</small></label></>}
        {['rotate-image','rotate-pdf'].includes(operation) && <label className="range-field">Rotación <select value={options.rotation} onChange={(event) => setOptions({ ...options, rotation: Number(event.target.value) })}><option value="90">90° a la derecha</option><option value="180">180°</option><option value="270">90° a la izquierda</option></select></label>}
        {operation === 'snapshot-video' && <label className="range-field">Momento del fotograma<input value={options.timestamp} onChange={(event) => setOptions({ ...options, timestamp: event.target.value })} placeholder="00:00:01"/></label>}
        {operation === 'optimize' && <label className="range-field">{files.some((file) => IMAGE_TYPES.includes(file.ext)) ? 'Calidad de imagen' : videoFiles ? 'Compresión de video' : 'Calidad de audio'} <b>{options.quality}%</b><input type="range" min="55" max="95" step="1" value={options.quality} onChange={(event) => setOptions({ ...options, quality: Number(event.target.value), crf: Math.round(35 - Number(event.target.value) * 0.2), bitrate: `${Math.round(64 + Number(event.target.value) * 1.3)}k` })}/></label>}
        <div className="panel-summary"><div className="summary-icon"><Zap size={15}/></div><span>{operation !== 'convert' && operationFiles.length < files.length ? <>Se procesarán <b>{operationFiles.length} de {files.length} archivos compatibles.</b></> : operation === 'convert' ? <>Conversión local <b>sin subir tus archivos</b></> : <>El original queda intacto. <b>Se crea una copia nueva.</b></>}</span></div>
        {folderTruncated && <p className="quick-limit-warning">El análisis se limitó a 5.000 elementos. Comprimir la carpeta está desactivado para evitar un ZIP incompleto.</p>}
        <button className="primary-button convert-button" onClick={busy ? () => window.dial.cancel(jobId) : start} disabled={!operationFiles.length || (!busy && operation === 'join-video' && operationFiles.length < 2) || (!busy && operation === 'create-zip' && folderTruncated) || (!busy && operation === 'convert' && !format) || (!busy && operation === 'organize-pdf' && !options.pageOrder.trim())}>{busy ? <><span className="button-spinner"/> Cancelar trabajo</> : <><WandSparkles size={16}/> {operation === 'convert' ? 'Convertir archivos' : 'Aplicar herramienta'}<ArrowRight size={15}/></>}</button>
        <div className="secondary-actions"><button onClick={clear} disabled={!files.length || busy}><Trash2 size={14}/> Limpiar</button><span>Compatible con Windows</span></div>
        </div>
      </aside>
    </div>
    {!!jobs.length && <section className="jobs-panel"><div className="jobs-head"><div><h2>Actividad de archivos</h2><p>Resultados guardados junto a los archivos originales.</p></div><button className="icon-button" onClick={() => setJobs([])} aria-label="Cerrar actividad"><X size={16}/></button></div>{jobs.map((job) => <div className="job-row" key={job.path}><div className={`filetype ${category(job.ext).toLowerCase()}`}>{fileIcon(job.ext)}</div><div className="job-main"><div className="job-title"><b>{job.name}</b><span className={`job-status ${job.status}`}>{job.status === 'done' ? 'Completado' : job.status === 'error' ? 'No completado' : job.status === 'cancelled' ? 'Cancelado' : 'Procesando'}</span></div><div className="progress-track"><i style={{ width: `${job.progress || 0}%` }}/></div>{job.error && <small className="job-error">{job.error}</small>}{job.output && <small>{job.output}</small>}{job.afterSize !== undefined && job.afterSize !== null && <small className="size-comparison">Original {formatSize(job.beforeSize)} → resultado {formatSize(job.afterSize)}{job.changePercent !== null ? ` · ${job.changePercent > 0 ? '+' : ''}${job.changePercent}%` : ''}</small>}</div>{job.output && <button className="text-button" onClick={() => window.dial.revealPath(job.output)}>Abrir carpeta <ArrowUpRight size={13}/></button>}</div>)}</section>}
    <section className="jobs-panel recoverable-queue"><div className="jobs-head"><div><h2>Cola e historial recuperable</h2><p>Los trabajos y sus ajustes quedan en este equipo, incluso si DIAL se cierra.</p></div><span className="queue-count">{savedJobs.length}</span></div>{!savedJobs.length ? <div className="queue-empty">Aquí aparecerán tus conversiones recientes y los trabajos que puedas reintentar.</div> : savedJobs.slice(0, 12).map((saved) => <article className="saved-job" key={saved.id}><div className="saved-job-head"><div><b>{operationLabel(saved.operation)} · {saved.files?.length || 0} archivo{saved.files?.length === 1 ? '' : 's'}</b><small>{new Date(saved.createdAt || saved.updatedAt).toLocaleString()} · {saved.status === 'done' ? 'Completado' : saved.status === 'processing' ? 'En curso' : saved.status === 'interrupted' ? 'Interrumpido' : saved.status === 'cancelled' ? 'Cancelado' : 'Error'}{saved.retryOf ? ' · reintento' : ''}</small></div><div className="saved-job-actions">{['interrupted','error','cancelled'].includes(saved.status) && <button className="text-button" onClick={() => start(saved)} disabled={busy}><RefreshCw size={13}/> Reintentar</button>}<button className="icon-button small" onClick={async () => { await window.dial.jobDelete(saved.id); setSavedJobs((items) => items.filter((item) => item.id !== saved.id)); }} disabled={busy || saved.status === 'processing'} aria-label="Quitar del historial"><Trash2 size={13}/></button></div></div>{saved.error && <small className="saved-job-error">{saved.error}</small>}{saved.results?.map((result, index) => <div className="saved-result" key={`${saved.id}-${index}`}><span>{result.label || result.input?.split(/[\\/]/).pop() || 'Resultado'}</span><span>{result.status === 'done' ? 'Listo' : result.status === 'cancelled' ? 'Cancelado' : result.error || 'Error'}</span>{result.beforeSize > 0 && result.afterSize !== null && result.afterSize !== undefined && <small>{formatSize(result.beforeSize)} → {formatSize(result.afterSize)}{result.changePercent !== null ? ` · ${result.changePercent > 0 ? '+' : ''}${result.changePercent}%` : ''}</small>}{result.output && <button className="text-button" onClick={() => window.dial.revealPath(result.output)}>Abrir <ArrowUpRight size={12}/></button>}</div>)}</article>)}</section>
    <footer className="page-footer"><span>Formatos disponibles según el motor local y cada archivo.</span><span>Originales preservados <span className="footer-separator">·</span> Sin carga a internet</span></footer>
  </div>;
}

function FormsPage({ forms, refresh, onToast }) {
  const [editing, setEditing] = useState(null); const [collecting, setCollecting] = useState(null); const [search, setSearch] = useState('');
  const startNew = () => setEditing({ id: '', title: '', description: '', fields: [{ id: id(), label: 'Nombre completo', type: 'text', required: true }] });
  const save = async (form) => { if (!form.title.trim()) return onToast('Ponle un título al formulario.', 'error'); await window.dial.formsSave(form); setEditing(null); await refresh(); onToast('Formulario guardado en este equipo.'); };
  const remove = async (form) => { if (!window.confirm(`¿Eliminar “${form.title}”? Las respuestas existentes se conservarán.`)) return; await window.dial.formsDelete(form.id); await refresh(); onToast('Formulario eliminado.'); };
  const filtered = forms.filter((form) => form.title.toLowerCase().includes(search.toLowerCase()));
  if (collecting) return <Collector form={collecting} back={() => setCollecting(null)} refresh={refresh} onToast={onToast}/>;
  if (editing) return <FormBuilder form={editing} onSave={save} onCancel={() => setEditing(null)}/>;
  return <div className="forms-page page-enter"><div className="page-intro compact"><div><div className="eyebrow"><FilePlus2 size={14}/> EDITOR LOCAL</div><h1>Formularios <span>a tu medida.</span></h1><p>Crea formularios y guárdalos en este equipo. La captura funciona offline.</p></div><button className="primary-button" onClick={startNew}><Plus size={17}/> Nuevo formulario</button></div>
    <div className="forms-toolbar"><div className="search-box"><Search size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar formularios…"/></div><span className="count-label">{forms.length} {forms.length === 1 ? 'formulario' : 'formularios'}</span></div>
    {!filtered.length ? <div className="forms-empty"><div className="empty-forms-icon"><FilePlus2 size={24}/></div><h3>{forms.length ? 'No encontramos resultados' : 'Tu primer formulario empieza aquí'}</h3><p>{forms.length ? 'Prueba otra búsqueda.' : 'Crea un formulario con preguntas, campos y adjuntos para comenzar.'}</p>{!forms.length && <button className="primary-button" onClick={startNew}><Plus size={16}/> Crear formulario</button>}</div> : <div className="form-grid">{filtered.map((form, index) => <article className="form-card" key={form.id}><div className={`form-card-art art-${index % 3}`}><div className="mini-paper"><div/><div/><div/><div/></div><div className="mini-stamp"><Check size={17}/></div></div><div className="form-card-body"><div className="form-card-top"><div><span className="form-kind">FORMULARIO</span><h3>{form.title}</h3></div><button className="icon-button" onClick={() => remove(form)} aria-label="Eliminar formulario"><MoreHorizontal size={18}/></button></div><p>{form.description || 'Sin descripción'}</p><div className="form-meta"><span><FileText size={13}/>{form.fields.length} campos</span><span><Clock3 size={13}/>{new Date(form.updatedAt || Date.now()).toLocaleDateString()}</span></div><div className="form-card-actions"><button className="primary-button compact-button" onClick={() => setCollecting(form)}><Play size={14}/> Completar</button><button className="outline-button" onClick={() => setEditing(form)}>Editar</button></div></div></article>)}</div>}
    <div className="offline-note"><div><CloudOff size={17}/></div><span><b>Listos para trabajar sin internet.</b> Tus formularios y respuestas permanecen aquí hasta configurar la sincronización.</span></div>
  </div>;
}

function fieldIsVisible(field, fields, values) {
  if (!field.visibleWhen?.fieldId) return true;
  const dependency = fields.find((candidate) => candidate.id === field.visibleWhen.fieldId);
  return Boolean(dependency) && String(values[field.visibleWhen.fieldId] ?? '') === String(field.visibleWhen.value ?? '');
}

function FormBuilder({ form, onSave, onCancel }) {
  const [draft, setDraft] = useState(JSON.parse(JSON.stringify(form)));
  const updateField = (fieldId, patch) => setDraft((current) => ({ ...current, fields: current.fields.map((field) => field.id === fieldId ? { ...field, ...patch } : field) }));
  const addField = (type = 'text') => setDraft((current) => ({ ...current, fields: [...current.fields, { id: id(), label: '', type, required: false, options: type === 'select' ? ['Opción 1', 'Opción 2'] : undefined }] }));
  return <div className="builder-page page-enter"><div className="builder-header"><button className="back-button" onClick={onCancel}><ArrowRight className="back-arrow" size={16}/> Formularios</button><div className="builder-buttons"><button className="outline-button" onClick={onCancel}>Cancelar</button><button className="primary-button" onClick={() => onSave(draft)}><Check size={16}/> Guardar formulario</button></div></div><div className="builder-layout"><div className="builder-work"><div className="builder-title-card"><span className="form-kind">CONFIGURACIÓN DEL FORMULARIO</span><input className="builder-title-input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Escribe el título del formulario"/><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Añade una descripción para quienes lo completen…" rows="2"/></div><div className="builder-section-title"><div><h2>Preguntas</h2><p>Organiza los campos que incluirá el formulario.</p></div><span>{draft.fields.length} campos</span></div><div className="builder-fields">{draft.fields.map((field, index) => <div className="builder-field" key={field.id}><div className="field-grip"><span>{String(index + 1).padStart(2, '0')}</span><div>⋮⋮</div></div><div className="builder-field-content"><div className="field-row"><input className="field-label-input" value={field.label} onChange={(event) => updateField(field.id, { label: event.target.value })} placeholder="Título de la pregunta"/><select value={field.type} onChange={(event) => updateField(field.id, { type: event.target.value })}>{FORM_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>{field.type === 'select' && <input className="options-input" value={(field.options || []).join(', ')} onChange={(event) => updateField(field.id, { options: event.target.value.split(',').map((item) => item.trim()) })} placeholder="Opción 1, Opción 2, Opción 3"/>}{index > 0 && <div className="conditional-row"><label>Mostrar esta pregunta cuando<select value={field.visibleWhen?.fieldId || ''} onChange={(event) => { const dependency = draft.fields.find((candidate) => candidate.id === event.target.value); updateField(field.id, { visibleWhen: event.target.value ? { fieldId: event.target.value, value: field.visibleWhen?.value || (dependency?.type === 'boolean' ? 'Sí' : dependency?.options?.[0] || '') } : null }); }}><option value="">Siempre visible</option>{draft.fields.slice(0, index).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label || 'Pregunta anterior'}</option>)}</select></label>{field.visibleWhen?.fieldId && <label>Respuesta es<input value={field.visibleWhen.value || ''} onChange={(event) => updateField(field.id, { visibleWhen: { ...field.visibleWhen, value: event.target.value } })} placeholder="Valor exacto"/></label>}</div>}<div className="field-controls"><label className="check-label"><input type="checkbox" checked={field.required} onChange={(event) => updateField(field.id, { required: event.target.checked })}/> Obligatorio</label><button className="remove-field" onClick={() => setDraft({ ...draft, fields: draft.fields.filter((item) => item.id !== field.id) })}><Trash2 size={13}/> Quitar</button></div></div></div>)}</div><button className="add-field-button" onClick={() => addField()}><Plus size={15}/> Añadir una pregunta</button><div className="builder-add-quick">{FORM_TYPES.map(([value, label]) => <button onClick={() => addField(value)} key={value}><Plus size={12}/>{label}</button>)}</div></div><aside className="builder-side"><div className="preview-card"><div className="preview-header"><span>VISTA PREVIA</span><span className="preview-live"><i/>En vivo</span></div><div className="preview-paper"><span className="preview-brand">DIAL <i/> FORMULARIO</span><h3>{draft.title || 'Título del formulario'}</h3><p>{draft.description || 'Descripción del formulario'}</p>{draft.fields.slice(0, 4).map((field) => <div className="preview-control" key={field.id}><span>{field.label || 'Pregunta'}{field.required && <i> *</i>}</span><div>{field.type === 'select' ? 'Selecciona una opción' : field.type === 'boolean' ? '○ Sí　 ○ No' : `Respuesta ${field.type === 'textarea' ? 'larga' : ''}`}</div></div>)}{draft.fields.length > 4 && <small>+ {draft.fields.length - 4} preguntas más</small>}<div className="preview-submit">Enviar respuesta <ArrowRight size={13}/></div></div></div><div className="builder-hint"><Sparkles size={15}/><span><b>Diseñado para funcionar offline.</b><br/>Las respuestas se guardan en este equipo.</span></div></aside></div></div>;
}

function Collector({ form, back, refresh, onToast }) {
  const [values, setValues] = useState({}); const [attachments, setAttachments] = useState({}); const [busy, setBusy] = useState(false);
  const update = (field, value) => setValues((current) => ({ ...current, [field.id]: value }));
  const attach = async (field, file) => {
    if (!file) return;
    const filePath = window.dial.pathForFile(file);
    try { const stored = await window.dial.attachmentStore(filePath, form.id); setAttachments((current) => ({ ...current, [field.id]: stored })); onToast(stored.optimized ? 'Adjunto optimizado. Se conservó el original.' : 'Adjunto guardado localmente.'); }
    catch (error) { onToast(`No se pudo optimizar el adjunto: ${error.message}`, 'error'); }
  };
    const submit = async (event) => {
    event.preventDefault(); const visibleFields = form.fields.filter((field) => fieldIsVisible(field, form.fields, values)); const missing = visibleFields.find((field) => field.required && (field.type === 'file' ? !attachments[field.id] : values[field.id] === undefined || values[field.id] === ''));
    if (missing) return onToast(`Completa el campo “${missing.label}”.`, 'error');
    setBusy(true);
    try { const visibleIds = new Set(visibleFields.map((field) => field.id)); const cleanValues = Object.fromEntries(Object.entries(values).filter(([fieldId]) => visibleIds.has(fieldId))); await window.dial.responseSave({ formId: form.id, formTitle: form.title, values: cleanValues, attachments: Object.entries(attachments).filter(([fieldId]) => visibleIds.has(fieldId)).map(([, file]) => file) }); await refresh(); onToast('Respuesta guardada en este equipo.'); back(); }
    catch (error) { onToast(`No se pudo guardar la respuesta: ${error.message}`, 'error'); }
    finally { setBusy(false); }
  };
  return <div className="collector-page page-enter"><div className="builder-header"><button className="back-button" onClick={back}><ArrowRight className="back-arrow" size={16}/> Formularios</button><span className="local-badge"><LockKeyhole size={13}/> Guardado local</span></div><form className="collector-card" onSubmit={submit}><div className="collector-heading"><span className="form-kind">FORMULARIO · SIN CONEXIÓN</span><h1>{form.title}</h1><p>{form.description || 'Completa los campos y envía la respuesta. Quedará guardada en este equipo.'}</p></div><div className="collector-fields">{visibleFields.map((field) => <label className="collector-field" key={field.id}><span>{field.label || 'Pregunta'}{field.required && <i> *</i>}</span>{field.type === 'textarea' ? <textarea rows="4" required={field.required} value={values[field.id] || ''} onChange={(event) => update(field, event.target.value)} placeholder="Escribe tu respuesta…"/> : field.type === 'select' ? <select required={field.required} value={values[field.id] || ''} onChange={(event) => update(field, event.target.value)}><option value="">Selecciona una opción</option>{(field.options || []).map((option) => <option key={option}>{option}</option>)}</select> : field.type === 'boolean' ? <select required={field.required} value={values[field.id] || ''} onChange={(event) => update(field, event.target.value)}><option value="">Selecciona</option><option value="Sí">Sí</option><option value="No">No</option></select> : field.type === 'file' ? <div className="attachment-picker"><input type="file" onChange={(event) => attach(field, event.target.files?.[0])}/><span><Upload size={15}/>{attachments[field.id]?.name || 'Elige un archivo para adjuntar'}</span>{attachments[field.id]?.optimized && <small>Optimizado · original conservado</small>}</div> : <input type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'} required={field.required} value={values[field.id] || ''} onChange={(event) => update(field, event.target.value)} placeholder="Escribe tu respuesta…"/>}</label>)}</div><div className="collector-footer"><span><ShieldCheck size={15}/> Tus respuestas se guardan localmente.</span><button className="primary-button" disabled={busy}><Check size={15}/>{busy ? 'Guardando…' : 'Guardar respuesta'}<ArrowRight size={15}/></button></div></form></div>;
}

function ResponsesPage({ responses, forms, navigate, onToast }) {
  const formMap = Object.fromEntries(forms.map((form) => [form.id, form.title]));
  const exportCsv = async () => {
    const header = ['Formulario', 'Fecha', 'Respuesta'];
    const rows = responses.map((response) => [response.formTitle, new Date(response.createdAt).toLocaleString(), Object.entries(response.values || {}).map(([key, value]) => `${key}: ${value}`).join(' | ')]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value || '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const result = await window.dial.saveTextFile({ suggestedName: 'respuestas-dial.csv', content: '\ufeff' + csv });
    if (!result.canceled) onToast('Respuestas exportadas a CSV.');
  };
  const exportXlsx = async () => { try { const result = await window.dial.exportResponsesXlsx(responses); if (!result.canceled) onToast('Respuestas exportadas a Excel.'); } catch (error) { onToast(`No se pudo exportar el libro: ${error.message}`, 'error'); } };
  return <div className="responses-page page-enter"><div className="page-intro compact"><div><div className="eyebrow"><ListFilter size={14}/> REGISTRO LOCAL</div><h1>Respuestas <span>guardadas.</span></h1><p>Las respuestas se mantienen en este equipo. Las que incluyen adjuntos enlazan a copias protegidas localmente.</p></div><div className="response-export-actions"><button className="outline-button" onClick={exportCsv} disabled={!responses.length}><ArrowDownToLine size={15}/> CSV</button><button className="primary-button" onClick={exportXlsx} disabled={!responses.length}><FileSpreadsheet size={15}/> Excel</button></div></div>
    {!responses.length ? <div className="forms-empty"><div className="empty-forms-icon"><FileText size={24}/></div><h3>Aún no hay respuestas</h3><p>Completa un formulario para guardar el primer registro.</p><button className="primary-button" onClick={() => navigate('forms')}>Ver formularios <ArrowRight size={15}/></button></div> : <div className="response-table-wrap"><table className="response-table"><thead><tr><th>FORMULARIO</th><th>FECHA</th><th>CAMPOS COMPLETADOS</th><th>ADJUNTOS</th><th>ESTADO</th></tr></thead><tbody>{responses.map((response) => <tr key={response.id}><td><div className="table-title"><div className="table-icon"><FileText size={16}/></div><div><b>{formMap[response.formId] || response.formTitle || 'Formulario eliminado'}</b><small>Respuesta {response.id.slice(0, 8)}</small></div></div></td><td>{new Date(response.createdAt).toLocaleString()}</td><td>{Object.values(response.values || {}).filter(Boolean).length}</td><td>{response.attachments?.length || 0}</td><td><span className="local-state"><i/>Solo en este equipo</span></td></tr>)}</tbody></table></div>}
    <div className="sync-notice"><CloudOff size={18}/><div><b>La sincronización aún no está activa.</b><p>Los datos están guardados localmente. Para enviarlos se requiere configurar y validar un servidor Tangerine compatible.</p></div><button className="outline-button" onClick={() => navigate('settings')}>Ver conexión <ArrowRight size={14}/></button></div>
  </div>;
}

function SettingsPage({ settings, setSettings, dataPath, sync, onToast, refresh }) {
  const [draft, setDraft] = useState(settings || {}); const [busy, setBusy] = useState(false);
  const [updateStatus, setUpdateStatus] = useState({ state: 'idle', version: '0.1.2' });
  useEffect(() => { if (settings) setDraft(settings); }, [settings]);
  useEffect(() => { window.dial.updatesStatus().then(setUpdateStatus); return window.dial.onUpdatesStatus(setUpdateStatus); }, []);
  const save = async () => { const saved = await window.dial.settingsSave(draft); setSettings(saved); onToast('Ajustes guardados.'); await refresh(); };
  const chooseFolder = async () => { const path = await window.dial.chooseFolder(); if (path) setDraft({ ...draft, outputFolder: path }); };
  const syncNow = async () => { setBusy(true); try { await window.dial.syncNow(); onToast('Sincronización completada.'); } catch (error) { onToast(error.message, 'error'); } finally { setBusy(false); } };
  const checkForUpdates = async () => { setUpdateStatus({ state: 'checking', version: updateStatus.version }); setUpdateStatus(await window.dial.updatesCheck()); };
  const installUpdate = async () => { await window.dial.updatesInstall(); };
  const updateCopy = { idle: 'DIAL buscará versiones nuevas al abrirse.', development: 'Las actualizaciones estarán disponibles en la versión instalada.', checking: 'Buscando una versión nueva…', downloading: `Descargando actualización${Number.isFinite(updateStatus.percent) ? ` · ${Math.round(updateStatus.percent)}%` : '…'}`, ready: `La versión ${updateStatus.version} está lista para instalar.`, current: `Tienes la versión más reciente${updateStatus.version ? ` (${updateStatus.version})` : ''}.`, error: updateStatus.message || 'No se pudo consultar el canal de actualizaciones.' }[updateStatus.state] || 'Estado de actualización no disponible.';
  return <div className="settings-page page-enter"><div className="page-intro compact"><div><div className="eyebrow"><Settings2 size={14}/> PERSONALIZA DIAL</div><h1>Ajustes <span>de tu espacio.</span></h1><p>Elige dónde se guardan los resultados y cómo optimizar adjuntos.</p></div></div><div className="settings-grid"><div className="settings-main">
    <section className="settings-card"><div className="settings-heading"><div className="settings-icon blue"><RefreshCw size={17}/></div><div><h2>Actualizaciones de DIAL</h2><p>{updateCopy}</p></div></div><button className="text-button update-source" onClick={() => window.dial.openExternal('https://github.com/estebanico10/dial-desktop/releases')}><span>Canal oficial · GitHub · estebanico10/dial-desktop</span><ArrowUpRight size={13}/></button>{updateStatus.state === 'downloading' && <div className="update-progress"><div style={{ width: `${Math.max(0, Math.min(100, updateStatus.percent || 0))}%` }}/></div>}<div className="server-actions">{updateStatus.state === 'ready' ? <button className="primary-button" onClick={installUpdate}><RefreshCw size={14}/> Reiniciar e instalar</button> : <button className="outline-button" onClick={checkForUpdates} disabled={['checking', 'downloading'].includes(updateStatus.state)}><RefreshCw size={14}/> Buscar actualizaciones</button>}</div></section>
    <section className="settings-card"><div className="settings-heading"><div className="settings-icon violet"><WandSparkles size={17}/></div><div><h2>Procesamiento de archivos</h2><p>Define las preferencias locales para tus conversiones y adjuntos.</p></div></div><div className="setting-row"><div><b>Carpeta de salida</b><small>Vacía = junto al archivo original</small></div><div className="path-picker"><span>{draft.outputFolder || 'Carpeta del archivo'}</span><button className="outline-button" onClick={chooseFolder}>Elegir</button></div></div><div className="setting-row"><div><b>Calidad de imagen</b><small>Perfil usado al optimizar adjuntos.</small></div><div className="setting-value"><input type="range" min="55" max="95" value={draft.imageQuality || 84} onChange={(event) => setDraft({ ...draft, imageQuality: Number(event.target.value) })}/><b>{draft.imageQuality || 84}%</b></div></div>{[['optimizeImages', 'Optimizar imágenes al adjuntar'], ['optimizeAudio', 'Optimizar audio al adjuntar'], ['optimizeVideo', 'Optimizar video al adjuntar']].map(([key, label]) => <div className="setting-row" key={key}><div><b>{label}</b><small>El archivo original se conserva junto a la copia optimizada.</small></div><button className={`toggle ${draft[key] ? 'on' : ''}`} onClick={() => setDraft({ ...draft, [key]: !draft[key] })} aria-label={label}><i/></button></div>)}<button className="primary-button settings-save" onClick={save}><Check size={15}/> Guardar preferencias</button></section>
    <section className="settings-card"><div className="settings-heading"><div className="settings-icon blue"><Cloud size={17}/></div><div><h2>Servidor de formularios</h2><p>Configura una instancia remota compatible. Las respuestas seguirán en este equipo hasta completar una conexión válida.</p></div></div><div className="server-form"><label>URL del servidor<input value={draft.remoteUrl || ''} onChange={(event) => setDraft({ ...draft, remoteUrl: event.target.value })} placeholder="https://servidor.ejemplo.org"/></label><label>Base de datos del grupo<input value={draft.remoteDatabase || ''} onChange={(event) => setDraft({ ...draft, remoteDatabase: event.target.value })} placeholder="nombre-de-base"/></label><div className="server-two"><label>Usuario<input value={draft.remoteUsername || ''} onChange={(event) => setDraft({ ...draft, remoteUsername: event.target.value })} placeholder="Usuario"/></label><label>Contraseña<input type="password" value={draft.remotePassword || ''} onChange={(event) => setDraft({ ...draft, remotePassword: event.target.value })} placeholder="Se guarda en este equipo"/></label></div><div className="sync-explainer"><CloudOff size={16}/><span><b>Estado: {sync.configured ? 'configuración guardada' : 'sin validar'}</b><br/>DIAL aún no replica los documentos con el protocolo de Tangerine. Guardar esta información no envía datos.</span></div><div className="server-actions"><button className="outline-button" onClick={save}>Guardar configuración</button><button className="primary-button" disabled><RefreshCw size={14}/>Integración pendiente</button></div></div></section>
    </div><aside className="settings-aside"><div className="privacy-card"><div className="privacy-art"><div className="privacy-shield"><ShieldCheck size={26}/></div><span className="privacy-spark ps-a">✦</span><span className="privacy-spark ps-b">✦</span></div><h3>Tus archivos, tus reglas.</h3><p>DIAL procesa archivos dentro de tu equipo. No los envía a servicios de conversión externos.</p><div className="privacy-points"><span><Check size={13}/> Procesamiento local</span><span><Check size={13}/> Originales preservados</span><span><Check size={13}/> Sin cuenta requerida</span></div></div><div className="data-location"><div><HardDrive size={16}/><b>Datos locales</b></div><code>{dataPath}\DIAL</code><small>Formularios, respuestas y adjuntos se guardan en esta carpeta.</small><button className="text-button" onClick={() => window.dial.openPath(`${dataPath}\DIAL`)}>Abrir ubicación <ArrowUpRight size={13}/></button></div></aside></div><footer className="page-footer"><span>DIAL para Windows · Versión 0.1.2 · Actualizaciones desde GitHub · GPLv3</span><span>Privacidad local <span className="footer-separator">·</span> Ayuda</span></footer></div>;
}

function category(ext) {
  if (IMAGE_TYPES.includes(ext)) return 'Imagen';
  if (['mp4', 'mov', 'mkv', 'webm', 'avi', 'wmv'].includes(ext)) return 'Video';
  if (['mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus', 'aiff', 'wma'].includes(ext)) return 'Audio';
  if (['srt', 'vtt'].includes(ext)) return 'Subtítulos';
  if (['zip', 'tar', 'gz'].includes(ext)) return 'Archivos';
  if (ext === 'pdf') return 'Documentos';
  return 'Documentos';
}
function fileIcon(ext) {
  const group = category(ext);
  return group === 'Imagen' ? <FileImage size={17}/> : group === 'Video' ? <FileVideo size={17}/> : group === 'Audio' ? <FileAudio size={17}/> : group === 'Archivos' ? <FileArchive size={17}/> : group === 'Subtítulos' ? <FileText size={17}/> : ['csv', 'xlsx'].includes(ext) ? <FileSpreadsheet size={17}/> : <FileText size={17}/>;
}

const overlayWindow = new URLSearchParams(window.location.search).get('overlay') === '1';
if (overlayWindow) document.body.classList.add('dial-overlay-window');
createRoot(document.getElementById('root')).render(overlayWindow ? <QuickOverlayWindow/> : <App/>);
