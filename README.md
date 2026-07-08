# Recorrido Virtual Comercial · Movimagen

Recorrido virtual foto a foto, con los artes de cada anunciante montados en perspectiva sobre las fotos reales. Sirve tanto para un **shopping** (caminás las paradas) como para un **bus** (girás alrededor: frente → lateral → trasera) o cualquier otro medio. Ver especificación en [`SPEC.md`](./SPEC.md).

## Estado

- **Home con varios recorridos agrupados por categoría** (Shoppings, Buses, etc.). Cada recorrido es independiente y usa el mismo motor.
- **Visor** por recorrido, con transición de "avance" (zoom + desvanecido) entre fotos para dar sensación de movimiento.
- **Editor** por recorrido: calibración de soportes arrastrando esquinas, hotspots, puntos (subir/reemplazar foto), clientes y artes, nombre y categoría del recorrido, zoom 2x, export/import JSON.
- **Fase 3 — Supabase (opcional, por variables de entorno):** con las credenciales cargadas, la app lee los recorridos de Postgres y las imágenes de Storage, el editor pide la clave de administración y **Publicar** sube todo (los links los ve cualquiera, desde cualquier dispositivo). Sin credenciales, funciona en modo local (semilla + `localStorage`), que es lo que corre en GitHub Pages.

## Activar Supabase + Vercel (Fase 3, ~10 minutos)

1. **Supabase**: crear cuenta gratis en [supabase.com](https://supabase.com) → New project. Cuando arranque, ir a **SQL Editor**, pegar el contenido de [`supabase/schema.sql`](./supabase/schema.sql) y correrlo (crea tablas, permisos y los buckets `fotos`/`artes`, con datos demo incluidos).
2. **Credenciales**: en Supabase, `Settings → API`: copiar la **URL** del proyecto, la **anon key** y la **service_role key**.
3. **Vercel**: en [vercel.com](https://vercel.com) → Add New Project → importar este repo de GitHub. Framework: Vite (lo detecta solo). Antes de deployar, cargar en Environment Variables las 4 de [`.env.example`](./.env.example): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `ADMIN_KEY` (una clave que inventás vos para el editor).
4. **Listo**: Vercel te da una URL (ej. `recorrido-movimagen.vercel.app`). El visor y los links por cliente salen de Supabase; el editor pide tu `ADMIN_KEY` y publica con el botón **Publicar**.

Seguridad (SPEC 4.2): el navegador solo tiene la anon key, que **únicamente puede leer** (RLS). Toda escritura pasa por las funciones `/api` de Vercel, que validan `x-admin-key` contra `ADMIN_KEY` y usan la service role key del lado del servidor. Sin la clave correcta no existe ningún camino de escritura.

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

## Herramientas de venta

El visor está pensado como material comercial de Movimagen:

- **Splash de bienvenida**: al abrir el link de un cliente (`?cliente=grido`), aparece una portada con su nombre — "Así se ve tu marca en …" (una vez por sesión).
- **Ficha de soporte**: tocar cualquier soporte abre una tarjeta con su nombre, ubicación y formato, y un botón "Consultar por este soporte" que arma el mensaje solo.
- **CTA flotante "Anunciá acá"**: siempre visible en el visor, abre WhatsApp o email con un texto prellenado que incluye el recorrido y la marca.
- **Espacios disponibles que venden**: los soportes sin arte muestran "Espacio disponible · tu marca acá" con un borde naranja pulsante.
- **Compartir y presentar**: botones de copiar link y pantalla completa en la barra superior; navegación con las flechas del teclado para reuniones.

**Configurar el contacto:** en `public/catalogo.json`, el bloque `contacto` define adónde llegan las consultas. Con `whatsapp` (número con código de país, sin `+`, ej. `59899123456`) los CTA abren WhatsApp; si queda vacío, usan el `email`.

## Marca

La identidad sigue el manual de marca Movimagen: naranja `#eb691c` (Pantone 1505 C), gris `#d0d3d4`, tipografía Montserrat, y el logo/monograma oficiales en `public/marca/` (`wordmark-blanco.png`, `wordmark-naranja.png`, `monograma.png`, `favicon.png`). Para reemplazar el logo por una versión nueva, pisá esos archivos manteniendo el nombre.

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
