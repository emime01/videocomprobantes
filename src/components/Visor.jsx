import { useEffect, useMemo, useRef, useState } from 'react';
import ZonaSoporte from './ZonaSoporte';
import Hotspot from './Hotspot';
import Logo, { Monograma } from './Logo';
import { alternarPantallaCompleta, pedirPantallaCompleta, resolverUrl } from '../lib/rutas';
import { linkConsulta, obtenerContacto } from '../lib/catalogo';

export default function Visor({ shopping, clienteId }) {
  const cliente = clienteId ? shopping.clientesDemo?.[clienteId] : null;

  const [puntoId, setPuntoId] = useState(shopping.puntos[0]?.id);
  const [box, setBox] = useState({ w: 0, h: 0, left: 0, top: 0 });
  // Transición de avance: 'idle' | 'saliendo' | 'entrando'
  const [fase, setFase] = useState('idle');
  const [montarArte, setMontarArte] = useState(true); // dispara la animación del arte al llegar
  const [ficha, setFicha] = useState(null);
  const [toast, setToast] = useState('');
  const [contacto, setContacto] = useState(null);
  const [autoplay, setAutoplay] = useState(false);
  const [cierre, setCierre] = useState(false); // pantalla de cierre al terminar
  const [lugarBanner, setLugarBanner] = useState(''); // cartel al cambiar de lugar (propuestas)
  const lugarPrevRef = useRef(null);

  // Apertura: solo cuando el link trae cliente. Una vez por sesión.
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
  const totalConArte = useMemo(() => {
    if (!cliente) return 0;
    return shopping.puntos.reduce(
      (a, p) => a + p.soportes.filter((s) => cliente.artes?.[s.id]).length,
      0
    );
  }, [shopping, cliente]);
  const totalSoportes = useMemo(
    () => shopping.puntos.reduce((a, p) => a + p.soportes.length, 0),
    [shopping]
  );

  useEffect(() => {
    obtenerContacto().then(setContacto).catch(() => {});
  }, []);

  useEffect(() => {
    document.title = cliente
      ? `${cliente.nombre} × ${shopping.nombre} · Movimagen`
      : `${shopping.nombre} · Movimagen`;
  }, [shopping, cliente]);

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

  // Precarga TODAS las fotos del recorrido apenas se abre (no solo las
  // vecinas): en una propuesta con varios lugares, cruzar de uno a otro no
  // debe esperar la descarga de la primera foto de ese lugar.
  useEffect(() => {
    shopping.puntos.forEach((p) => {
      new Image().src = resolverUrl(p.foto);
    });
  }, [shopping]);

  // Al cambiar de parada, re-disparamos el "montaje" del arte.
  useEffect(() => {
    setMontarArte(false);
    const t = setTimeout(() => setMontarArte(true), 30);
    return () => clearTimeout(t);
  }, [punto?.id]);

  // En una propuesta, al entrar a un lugar nuevo mostramos un cartel breve.
  useEffect(() => {
    const lugar = punto?.lugar;
    if (!lugar) return;
    if (lugarPrevRef.current !== null && lugarPrevRef.current !== lugar) {
      setLugarBanner(lugar);
      const t = setTimeout(() => setLugarBanner(''), 1700);
      lugarPrevRef.current = lugar;
      return () => clearTimeout(t);
    }
    lugarPrevRef.current = lugar;
  }, [punto?.id, punto?.lugar]);

  // Navegación con flechas del teclado.
  useEffect(() => {
    function onKey(e) {
      if (splash || ficha || cierre) return;
      if (e.key === 'ArrowRight') avanzar();
      if (e.key === 'ArrowLeft' && indice > 0) irA(shopping.puntos[indice - 1].id);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Tour automático.
  useEffect(() => {
    if (!autoplay || splash || cierre) return;
    const t = setTimeout(() => {
      if (indice < shopping.puntos.length - 1) irA(shopping.puntos[indice + 1].id);
      else {
        setAutoplay(false);
        setCierre(true);
      }
    }, 3200);
    return () => clearTimeout(t);
  }, [autoplay, indice, splash, cierre, puntoId]);

  function irA(id) {
    if (id === puntoId || fase !== 'idle') return;
    setFase('saliendo');
    setTimeout(() => {
      setPuntoId(id);
      setFase('entrando');
      setTimeout(() => setFase('idle'), 260);
    }, 220);
  }

  function avanzar() {
    if (indice < shopping.puntos.length - 1) irA(shopping.puntos[indice + 1].id);
    else setCierre(true);
  }

  function cerrarSplash() {
    pedirPantallaCompleta();
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

  if (!punto) return null;

  // Un soporte con capa:'debajo' se pinta detrás de la foto (para fotos con
  // un hueco transparente preparado, típico en buses de forma más compleja).
  const soportesDetras = punto.soportes.filter((s) => s.capa === 'debajo');
  const soportesEncima = punto.soportes.filter((s) => s.capa !== 'debajo');

  const textoGeneral = `Hola, estuve viendo el recorrido "${shopping.nombre}"${
    cliente ? ` con la marca ${cliente.nombre}` : ''
  } y quiero más info sobre los soportes.`;

  return (
    <div className="visor" ref={visorRef}>
      {/* Progreso tipo historias */}
      <div className="visor-progreso">
        {shopping.puntos.map((p, i) => (
          <span key={p.id} className={`prog ${i < indice ? 'prog-hecha' : ''} ${i === indice ? 'prog-actual' : ''}`} />
        ))}
      </div>

      <header className="visor-topbar">
        <a className="marca" href="#/" title="Todos los recorridos">
          <Logo />
        </a>
        <div className="visor-titulo">
          <strong>{punto.lugar || shopping.nombre}</strong>
          <span>
            {punto.nombre} · parada {indice + 1} de {shopping.puntos.length}
          </span>
        </div>
        <div className="visor-acciones">
          <button
            type="button"
            className={autoplay ? 'activo' : ''}
            onClick={() => setAutoplay((v) => !v)}
            title={autoplay ? 'Pausar tour' : 'Reproducir tour'}
            aria-label="Tour automático"
          >
            {autoplay ? '❚❚' : '▶'}
          </button>
          <button type="button" onClick={compartir} title="Copiar link" aria-label="Copiar link">⧉</button>
          <button type="button" onClick={alternarPantallaCompleta} title="Pantalla completa" aria-label="Pantalla completa">⛶</button>
        </div>
      </header>

      <div className="visor-stage">
        {/* Soportes "debajo": se pintan detrás de la foto. La foto necesita un
            hueco transparente ahí para que se vean (buses con formas complejas). */}
        <div
          className={`visor-overlay-capa visor-overlay-detras visor-overlay-${fase}`}
          style={{ left: box.left, top: box.top, width: box.w, height: box.h }}
        >
          {soportesDetras.map((s) => (
            <ZonaSoporte
              key={s.id}
              soporte={s}
              size={box}
              arteUrl={resolverUrl(cliente?.artes?.[s.id])}
              montando={montarArte && !!cliente?.artes?.[s.id]}
              onClickSoporte={() => setFicha(s)}
            />
          ))}
        </div>
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
          {soportesEncima.map((s) => (
            <ZonaSoporte
              key={s.id}
              soporte={s}
              size={box}
              arteUrl={resolverUrl(cliente?.artes?.[s.id])}
              montando={montarArte && !!cliente?.artes?.[s.id]}
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

      <a className="cta-flotante" href={linkConsulta(contacto, textoGeneral)} target="_blank" rel="noreferrer">
        Anunciá acá →
      </a>

      {splash && cliente && (
        <div className="splash">
          <div className="splash-card">
            <Logo className="logo-lg splash-logo" />
            <p className="splash-intro">Preparamos esta experiencia para</p>
            <h2>{cliente.nombre}</h2>
            <p className="splash-sub">
              Así se ve tu marca en <strong>{shopping.nombre}</strong>.
              Recorrelo y mirá el impacto real.
            </p>
            <button type="button" className="btn-cta btn-cta-lg" onClick={cerrarSplash}>
              Ver mi marca →
            </button>
          </div>
        </div>
      )}

      {ficha && (
        <div className="ficha-backdrop" onClick={() => setFicha(null)}>
          <div className="ficha" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ficha-cerrar" onClick={() => setFicha(null)} aria-label="Cerrar">✕</button>
            <span className={`ficha-tag ${cliente?.artes?.[ficha.id] ? 'ficha-tag-montado' : ''}`}>
              {cliente?.artes?.[ficha.id] ? 'Con tu marca montada' : 'Espacio disponible'}
            </span>
            <h3>{ficha.nombre}</h3>
            <p className="ficha-ubicacion">
              {shopping.nombre} · {punto.nombre} · formato {ficha.orientacion === 'v' ? 'vertical' : 'horizontal'}
            </p>
            <a
              className="btn-cta"
              href={linkConsulta(contacto, `Hola, me interesa el soporte "${ficha.nombre}" en ${shopping.nombre} (${punto.nombre}).`)}
              target="_blank"
              rel="noreferrer"
            >
              Consultar por este soporte →
            </a>
          </div>
        </div>
      )}

      {cierre && (
        <div className="splash cierre">
          <div className="splash-card">
            <Monograma className="cierre-mono" />
            <h2 className="cierre-titulo">¿Estás listo para llevar tu marca al siguiente nivel?</h2>
            <p className="splash-sub">
              {cliente
                ? `Viste a ${cliente.nombre} en ${totalConArte} ${totalConArte === 1 ? 'soporte' : 'soportes'} de ${shopping.nombre}.`
                : `${totalSoportes} ${totalSoportes === 1 ? 'soporte disponible' : 'soportes disponibles'} en ${shopping.nombre}.`}
            </p>
            <a
              className="btn-cta btn-cta-lg"
              href={linkConsulta(contacto, textoGeneral)}
              target="_blank"
              rel="noreferrer"
            >
              Quiero anunciar →
            </a>
            <button type="button" className="cierre-volver" onClick={() => { setCierre(false); irA(shopping.puntos[0].id); }}>
              Ver el recorrido de nuevo
            </button>
          </div>
        </div>
      )}

      {lugarBanner && (
        <div className="lugar-banner">
          <span>Ahora en</span>
          <strong>{lugarBanner}</strong>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
