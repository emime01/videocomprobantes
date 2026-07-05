# Recorrido Virtual Comercial · Movimagen

Recorrido virtual foto a foto de un shopping, con los artes de cada anunciante montados en perspectiva sobre las fotos reales. Ver especificación completa en [`SPEC.md`](./SPEC.md).

## Estado

**Fase 1 — Visor con datos locales.** El visor lee `/public/config.demo.json` (sin Supabase todavía) y muestra un recorrido demo de 3 puntos con los artes de un cliente de prueba montados en perspectiva.

**Fase 2 — Editor local.** El editor (`/editor`) trabaja en memoria: calibración de soportes arrastrando esquinas, hotspots editables, alta/baja/reorden de puntos subiendo su foto, alta de clientes y artes por soporte, zoom 2x para calibrar fino, y export/import del JSON completo como backup manual.

## Desarrollo local

```bash
npm install
npm run dev
```

- `http://localhost:5173/?cliente=grido` — visor público con los artes de "Grido" montados en los soportes. Sin `?cliente`, los soportes se muestran vacíos ("Espacio disponible").
- `http://localhost:5173/editor` — editor visual. Los cambios viven en memoria; usá "Exportar JSON" para guardarlos y "Importar JSON" para retomarlos.

## Preview en vivo (GitHub Pages)

Cada push a `main` publica la app automáticamente vía GitHub Actions (workflow `.github/workflows/deploy-pages.yml`). **Activación por única vez:** en el repo, `Settings → Pages → Build and deployment → Source: GitHub Actions`. Después de eso, cada push queda publicado solo.

URL pública una vez activado:

- Visor: `https://emime01.github.io/videocomprobantes/?cliente=grido`
- Editor: `https://emime01.github.io/videocomprobantes/#/editor`

> En Pages la app vive bajo el subpath `/videocomprobantes/`, así que el editor se abre con **hash** (`#/editor`) en vez de `/editor`. En dev local y en el deploy definitivo de Vercel (Fase 4) sigue funcionando `/editor` normal.

## Notas

- Las fotos y artes de `/public/demo/` son placeholders SVG (no hay fotos reales del shopping todavía).
- El bloque `clientesDemo` dentro de `config.demo.json` (Fase 1) y el arreglo `clientes` que exporta/importa el editor (Fase 2) son atajos temporales para trabajar sin Supabase; en la Fase 3 se reemplazan por las tablas `clientes`/`artes` (sección 4.2 de `SPEC.md`).
- La ruta `/editor` todavía no pide `ADMIN_KEY` (eso llega con las funciones serverless de la Fase 3); por ahora es una herramienta de trabajo local, sin persistencia remota.
