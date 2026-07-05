# Recorrido Virtual Comercial · Movimagen

Recorrido virtual foto a foto de un shopping, con los artes de cada anunciante montados en perspectiva sobre las fotos reales. Ver especificación completa en [`SPEC.md`](./SPEC.md).

## Estado

**Fase 1 — Visor con datos locales.** El visor lee `/public/config.demo.json` (sin Supabase todavía) y muestra un recorrido demo de 3 puntos con los artes de un cliente de prueba montados en perspectiva.

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir `http://localhost:5173/?cliente=grido` para ver el recorrido demo con los artes de "Grido" montados en los soportes. Sin `?cliente`, los soportes se muestran vacíos ("Espacio disponible").

## Notas de la Fase 1

- Las fotos y artes de `/public/demo/` son placeholders SVG (no hay fotos reales del shopping todavía).
- El bloque `clientesDemo` dentro de `config.demo.json` es un atajo temporal para probar artes en memoria sin Supabase; en la Fase 3 se reemplaza por las tablas `clientes`/`artes` (sección 4.2 de `SPEC.md`).
