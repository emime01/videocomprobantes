import { BASE } from './rutas';
import { cargarConfig, listarRecorridosLocales } from './almacenamiento';

// El catálogo semilla vive en /public/catalogo.json (demo, Fase 1–2). Lo local
// (localStorage) lo pisa y lo extiende: recorridos editados o creados en este
// navegador. En la Fase 3 esto se reemplaza por Supabase.

let semillaCache = null;

async function cargarSemilla() {
  if (semillaCache) return semillaCache;
  const r = await fetch(`${BASE}catalogo.json`);
  if (!r.ok) throw new Error('No se pudo cargar el catálogo de recorridos');
  const data = await r.json();
  semillaCache = data.recorridos || [];
  return semillaCache;
}

// Lista de recorridos para la home: unión de semilla + locales, sin duplicar,
// con los metadatos locales pisando a los de la semilla.
export async function listarRecorridos() {
  const semilla = await cargarSemilla();
  const locales = listarRecorridosLocales();
  const porId = new Map();
  for (const r of semilla) porId.set(r.id, { id: r.id, nombre: r.nombre, categoria: r.categoria || 'Sin categoría' });
  for (const r of locales) porId.set(r.id, r);
  return [...porId.values()];
}

// Config completo de un recorrido: primero lo guardado en el navegador, si no
// la semilla. Devuelve { shopping, clientes } (clientes como arreglo).
export async function cargarRecorrido(recorridoId) {
  const local = cargarConfig(recorridoId);
  if (local) return local;
  const semilla = await cargarSemilla();
  const r = semilla.find((x) => x.id === recorridoId);
  if (!r) return null;
  const { clientesDemo = {}, ...shopping } = r;
  const clientes = Object.entries(clientesDemo).map(([id, c]) => ({
    id,
    nombre: c.nombre,
    artes: { ...c.artes },
  }));
  return { shopping, clientes };
}
