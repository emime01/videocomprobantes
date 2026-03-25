const express    = require('express');
const multer     = require('multer');
const ffmpeg     = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { v4: uuid } = require('uuid');
const path       = require('path');
const fs         = require('fs');
const os         = require('os');

ffmpeg.setFfmpegPath(ffmpegPath);

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Temp dir for uploads & processing ─────────────────────────────────────
const TMP = path.join(os.tmpdir(), 'movimagen');
if(!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

// ── Multer: accept multiple files ──────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const jobDir = path.join(TMP, req.jobId);
    fs.mkdirSync(jobDir, { recursive: true });
    cb(null, jobDir);
  },
  filename: (req, file, cb) => cb(null, file.fieldname + '_' + Date.now() + path.extname(file.originalname))
});

// Assign a jobId before multer runs
app.use((req, res, next) => { req.jobId = uuid(); next(); });

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB per file
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));

// ── Helper: clean up job directory ────────────────────────────────────────
function cleanup(jobDir) {
  try { fs.rmSync(jobDir, { recursive: true, force: true }); } catch {}
}

// ── Helper: run ffmpeg command as promise ──────────────────────────────────
function runFFmpeg(cmd) {
  return new Promise((resolve, reject) => {
    cmd.on('end', resolve).on('error', reject).run();
  });
}

