import { useRef } from 'react';

function FileButton({ children, accept = 'image/*', onFile, ...props }) {
  const inputRef = useRef(null);
  return (
    <>
      <button type="button" onClick={() => inputRef.current?.click()} {...props}>
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </>
  );
}

export default function PanelEditor({
  shopping,
  punto,
  remoto = false,
  onEditarRecorrido,
  soporteSeleccionado,
  hotspotSeleccionado,
  zoom,
  mostrarLuz,
  onSetZoom,
  onSetMostrarLuz,
  onEditarSoporte,
  onEliminarSoporte,
  onCrearSoporte,
  onEditarHotspot,
  onEliminarHotspot,
  onCrearHotspot,
  onSeleccionarHotspot,
  onRenombrarPunto,
  onReemplazarFotoPunto,
  onEliminarPunto,
  onMoverPunto,
  onCrearPunto,
  onExportarJSON,
  onImportarJSON,
  onRestablecerDemo,
  linkClientesUrl,
}) {
  const hotspot = punto && hotspotSeleccionado != null ? punto.hotspots[hotspotSeleccionado] : null;

  return (
    <aside className="panel-editor">
      <section className="panel-seccion">
        <h3>Recorrido</h3>
        <div className="panel-campos">
          <label>
            Nombre
            <input
              type="text"
              value={shopping.nombre}
              onChange={(e) => onEditarRecorrido({ nombre: e.target.value })}
            />
          </label>
          <label>
            Categoría
            <input
              type="text"
              placeholder="Shoppings, Buses…"
              value={shopping.categoria || ''}
              onChange={(e) => onEditarRecorrido({ categoria: e.target.value })}
            />
          </label>
        </div>
        {linkClientesUrl && (
          <a className="panel-link-clientes" href={linkClientesUrl}>
            👤 Cargar imágenes de un cliente →
          </a>
        )}
      </section>

      {punto && (
      <>
      <section className="panel-seccion">
        <h3>Soporte</h3>
        {soporteSeleccionado ? (
          <div className="panel-campos">
            <label>
              Nombre
              <input
                type="text"
                value={soporteSeleccionado.nombre}
                onChange={(e) => onEditarSoporte(soporteSeleccionado.id, { nombre: e.target.value })}
              />
            </label>
            <label>
              Orientación
              <select
                value={soporteSeleccionado.orientacion}
                onChange={(e) => onEditarSoporte(soporteSeleccionado.id, { orientacion: e.target.value })}
              >
                <option value="v">Vertical</option>
                <option value="h">Horizontal</option>
              </select>
            </label>
            <label>
              Capa del arte
              <select
                value={soporteSeleccionado.capa || 'encima'}
                onChange={(e) => onEditarSoporte(soporteSeleccionado.id, { capa: e.target.value })}
              >
                <option value="encima">Encima de la foto (normal)</option>
                <option value="debajo">Debajo de la foto (foto con hueco transparente)</option>
              </select>
            </label>
            <p className="panel-hint">Arrastrá las 4 esquinas sobre la foto para calibrar el soporte.</p>
            <label className="panel-checkbox">
              <input type="checkbox" checked={zoom} onChange={(e) => onSetZoom(e.target.checked)} />
              Zoom 16x para calibrar fino
            </label>
            <button type="button" className="btn-peligro" onClick={() => onEliminarSoporte(soporteSeleccionado.id)}>
              Eliminar soporte
            </button>
          </div>
        ) : (
          <p className="panel-hint">Tocá un soporte en la foto para calibrarlo, o creá uno nuevo.</p>
        )}
        <button type="button" className="btn-secundario" onClick={onCrearSoporte}>
          + Soporte
        </button>
      </section>

      <section className="panel-seccion">
        <h3>Hotspots</h3>
        {hotspot ? (
          <div className="panel-campos">
            <label>
              Destino
              <select
                value={hotspot.to}
                onChange={(e) => onEditarHotspot(hotspotSeleccionado, { to: e.target.value })}
              >
                {shopping.puntos
                  .filter((p) => p.id !== punto.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Label
              <input
                type="text"
                value={hotspot.label}
                onChange={(e) => onEditarHotspot(hotspotSeleccionado, { label: e.target.value })}
              />
            </label>
            <p className="panel-hint">Arrastrá el hotspot sobre la foto para reposicionarlo.</p>
            <button type="button" className="btn-peligro" onClick={() => onEliminarHotspot(hotspotSeleccionado)}>
              Eliminar hotspot
            </button>
          </div>
        ) : (
          <ul className="panel-lista">
            {(punto.hotspots || []).map((h, i) => (
              <li key={i}>
                <button type="button" onClick={() => onSeleccionarHotspot(i)}>
                  {h.label} → {shopping.puntos.find((p) => p.id === h.to)?.nombre || '(sin destino)'}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="btn-secundario"
          onClick={onCrearHotspot}
          disabled={shopping.puntos.length < 2}
        >
          + Hotspot
        </button>
      </section>
      </>
      )}

      <section className="panel-seccion">
        <h3>Puntos del recorrido</h3>
        <ul className="panel-lista">
          {shopping.puntos.map((p, i) => (
            <li key={p.id} className="panel-punto-item">
              <input
                type="text"
                value={p.nombre}
                onChange={(e) => onRenombrarPunto(p.id, e.target.value)}
              />
              <div className="panel-punto-acciones">
                <button type="button" disabled={i === 0} onClick={() => onMoverPunto(p.id, -1)} aria-label="Subir">
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === shopping.puntos.length - 1}
                  onClick={() => onMoverPunto(p.id, 1)}
                  aria-label="Bajar"
                >
                  ↓
                </button>
                <FileButton onFile={(file) => onReemplazarFotoPunto(p.id, file)}>Foto</FileButton>
                <button
                  type="button"
                  className="btn-peligro"
                  disabled={shopping.puntos.length <= 1}
                  onClick={() => onEliminarPunto(p.id)}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
        <FileButton className="btn-secundario" onFile={onCrearPunto}>
          + Punto (subir foto)
        </FileButton>
      </section>

      <section className="panel-seccion">
        <h3>Visualización</h3>
        <label className="panel-checkbox">
          <input type="checkbox" checked={mostrarLuz} onChange={(e) => onSetMostrarLuz(e.target.checked)} />
          Overlay de luz sobre los artes
        </label>
      </section>

      <section className="panel-seccion">
        <h3>Backup</h3>
        <div className="panel-punto-acciones">
          <button type="button" className="btn-secundario" onClick={onExportarJSON}>
            Exportar JSON
          </button>
          <FileButton accept="application/json" onFile={onImportarJSON}>
            Importar JSON
          </FileButton>
        </div>
        <p className="panel-hint">
          {remoto
            ? '"Publicar" (arriba) sube los cambios a Supabase: los ve cualquiera con el link. Exportá el JSON como backup.'
            : '"Guardar" (arriba) deja los cambios en este navegador. Exportá el JSON para tener un backup o pasarlo a otra máquina.'}
        </p>
        <button type="button" className="btn-peligro" onClick={onRestablecerDemo}>
          {remoto ? 'Descartar borrador local' : 'Descartar cambios guardados'}
        </button>
      </section>
    </aside>
  );
}
