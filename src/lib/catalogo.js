import { BASE } from './rutas';
import { cargarConfig, listarRecorridosLocales } from './almacenamiento';

// El catálogo semilla vive en /public/catalogo.json (demo, Fase 1–2). Lo local
// (localStorage) lo pisa y lo extiende: recorridos editados o creados en este
// navegador. En la Fase 3 esto se reemplaza por Supabase.

let dataCache = null;

async function cargarData() {
  if (dataCache) return dataCache;
  const r = await fetch(`${BASE}catalogo.json`);
  if (!r.ok) throw new Error('No se pudo cargar el catálogo de recorridos');
  dataCache = await r.json();
  return dataCache;
}

// Resumen liviano para la home (portada + números que venden).
export function resumenRecorrido(r) {
  return {
    id: r.id,
    nombre: r.nombre || r.id,
    categoria: r.categoria || 'Sin categoría',
    portada: r.puntos?.[0]?.foto || null,
    paradas: r.puntos?.length || 0,
    soportes: (r.puntos || []).reduce((a, p) => a + (p.soportes?.length || 0), 0),
  };
}

// Lista para la home: unión de semilla + locales, con lo local pisando.
export async function listarRecorridos() {
  const { recorridos = [] } = await cargarData();
  const locales = listarRecorridosLocales();
  const porId = new Map();
  for (const r of recorridos) porId.set(r.id, resumenRecorrido(r));
  for (const r of locales) porId.set(r.id, r);
  return [...porId.values()];
}

// Datos de contacto comercial (WhatsApp / email) definidos en el catálogo.
export async function obtenerContacto() {
  const { contacto } = await cargarData();
  return contacto || {};
}

// Link de consulta comercial: WhatsApp si está configurado, si no email.
export function linkConsulta(contacto, texto) {
  if (contacto?.whatsapp) {
    return `https://wa.me/${contacto.whatsapp}?text=${encodeURIComponent(texto)}`;
  }
  const email = contacto?.email || 'comercial@movimagen.com.uy';
  return `mailto:${email}?subject=${encodeURIComponent('Consulta por soportes publicitarios')}&body=${encodeURIComponent(texto)}`;
}

// Config completo de un recorrido: primero lo guardado en el navegador, si no
// la semilla. Devuelve { shopping, clientes } (clientes como arreglo).
export async function cargarRecorrido(recorridoId) {
  const local = cargarConfig(recorridoId);
  if (local) return local;
  const { recorridos = [] } = await cargarData();
  const r = recorridos.find((x) => x.id === recorridoId);
  if (!r) return null;
  const { clientesDemo = {}, ...shopping } = r;
  const clientes = Object.entries(clientesDemo).map(([id, c]) => ({
    id,
    nombre: c.nombre,
    artes: { ...c.artes },
  }));
  return { shopping, clientes };
}
