import { resolverUrl } from '../lib/rutas';

// Logo oficial Movimagen. variante: 'naranja' (fondo claro, default — la app
// es blanco y naranja) | 'blanco' (para los pocos fondos oscuros, ej. el stage).
export default function Logo({ variante = 'naranja', className = '', alt = 'Movimagen · Publicidad OOH' }) {
  const src = resolverUrl(variante === 'blanco' ? '/marca/wordmark-blanco.png' : '/marca/wordmark-naranja.png');
  return <img src={src} alt={alt} className={`logo ${className}`} draggable={false} />;
}

export function Monograma({ className = '' }) {
  return <img src={resolverUrl('/marca/monograma.png')} alt="Movimagen" className={`monograma ${className}`} draggable={false} />;
}
