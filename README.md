# DIAL para Windows

DIAL es una aplicación de escritorio local desarrollada dentro del código comunitario de Tangerine. Reúne conversión de medios y documentos, herramientas rápidas, un editor local de formularios y captura de respuestas offline.

## Desarrollo

Necesitas Node.js 22 o posterior y Windows x64.

```powershell
npm install
npm run dev
```

## Crear el instalador

```powershell
npm run dist:win
```

El instalador NSIS se genera en `release/`.

## Actualizaciones de Windows

Las versiones instaladas buscan actualizaciones al iniciar y desde **Ajustes → Actualizaciones de DIAL**. Cuando una versión está lista, la aplicación permite reiniciar e instalarla sin borrar formularios, respuestas ni adjuntos locales.

Las publicaciones se alojan como GitHub Releases en `estebanico10/dial-desktop`. Para crear una versión nueva, actualiza `version` en `package.json`, genera una etiqueta `v<version>` y súbela al repositorio. GitHub Actions compila el instalador y publica el manifiesto y los paquetes que usa el actualizador. Las compilaciones locales no publican nada.

## Capacidades activas

- Conversión de imágenes con Sharp, incluyendo salida PDF; PNG, JPEG, WebP, AVIF y TIFF.
- Crear collage PNG de 2 a 20 imágenes, con columnas, tamaño de cada cuadro, separación y color de fondo configurables.
- Conversión y edición básica de audio/video con FFmpeg distribuido dentro de la aplicación.
- Recorte y cambio de velocidad de audio; normalización y conversión a mono.
- Ajuste de brillo, contraste y saturación por lote; ocultación de áreas con bloque opaco, con coordenadas en píxeles.
- Control de volumen, fundido de entrada/salida y escritura de metadatos básicos de audio y video.
- Recorte de audio/video con duración detectada, controles de inicio y fin, vista de forma de onda para audio y fotograma de referencia para video.
- Captura de fotogramas de video como PNG; recorte del encuadre, quitar audio, recortar duración, cambiar velocidad, dividir en segmentos y unir videos compatibles.
- Redimensionar, recortar por píxeles y girar imágenes; exportar copias sin metadatos EXIF.
- Conversión CSV ↔ XLSX, DOCX → HTML y TXT ↔ Markdown.
- Conversión SRT ↔ VTT, giro y organización de páginas PDF, unión/división de PDF, creación y extracción de ZIP.
- Organizador de PDF con miniaturas locales: seleccionar, excluir y reordenar páginas antes de exportar.
- Cola e historial local recuperable: los trabajos interrumpidos se pueden reintentar con sus ajustes; compara el tamaño original y el resultado cuando ambos son archivos.
- Editor de formularios local con preguntas condicionales; las respuestas solo incluyen campos visibles, y los adjuntos conservan también el original.
- Preferencias locales, selección de carpeta de salida y exportación CSV o XLSX de respuestas.
- Modo rápido superpuesto con `Ctrl+Shift+D` (alternador), botones para elegir archivos o carpetas, arrastrar y soltar, análisis local hasta 5.000 archivos y resumen por tipo.
- Menú contextual de Windows “Analizar con DIAL” para archivos y carpetas; al instalar, rutas pasan a la instancia activa o inician DIAL.
- Acciones rápidas para crear ZIP conservando las rutas de la carpeta, comprimir medios compatibles, abrir herramientas completas y revelar el resultado en el Explorador.

El menú muestra únicamente familias de salida con una ruta implementada. Las herramientas aparecen según los archivos compatibles. No hay soporte para los 275 pares de conversión anunciados por el producto de referencia.

## Integración de Tangerine pendiente

La fuente Tangerine incluida en el repositorio requiere su servidor y CouchDB en contenedores. El shell DIAL no inicia ni empaqueta esos servicios. El editor y recolector de esta versión son locales de DIAL y no cargan el editor Angular original. Las respuestas quedan guardadas localmente; aunque se pueden guardar los datos de conexión, la réplica con el protocolo de Tangerine aún no está implementada y el botón de sincronización lo comunica sin enviar los datos.

## Privacidad y datos

La conversión se ejecuta localmente. Formularios, respuestas y adjuntos se guardan bajo `%APPDATA%/dial-desktop/DIAL`. La contraseña de conexión, si se guarda, se cifra con el almacenamiento seguro de Electron en Windows.

El modo rápido requiere que DIAL esté abierto para responder al atajo global. Si se cierra la aplicación, usa el menú contextual de Windows para archivos o carpetas. “Abrir ubicación para compartir” muestra el resultado en el Explorador; el envío automático a Blip todavía no está integrado.

## Licencia y procedencia

El código de Tangerine en `../` se distribuye bajo GPLv3. Este módulo se publica bajo GPL-3.0-only; consulta `COPYING` y `UPSTREAM-NOTICE.md`.

