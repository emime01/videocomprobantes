# Recorrido Virtual Comercial · Movimagen

Recorrido virtual foto a foto, con los artes de cada anunciante montados en perspectiva sobre las fotos reales. Sirve tanto para un **shopping** (caminás las paradas) como para un **bus** (girás alrededor: frente → lateral → trasera) o cualquier otro medio. Ver especificación en [`SPEC.md`](./SPEC.md).

## Estado

- **Home con varios recorridos agrupados por categoría** (Shoppings, Buses, etc.). Cada recorrido es independiente y usa el mismo motor.
- **Visor** por recorrido, con transición de "avance" (zoom + desvanecido) entre fotos para dar sensación de movimiento.
- **Editor** por recorrido: calibración de soportes arrastrando esquinas, hotspots, puntos (subir/reemplazar foto), clientes y artes, nombre y categoría del recorrido, zoom 2x, export/import JSON.
- **Guardado en el navegador** (`localStorage`), con botón Guardar e indicador de estado. Sin Supabase todavía (Fase 3).

## Desarrollo local

```bash
npm install
npm run dev
```

Rutas (por hash, para que funcionen igual en GitHub Pages):

- `/` — home con la lista de recorridos agrupados.
- `/#/{recorridoId}` — visor público. Con `?cliente=slug` muestra los artes de ese cliente; sin él, los soportes van vacíos ("Espacio disponible"). Ej: `/?cliente=grido#/demo-shopping`.
- `/#/{recorridoId}/editor` — editor visual del recorrido.

Recorridos demo incluidos: `demo-shopping` (categoría Shoppings) y `demo-bus` (categoría Buses).

## Datos

- El catálogo semilla vive en [`public/catalogo.json`](./public/catalogo.json): un arreglo de recorridos, cada uno con `id`, `nombre`, `categoria`, `puntos[]` y (para el demo) `clientesDemo`.
- Lo que editás o creás se guarda en `localStorage` bajo `recorrido:{id}` y **pisa** la semilla en tu navegador. La home lista la unión de ambos.
- Las fotos/artes de `public/demo/` son placeholders SVG (no hay fotos reales todavía).

## Preview en vivo (GitHub Pages)

Cada push a `main` publica la app vía GitHub Actions (`.github/workflows/deploy-pages.yml`). **Activación por única vez:** `Settings → Pages → Build and deployment → Source: GitHub Actions`.

- Home: `https://emime01.github.io/videocomprobantes/`
- Visor: `https://emime01.github.io/videocomprobantes/?cliente=grido#/demo-shopping`
- Editor: `https://emime01.github.io/videocomprobantes/#/demo-shopping/editor`

> En Pages la app vive bajo el subpath `/videocomprobantes/` y se rutea por **hash** (`#/...`), que funciona sin rewrites de servidor. En el deploy definitivo de Vercel (Fase 3/4) se pueden usar rutas reales.

## Guardado y su alcance

El botón **Guardar** persiste el recorrido en el **navegador**. Los cambios sobreviven al recargar y el visor de ese mismo navegador los muestra (incluido `?cliente=`).

- **Alcance:** es por navegador/dispositivo. Si le mandás el link a un cliente en su celular, ve el demo, no tus cambios — el guardado compartido llega con **Supabase (Fase 3)**.
- **Backup / traspaso:** **Exportar JSON** guarda un respaldo; **Importar JSON** lo retoma en otra máquina.
- **Descartar cambios:** en la sección Backup del panel, borra lo guardado de ese recorrido en el navegador y vuelve a la semilla.
- Si los artes/fotos pesan mucho, `localStorage` puede llenarse; el indicador avisa y conviene usar Exportar JSON.

## Notas

- Todavía no pide `ADMIN_KEY` (eso llega con las funciones serverless de la Fase 3); por ahora es una herramienta de trabajo local, sin persistencia remota compartida.
