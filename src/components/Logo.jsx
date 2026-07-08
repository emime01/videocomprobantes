import { resolverUrl } from '../lib/rutas';

// Logo oficial Movimagen. variante: 'blanco' (fondo oscuro) | 'naranja' (fondo claro).
export default function Logo({ variante = 'blanco', className = '', alt = 'Movimagen · Publicidad OOH' }) {
  const src = resolverUrl(variante === 'naranja' ? '/marca/wordmark-naranja.png' : '/marca/wordmark-blanco.png');
  return <img src={src} alt={alt} className={`logo ${className}`} draggable={false} />;
}

export function Monograma({ className = '' }) {
  return <img src={resolverUrl('/marca/monograma.png')} alt="Movimagen" className={`monograma ${className}`} draggable={false} />;
}
