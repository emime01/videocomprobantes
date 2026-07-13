import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ZonaSoporte from './ZonaSoporte';
import Hotspot from './Hotspot';
import PanelEditor from './PanelEditor';
import { comprimirFoto, genId } from '../lib/imagenes';
import { linkVisor, resolverUrl } from '../lib/rutas';
import { borrarConfig, guardarConfig } from '../lib/almacenamiento';
import { cargarRecorrido } from '../lib/catalogo';
import { guardarRemoto, remotoDisponible, subirPendientes } from '../lib/supabase';
import { borrarClave, hayClave, leerClave } from '../lib/adminKey';
import PantallaClave from './PantallaClave';

export default function Editor({ recorridoId, onVolver }) {
  const [shopping, setShopping] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [error, setError] = useState(null);

  const [puntoActualId, setPuntoActualId] = useState(null);
  const [soporteSeleccionadoId, setSoporteSeleccionadoId] = useState(null);
  const [hotspotSeleccionado, setHotspotSeleccionado] = useState(null);
  const [zoom, setZoom] = useState(false);
  const [mostrarLuz, setMostrarLuz] = useState(true);

  // 'guardado' | 'sin-guardar' | 'guardando' | 'error-quota' | 'error-auth' | 'error'
  const [estadoGuardado, setEstadoGuardado] = useState('guardado');
  const [errorGuardado, setErrorGuardado] = useState('');

  // Clave de administración (SPEC 5): se pide al entrar en modo remoto, se
  // guarda en sessionStorage y viaja como x-admin-key en cada escritura.
  const [claveLista, setClaveLista] = useState(() => !remotoDisponible || hayClave());

  const [box, setBox] = useState({ w: 0, h: 0, left: 0, top: 0 });
  const imgRef = useRef(null);
  const draggingRef = useRef(null);
  const hidratadoRef = useRef(false);
  const omitirMarcaRef = useRef(false);

  useEffect(() => {
    // Preferimos lo guardado en este navegador; si no hay, la semilla del catálogo.
    cargarRecorrido(recorridoId)
      .then((data) => {
        if (!data) {
          setError(`No existe el recorrido “${recorridoId}”.`);
          return;
        }
        setShopping(data.shopping);
        setClientes(data.clientes);
        setPuntoActualId(data.shopping.puntos?.[0]?.id || null);
      })
      .catch((e) => setError(e.message));
  }, [recorridoId]);

  // La primera vez que llegan los datos (hidratación) no cuenta como cambio;
  // cualquier edición posterior marca "cambios sin guardar". El reemplazo de
  // dataURLs por URLs subidas durante el guardado tampoco cuenta.
  useEffect(() => {
    if (!shopping) return;
    if (!hidratadoRef.current) {
      hidratadoRef.current = true;
      return;
    }
    if (omitirMarcaRef.current) {
      omitirMarcaRef.current = false;
      return;
    }
    setEstadoGuardado('sin-guardar');
  }, [shopping, clientes]);

  async function guardar() {
    if (!remotoDisponible) {
      const r = guardarConfig(shopping, clientes);
      if (r.ok) setEstadoGuardado('guardado');
      else setEstadoGuardado(r.error === 'quota' ? 'error-quota' : 'error');
      return;
    }
    // Modo remoto: primero suben las imágenes nuevas (dataURL → Storage),
    // después el config completo vía /api/guardar-config.
    setEstadoGuardado('guardando');
    const clave = leerClave();
    try {
      const subido = await subirPendientes(shopping, clientes, clave);
      omitirMarcaRef.current = true;
      setShopping(subido.shopping);
      setClientes(subido.clientes);
      await guardarRemoto(subido.shopping, subido.clientes, clave);
      borrarConfig(recorridoId); // el borrador local ya no hace falta
      setEstadoGuardado('guardado');
    } catch (e) {
      if (e.status === 401) {
        borrarClave();
        setEstadoGuardado('error-auth');
        setClaveLista(false);
      } else {
        setErrorGuardado(e.message || 'No se pudo guardar');
        setEstadoGuardado('error');
      }
    }
  }

  function restablecerDemo() {
    if (!window.confirm('¿Descartar los cambios guardados en este navegador para este recorrido?')) return;
    borrarConfig(recorridoId);
    window.location.reload();
  }

  function editarRecorrido(cambios) {
    setShopping((prev) => ({ ...prev, ...cambios }));
  }

  const punto = useMemo(
    () => shopping?.puntos.find((p) => p.id === puntoActualId) || null,
    [shopping, puntoActualId]
  );
  const soporteSeleccionado = useMemo(
    () => punto?.soportes.find((s) => s.id === soporteSeleccionadoId) || null,
    [punto, soporteSeleccionadoId]
  );

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

  const clientToPercent = useCallback((clientX, clientY) => {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
    };
  }, []);

  useEffect(() => {
    function onMove(e) {
      const d = draggingRef.current;
      if (!d) return;
      const { x, y } = clientToPercent(e.clientX, e.clientY);
      setShopping((prev) => {
        if (!prev) return prev;
        const puntos = prev.puntos.map((p) => {
          if (p.id !== d.puntoId) return p;
          if (d.tipo === 'esquina') {
            return {
              ...p,
              soportes: p.soportes.map((s) =>
                s.id === d.soporteId
                  ? { ...s, esquinas: s.esquinas.map((esq, i) => (i === d.indice ? { x, y } : esq)) }
                  : s
              ),
            };
          }
          return {
            ...p,
            hotspots: p.hotspots.map((h, i) => (i === d.indice ? { ...h, x, y } : h)),
          };
        });
        return { ...prev, puntos };
      });
    }
    function onUp() {
      draggingRef.current = null;
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [clientToPercent]);

  function actualizarPunto(puntoId, fn) {
    setShopping((prev) => ({ ...prev, puntos: prev.puntos.map((p) => (p.id === puntoId ? fn(p) : p)) }));
  }

  function iniciarArrastreEsquina(soporteId, indice) {
    draggingRef.current = { tipo: 'esquina', puntoId: puntoActualId, soporteId, indice };
  }

  function iniciarArrastreHotspot(indice) {
    draggingRef.current = { tipo: 'hotspot', puntoId: puntoActualId, indice };
  }

  function seleccionarPunto(id) {
    setPuntoActualId(id);
    setSoporteSeleccionadoId(null);
    setHotspotSeleccionado(null);
  }

  function crearSoporte() {
    const nuevo = {
      id: genId('s'),
      nombre: 'Nuevo soporte',
      orientacion: 'v',
      esquinas: [
        { x: 40, y: 40 },
        { x: 60, y: 40 },
        { x: 60, y: 60 },
        { x: 40, y: 60 },
      ],
    };
    actualizarPunto(puntoActualId, (p) => ({ ...p, soportes: [...p.soportes, nuevo] }));
    setSoporteSeleccionadoId(nuevo.id);
    setHotspotSeleccionado(null);
  }

  function editarSoporte(soporteId, cambios) {
    actualizarPunto(puntoActualId, (p) => ({
      ...p,
      soportes: p.soportes.map((s) => (s.id === soporteId ? { ...s, ...cambios } : s)),
    }));
  }

  function eliminarSoporte(soporteId) {
    actualizarPunto(puntoActualId, (p) => ({ ...p, soportes: p.soportes.filter((s) => s.id !== soporteId) }));
    setSoporteSeleccionadoId(null);
  }

  function crearHotspot() {
    if (!punto) return;
    const otro = shopping.puntos.find((p) => p.id !== puntoActualId);
    const nuevo = { to: otro?.id || '', x: 50, y: 50, label: 'Nueva parada' };
    const nuevoIndice = (punto.hotspots || []).length;
    actualizarPunto(puntoActualId, (p) => ({ ...p, hotspots: [...(p.hotspots || []), nuevo] }));
    setHotspotSeleccionado(nuevoIndice);
    setSoporteSeleccionadoId(null);
  }

  function editarHotspot(indice, cambios) {
    actualizarPunto(puntoActualId, (p) => ({
      ...p,
      hotspots: p.hotspots.map((h, i) => (i === indice ? { ...h, ...cambios } : h)),
    }));
  }

  function eliminarHotspot(indice) {
    actualizarPunto(puntoActualId, (p) => ({ ...p, hotspots: p.hotspots.filter((_, i) => i !== indice) }));
    setHotspotSeleccionado(null);
  }

  async function crearPunto(file) {
    const foto = await comprimirFoto(file);
    const nuevo = { id: genId('p'), nombre: 'Nuevo punto', foto, hotspots: [], soportes: [] };
    setShopping((prev) => ({ ...prev, puntos: [...prev.puntos, nuevo] }));
    seleccionarPunto(nuevo.id);
  }

  async function reemplazarFotoPunto(puntoId, file) {
    const foto = await comprimirFoto(file);
    actualizarPunto(puntoId, (p) => ({ ...p, foto }));
  }

  function renombrarPunto(puntoId, nombre) {
    actualizarPunto(puntoId, (p) => ({ ...p, nombre }));
  }

  function eliminarPunto(puntoId) {
    if (shopping.puntos.length <= 1) return;
    const restante = shopping.puntos.find((p) => p.id !== puntoId);
    setShopping((prev) => ({
      ...prev,
      puntos: prev.puntos
        .filter((p) => p.id !== puntoId)
        .map((p) => ({ ...p, hotspots: (p.hotspots || []).filter((h) => h.to !== puntoId) })),
    }));
    if (puntoActualId === puntoId) seleccionarPunto(restante?.id || null);
  }

  function moverPunto(puntoId, direccion) {
    setShopping((prev) => {
      const i = prev.puntos.findIndex((p) => p.id === puntoId);
      const j = i + direccion;
      if (j < 0 || j >= prev.puntos.length) return prev;
      const puntos = [...prev.puntos];
      [puntos[i], puntos[j]] = [puntos[j], puntos[i]];
      return { ...prev, puntos };
    });
  }

  function exportarJSON() {
    const data = { ...shopping, clientes };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${shopping.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importarJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const { clientes: clientesImportados = [], ...config } = data;
        setShopping(config);
        setClientes(clientesImportados);
        setPuntoActualId(config.puntos?.[0]?.id || null);
        setSoporteSeleccionadoId(null);
        setHotspotSeleccionado(null);
        setError(null);
      } catch {
        setError('El archivo no es un JSON válido de recorrido');
      }
    };
    reader.readAsText(file);
  }

  if (error)
    return (
      <div className="estado estado-error">
        {error} <a href="#/">Volver al inicio</a>
      </div>
    );

  // Modo remoto: pedir la clave antes de mostrar el editor (SPEC 5).
  if (remotoDisponible && !claveLista)
    return (
      <PantallaClave
        titulo="Editor"
        error={estadoGuardado === 'error-auth'}
        onOk={() => {
          setClaveLista(true);
          if (estadoGuardado === 'error-auth') setEstadoGuardado('sin-guardar');
        }}
      />
    );

  if (!shopping) return <div className="estado">Cargando…</div>;

  const centroide = soporteSeleccionado
    ? {
        x: soporteSeleccionado.esquinas.reduce((a, e) => a + e.x, 0) / 4,
        y: soporteSeleccionado.esquinas.reduce((a, e) => a + e.y, 0) / 4,
      }
    : { x: 50, y: 50 };
  const zoomActivo = zoom && !!soporteSeleccionado;

  return (
    <div className="editor">
      <div className="editor-principal">
        <div className="editor-topbar">
          <button type="button" className="editor-inicio" onClick={onVolver}>← Inicio</button>
          <strong>{shopping.nombre}</strong>
          <button
            type="button"
            className="btn-secundario"
            onClick={guardar}
            disabled={estadoGuardado === 'guardado' || estadoGuardado === 'guardando'}
          >
            {estadoGuardado === 'guardado'
              ? 'Guardado ✓'
              : estadoGuardado === 'guardando'
                ? 'Guardando…'
                : remotoDisponible
                  ? 'Publicar'
                  : 'Guardar'}
          </button>
          <span className={`editor-estado editor-estado-${estadoGuardado}`}>
            {estadoGuardado === 'guardado' &&
              (remotoDisponible ? 'Publicado — lo ve cualquiera con el link' : 'Sin cambios pendientes')}
            {estadoGuardado === 'sin-guardar' &&
              (remotoDisponible ? 'Cambios sin publicar' : 'Cambios sin guardar')}
            {estadoGuardado === 'guardando' && 'Subiendo imágenes y publicando…'}
            {estadoGuardado === 'error-quota' &&
              'No entró en el navegador (demasiado peso). Usá Exportar JSON.'}
            {estadoGuardado === 'error' && (errorGuardado || 'No se pudo guardar')}
          </span>
          <a href={linkVisor(recorridoId)} className="editor-volver">Ver como público ↗</a>
        </div>

        <nav className="visor-paradas">
          {shopping.puntos.map((p, i) => (
            <button
              key={p.id}
              className={`parada ${p.id === puntoActualId ? 'parada-activa' : ''}`}
              onClick={() => seleccionarPunto(p.id)}
            >
              <span className="parada-numero">{i + 1}</span>
              <span className="parada-nombre">{p.nombre}</span>
            </button>
          ))}
        </nav>

        <div className="editor-stage">
          {!punto ? (
            <div className="editor-vacio">
              <p>Este recorrido todavía no tiene fotos.</p>
              <p className="panel-hint">Usá “+ Punto (subir foto)” en el panel para agregar la primera parada.</p>
            </div>
          ) : (
          <>
          <img
            ref={imgRef}
            src={resolverUrl(punto.foto)}
            alt={punto.nombre}
            className="visor-foto"
            draggable={false}
            style={zoomActivo ? { transform: 'scale(16)', transformOrigin: `${centroide.x}% ${centroide.y}%` } : undefined}
          />
          <div
            className="editor-overlay-capa"
            style={{
              left: box.left,
              top: box.top,
              width: box.w,
              height: box.h,
              transform: zoomActivo ? 'scale(16)' : undefined,
              transformOrigin: zoomActivo ? `${centroide.x}% ${centroide.y}%` : undefined,
            }}
            onPointerDown={(e) => {
              if (e.target !== e.currentTarget) return;
              setSoporteSeleccionadoId(null);
              setHotspotSeleccionado(null);
            }}
          >
            {punto.soportes.map((s) => (
              <ZonaSoporte
                key={s.id}
                soporte={s}
                size={box}
                mostrarLuz={mostrarLuz}
                editable
                seleccionado={s.id === soporteSeleccionadoId}
                onSeleccionar={(id) => {
                  setSoporteSeleccionadoId(id);
                  setHotspotSeleccionado(null);
                }}
                onIniciarArrastreEsquina={iniciarArrastreEsquina}
              />
            ))}
            {(punto.hotspots || []).map((h, i) => (
              <Hotspot
                key={i}
                hotspot={h}
                editable
                seleccionado={i === hotspotSeleccionado}
                onSeleccionar={() => {
                  setHotspotSeleccionado(i);
                  setSoporteSeleccionadoId(null);
                }}
                onIniciarArrastre={() => iniciarArrastreHotspot(i)}
              />
            ))}
          </div>
          </>
          )}
        </div>
      </div>

      <PanelEditor
        shopping={shopping}
        punto={punto}
        remoto={remotoDisponible}
        onEditarRecorrido={editarRecorrido}
        soporteSeleccionado={soporteSeleccionado}
        hotspotSeleccionado={hotspotSeleccionado}
        zoom={zoom}
        mostrarLuz={mostrarLuz}
        onSetZoom={setZoom}
        onSetMostrarLuz={setMostrarLuz}
        onEditarSoporte={editarSoporte}
        onEliminarSoporte={eliminarSoporte}
        onCrearSoporte={crearSoporte}
        onEditarHotspot={editarHotspot}
        onEliminarHotspot={eliminarHotspot}
        onCrearHotspot={crearHotspot}
        onSeleccionarHotspot={(i) => {
          setHotspotSeleccionado(i);
          setSoporteSeleccionadoId(null);
        }}
        onRenombrarPunto={renombrarPunto}
        onReemplazarFotoPunto={reemplazarFotoPunto}
        onEliminarPunto={eliminarPunto}
        onMoverPunto={moverPunto}
        onCrearPunto={crearPunto}
        onExportarJSON={exportarJSON}
        onImportarJSON={importarJSON}
        onRestablecerDemo={restablecerDemo}
        linkClientesUrl={`#/${recorridoId}/clientes`}
      />
    </div>
  );
}
