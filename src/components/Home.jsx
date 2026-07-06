import { useEffect, useState } from 'react';
import { listarRecorridos } from '../lib/catalogo';
import { guardarConfig } from '../lib/almacenamiento';
import { irA, linkEditor, linkVisor, resolverUrl } from '../lib/rutas';
import { genId, slugify } from '../lib/imagenes';

export default function Home() {
  const [recorridos, setRecorridos] = useState(null);
  const [error, setError] = useState(null);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [categoriaNueva, setCategoriaNueva] = useState('');

  useEffect(() => {
    document.title = 'Movimagen · Recorridos virtuales';
    listarRecorridos().then(setRecorridos).catch((e) => setError(e.message));
  }, []);

  function crearRecorrido() {
    const nombre = nombreNuevo.trim();
    if (!nombre) return;
    const categoria = categoriaNueva.trim() || 'Sin categoría';
    let id = slugify(nombre) || genId('r');
    const existentes = new Set((recorridos || []).map((r) => r.id));
    if (existentes.has(id)) id = `${id}-${Math.random().toString(36).slice(2, 5)}`;
    const r = guardarConfig({ id, nombre, categoria, puntos: [] }, []);
    if (!r.ok) {
      setError('No se pudo crear el recorrido en el navegador.');
      return;
    }
    irA(linkEditor(id).slice(1)); // sin el '#'
  }

  if (error) return <div className="estado estado-error">{error}</div>;
  if (!recorridos) return <div className="estado">Cargando…</div>;

  // Agrupar por categoría, manteniendo orden de aparición.
  const grupos = [];
  const indice = new Map();
  for (const r of recorridos) {
    const cat = r.categoria || 'Sin categoría';
    if (!indice.has(cat)) {
      indice.set(cat, grupos.length);
      grupos.push({ categoria: cat, items: [] });
    }
    grupos[indice.get(cat)].items.push(r);
  }

  return (
    <div className="home">
      <header className="home-hero">
        <span className="marca marca-grande">MOVIMAGEN<i>·</i></span>
        <h1>Recorridos virtuales</h1>
        <p>
          Mostrale a cada anunciante su marca montada en los soportes reales,
          antes de imprimir un solo vinilo.
        </p>
      </header>

      {grupos.length === 0 && (
        <p className="panel-hint">Todavía no hay recorridos. Creá el primero abajo.</p>
      )}

      {grupos.map((g) => (
        <section key={g.categoria} className="home-grupo">
          <h2>{g.categoria}</h2>
          <ul className="home-cards">
            {g.items.map((r) => (
              <li key={r.id} className="card">
                <a className="card-media" href={linkVisor(r.id)}>
                  {r.portada ? (
                    <img src={resolverUrl(r.portada)} alt="" loading="lazy" />
                  ) : (
                    <div className="card-media-vacia">Sin fotos todavía</div>
                  )}
                </a>
                <div className="card-body">
                  <a className="card-nombre" href={linkVisor(r.id)}>{r.nombre}</a>
                  <span className="card-stats">
                    {r.paradas} {r.paradas === 1 ? 'parada' : 'paradas'} · {r.soportes}{' '}
                    {r.soportes === 1 ? 'soporte' : 'soportes'}
                  </span>
                  <div className="card-acciones">
                    <a className="btn-cta btn-chico" href={linkVisor(r.id)}>Ver recorrido →</a>
                    <a className="card-editar" href={linkEditor(r.id)}>✎ Editar</a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="home-nuevo">
        <h2>Nuevo recorrido</h2>
        <div className="home-nuevo-campos">
          <input
            type="text"
            placeholder="Nombre (ej. Shopping Tres Cruces)"
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
          />
          <input
            type="text"
            placeholder="Categoría (ej. Shoppings, Buses)"
            value={categoriaNueva}
            onChange={(e) => setCategoriaNueva(e.target.value)}
          />
          <button type="button" className="btn-secundario" onClick={crearRecorrido}>
            + Crear
          </button>
        </div>
        <p className="panel-hint">Se crea vacío; después subís las fotos y calibrás los soportes en el editor.</p>
      </section>

      <footer className="home-pie">
        Movimagen Publicidad · publicidad que se ve
      </footer>
    </div>
  );
}
