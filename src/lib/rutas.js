// Base del deploy: '/' en dev y Vercel, '/videocomprobantes/' en GitHub Pages.
const BASE = import.meta.env.BASE_URL;

// Resuelve una URL de la config contra la base del deploy. Las URLs absolutas
// (http, data, blob — p.ej. artes remotos de Supabase o dataURLs del editor)
// pasan sin tocar; las rutas root-relative ("/demo/p1.svg") se prefijan con la
// base para que funcionen también bajo el subpath de GitHub Pages.
export function resolverUrl(u) {
  if (!u) return u;
  if (/^(https?:|data:|blob:)/.test(u)) return u;
  if (u.startsWith('/')) return BASE.replace(/\/$/, '') + u;
  return u;
}

// Ruteo por hash (funciona en GitHub Pages sin rewrites de servidor):
//   #/                       -> home (lista de recorridos)
//   #/{recorridoId}          -> visor de ese recorrido
//   #/{recorridoId}/editor   -> editor de ese recorrido
// El cliente para el visor viaja como query (?cliente=slug).
export function parseRuta() {
  const clienteId = new URLSearchParams(window.location.search).get('cliente');
  const partes = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (partes.length === 0) return { vista: 'home', clienteId };
  const recorridoId = partes[0];
  const vista = partes[1] === 'editor' ? 'editor' : 'visor';
  return { vista, recorridoId, clienteId };
}

export function irA(hashPath) {
  // hashPath sin el '#', p.ej. '/demo-shopping' o '/demo-shopping/editor' o '/'
  window.location.hash = hashPath;
}

export function linkVisor(recorridoId) {
  return `#/${recorridoId}`;
}

export function linkEditor(recorridoId) {
  return `#/${recorridoId}/editor`;
}

// Link público absoluto de un cliente para un recorrido (para "copiar link").
export function linkCliente(recorridoId, clienteId) {
  return `${window.location.origin}${BASE}?cliente=${clienteId}#/${recorridoId}`;
}

export { BASE };
