import { useEffect, useMemo, useRef, useState } from 'react';
import ZonaSoporte from './ZonaSoporte';
import Hotspot from './Hotspot';
import { resolverUrl } from '../lib/rutas';

export default function Visor({ shopping, clienteId }) {
  const [puntoId, setPuntoId] = useState(shopping.puntos[0]?.id);
  const [box, setBox] = useState({ w: 0, h: 0, left: 0, top: 0 });
  // Transición de avance: 'idle' | 'saliendo' | 'entrando'
  const [fase, setFase] = useState('idle');
  const imgRef = useRef(null);

  const punto = useMemo(
    () => shopping.puntos.find((p) => p.id === puntoId),
    [shopping, puntoId]
  );
  const cliente = clienteId ? shopping.clientesDemo?.[clienteId] : null;

  // La foto puede quedar con letterbox dentro del stage (aspect ratio propia).
  // Medimos la caja realmente renderizada de la <img> para que los porcentajes
  // de esquinas/hotspots se ubiquen sobre la foto y no sobre el contenedor.
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    function medir() {
      setBox({ w: img.offsetWidth, h: img.offsetHeight, left: img.offsetLeft, top: img.offsetTop });
    }
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(img);
    return () => ro.disconnect();
  }, [punto?.id]);

  // Precarga las fotos de los puntos vecinos.
  useEffect(() => {
    punto?.hotspots?.forEach((h) => {
      const destino = shopping.puntos.find((p) => p.id === h.to);
      if (destino) new Image().src = resolverUrl(destino.foto);
    });
  }, [punto, shopping]);

  function irA(id) {
    if (id === puntoId || fase !== 'idle') return;
    setFase('saliendo'); // la foto actual avanza hacia adelante y se desvanece
    setTimeout(() => {
      setPuntoId(id);
      setFase('entrando'); // la nueva entra desde un poco más atrás
      setTimeout(() => setFase('idle'), 260);
    }, 220);
  }

  if (!punto) return null;

  return (
    <div className="visor">
      <div className="visor-stage">
        <img
          ref={imgRef}
          src={resolverUrl(punto.foto)}
          alt={punto.nombre}
          className={`visor-foto visor-foto-${fase}`}
          draggable={false}
        />
        <div
          className={`visor-overlay-capa visor-overlay-${fase}`}
          style={{ left: box.left, top: box.top, width: box.w, height: box.h }}
        >
          {punto.soportes.map((s) => (
            <ZonaSoporte key={s.id} soporte={s} size={box} arteUrl={resolverUrl(cliente?.artes?.[s.id])} />
          ))}
          {punto.hotspots?.map((h, i) => (
            <Hotspot key={`${punto.id}-${i}`} hotspot={h} onClick={() => irA(h.to)} />
          ))}
        </div>
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
