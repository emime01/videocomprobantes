import { matrix3dFor } from '../lib/homografia';

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export default function ZonaSoporte({ soporte, size, arteUrl, mostrarLuz = true }) {
  if (!size.w || !size.h) return null;

  const px = soporte.esquinas.map((e) => ({
    x: (e.x / 100) * size.w,
    y: (e.y / 100) * size.h,
  }));
  const [tl, tr, , bl] = px;
  const w = dist(tl, tr);
  const h = dist(tl, bl);
  const transform = matrix3dFor(w, h, px);

  const style = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: w,
    height: h,
    transformOrigin: '0 0',
    transform,
  };

  return (
    <div className="zona-soporte" style={style}>
      {arteUrl ? (
        <img src={arteUrl} alt={soporte.nombre} className="zona-soporte-arte" draggable={false} />
      ) : (
        <div className="zona-soporte-vacia">
          <span>Espacio disponible</span>
        </div>
      )}
      {mostrarLuz && <div className="zona-soporte-luz" />}
    </div>
  );
}
