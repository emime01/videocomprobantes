import { useEffect, useState } from 'react';
import PantallaClave from './PantallaClave';
import { listarRecorridos, cargarRecorrido } from '../lib/catalogo';
import { guardarConfig } from '../lib/almacenamiento';
import { irA, linkCliente, linkVisor } from '../lib/rutas';
import { genId, slugify } from '../lib/imagenes';
import { guardarRemoto, remotoDisponible } from '../lib/supabase';
import { borrarClave, hayClave, leerClave } from '../lib/adminKey';

// Arma una propuesta: nombre + qué lugares (recorridos) incluye, en orden.
// El id 'nueva' es una propuesta todavía sin guardar.
export default function PropuestaEditor({ recorridoId, onVolver }) {
  const nueva = recorridoId === 'nueva';
  const [claveLista, setClaveLista] = useState(() => !remotoDisponible || hayClave());
  const [errorAuth, setErrorAuth] = useState(false);

  const [nombre, setNombre] = useState('');
  const [incluye, setIncluye] = useState([]); // ids en orden
  const [disponibles, setDisponibles] = useState(null); // recorridos base
  const [error, setError] = useState(null);
  const [estado, setEstado] = useState('idle'); // idle | guardando | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    listarRecorridos()
      .then((todos) => setDisponibles(todos.filter((r) => r.tipo !== 'propuesta')))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (nueva) return;
    cargarRecorrido(recorridoId)
      .then((data) => {
        if (!data || data.shopping?.tipo !== 'propuesta') {
          setError('Esa propuesta no existe.');
          return;
        }
        setNombre(data.shopping.nombre || '');
        setIncluye(data.shopping.incluye || []);
      })
      .catch((e) => setError(e.message));
  }, [recorridoId, nueva]);

  function toggle(id) {
    setIncluye((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function mover(id, dir) {
    setIncluye((prev) => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const c = [...prev];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  }

  async function guardar() {
    const nom = nombre.trim();
    if (!nom) {
      setErrorMsg('Poné un nombre a la propuesta.');
      setEstado('error');
      return;
    }
    if (incluye.length === 0) {
      setErrorMsg('Elegí al menos un lugar.');
      setEstado('error');
      return;
    }
    let id = nueva ? slugify(nom) || genId('prop') : recorridoId;
    if (nueva) {
      const existentes = new Set((disponibles || []).map((r) => r.id));
      if (existentes.has(id)) id = `${id}-${Math.random().toString(36).slice(2, 5)}`;
    }
    const config = { id, nombre: nom, categoria: 'Propuestas', tipo: 'propuesta', incluye };

    if (!remotoDisponible) {
      const r = guardarConfig(config, []);
      if (!r.ok) {
        setErrorMsg('No se pudo guardar en el navegador.');
        setEstado('error');
        return;
      }
      irA(linkVisor(id).slice(1));
      return;
    }
    setEstado('guardando');
    try {
      await guardarRemoto(config, [], leerClave());
      irA(linkVisor(id).slice(1));
    } catch (e) {
      if (e.status === 401) {
        borrarClave();
        setErrorAuth(true);
        setClaveLista(false);
        setEstado('idle');
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
    return <PantallaClave titulo="Propuesta" error={errorAuth} onOk={() => { setClaveLista(true); setErrorAuth(false); }} />;

  if (!disponibles) return <div className="estado">Cargando…</div>;

  const elegidos = incluye
    .map((id) => disponibles.find((r) => r.id === id))
    .filter(Boolean);
  const sinElegir = disponibles.filter((r) => !incluye.includes(r.id));

  return (
    <div className="home">
      <header className="home-hero">
        <button type="button" className="editor-inicio" onClick={onVolver}>← Inicio</button>
        <h1 style={{ marginTop: 14 }}>{nueva ? 'Nueva propuesta' : 'Editar propuesta'}</h1>
        <p>Combiná varios lugares en un solo recorrido para el cliente.</p>
      </header>

      <section className="home-grupo">
        <h2>Nombre</h2>
        <div className="home-nuevo-campos">
          <input
            type="text"
            placeholder="Ej. Propuesta Interior 2026"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
      </section>

      <section className="home-grupo">
        <h2>Lugares en la propuesta ({elegidos.length})</h2>
        {elegidos.length === 0 && <p className="panel-hint">Todavía no elegiste ningún lugar. Sumalos de la lista de abajo.</p>}
        <ul className="prop-lista">
          {elegidos.map((r, i) => (
            <li key={r.id} className="prop-item prop-item-on">
              <span className="prop-orden">{i + 1}</span>
              <span className="prop-nombre">{r.nombre}<em> · {r.categoria}</em></span>
              <div className="panel-punto-acciones">
                <button type="button" disabled={i === 0} onClick={() => mover(r.id, -1)} aria-label="Subir">↑</button>
                <button type="button" disabled={i === elegidos.length - 1} onClick={() => mover(r.id, 1)} aria-label="Bajar">↓</button>
                <button type="button" className="btn-peligro" onClick={() => toggle(r.id)}>Quitar</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {sinElegir.length > 0 && (
        <section className="home-grupo">
          <h2>Agregar lugares</h2>
          <ul className="prop-lista">
            {sinElegir.map((r) => (
              <li key={r.id} className="prop-item">
                <span className="prop-nombre">{r.nombre}<em> · {r.categoria}</em></span>
                <button type="button" className="btn-secundario" onClick={() => toggle(r.id)}>+ Agregar</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="home-nuevo">
        <button type="button" className="btn-cta" onClick={guardar} disabled={estado === 'guardando'}>
          {estado === 'guardando' ? 'Publicando…' : nueva ? 'Crear propuesta →' : 'Guardar cambios →'}
        </button>
        {estado === 'error' && <p className="clave-error" style={{ marginTop: 10 }}>{errorMsg}</p>}
        <p className="panel-hint">
          Después, el link para el cliente es <code>{linkCliente('...', 'cliente')}</code> apuntando a esta propuesta.
        </p>
      </section>
    </div>
  );
}
