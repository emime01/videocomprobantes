export default function Hotspot({
  hotspot,
  onClick,
  editable = false,
  seleccionado = false,
  onSeleccionar,
  onIniciarArrastre,
}) {
  const style = { left: `${hotspot.x}%`, top: `${hotspot.y}%` };
  const clases = ['hotspot'];
  if (seleccionado) clases.push('hotspot-seleccionado');

  return (
    <button
      type="button"
      className={clases.join(' ')}
      style={style}
      aria-label={hotspot.label}
      onClick={editable ? () => onSeleccionar?.() : onClick}
      onPointerDown={
        editable
          ? (e) => {
              e.stopPropagation();
              onIniciarArrastre?.(e);
            }
          : undefined
      }
    >
      <span className="hotspot-flecha" aria-hidden="true">→</span>
      <span className="hotspot-label">{hotspot.label}</span>
    </button>
  );
}
