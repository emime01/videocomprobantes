import { useState } from 'react';
import Logo from './Logo';
import { guardarClave } from '../lib/adminKey';

// Pantalla de clave de administración, reutilizada por el editor y el modo clientes.
export default function PantallaClave({ titulo = 'Editor', error = false, onOk }) {
  const [valor, setValor] = useState('');

  function entrar() {
    const clave = valor.trim();
    if (!clave) return;
    guardarClave(clave);
    setValor('');
    onOk();
  }

  return (
    <div className="splash">
      <div className="splash-card">
        <Logo className="logo-lg" />
        <h2 className="clave-titulo">{titulo}</h2>
        <p>Ingresá la clave de administración para editar.</p>
        {error && <p className="clave-error">La clave era incorrecta, probá de nuevo.</p>}
        <input
          type="password"
          className="clave-input"
          placeholder="Clave"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && entrar()}
          autoFocus
        />
        <button type="button" className="btn-cta" onClick={entrar}>
          Entrar →
        </button>
      </div>
    </div>
  );
}
