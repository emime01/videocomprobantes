import { useEffect, useMemo, useRef, useState } from 'react';
import ZonaSoporte from './ZonaSoporte';
import Hotspot from './Hotspot';
import { resolverUrl } from '../lib/rutas';
import { linkConsulta, obtenerContacto } from '../lib/catalogo';

export default function Visor({ shopping, clienteId }) {
  const cliente = clienteId ? shopping.clientesDemo?.[clienteId] : null;

  const [puntoId, setPuntoId] = useState(shopping.puntos[0]?.id);
  const [box, setBox] = useState({ w: 0, h: 0, left: 0, top: 0 });
  // Transición de avance: 'idle' | 'saliendo' | 'entrando'
  const [fase, setFase] = useState('idle');
  const [ficha, setFicha] = useState(null); // soporte tocado (modo comercial)
  const [toast, setToast] = useState('');
  const [contacto, setContacto] = useState(null);

  // Splash de bienvenida: una vez por sesión, solo con cliente en el link.
  const splashKey = `splash:${shopping.id}:${clienteId || ''}`;
  const [splash, setSplash] = useState(() => {
    if (!cliente) return false;
    try {
      return !sessionStorage.getItem(splashKey);
    } catch {
      return true;
    }
  });

  const imgRef = useRef(null);
  const visorRef = useRef(null);

  const punto = useMemo(
    () => shopping.puntos.find((p) => p.id === puntoId),
    [shopping, puntoId]
  );
  const indice = shopping.puntos.findIndex((p) => p.id === puntoId);

  useEffect(() => {
    obtenerContacto().then(setContacto).catch(() => {});
  }, []);

  // Título de pestaña dinámico: material comercial con nombre y ubicación.
  useEffect(() => {
    document.title = cliente
      ? `${cliente.nombre} × ${shopping.nombre} · Movimagen`
      : `${shopping.nombre} · Movimagen`;
  }, [shopping, cliente]);

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

  // Navegación con flechas del teclado (para presentaciones).
  useEffect(() => {
    function onKey(e) {
      if (splash || ficha) return;
      if (e.key === 'ArrowRight' && indice < shopping.puntos.length - 1) irA(shopping.puntos[indice + 1].id);
      if (e.key === 'ArrowLeft' && indice > 0) irA(shopping.puntos[indice - 1].id);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function irA(id) {
    if (id === puntoId || fase !== 'idle') return;
    setFase('saliendo'); // la foto actual avanza hacia adelante y se desvanece
    setTimeout(() => {
      setPuntoId(id);
      setFase('entrando'); // la nueva entra desde un poco más atrás
      setTimeout(() => setFase('idle'), 260);
    }, 220);
  }

  function cerrarSplash() {
    setSplash(false);
    try {
      sessionStorage.setItem(splashKey, '1');
    } catch {
      /* no-op */
    }
  }

  function compartir() {
    navigator.clipboard?.writeText(window.location.href);
    setToast('Link copiado ✓');
    setTimeout(() => setToast(''), 2200);
  }

  function pantallaCompleta() {
    if (document.fullscreenElement) document.exitFullscreen();
    else visorRef.current?.requestFullscreen?.();
  }

  if (!punto) return null;

  const textoGeneral = `Hola, estuve viendo el recorrido "${shopping.nombre}"${
    cliente ? ` con la marca ${cliente.nombre}` : ''
  } y quiero más info sobre los soportes.`;

  return (
    <div className="visor" ref={visorRef}>
      <header className="visor-topbar">
        <a className="marca" href="#/" title="Todos los recorridos">
          MOVIMAGEN<i>·</i>
        </a>
        <div className="visor-titulo">
          <strong>{shopping.nombre}</strong>
          <span>
            {punto.nombre} · parada {indice + 1} de {shopping.puntos.length}
          </span>
        </div>
        <div className="visor-acciones">
          <button type="button" onClick={compartir} title="Copiar link" aria-label="Copiar link">⧉</button>
          <button type="button" onClick={pantallaCompleta} title="Pantalla completa" aria-label="Pantalla completa">⛶</button>
        </div>
      </header>

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
            <ZonaSoporte
              key={s.id}
              soporte={s}
              size={box}
              arteUrl={resolverUrl(cliente?.artes?.[s.id])}
              onClickSoporte={() => setFicha(s)}
            />
          ))}
          {punto.hotspots?.map((h, i) => (
            <Hotspot key={`${punto.id}-${i}`} hotspot={h} onClick={() => irA(h.to)} />
          ))}
        </div>
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

      <a
        className="cta-flotante"
        href={linkConsulta(contacto, textoGeneral)}
        target="_blank"
        rel="noreferrer"
      >
        Anunciá acá →
      </a>

      {splash && cliente && (
        <div className="splash">
          <div className="splash-card">
            <span className="marca marca-grande">MOVIMAGEN<i>·</i></span>
            <h2>{cliente.nombre}</h2>
            <p>
              Así se ve tu marca en <strong>{shopping.nombre}</strong>.
              <br />
              Recorrelo tocando las flechas naranjas.
            </p>
            <button type="button" className="btn-cta" onClick={cerrarSplash}>
              Ver mi marca →
            </button>
          </div>
        </div>
      )}

      {ficha && (
        <div className="ficha-backdrop" onClick={() => setFicha(null)}>
          <div className="ficha" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ficha-cerrar" onClick={() => setFicha(null)} aria-label="Cerrar">
              ✕
            </button>
            <span className={`ficha-tag ${cliente?.artes?.[ficha.id] ? 'ficha-tag-montado' : ''}`}>
              {cliente?.artes?.[ficha.id] ? 'Con tu marca montada' : 'Espacio disponible'}
            </span>
            <h3>{ficha.nombre}</h3>
            <p className="ficha-ubicacion">
              {shopping.nombre} · {punto.nombre} · formato {ficha.orientacion === 'v' ? 'vertical' : 'horizontal'}
            </p>
            <a
              className="btn-cta"
              href={linkConsulta(
                contacto,
                `Hola, me interesa el soporte "${ficha.nombre}" en ${shopping.nombre} (${punto.nombre}).`
              )}
              target="_blank"
              rel="noreferrer"
            >
              Consultar por este soporte →
            </a>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
