// Función serverless de Vercel: persiste el config completo de un recorrido
// en Supabase. Única vía de escritura a las tablas — usa la service role key
// (nunca llega al cliente) y valida x-admin-key contra ADMIN_KEY (SPEC 4.2).

const SB = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

function cab(extra = {}) {
  return {
    apikey: SRK,
    Authorization: `Bearer ${SRK}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (!process.env.ADMIN_KEY || req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Clave incorrecta' });
  }
  if (!SB || !SRK) {
    return res.status(500).json({ error: 'Faltan las variables de Supabase en el servidor' });
  }

  const { shopping, clientes = [] } = req.body || {};
  if (!shopping?.id || !/^[a-z0-9-]+$/.test(shopping.id)) {
    return res.status(400).json({ error: 'Falta un id válido de recorrido' });
  }
  const id = shopping.id;

  // 1) Upsert del shopping con el config completo como jsonb.
  let r = await fetch(`${SB}/rest/v1/shoppings?on_conflict=id`, {
    method: 'POST',
    headers: cab({ Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify([
      {
        id,
        nombre: shopping.nombre || id,
        config: shopping,
        actualizado_en: new Date().toISOString(),
      },
    ]),
  });
  if (!r.ok) return res.status(502).json({ error: `Supabase (shopping): ${await r.text()}` });

  // 2) Reemplazo total de clientes y artes del shopping. El volumen es chico
  //    y así el estado remoto queda idéntico a lo que se ve en el editor.
  await fetch(`${SB}/rest/v1/artes?shopping_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: cab() });
  await fetch(`${SB}/rest/v1/clientes?shopping_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: cab() });

  if (clientes.length) {
    r = await fetch(`${SB}/rest/v1/clientes`, {
      method: 'POST',
      headers: cab(),
      body: JSON.stringify(
        clientes.map((c) => ({ shopping_id: id, id: c.id, nombre: c.nombre || c.id, activo: c.activo !== false }))
      ),
    });
    if (!r.ok) return res.status(502).json({ error: `Supabase (clientes): ${await r.text()}` });

    const filas = [];
    for (const c of clientes) {
      for (const [soporteId, url] of Object.entries(c.artes || {})) {
        // Los dataURL se suben antes por /api/subir-archivo; acá solo URLs.
        if (typeof url === 'string' && !url.startsWith('data:')) {
          filas.push({ shopping_id: id, cliente_id: c.id, soporte_id: soporteId, url });
        }
      }
    }
    if (filas.length) {
      r = await fetch(`${SB}/rest/v1/artes`, { method: 'POST', headers: cab(), body: JSON.stringify(filas) });
      if (!r.ok) return res.status(502).json({ error: `Supabase (artes): ${await r.text()}` });
    }
  }

  return res.status(200).json({ ok: true });
}
