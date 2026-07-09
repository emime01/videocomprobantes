// Clave de administración (SPEC 5): se guarda en sessionStorage y viaja como
// x-admin-key en cada escritura a /api. Compartida por el editor y el modo clientes.
const K = 'adminKey';

export function leerClave() {
  try {
    return sessionStorage.getItem(K) || '';
  } catch {
    return '';
  }
}

export function hayClave() {
  return Boolean(leerClave());
}

export function guardarClave(v) {
  try {
    sessionStorage.setItem(K, v);
  } catch {
    /* no-op */
  }
}

export function borrarClave() {
  try {
    sessionStorage.removeItem(K);
  } catch {
    /* no-op */
  }
}
