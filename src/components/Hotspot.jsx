export default function Hotspot({ hotspot, onClick }) {
  const style = { left: `${hotspot.x}%`, top: `${hotspot.y}%` };
  return (
    <button className="hotspot" style={style} onClick={onClick} aria-label={hotspot.label}>
      <span className="hotspot-flecha" aria-hidden="true">→</span>
      <span className="hotspot-label">{hotspot.label}</span>
    </button>
  );
}
