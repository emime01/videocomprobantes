const express  = require('express');
const multer   = require('multer');
const { v4: uuid } = require('uuid');
const path     = require('path');
const fs       = require('fs');
const os       = require('os');
const { spawn, execSync } = require('child_process');

// ── Find FFmpeg ────────────────────────────────────────────────────────────
let FFMPEG = '';
try { FFMPEG = execSync('which ffmpeg').toString().trim(); } catch {}
if(!FFMPEG) { try { FFMPEG = require('ffmpeg-static'); } catch {} }
if(!FFMPEG) { console.error('FFmpeg not found!'); process.exit(1); }
console.log('FFmpeg path:', FFMPEG);

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Temp dir (short path, no hyphens) ─────────────────────────────────────
const TMP = path.join(os.tmpdir(), 'mv');
fs.mkdirSync(TMP, { recursive: true });

// ── Assign jobId (no hyphens to avoid FFmpeg path issues) ─────────────────
app.use((req, res, next) => {
  req.jobId = uuid().replace(/-/g, '');
  next();
});

// ── Multer storage ─────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const d = path.join(TMP, req.jobId);
    fs.mkdirSync(d, { recursive: true });
    cb(null, d);
  },
  filename: (req, file, cb) => {
    const safe = file.fieldname.replace(/[^a-z0-9]/gi,'_');
    const ext  = path.extname(file.originalname).toLowerCase() || '.mp4';
    cb(null, safe + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

// ── Static files ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use(express.json({ limit: '10mb' }));

// ── Helpers ────────────────────────────────────────────────────────────────
function cleanup(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }

function runFF(args) {
  return new Promise((resolve, reject) => {
    console.log('FF:', args.join(' ').slice(0, 120));
    const proc = spawn(FFMPEG, args);
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', code => {
      if(code === 0) resolve();
      else reject(new Error(`FFmpeg exit ${code}: ${stderr.slice(-500)}`));
    });
    proc.on('error', reject);
  });
}

function esc(s) {
  return String(s)
    .replace(/\\/g,'\\\\').replace(/'/g,"\\'")
    .replace(/:/g,'\\:').replace(/\[/g,'\\[').replace(/\]/g,'\\]');
}

// ── POST /api/generate ─────────────────────────────────────────────────────
app.post('/api/generate', upload.any(), async (req, res) => {
  const jobDir = path.join(TMP, req.jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  try {
    const { cliente='', campana='', desde='', hasta='',
            overDur='5', overlayStyle='bottom', clipNames='[]' } = req.body;

    const names   = JSON.parse(clipNames);
    const overSec = Math.max(1, parseFloat(overDur) || 5);
    const fileMap = {};
    (req.files||[]).forEach(f => { fileMap[f.fieldname] = f.path; });

    const clipKeys = Object.keys(fileMap)
      .filter(k => /^clip\d+$/.test(k))
      .sort((a,b) => parseInt(a.slice(4))-parseInt(b.slice(4)));

    if(!clipKeys.length) return res.status(400).json({ error: 'No se recibieron clips' });

    const done = [];
    let i = 0;

    // INTRO
    if(fileMap['intro']) {
      const out = path.join(jobDir, `s${i++}.mp4`);
      await segIntro(fileMap['intro'], out, fileMap['logo']||null);
      done.push(out);
    }

    // CLIPS
    for(let c=0; c<clipKeys.length; c++) {
      const out = path.join(jobDir, `s${i++}.mp4`);
      await segClip(fileMap[clipKeys[c]], out, names[c]||`Soporte ${c+1}`, desde, hasta, overSec, overlayStyle);
      done.push(out);
    }

    // OUTRO
    if(fileMap['outro']) {
      const out = path.join(jobDir, `s${i++}.mp4`);
      await segPass(fileMap['outro'], out);
      done.push(out);
    }

    // CONCAT
    const listPath = path.join(jobDir, 'list.txt');
    fs.writeFileSync(listPath, done.map(f=>`file '${f}'`).join('\n'));
    const finalOut = path.join(jobDir, 'out.mp4');
    await runFF(['-f','concat','-safe','0','-i',listPath,'-c','copy','-movflags','+faststart','-y',finalOut]);

    // SEND
    const stat = fs.statSync(finalOut);
    const name = `Movimagen_${cliente}_${campana}.mp4`.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_.-]/g,'');
    res.setHeader('Content-Type','video/mp4');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition',`attachment; filename="${name}"`);
    const stream = fs.createReadStream(finalOut);
    stream.pipe(res);
    stream.on('close', () => cleanup(jobDir));

  } catch(err) {
    console.error('Error:', err.message);
    cleanup(jobDir);
    if(!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ── Segment processors ─────────────────────────────────────────────────────

const BASE = 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black';

// Intro: normalize + optional logo overlay
async function segIntro(input, output, logoPath) {
  if(logoPath) {
    const fc = `[0:v]${BASE}[base];[1:v]scale=200:-1[logo];[base][logo]overlay=W-w-25:H-h-15[out]`;
    await runFF([
      '-i',input,'-i',logoPath,
      '-filter_complex',fc,
      '-map','[out]','-map','0:a?',
      '-c:v','libx264','-preset','fast','-crf','22',
      '-c:a','aac','-b:a','128k',
      '-movflags','+faststart','-y',output
    ]);
  } else {
    await segPass(input, output);
  }
}

// Passthrough: just normalize
async function segPass(input, output) {
  await runFF([
    '-i',input,
    '-vf',BASE,
    '-c:v','libx264','-preset','fast','-crf','22',
    '-c:a','aac','-b:a','128k',
    '-movflags','+faststart','-y',output
  ]);
}

// Clip: normalize + drawtext overlay
async function segClip(input, output, soporteName, desde, hasta, overSec, overlayStyle) {
  const soporte = esc(String(soporteName).toUpperCase());
  const periodo = esc(`Desde: ${desde}  Hasta: ${hasta}`);
  const barY    = overlayStyle==='bottom' ? 'ih-130' : '0';
  const textY   = overlayStyle==='bottom' ? 'ih-84'  : '46';
  const mvY     = overlayStyle==='bottom' ? 'ih-16'  : '8';
  const en      = `lte(t\\,${overSec})`;

  const vf = [
    BASE,
    `drawbox=x=0:y=${barY}:w=iw:h=130:color=0xE8601C@0.92:t=fill:enable='${en}'`,
    `drawtext=text='${soporte}':fontsize=44:fontcolor=white:x=36:y=${textY}-22:enable='${en}'`,
    `drawtext=text='${periodo}':fontsize=22:fontcolor=white@0.92:x=w-tw-36:y=${textY}-11:enable='${en}'`,
    `drawtext=text='movimagen':fontsize=17:fontcolor=white@0.55:x=w-tw-24:y=${mvY}:enable='${en}'`,
  ].join(',');

  await runFF([
    '-i',input,
    '-vf',vf,
    '-c:v','libx264','-preset','fast','-crf','22',
    '-c:a','aac','-b:a','128k',
    '-movflags','+faststart','-y',output
  ]);
}

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (req,res) => res.json({ ok:true, ffmpeg:FFMPEG }));
app.listen(PORT, () => console.log(`Movimagen en puerto ${PORT}`));
