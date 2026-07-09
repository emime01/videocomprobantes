// Una "propuesta" combina varios recorridos (Colonia + Paysandú + Bus) en un
// tour continuo. No guarda puntos propios: referencia otros recorridos por id
// (config.tipo === 'propuesta', config.incluye = [recorridoId, ...]).
//
// combinarPropuesta concatena los puntos de cada recorrido incluido, con ids
// "namespaceados" por recorrido (para que no choquen entre lugares), agrega el
// nombre del lugar a cada punto, cose hotspots entre lugares (última parada de
// un lugar → primera del siguiente) y unifica los artes de cada cliente.

export function combinarPropuesta(prop, incluidos) {
  const puntos = [];
  const segmentos = []; // { lugar, primerId, ultimoPunto }
  const porCliente = new Map(); // slug -> { id, nombre, artes }

  for (const inc of incluidos) {
    const rid = inc.recorridoId;
    const lugar = inc.shopping.nombre;
    const ns = (x) => `${rid}::${x}`;
    const puntosLugar = (inc.shopping.puntos || []).map((p) => ({
      ...p,
      id: ns(p.id),
      lugar,
      hotspots: (p.hotspots || []).map((h) => ({ ...h, to: ns(h.to) })),
      soportes: (p.soportes || []).map((s) => ({ ...s, id: ns(s.id) })),
    }));
    if (puntosLugar.length === 0) continue;

    segmentos.push({ lugar, primerId: puntosLugar[0].id, ultimoPunto: puntosLugar[puntosLugar.length - 1] });
    puntos.push(...puntosLugar);

    for (const c of inc.clientes || []) {
      if (!porCliente.has(c.id)) porCliente.set(c.id, { id: c.id, nombre: c.nombre, artes: {} });
      const dst = porCliente.get(c.id).artes;
      for (const [sid, url] of Object.entries(c.artes || {})) dst[ns(sid)] = url;
    }
  }

  // Coser lugares: al final de cada lugar, un hotspot al primero del siguiente.
  for (let i = 0; i < segmentos.length - 1; i++) {
    const sig = segmentos[i + 1];
    segmentos[i].ultimoPunto.hotspots = [
      ...(segmentos[i].ultimoPunto.hotspots || []),
      { to: sig.primerId, x: 50, y: 84, label: `Ir a ${sig.lugar}` },
    ];
  }

  const shopping = {
    id: prop.id,
    nombre: prop.nombre,
    categoria: prop.categoria || 'Propuestas',
    tipo: 'propuesta',
    incluye: prop.incluye || [],
    puntos,
  };
  return { shopping, clientes: [...porCliente.values()] };
}
