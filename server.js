const express  = require('express');
const multer   = require('multer');
const { v4: uuid } = require('uuid');
const path     = require('path');
const fs       = require('fs');
const os       = require('os');
const { spawn } = require('child_process');
const sharp    = require('sharp');

const FFMPEG = require('ffmpeg-static');
console.log('FFmpeg:', FFMPEG);

const app  = express();
const PORT = process.env.PORT || 3000;
const TMP  = path.join(os.tmpdir(), 'mv');
fs.mkdirSync(TMP, { recursive: true });

// ── jobId without hyphens ──────────────────────────────────────────────────
app.use((req, res, next) => { req.jobId = uuid().replace(/-/g,''); next(); });

// ── Multer ─────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => { const d=path.join(TMP,req.jobId); fs.mkdirSync(d,{recursive:true}); cb(null,d); },
  filename:    (req, file, cb) => { cb(null, file.fieldname.replace(/[^a-z0-9]/gi,'_') + (path.extname(file.originalname).toLowerCase()||'.mp4')); }
});
const upload = multer({ storage, limits: { fileSize: 500*1024*1024 } });

app.use(express.static(path.join(__dirname,'public')));
app.get('/', (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));
app.use(express.json({ limit:'10mb' }));

function cleanup(dir) { try { fs.rmSync(dir,{recursive:true,force:true}); } catch {} }

function runFF(args) {
  return new Promise((resolve,reject) => {
    const proc = spawn(FFMPEG, args);
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', code => { if(code===0) resolve(); else reject(new Error(`FFmpeg ${code}: ${stderr.slice(-500)}`)); });
    proc.on('error', reject);
  });
}

// ── Generate overlay PNG using SVG + sharp (no canvas needed) ──────────────
async function makeOverlayPng(outPath, soporteName, desde, hasta, overlayStyle) {
  const W = 1280, H = 720, barH = 130;
  const y0 = overlayStyle === 'bottom' ? H - barH : 0;

  // Truncate soporte name if too long
  let soporte = String(soporteName).toUpperCase();
  if(soporte.length > 28) soporte = soporte.slice(0,27) + '…';

  const periodo = `Desde: ${desde}   Hasta: ${hasta}`;

  // Build SVG — Sharp renders SVG natively, no extra libs needed
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <!-- transparent background -->
    <rect width="${W}" height="${H}" fill="none"/>

    <!-- orange bar -->
    <rect x="0" y="${y0}" width="${W}" height="${barH}" fill="#E8601C" opacity="0.93"/>

    <!-- gradient fade on open edge -->
    <defs>
      <linearGradient id="fade" x1="0" y1="${overlayStyle==='bottom'?'0':'1'}" x2="0" y2="${overlayStyle==='bottom'?'1':'0'}" gradientUnits="objectBoundingBox">
        <stop offset="0%" stop-color="#E8601C" stop-opacity="0"/>
        <stop offset="25%" stop-color="#E8601C" stop-opacity="0.93"/>
        <stop offset="100%" stop-color="#C04E15" stop-opacity="0.99"/>
      </linearGradient>
    </defs>
    <rect x="0" y="${y0}" width="${W}" height="${barH}" fill="url(#fade)"/>

    <!-- soporte name -->
    <text x="38" y="${y0 + (overlayStyle==='bottom' ? 72 : 58)}"
      font-family="Arial, sans-serif" font-size="52" font-weight="bold"
      fill="white">${escSvg(soporte)}</text>

    <!-- periodo -->
    <text x="${W-38}" y="${y0 + (overlayStyle==='bottom' ? 72 : 58)}"
      font-family="Arial, sans-serif" font-size="22"
      fill="white" opacity="0.92" text-anchor="end">${escSvg(periodo)}</text>

    <!-- movimagen watermark -->
    <text x="${W-28}" y="${overlayStyle==='bottom' ? H-12 : y0+barH-10}"
      font-family="Arial, sans-serif" font-size="17"
      fill="white" opacity="0.55" text-anchor="end">movimagen</text>
  </svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outPath);
}

