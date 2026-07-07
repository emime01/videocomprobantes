// Función serverless de Vercel: sube una imagen (ya comprimida en el cliente)
// a Storage con la service role key y devuelve su URL pública. Valida
// x-admin-key contra ADMIN_KEY (SPEC 9).

const SB = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (!process.env.ADMIN_KEY || req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Clave incorrecta' });
  }
  if (!SB || !SRK) {
    return res.status(500).json({ error: 'Faltan las variables de Supabase en el servidor' });
  }

  const { bucket, path, dataUrl } = req.body || {};
  if (!['fotos', 'artes'].includes(bucket)) {
    return res.status(400).json({ error: 'Bucket inválido' });
  }
  if (typeof path !== 'string' || !/^[a-zA-Z0-9._/-]+$/.test(path) || path.includes('..')) {
    return res.status(400).json({ error: 'Path inválido' });
  }
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) return res.status(400).json({ error: 'Se esperaba una imagen en dataURL' });

  const r = await fetch(`${SB}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      'Content-Type': m[1],
      'x-upsert': 'true', // reemplazar es sobrescribir (SPEC 9)
    },
    body: Buffer.from(m[2], 'base64'),
  });
  if (!r.ok) return res.status(502).json({ error: `Supabase (storage): ${await r.text()}` });

  return res.status(200).json({ url: `${SB}/storage/v1/object/public/${bucket}/${path}` });
}
