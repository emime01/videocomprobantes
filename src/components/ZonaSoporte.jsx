import { matrix3dFor } from '../lib/homografia';

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

const LOCAL_CORNERS = (w, h) => [
  { x: 0, y: 0 },
  { x: w, y: 0 },
  { x: w, y: h },
  { x: 0, y: h },
];

export default function ZonaSoporte({
  soporte,
  size,
  arteUrl,
  mostrarLuz = true,
  editable = false,
  seleccionado = false,
  onSeleccionar,
  onIniciarArrastreEsquina,
  onClickSoporte,
}) {
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

  const clickeable = !editable && typeof onClickSoporte === 'function';
  const clases = ['zona-soporte'];
  if (editable) clases.push('zona-soporte-editable');
  if (seleccionado) clases.push('zona-soporte-seleccionada');
  if (clickeable) clases.push('zona-soporte-clickeable');

  return (
    <div
      className={clases.join(' ')}
      style={style}
      onPointerDown={editable ? () => onSeleccionar?.(soporte.id) : undefined}
      onClick={clickeable ? () => onClickSoporte(soporte) : undefined}
    >
      {arteUrl ? (
        <img src={arteUrl} alt={soporte.nombre} className="zona-soporte-arte" draggable={false} />
      ) : (
        <div className="zona-soporte-vacia">
          <span className="zsv-titulo">Espacio disponible</span>
          <span className="zsv-sub">tu marca acá</span>
        </div>
      )}
      {mostrarLuz && <div className="zona-soporte-luz" />}
      {editable &&
        seleccionado &&
        LOCAL_CORNERS(w, h).map((c, i) => (
          <button
            key={i}
            type="button"
            className="handle-esquina"
            style={{ left: c.x, top: c.y }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onIniciarArrastreEsquina?.(soporte.id, i, e);
            }}
            aria-label={`Esquina ${i + 1} de ${soporte.nombre}`}
          />
        ))}
    </div>
  );
}
