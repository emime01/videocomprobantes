// Persistencia local (localStorage) para la Fase 2: sin backend todavía.
// Guarda el config completo del shopping + los clientes/artes por shopping id.
// Es por navegador/dispositivo — no se comparte entre usuarios; eso llega con
// Supabase en la Fase 3. Sirve para editar, recargar y previsualizar sin perder
// el trabajo.

const KEY = (id) => `recorrido:${id}`;

export function guardarConfig(shopping, clientes) {
  try {
    localStorage.setItem(KEY(shopping.id), JSON.stringify({ ...shopping, clientes }));
    return { ok: true };
  } catch (e) {
    // Típicamente QuotaExceededError: los artes/fotos en dataURL pesan mucho.
    return { ok: false, error: e?.name === 'QuotaExceededError' ? 'quota' : 'desconocido' };
  }
}

export function cargarConfig(shoppingId = 'demo-shopping') {
  try {
    const raw = localStorage.getItem(KEY(shoppingId));
    if (!raw) return null;
    const { clientes = [], ...shopping } = JSON.parse(raw);
    return { shopping, clientes };
  } catch {
    return null;
  }
}

export function borrarConfig(shoppingId = 'demo-shopping') {
  try {
    localStorage.removeItem(KEY(shoppingId));
  } catch {
    /* no-op */
  }
}
