import { useEffect, useMemo, useRef, useState } from 'react';
import ZonaSoporte from './ZonaSoporte';
import Hotspot from './Hotspot';

export default function Visor({ shopping, clienteId }) {
  const [puntoId, setPuntoId] = useState(shopping.puntos[0]?.id);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [fading, setFading] = useState(false);
  const stageRef = useRef(null);

  const punto = useMemo(
    () => shopping.puntos.find((p) => p.id === puntoId),
    [shopping, puntoId]
  );
  const cliente = clienteId ? shopping.clientesDemo?.[clienteId] : null;

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Precarga las fotos de los puntos vecinos.
  useEffect(() => {
    punto?.hotspots?.forEach((h) => {
      const destino = shopping.puntos.find((p) => p.id === h.to);
      if (destino) new Image().src = destino.foto;
    });
  }, [punto, shopping]);

  function irA(id) {
    if (id === puntoId) return;
    setFading(true);
    setTimeout(() => {
      setPuntoId(id);
      setFading(false);
    }, 200);
  }

  if (!punto) return null;

  return (
    <div className="visor">
      <div className="visor-stage" ref={stageRef}>
        <img
          src={punto.foto}
          alt={punto.nombre}
          className={`visor-foto ${fading ? 'visor-foto-fade' : ''}`}
          draggable={false}
        />
        {punto.soportes.map((s) => (
          <ZonaSoporte key={s.id} soporte={s} size={size} arteUrl={cliente?.artes?.[s.id]} />
        ))}
        {punto.hotspots?.map((h, i) => (
          <Hotspot key={`${punto.id}-${i}`} hotspot={h} onClick={() => irA(h.to)} />
        ))}
        <div className="visor-marca">MOVIMAGEN</div>
      </div>

      <nav className="visor-paradas">
        {shopping.puntos.map((p, i) => (
          <button
            key={p.id}
            className={`parada ${p.id === puntoId ? 'parada-activa' : ''}`}
            onClick={() => irA(p.id)}
          >
            <span className="parada-numero">{i + 1}</span>
            <span className="parada-nombre">{p.nombre}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
