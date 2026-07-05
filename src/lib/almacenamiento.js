// Persistencia local (localStorage) para la Fase 2: sin backend todavía.
// Un recorrido por clave `recorrido:{id}` con su config completo + clientes/artes.
// Es por navegador/dispositivo — no se comparte entre usuarios; eso llega con
// Supabase en la Fase 3. Sirve para editar, recargar y previsualizar sin perder
// el trabajo.

const PREFIJO = 'recorrido:';
const KEY = (id) => PREFIJO + id;

export function guardarConfig(shopping, clientes) {
  try {
    localStorage.setItem(KEY(shopping.id), JSON.stringify({ ...shopping, clientes }));
    return { ok: true };
  } catch (e) {
    // Típicamente QuotaExceededError: los artes/fotos en dataURL pesan mucho.
    return { ok: false, error: e?.name === 'QuotaExceededError' ? 'quota' : 'desconocido' };
  }
}

export function cargarConfig(recorridoId) {
  try {
    const raw = localStorage.getItem(KEY(recorridoId));
    if (!raw) return null;
    const { clientes = [], ...shopping } = JSON.parse(raw);
    return { shopping, clientes };
  } catch {
    return null;
  }
}

export function borrarConfig(recorridoId) {
  try {
    localStorage.removeItem(KEY(recorridoId));
  } catch {
    /* no-op */
  }
}

// Metadatos de los recorridos guardados en este navegador (para la home).
export function listarRecorridosLocales() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIJO)) continue;
      try {
        const { id, nombre, categoria } = JSON.parse(localStorage.getItem(k));
        if (id) out.push({ id, nombre: nombre || id, categoria: categoria || 'Sin categoría' });
      } catch {
        /* entrada corrupta, la ignoramos */
      }
    }
  } catch {
    /* localStorage no disponible */
  }
  return out;
}
