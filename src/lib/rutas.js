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

// URL del visor público para un cliente, absoluta y con la base correcta.
export function linkCliente(clienteId) {
  return `${window.location.origin}${BASE}?cliente=${clienteId}`;
}

// True si la URL actual corresponde al editor. Soporta tanto la ruta real
// (/editor, que sirve Vercel con su SPA fallback) como el hash (#/editor),
// que es lo que funciona en GitHub Pages sin rewrites de servidor.
export function esRutaEditor() {
  const path = window.location.pathname.replace(/\/+$/, '');
  const hash = window.location.hash.replace(/^#\/?/, '');
  return path.endsWith('/editor') || hash === 'editor';
}

export { BASE };
