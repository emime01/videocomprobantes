// Fase 3 — Supabase. El cliente usa solo la anon key para LEER (RLS permite
// select y nada más); toda escritura pasa por las funciones /api de Vercel,
// que validan x-admin-key y usan la service role key del lado del servidor.
// Sin VITE_SUPABASE_URL/ANON_KEY la app queda en modo local (semilla +
// localStorage), como hasta la Fase 2.

// Sacamos la barra final por si se pegó la URL con "/": si no, la app armaría
// ".../supabase.co//rest/v1/..." (doble barra) y Supabase responde 404.
const URL_SB = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const remotoDisponible = Boolean(URL_SB && ANON);

async function rest(consulta) {
  const r = await fetch(`${URL_SB}/rest/v1/${consulta}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  if (!r.ok) throw new Error(`No se pudo leer de Supabase (${r.status})`);
  return r.json();
}

// Filas crudas de shoppings, para que catalogo.js arme los resúmenes.
export async function obtenerShoppingsRemoto() {
  return rest('shoppings?select=id,nombre,config&order=actualizado_en.desc');
}

// Config completo + clientes con sus artes. null si el id no existe.
export async function obtenerRecorridoRemoto(id) {
  const eid = encodeURIComponent(id);
  const filas = await rest(`shoppings?id=eq.${eid}&select=id,nombre,config`);
  if (!filas.length) return null;
  const [clientesFilas, artesFilas] = await Promise.all([
    rest(`clientes?shopping_id=eq.${eid}&select=id,nombre,activo`),
    rest(`artes?shopping_id=eq.${eid}&select=cliente_id,soporte_id,url`),
  ]);
  const clientes = clientesFilas.map((c) => ({ id: c.id, nombre: c.nombre, artes: {} }));
  const porId = new Map(clientes.map((c) => [c.id, c]));
  for (const a of artesFilas) {
    const c = porId.get(a.cliente_id);
    if (c) c.artes[a.soporte_id] = a.url;
  }
  const shopping = { ...filas[0].config, id: filas[0].id, nombre: filas[0].nombre };
  return { shopping, clientes };
}

// ── Escritura (vía /api, requiere la clave de administración) ────────────

async function errorDe(r) {
  let msg = `Error ${r.status}`;
  try {
    msg = (await r.json()).error || msg;
  } catch {
    /* respuesta sin JSON */
  }
  const e = new Error(msg);
  e.status = r.status;
  return e;
}

async function subirArchivo(bucket, path, dataUrl, clave) {
  const r = await fetch('/api/subir-archivo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': clave },
    body: JSON.stringify({ bucket, path, dataUrl }),
  });
  if (!r.ok) throw await errorDe(r);
  const { url } = await r.json();
  return `${url}?v=${Date.now()}`; // rompe caché al reemplazar (SPEC 9)
}

// Sube toda foto/arte que siga en dataURL y devuelve shopping/clientes con
// las URLs públicas ya reemplazadas.
export async function subirPendientes(shopping, clientes, clave) {
  const puntos = [];
  for (const p of shopping.puntos || []) {
    if (p.foto?.startsWith('data:')) {
      const url = await subirArchivo('fotos', `${shopping.id}/${p.id}.jpg`, p.foto, clave);
      puntos.push({ ...p, foto: url });
    } else {
      puntos.push(p);
    }
  }
  const clientesSubidos = [];
  for (const c of clientes) {
    const artes = { ...c.artes };
    for (const [soporteId, u] of Object.entries(artes)) {
      if (u?.startsWith('data:')) {
        artes[soporteId] = await subirArchivo('artes', `${shopping.id}/${c.id}/${soporteId}.jpg`, u, clave);
      }
    }
    clientesSubidos.push({ ...c, artes });
  }
  return { shopping: { ...shopping, puntos }, clientes: clientesSubidos };
}

export async function guardarRemoto(shopping, clientes, clave) {
  const r = await fetch('/api/guardar-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': clave },
    body: JSON.stringify({ shopping, clientes }),
  });
  if (!r.ok) throw await errorDe(r);
}