function escSvg(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Segment processors ─────────────────────────────────────────────────────
const BASE = 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black';

async function segPass(input, output) {
  await runFF(['-i',input,'-vf',BASE,
    '-c:v','libx264','-preset','fast','-crf','22',
    '-c:a','aac','-b:a','128k','-movflags','+faststart','-y',output]);
}

async function segIntro(input, output, logoPath) {
  if(!logoPath) { await segPass(input,output); return; }
  const fc = `[0:v]${BASE}[base];[1:v]scale=200:-1[logo];[base][logo]overlay=W-w-25:H-h-15[out]`;
  await runFF(['-i',input,'-i',logoPath,
    '-filter_complex',fc,'-map','[out]','-map','0:a?',
    '-c:v','libx264','-preset','fast','-crf','22',
    '-c:a','aac','-b:a','128k','-movflags','+faststart','-y',output]);
}

async function segClip(input, output, overlayPng, overSec) {
  const fc = [
    `[0:v]${BASE}[base]`,
    `[1:v]scale=${1280}:${720}[ov]`,
    `[base][ov]overlay=0:0:enable='between(t,0,${overSec})'[out]`
  ].join(';');
  await runFF(['-i',input,'-i',overlayPng,
    '-filter_complex',fc,'-map','[out]','-map','0:a?',
    '-c:v','libx264','-preset','fast','-crf','22',
    '-c:a','aac','-b:a','128k','-movflags','+faststart','-y',output]);
}

// ── POST /api/generate ─────────────────────────────────────────────────────
app.post('/api/generate', upload.any(), async (req,res) => {
  const jobDir = path.join(TMP, req.jobId);
  fs.mkdirSync(jobDir,{recursive:true});
  try {
    const { cliente='', campana='', desde='', hasta='',
            overDur='5', overlayStyle='bottom', clipNames='[]' } = req.body;
    const names   = JSON.parse(clipNames);
    const overSec = Math.max(1, parseFloat(overDur)||5);
    const fileMap = {};
    (req.files||[]).forEach(f => { fileMap[f.fieldname]=f.path; });
    const clipKeys = Object.keys(fileMap)
      .filter(k=>/^clip\d+$/.test(k))
      .sort((a,b)=>parseInt(a.slice(4))-parseInt(b.slice(4)));

    if(!clipKeys.length) return res.status(400).json({error:'No se recibieron clips'});

    const done=[]; let i=0;

    if(fileMap['intro']) {
      const out=path.join(jobDir,`s${i++}.mp4`);
      await segIntro(fileMap['intro'],out,fileMap['logo']||null);
      done.push(out);
    }

    for(let c=0;c<clipKeys.length;c++) {
      const soporteName = names[c]||`Soporte ${c+1}`;
      const pngPath     = path.join(jobDir,`ov${c}.png`);
      await makeOverlayPng(pngPath, soporteName, desde, hasta, overlayStyle);
      const out=path.join(jobDir,`s${i++}.mp4`);
      await segClip(fileMap[clipKeys[c]], out, pngPath, overSec);
      done.push(out);
    }

    if(fileMap['outro']) {
      const out=path.join(jobDir,`s${i++}.mp4`);
      await segPass(fileMap['outro'],out);
      done.push(out);
    }

    const listPath=path.join(jobDir,'list.txt');
    fs.writeFileSync(listPath, done.map(f=>`file '${f}'`).join('\n'));
    const finalOut=path.join(jobDir,'out.mp4');
    await runFF(['-f','concat','-safe','0','-i',listPath,
      '-c','copy','-movflags','+faststart','-y',finalOut]);

    const stat=fs.statSync(finalOut);
    const safeName=`Movimagen_${cliente}_${campana}.mp4`
      .replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_.-]/g,'');
    res.setHeader('Content-Type','video/mp4');
    res.setHeader('Content-Length',stat.size);
    res.setHeader('Content-Disposition',`attachment; filename="${safeName}"`);
    const stream=fs.createReadStream(finalOut);
    stream.pipe(res);
    stream.on('close',()=>cleanup(jobDir));

  } catch(err) {
    console.error('Error:',err.message);
    cleanup(jobDir);
    if(!res.headersSent) res.status(500).json({error:err.message});
  }
});

app.get('/health',(req,res)=>res.json({ok:true,ffmpeg:FFMPEG}));
app.listen(PORT,()=>console.log(`Movimagen en puerto ${PORT}`));