// ── Helper: escape text for FFmpeg drawtext ────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g,  "\\'")
    .replace(/:/g,  '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

// ── POST /api/generate ─────────────────────────────────────────────────────
// Fields: cliente, campana, desde, hasta, overDur, overlayStyle
// Files:  intro (optional), outro (optional), logo (optional), clip0..clipN
app.post('/api/generate',
  upload.any(),
  async (req, res) => {
    const jobDir = path.join(TMP, req.jobId);

    try {
      const {
        cliente    = '',
        campana    = '',
        desde      = '',
        hasta      = '',
        overDur    = '5',
        overlayStyle = 'bottom',
        clipNames  = '[]',   // JSON array of display names in order
      } = req.body;

      const names   = JSON.parse(clipNames);
      const overSec = Math.max(1, parseFloat(overDur) || 5);

      // Map uploaded files by fieldname
      const fileMap = {};
      (req.files || []).forEach(f => { fileMap[f.fieldname] = f.path; });

      // Collect clip files in order (clip0, clip1, ...)
      const clipKeys = Object.keys(fileMap)
        .filter(k => k.startsWith('clip'))
        .sort((a,b) => parseInt(a.slice(4)) - parseInt(b.slice(4)));

      if(clipKeys.length === 0) {
        return res.status(400).json({ error: 'No se recibieron clips' });
      }

      // ── Process each segment ─────────────────────────────────────────
      const processedFiles = [];
      let segIdx = 0;

      // INTRO
      if(fileMap['intro']) {
        const outPath = path.join(jobDir, `seg${segIdx++}.mp4`);
        await processSegment({
          input:       fileMap['intro'],
          output:      outPath,
          hasOverlay:  false,
          isIntro:     true,
          logoPath:    fileMap['logo'] || null,
        });
        processedFiles.push(outPath);
      }

      // CLIPS
      for(let i=0; i<clipKeys.length; i++) {
        const key       = clipKeys[i];
        const sName     = names[i] || `Soporte ${i+1}`;
        const outPath   = path.join(jobDir, `seg${segIdx++}.mp4`);
        await processSegment({
          input:        fileMap[key],
          output:       outPath,
          hasOverlay:   true,
          isIntro:      false,
          soporteName:  sName,
          desde, hasta, overSec, overlayStyle,
          logoPath:     null,
        });
        processedFiles.push(outPath);
      }

      // OUTRO
      if(fileMap['outro']) {
        const outPath = path.join(jobDir, `seg${segIdx++}.mp4`);
        await processSegment({
          input:      fileMap['outro'],
          output:     outPath,
          hasOverlay: false,
          isIntro:    false,
          logoPath:   null,
        });
        processedFiles.push(outPath);
      }

      // ── Concat all segments ──────────────────────────────────────────
      const concatListPath = path.join(jobDir, 'concat.txt');
      const concatContent  = processedFiles.map(f => `file '${f}'`).join('\n');
      fs.writeFileSync(concatListPath, concatContent);

      const outputPath = path.join(jobDir, 'output.mp4');
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(concatListPath)
          .inputOptions(['-f concat', '-safe 0'])
          .outputOptions(['-c copy', '-movflags +faststart'])
          .output(outputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      // ── Stream result to client ──────────────────────────────────────
      const stat     = fs.statSync(outputPath);
      const fileName = `Movimagen_${cliente}_${campana}_videocomprobante.mp4`
        .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');

      res.setHeader('Content-Type',        'video/mp4');
      res.setHeader('Content-Length',      stat.size);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      const readStream = fs.createReadStream(outputPath);
      readStream.pipe(res);
      readStream.on('close', () => cleanup(jobDir));

    } catch(err) {
      console.error('Error generating video:', err);
      cleanup(jobDir);
      res.status(500).json({ error: err.message || 'Error procesando video' });
    }
  }
);

// ── Process one segment with FFmpeg ───────────────────────────────────────
function processSegment({ input, output, hasOverlay, isIntro, soporteName, desde, hasta, overSec, overlayStyle, logoPath }) {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(input);

    // Base video filter: normalize to 1280x720
    const baseScale = 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black';

    let vfChain = baseScale;

    if(hasOverlay) {
      const soporte  = esc(String(soporteName).toUpperCase());
      const periodo  = esc(`Desde: ${desde}  Hasta: ${hasta}`);
      const mv       = 'movimagen';
      const barH     = 130;
      const barY     = overlayStyle === 'bottom' ? 'ih-130' : '0';
      const textY    = overlayStyle === 'bottom' ? 'ih-84'  : '46';
      const mvY      = overlayStyle === 'bottom' ? 'ih-16'  : '8';
      const en       = `lte(t\\,${overSec})`;

      vfChain += [
        `,drawbox=x=0:y=${barY}:w=iw:h=${barH}:color=0xE8601C@0.92:t=fill:enable='${en}'`,
        `,drawtext=text='${soporte}':fontsize=44:fontcolor=white:x=36:y=${textY}-22:enable='${en}'`,
        `,drawtext=text='${periodo}':fontsize=22:fontcolor=white@0.92:x=w-tw-36:y=${textY}-11:enable='${en}'`,
        `,drawtext=text='${mv}':fontsize=17:fontcolor=white@0.55:x=w-tw-24:y=${mvY}:enable='${en}'`,
      ].join('');
    }

    // If logo and intro: use filter_complex to overlay logo
    if(isIntro && logoPath) {
      cmd.input(logoPath);
      const filterComplex = `[0:v]${vfChain}[base];[1:v]scale=210:-1[logo];[base][logo]overlay=W-w-28:H-h-18`;
      cmd
        .complexFilter(filterComplex)
        .outputOptions([
          '-map [out]',
          '-c:v libx264', '-preset fast', '-crf 22',
          '-c:a aac', '-b:a 128k',
          '-movflags +faststart',
        ]);
      // fix map — complexFilter names last output automatically
      cmd.outputOptions(['-map [out]']);
    } else {
      cmd
        .videoFilter(vfChain)
        .outputOptions([
          '-c:v libx264', '-preset fast', '-crf 22',
          '-c:a aac', '-b:a 128k',
          '-movflags +faststart',
        ]);
    }

    cmd
      .output(output)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true, ffmpeg: ffmpegPath }));

app.listen(PORT, () => {
  console.log(`Movimagen Videocomprobantes corriendo en puerto ${PORT}`);
  console.log(`FFmpeg: ${ffmpegPath}`);
});
