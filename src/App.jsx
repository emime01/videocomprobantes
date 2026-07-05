import { useEffect, useState } from 'react';
import Visor from './components/Visor';

export default function App() {
  const [shopping, setShopping] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/config.demo.json')
      .then((r) => {
        if (!r.ok) throw new Error('No se pudo cargar la configuración del recorrido');
        return r.json();
      })
      .then(setShopping)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="estado estado-error">{error}</div>;
  if (!shopping) return <div className="estado">Cargando…</div>;

  const clienteId = new URLSearchParams(window.location.search).get('cliente');

  return <Visor shopping={shopping} clienteId={clienteId} />;
}
