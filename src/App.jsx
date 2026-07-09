import { useEffect, useState } from 'react';
import Home from './components/Home';
import Visor from './components/Visor';
import Editor from './components/Editor';
import ClientesEditor from './components/ClientesEditor';
import PropuestaEditor from './components/PropuestaEditor';
import { irA, parseRuta } from './lib/rutas';
import { cargarRecorrido } from './lib/catalogo';

// Convierte el arreglo de clientes al mapa que consume el Visor.
function conClientesDemo(shopping, clientes) {
  const clientesDemo = Object.fromEntries(
    clientes.map((c) => [c.id, { nombre: c.nombre, artes: c.artes || {} }])
  );
  return { ...shopping, clientesDemo };
}

function VisorRecorrido({ recorridoId, clienteId }) {
  const [shopping, setShopping] = useState(null);
  const [estado, setEstado] = useState('cargando'); // cargando | ok | no-encontrado | error

  useEffect(() => {
    let vivo = true;
    setEstado('cargando');
    cargarRecorrido(recorridoId)
      .then((data) => {
        if (!vivo) return;
        if (!data) {
          setEstado('no-encontrado');
          return;
        }
        setShopping(conClientesDemo(data.shopping, data.clientes));
        setEstado('ok');
      })
      .catch(() => vivo && setEstado('error'));
    return () => {
      vivo = false;
    };
  }, [recorridoId]);

  if (estado === 'cargando') return <div className="estado">Cargando…</div>;
  if (estado === 'no-encontrado')
    return (
      <div className="estado estado-error">
        No existe el recorrido “{recorridoId}”. <a href="#/">Volver al inicio</a>
      </div>
    );
  if (estado === 'error') return <div className="estado estado-error">No se pudo cargar el recorrido.</div>;

  return <Visor shopping={shopping} clienteId={clienteId} />;
}

export default function App() {
  const [ruta, setRuta] = useState(parseRuta());

  useEffect(() => {
    const onNav = () => setRuta(parseRuta());
    window.addEventListener('hashchange', onNav);
    window.addEventListener('popstate', onNav);
    return () => {
      window.removeEventListener('hashchange', onNav);
      window.removeEventListener('popstate', onNav);
    };
  }, []);

  if (ruta.vista === 'home') return <Home />;
  if (ruta.vista === 'editor')
    return <Editor key={ruta.recorridoId} recorridoId={ruta.recorridoId} onVolver={() => irA('/')} />;
  if (ruta.vista === 'clientes')
    return <ClientesEditor key={ruta.recorridoId} recorridoId={ruta.recorridoId} onVolver={() => irA('/')} />;
  if (ruta.vista === 'propuesta')
    return <PropuestaEditor key={ruta.recorridoId} recorridoId={ruta.recorridoId} onVolver={() => irA('/')} />;
  return (
    <VisorRecorrido key={ruta.recorridoId} recorridoId={ruta.recorridoId} clienteId={ruta.clienteId} />
  );
}
