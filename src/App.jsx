import { useEffect, useState } from 'react';
import Visor from './components/Visor';
import Editor from './components/Editor';
import { BASE, esRutaEditor } from './lib/rutas';
import { cargarConfig } from './lib/almacenamiento';

// Convierte el arreglo de clientes guardado al mapa que consume el Visor.
function conClientesDemo(shopping, clientes) {
  const clientesDemo = Object.fromEntries(
    clientes.map((c) => [c.id, { nombre: c.nombre, artes: c.artes || {} }])
  );
  return { ...shopping, clientesDemo };
}

export default function App() {
  const [shopping, setShopping] = useState(null);
  const [error, setError] = useState(null);
  const [esEditor, setEsEditor] = useState(esRutaEditor());

  // En GitHub Pages el editor se abre con hash (#/editor); reevaluamos al cambiarlo.
  useEffect(() => {
    const onHash = () => setEsEditor(esRutaEditor());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (esEditor) return;
    // Si el editor guardó algo en este navegador, el visor lo usa.
    const guardado = cargarConfig();
    if (guardado) {
      setShopping(conClientesDemo(guardado.shopping, guardado.clientes));
      return;
    }
    fetch(`${BASE}config.demo.json`)
      .then((r) => {
        if (!r.ok) throw new Error('No se pudo cargar la configuración del recorrido');
        return r.json();
      })
      .then(setShopping)
      .catch((e) => setError(e.message));
  }, [esEditor]);

  if (esEditor) return <Editor />;

  if (error) return <div className="estado estado-error">{error}</div>;
  if (!shopping) return <div className="estado">Cargando…</div>;

  const clienteId = new URLSearchParams(window.location.search).get('cliente');

  return <Visor shopping={shopping} clienteId={clienteId} />;
}
