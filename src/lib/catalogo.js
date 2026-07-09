import { BASE } from './rutas';
import { cargarConfig, listarRecorridosLocales } from './almacenamiento';
import { obtenerRecorridoRemoto, obtenerShoppingsRemoto, remotoDisponible } from './supabase';
import { combinarPropuesta } from './propuesta';

// Fuente de datos según el entorno:
// - Con Supabase configurado (Fase 3): las tablas remotas son la verdad; lo
//   local solo aporta borradores todavía no publicados.
// - Sin Supabase: catálogo semilla en /public/catalogo.json + localStorage
//   pisándolo (Fases 1–2, y el build de GitHub Pages).

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
  if (r.tipo === 'propuesta') {
    return {
      id: r.id,
      nombre: r.nombre || r.id,
      categoria: r.categoria || 'Propuestas',
      tipo: 'propuesta',
      incluye: r.incluye || [],
      lugares: (r.incluye || []).length,
      portada: null,
      paradas: 0,
      soportes: 0,
    };
  }
  return {
    id: r.id,
    nombre: r.nombre || r.id,
    categoria: r.categoria || 'Sin categoría',
    portada: r.puntos?.[0]?.foto || null,
    paradas: r.puntos?.length || 0,
    soportes: (r.puntos || []).reduce((a, p) => a + (p.soportes?.length || 0), 0),
  };
}

// Lista para la home.
export async function listarRecorridos() {
  const locales = listarRecorridosLocales();
  const porId = new Map();
  if (remotoDisponible) {
    for (const fila of await obtenerShoppingsRemoto()) {
      porId.set(fila.id, resumenRecorrido({ ...fila.config, id: fila.id, nombre: fila.nombre }));
    }
    // Borradores creados en este navegador que todavía no se publicaron.
    for (const r of locales) if (!porId.has(r.id)) porId.set(r.id, r);
    return [...porId.values()];
  }
  const { recorridos = [] } = await cargarData();
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

// Resolución cruda de un recorrido (sin expandir propuestas). null si no existe.
async function resolverRecorrido(recorridoId) {
  if (remotoDisponible) {
    const remoto = await obtenerRecorridoRemoto(recorridoId);
    if (remoto) return remoto;
    return cargarConfig(recorridoId); // borrador local no publicado
  }
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

// Config completo de un recorrido. Si es una propuesta, la expande en un tour
// continuo combinando los recorridos incluidos. Devuelve { shopping, clientes }.
export async function cargarRecorrido(recorridoId) {
  const base = await resolverRecorrido(recorridoId);
  if (!base) return null;
  if (base.shopping?.tipo !== 'propuesta') return base;

  const incluidos = [];
  for (const rid of base.shopping.incluye || []) {
    const inc = await resolverRecorrido(rid);
    if (inc && inc.shopping?.tipo !== 'propuesta') {
      incluidos.push({ recorridoId: rid, shopping: inc.shopping, clientes: inc.clientes });
    }
  }
  return combinarPropuesta(base.shopping, incluidos);
}
