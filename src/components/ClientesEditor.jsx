import { useEffect, useMemo, useRef, useState } from 'react';
import ZonaSoporte from './ZonaSoporte';
import PantallaClave from './PantallaClave';
import { comprimirArte, genId, slugify } from '../lib/imagenes';
import { linkCliente, resolverUrl } from '../lib/rutas';
import { guardarConfig } from '../lib/almacenamiento';
import { cargarRecorrido } from '../lib/catalogo';
import { guardarRemoto, remotoDisponible, subirPendientes } from '../lib/supabase';
import { borrarClave, hayClave, leerClave } from '../lib/adminKey';

// Modo "Clientes": sobre un recorrido YA armado (fotos + soportes calibrados),
// solo se asignan las imágenes de cada anunciante. No se toca la calibración.
export default function ClientesEditor({ recorridoId, onVolver }) {
  const [shopping, setShopping] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [error, setError] = useState(null);
  const [claveLista, setClaveLista] = useState(() => !remotoDisponible || hayClave());

  const [clienteActivoId, setClienteActivoId] = useState(null);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [puntoPreviewId, setPuntoPreviewId] = useState(null);
  const [estado, setEstado] = useState('guardado'); // guardado | sin-guardar | guardando | error-auth | error
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState('');

  const [box, setBox] = useState({ w: 0, h: 0, left: 0, top: 0 });
  const imgRef = useRef(null);
  const hidratadoRef = useRef(false);

  useEffect(() => {
    cargarRecorrido(recorridoId)
      .then((data) => {
        if (!data) {
          setError(`No existe el recorrido “${recorridoId}”.`);
          return;
        }
        setShopping(data.shopping);
        setClientes(data.clientes);
        setClienteActivoId(data.clientes[0]?.id || null);
        setPuntoPreviewId(data.shopping.puntos?.[0]?.id || null);
      })
      .catch((e) => setError(e.message));
  }, [recorridoId]);

  useEffect(() => {
    if (!shopping) return;
    if (!hidratadoRef.current) {
      hidratadoRef.current = true;
      return;
    }
    setEstado('sin-guardar');
  }, [clientes]);

  const clienteActivo = useMemo(
    () => clientes.find((c) => c.id === clienteActivoId) || null,
    [clientes, clienteActivoId]
  );
  const puntoPreview = useMemo(
    () => shopping?.puntos.find((p) => p.id === puntoPreviewId) || null,
    [shopping, puntoPreviewId]
  );

  // Medir la caja real de la foto de preview.
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
  }, [puntoPreview?.id]);

  function crearCliente() {
    const nombre = nombreNuevo.trim();
    if (!nombre) return;
    let id = slugify(nombre) || genId('c');
    if (clientes.some((c) => c.id === id)) id = `${id}-${Math.random().toString(36).slice(2, 5)}`;
    setClientes((prev) => [...prev, { id, nombre, artes: {} }]);
    setClienteActivoId(id);
    setNombreNuevo('');
  }

  function eliminarCliente(id) {
    if (!window.confirm('¿Eliminar este cliente y sus artes de este recorrido?')) return;
    setClientes((prev) => prev.filter((c) => c.id !== id));
    if (clienteActivoId === id) setClienteActivoId(null);
  }

  async function subirArte(soporteId, file) {
    if (!clienteActivoId) return;
    const url = await comprimirArte(file);
    setClientes((prev) =>
      prev.map((c) => (c.id === clienteActivoId ? { ...c, artes: { ...c.artes, [soporteId]: url } } : c))
    );
  }

  // Sube un solo arte y lo aplica a TODOS los soportes de esa orientación en
  // TODO el recorrido (todos los verticales juntos, todos los horizontales
  // juntos). No aplica a Buses: sus soportes tienen formas más específicas
  // (frente/lateral/trasera) y conviene cargarlos uno por uno.
  async function subirArteMasivo(orientacion, file) {
    if (!clienteActivoId) return;
    const url = await comprimirArte(file);
    const idsDeEsaOrientacion = shopping.puntos.flatMap((p) =>
      p.soportes.filter((s) => s.orientacion === orientacion).map((s) => s.id)
    );
    setClientes((prev) =>
      prev.map((c) => {
        if (c.id !== clienteActivoId) return c;
        const artes = { ...c.artes };
        for (const id of idsDeEsaOrientacion) artes[id] = url;
        return { ...c, artes };
      })
    );
  }

  function quitarArte(soporteId) {
    setClientes((prev) =>
      prev.map((c) => {
        if (c.id !== clienteActivoId) return c;
        const artes = { ...c.artes };
        delete artes[soporteId];
        return { ...c, artes };
      })
    );
  }

  function copiarLink(id) {
    navigator.clipboard?.writeText(linkCliente(recorridoId, id));
    setToast('Link copiado ✓');
    setTimeout(() => setToast(''), 2000);
  }

  async function publicar() {
    if (!remotoDisponible) {
      const r = guardarConfig(shopping, clientes); // el config base va igual, sin cambios
      setEstado(r.ok ? 'guardado' : 'error');
      if (!r.ok) setErrorMsg(r.error === 'quota' ? 'No entró en el navegador (demasiado peso).' : 'No se pudo guardar');
      return;
    }
    setEstado('guardando');
    const clave = leerClave();
    try {
      // Solo suben artes nuevos (las fotos base ya son URLs, no se re-suben).
      const subido = await subirPendientes(shopping, clientes, clave);
      setClientes(subido.clientes);
      await guardarRemoto(shopping, subido.clientes, clave);
      setEstado('guardado');
    } catch (e) {
      if (e.status === 401) {
        borrarClave();
        setEstado('error-auth');
        setClaveLista(false);
      } else {
        setErrorMsg(e.message || 'No se pudo publicar');
        setEstado('error');
      }
    }
  }

  if (error)
    return (
      <div className="estado estado-error">
        {error} <a href="#/">Volver al inicio</a>
      </div>
    );

  if (remotoDisponible && !claveLista)
    return (
      <PantallaClave
        titulo="Clientes"
        error={estado === 'error-auth'}
        onOk={() => {
          setClaveLista(true);
          if (estado === 'error-auth') setEstado('sin-guardar');
        }}
      />
    );

  if (!shopping) return <div className="estado">Cargando…</div>;

  const soportesTotales = shopping.puntos.reduce((a, p) => a + p.soportes.length, 0);
  const artesCargados = clienteActivo
    ? shopping.puntos.reduce((a, p) => a + p.soportes.filter((s) => clienteActivo.artes?.[s.id]).length, 0)
    : 0;
  const esBus = shopping.categoria === 'Buses';
  const totalVerticales = shopping.puntos.reduce((a, p) => a + p.soportes.filter((s) => s.orientacion === 'v').length, 0);
  const totalHorizontales = shopping.puntos.reduce((a, p) => a + p.soportes.filter((s) => s.orientacion === 'h').length, 0);

  return (
    <div className="clientes-modo">
      <div className="editor-principal">
        <div className="editor-topbar">
          <button type="button" className="editor-inicio" onClick={onVolver}>← Inicio</button>
          <strong>{shopping.nombre} · Clientes</strong>
          <button
            type="button"
            className="btn-secundario"
            onClick={publicar}
            disabled={estado === 'guardado' || estado === 'guardando'}
          >
            {estado === 'guardado' ? 'Publicado ✓' : estado === 'guardando' ? 'Publicando…' : remotoDisponible ? 'Publicar' : 'Guardar'}
          </button>
          <span className={`editor-estado editor-estado-${estado}`}>
            {estado === 'guardado' && (remotoDisponible ? 'Todo publicado' : 'Sin cambios pendientes')}
            {estado === 'sin-guardar' && (remotoDisponible ? 'Cambios sin publicar' : 'Cambios sin guardar')}
            {estado === 'guardando' && 'Subiendo imágenes…'}
            {estado === 'error' && (errorMsg || 'No se pudo publicar')}
          </span>
          <a href={`#/${recorridoId}/editor`} className="editor-volver">Armar recorrido ↗</a>
        </div>

        {/* Preview en vivo del montaje */}
        <div className="editor-stage">
          {puntoPreview ? (
            <>
              <div className="editor-overlay-capa editor-overlay-detras" style={{ left: box.left, top: box.top, width: box.w, height: box.h }}>
                {puntoPreview.soportes.filter((s) => s.capa === 'debajo').map((s) => (
                  <ZonaSoporte key={s.id} soporte={s} size={box} arteUrl={resolverUrl(clienteActivo?.artes?.[s.id])} />
                ))}
              </div>
              <img ref={imgRef} src={resolverUrl(puntoPreview.foto)} alt={puntoPreview.nombre} className="visor-foto" draggable={false} />
              <div className="visor-overlay-capa" style={{ left: box.left, top: box.top, width: box.w, height: box.h }}>
                {puntoPreview.soportes.filter((s) => s.capa !== 'debajo').map((s) => (
                  <ZonaSoporte key={s.id} soporte={s} size={box} arteUrl={resolverUrl(clienteActivo?.artes?.[s.id])} />
                ))}
              </div>
            </>
          ) : (
            <div className="editor-vacio">
              <p>Este recorrido todavía no tiene fotos ni soportes.</p>
              <p className="panel-hint">Armalo primero en “Armar recorrido”.</p>
            </div>
          )}
        </div>

        {shopping.puntos.length > 1 && (
          <nav className="visor-paradas">
            {shopping.puntos.map((p, i) => (
              <button key={p.id} className={`parada ${p.id === puntoPreviewId ? 'parada-activa' : ''}`} onClick={() => setPuntoPreviewId(p.id)}>
                <span className="parada-numero">{i + 1}</span>
                <span className="parada-nombre">{p.nombre}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      <aside className="panel-editor">
        <section className="panel-seccion">
          <h3>Cliente / anunciante</h3>
          <div className="panel-cliente-nuevo">
            <input
              type="text"
              placeholder="Nombre (ej. Grido)"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && crearCliente()}
            />
            <button type="button" className="btn-secundario" onClick={crearCliente}>+ Nuevo</button>
          </div>
          {clientes.length === 0 && <p className="panel-hint">Creá el primer cliente para asignarle sus imágenes.</p>}
          <ul className="panel-lista">
            {clientes.map((c) => (
              <li key={c.id} className={`cliente-fila ${c.id === clienteActivoId ? 'cliente-fila-activa' : ''}`}>
                <button type="button" className="cliente-elegir" onClick={() => setClienteActivoId(c.id)}>
                  {c.nombre}
                </button>
                <button type="button" onClick={() => copiarLink(c.id)} title="Copiar link del cliente">link</button>
                <button type="button" className="btn-peligro" onClick={() => eliminarCliente(c.id)} title="Eliminar">✕</button>
              </li>
            ))}
          </ul>
        </section>

        {clienteActivo && (
          <section className="panel-seccion">
            <h3>Imágenes de {clienteActivo.nombre}</h3>
            <p className="panel-hint">
              {artesCargados} de {soportesTotales} soportes con imagen.
            </p>

            {!esBus && (totalVerticales > 0 || totalHorizontales > 0) && (
              <div className="carga-masiva">
                <p className="panel-hint" style={{ marginTop: 0 }}>
                  Subí una imagen por formato: se aplica a todos los soportes de ese formato en el recorrido.
                </p>
                <div className="carga-masiva-botones">
                  {totalVerticales > 0 && (
                    <FileArte onFile={(f) => subirArteMasivo('v', f)}>
                      ▮ Arte vertical (todos · {totalVerticales})
                    </FileArte>
                  )}
                  {totalHorizontales > 0 && (
                    <FileArte onFile={(f) => subirArteMasivo('h', f)}>
                      ▭ Arte horizontal (todos · {totalHorizontales})
                    </FileArte>
                  )}
                </div>
                <p className="panel-hint">O subilo soporte por soporte más abajo:</p>
              </div>
            )}

            {shopping.puntos.map((p) => (
              <div key={p.id} className="clientes-parada">
                <h4>{p.nombre}</h4>
                {p.soportes.length === 0 && <p className="panel-hint">Sin soportes en esta parada.</p>}
                {p.soportes.map((s) => {
                  const url = clienteActivo.artes?.[s.id];
                  return (
                    <div key={s.id} className="clientes-soporte">
                      <div className="cs-info">
                        {url ? (
                          <img src={resolverUrl(url)} alt="" className="panel-arte-thumb" />
                        ) : (
                          <span className="cs-vacio">—</span>
                        )}
                        <span className="cs-nombre">{s.nombre}</span>
                      </div>
                      <div className="panel-punto-acciones">
                        <FileArte onFile={(f) => subirArte(s.id, f)}>{url ? 'Reemplazar' : 'Subir'}</FileArte>
                        {url && <button type="button" className="btn-peligro" onClick={() => quitarArte(s.id)}>Quitar</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <button type="button" className="btn-cta btn-chico cliente-link" onClick={() => copiarLink(clienteActivo.id)}>
              Copiar link para {clienteActivo.nombre} →
            </button>
          </section>
        )}
      </aside>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function FileArte({ children, onFile }) {
  const ref = useRef(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()}>{children}</button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </>
  );
}
