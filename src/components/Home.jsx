import { useEffect, useState } from 'react';
import { listarRecorridos } from '../lib/catalogo';
import { guardarConfig } from '../lib/almacenamiento';
import { irA, linkAdmin, linkClientes, linkEditor, linkPropuesta, linkVisor, pedirPantallaCompleta, resolverUrl } from '../lib/rutas';
import { genId, slugify } from '../lib/imagenes';
import Logo from './Logo';

// Categorías sugeridas para que los recorridos se agrupen de forma
// consistente en la landing (planners navegan por estos rubros). El campo
// sigue siendo texto libre: son sugerencias, no una lista cerrada.
const CATEGORIAS_SUGERIDAS = ['Shoppings', 'Pantallas gigantes', 'Medianeras', 'Carteles en buses', 'Freeshops'];

export default function Home({ admin = false }) {
  const [recorridos, setRecorridos] = useState(null);
  const [error, setError] = useState(null);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [categoriaNueva, setCategoriaNueva] = useState('');
  const [menuAbiertoId, setMenuAbiertoId] = useState(null);

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
        <Logo className="logo-lg" />
        <h1>{admin ? 'Panel de administración' : 'Recorridos virtuales'}</h1>
        {admin ? (
          <p>
            Creá recorridos nuevos y accedé a Armar / Clientes de cada uno. <a href="#/">← Volver a la landing</a>
          </p>
        ) : (
          <p>
            Mostrale a cada anunciante su marca montada en los soportes reales,
            antes de imprimir un solo vinilo.
          </p>
        )}
      </header>

      {grupos.length === 0 && (
        <p className="panel-hint">Todavía no hay recorridos. Creá el primero abajo.</p>
      )}

      {menuAbiertoId && <div className="home-menu-backdrop" onClick={() => setMenuAbiertoId(null)} />}

      {grupos.map((g) => (
        <section key={g.categoria} className="home-grupo">
          <h2>{g.categoria}</h2>
          <ul className="home-cards">
            {g.items.map((r) => (
              <li key={r.id} className="card">
                <a
                  className={`card-media ${r.tipo === 'propuesta' ? 'card-media-propuesta' : ''}`}
                  href={linkVisor(r.id)}
                  onClick={pedirPantallaCompleta}
                >
                  {r.portada ? (
                    <img src={resolverUrl(r.portada)} alt="" loading="lazy" />
                  ) : r.tipo === 'propuesta' ? (
                    <div className="card-media-vacia">🗺️ {r.lugares} {r.lugares === 1 ? 'lugar' : 'lugares'}</div>
                  ) : (
                    <div className="card-media-vacia">Sin fotos todavía</div>
                  )}
                  <span className="card-badge">{r.categoria}</span>
                </a>
                <div className="card-body">
                  <div className="card-titulo-fila">
                    <a className="card-nombre" href={linkVisor(r.id)} onClick={pedirPantallaCompleta}>
                      {r.nombre}
                    </a>
                    {admin && (
                      <div className="card-menu">
                        <button
                          type="button"
                          className="card-menu-boton"
                          aria-label="Opciones de administración"
                          onClick={() => setMenuAbiertoId(menuAbiertoId === r.id ? null : r.id)}
                        >
                          ⚙
                        </button>
                        {menuAbiertoId === r.id && (
                          <div className="card-menu-dropdown">
                            {r.tipo === 'propuesta' ? (
                              <a href={linkPropuesta(r.id)}>✎ Editar lugares</a>
                            ) : (
                              <>
                                <a href={linkClientes(r.id)}>👤 Clientes</a>
                                <a href={linkEditor(r.id)}>✎ Armar</a>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {r.tipo === 'propuesta' ? (
                    <span className="card-stats">{r.lugares} {r.lugares === 1 ? 'lugar combinado' : 'lugares combinados'}</span>
                  ) : (
                    <span className="card-stats">
                      {r.paradas} {r.paradas === 1 ? 'parada' : 'paradas'} · {r.soportes}{' '}
                      {r.soportes === 1 ? 'soporte' : 'soportes'}
                    </span>
                  )}
                  <a className="btn-cta btn-chico card-ver" href={linkVisor(r.id)} onClick={pedirPantallaCompleta}>
                    Ver {r.tipo === 'propuesta' ? 'propuesta' : 'recorrido'} →
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {admin && (
        <>
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
                list="categorias-sugeridas"
                placeholder="Categoría (ej. Shoppings)"
                value={categoriaNueva}
                onChange={(e) => setCategoriaNueva(e.target.value)}
              />
              <datalist id="categorias-sugeridas">
                {CATEGORIAS_SUGERIDAS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <button type="button" className="btn-secundario" onClick={crearRecorrido}>
                + Crear
              </button>
            </div>
            <p className="panel-hint">Se crea vacío; después subís las fotos y calibrás los soportes en el editor.</p>
          </section>

          <section className="home-nuevo">
            <h2>Nueva propuesta</h2>
            <p className="panel-hint" style={{ marginTop: 0 }}>
              Combiná varios lugares ya armados (ej. Colonia + Paysandú + un bus) en un solo recorrido para el cliente.
            </p>
            <a className="btn-secundario" href={linkPropuesta('nueva')} style={{ display: 'inline-block' }}>
              + Crear propuesta
            </a>
          </section>
        </>
      )}

      <footer className="home-pie">
        <Logo className="logo-pie" />
        <span>Publicidad que se ve.</span>
        {!admin && (
          <a className="home-link-admin" href={linkAdmin()}>
            Equipo Movimagen · administrar →
          </a>
        )}
      </footer>
    </div>
  );
}
