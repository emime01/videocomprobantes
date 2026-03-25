# Movimagen – Videocomprobantes

Generador de videocomprobantes para Movimagen Publicidad OOH.

## Deploy en Railway (5 minutos)

### 1. Subir a GitHub
```bash
git init
git add .
git commit -m "Movimagen Videocomprobantes"
git remote add origin https://github.com/TU-USUARIO/movimagen-video.git
git push -u origin main
```

### 2. Crear proyecto en Railway
1. Ir a [railway.app](https://railway.app) → **New Project**
2. Elegir **Deploy from GitHub repo**
3. Seleccionar el repo `movimagen-video`
4. Railway detecta automáticamente Node.js y despliega

### 3. Listo
Railway te da una URL tipo `movimagen-video.up.railway.app` — compartila con tu equipo.

## Desarrollo local
```bash
npm install
npm start
# Abrir http://localhost:3000
```

## Estructura
```
├── server.js          # Servidor Express + FFmpeg
├── package.json
└── public/
    └── index.html     # Frontend
```

## Notas
- FFmpeg corre en el servidor (ffmpeg-static incluido, no requiere instalación)
- Los videos temporales se eliminan automáticamente después de la descarga
- Límite por archivo: 500 MB
- Para videos muy largos (>10 min cada uno), Railway puede necesitar plan Pro por el timeout
