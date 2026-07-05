# SPEC — Recorrido Virtual Comercial · Movimagen

Documento de especificación para implementar con Claude Code. Leerlo completo antes de escribir código. Si algo no está definido acá, elegir siempre la opción más simple.

## 1. Qué es

Web app: recorrido virtual foto a foto de un shopping donde los soportes publicitarios muestran el arte de cada anunciante montado en perspectiva sobre las fotos reales. Es una herramienta de venta: a cada anunciante se le manda un link (`/demo-shopping?cliente=grido`) y ve su marca puesta en todos los soportes mientras navega el recorrido haciendo click.

Incluye un editor visual interno: sobre la misma foto se definen las zonas de cada soporte arrastrando sus 4 esquinas, se cargan los artes por cliente y se arma la navegación entre puntos. Cero Photoshop: se fotografía el shopping una vez y después todo se gestiona desde el navegador.

Ya existe un prototipo React de un solo componente que validó la mecánica (homografía rectángulo→cuadrilátero con CSS `matrix3d`, esquinas arrastrables, carga de arte con downscale, export JSON). Este documento define la versión productiva.

## 2. Stack (no cambiar sin una razón fuerte)

- **Vite + React 18**, JavaScript. Sin TypeScript, sin Next.
- **CSS plano**: un archivo global con variables CSS. Sin Tailwind, sin librerías de UI.
- **Supabase**: Postgres para la configuración + Storage para fotos y artes.
- **Vercel** para el deploy. Funciones serverless de Vercel (`/api`) solo para las escrituras autenticadas.
- **GitHub** como repo, un commit al cierre de cada fase.

Principio rector: pragmático y sin over-engineering. Cada dependencia nueva se justifica o no entra.

## 3. Estructura del repo

```
/src
  /components   Visor.jsx, Editor.jsx, ZonaSoporte.jsx, Hotspot.jsx, PanelEditor.jsx ...
  /lib          homografia.js, supabase.js, imagenes.js
  App.jsx
  main.jsx
  styles.css
/api            guardar-config.js, subir-archivo.js  (funciones Vercel)
/public          config.demo.json + fotos de demo (solo Fase 1–2)
SPEC.md          este archivo
```

## 4. Modelo de datos

### 4.1 Formato de configuración (fuente de verdad)

Un JSON por shopping — mismo espíritu que el `catalogo.json` de preflight-ooh: un solo archivo define todo.

```json
{
  "id": "demo-shopping",
  "nombre": "Demo Shopping",
  "puntos": [
    {
      "id": "p1",
      "nombre": "Atrio de entrada",
      "foto": "https://.../storage/fotos/demo-shopping/p1.jpg",
      "hotspots": [
        { "to": "p2", "x": 50, "y": 68, "label": "Pasillo central" }
      ],
      "soportes": [
        {
          "id": "s1",
          "nombre": "Columna LED · Atrio",
          "orientacion": "v",
          "esquinas": [
            { "x": 73.2, "y": 21.5 },
            { "x": 81.0, "y": 23.0 },
            { "x": 81.0, "y": 88.0 },
            { "x": 73.2, "y": 90.2 }
          ]
        }
      ]
    }
  ]
}
```

Reglas del formato:

- Todas las coordenadas (`esquinas`, `hotspots`) son **porcentajes 0–100 relativos a la foto** de ese punto. Así funcionan igual en cualquier tamaño de pantalla.
- El orden de esquinas es fijo: **TL, TR, BR, BL** (arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda).
- `orientacion` (`"v"` | `"h"`) solo se usa para elegir el placeholder correcto; el arte real siempre se deforma al cuadrilátero.
- Los `id` de puntos y soportes son únicos dentro del shopping y no se reciclan.

### 4.2 Supabase

```sql
create table shoppings (
  id text primary key,           -- slug: "demo-shopping"
  nombre text not null,
  config jsonb not null,         -- el JSON de la sección 4.1
  actualizado_en timestamptz default now()
);

create table clientes (
  id text not null,              -- slug: "grido"
  shopping_id text not null references shoppings(id) on delete cascade,
  nombre text not null,
  activo boolean default true,
  primary key (shopping_id, id)
);

create table artes (
  shopping_id text not null,
  cliente_id text not null,
  soporte_id text not null,      -- id de soporte dentro del config
  url text not null,             -- URL pública en Storage
  primary key (shopping_id, cliente_id, soporte_id)
);
```

Storage: buckets `fotos` y `artes`, ambos con lectura pública.

RLS: **lectura anónima en todo, escritura en nada**. Toda escritura pasa por las funciones serverless de `/api`, que usan `SUPABASE_SERVICE_ROLE_KEY` y validan el header `x-admin-key` contra la env `ADMIN_KEY`.

Decisión deliberada: la config vive como `jsonb` (una fila por shopping) en vez de normalizar puntos y soportes en tablas. Menos fricción, export/import trivial, y el volumen no lo justifica.

## 5. Rutas

- `/` — lista simple de shoppings (nombre + link al visor).
- `/:shoppingId?cliente=slug` — **visor público**, solo lectura. El link ya define el cliente: no hay selector visible. Sin `?cliente`, los soportes se muestran vacíos con el texto "Espacio disponible". Con un slug inexistente, igual que vacío.
- `/:shoppingId/editor` — visor + **modo edición**. Al entrar pide la clave (input simple); se guarda en `sessionStorage` y se manda como `x-admin-key` en cada escritura. Si la clave es incorrecta, las funciones de `/api` devuelven 401 y la UI lo informa.

## 6. Visor (público)

- La foto del punto ocupa el máximo espacio posible **respetando su aspect ratio real** (no forzar 16:9). El sistema de porcentajes funciona igual con cualquier proporción.
- Soportes: el arte del cliente se monta con `matrix3d` (sección 8) más un overlay sutil de luz (gradiente diagonal) para que se integre a la foto.
- Hotspots: botones circulares con flecha y label; al tocarlos se navega al punto destino con una transición fade corta (~400 ms).
- Barra inferior con las paradas numeradas del recorrido (acceso directo).
- Precarga de las fotos de los puntos vecinos (los `to` de los hotspots del punto actual).
- Marca "MOVIMAGEN" discreta en una esquina — es material comercial.
- Responsive y touch. Sin login, sin analytics, sin cookies.

## 7. Editor (interno)

Todo lo del visor, más:

- **Calibración de soportes**: tocar un soporte lo selecciona; sus 4 esquinas se arrastran con pointer events (`touch-action: none` en el stage durante la edición). Handles visibles estilo marcas de registro. Crear y eliminar soportes; editar nombre y orientación.
- **Zoom para calibrar fino**: con fotos reales las esquinas exigen precisión. Implementar zoom/pan del stage (rueda + pinch, o como mínimo un toggle de zoom 2x centrado en el soporte seleccionado).
- **Hotspots editables**: arrastrarlos, elegir punto destino, editar label, crear y eliminar.
- **Puntos**: crear punto subiendo su foto, renombrar, reemplazar foto, eliminar, reordenar.
- **Clientes y artes**: crear cliente (nombre + slug), subir arte por soporte, quitar arte, y botón "copiar link público" del cliente. Selector de cliente activo para previsualizar ("ver como").
- **Guardado**: botón explícito "Guardar" que persiste el config vía `/api/guardar-config`, con indicador de estado (guardado / cambios sin guardar / error). Autosave con debounce es opcional; el botón es obligatorio.
- **Export / Import JSON** del config completo, como backup manual.
- Toggle "luz" (overlay de integración) solo visible en el editor.

## 8. Matemática de perspectiva (usar tal cual, no reinventar)

`src/lib/homografia.js` — mapea un rectángulo al cuadrilátero definido por las esquinas y devuelve un `matrix3d` para CSS. Probado en el prototipo:

```js
function adj(m) {
  return [
    m[4]*m[8]-m[5]*m[7], m[2]*m[7]-m[1]*m[8], m[1]*m[5]-m[2]*m[4],
    m[5]*m[6]-m[3]*m[8], m[0]*m[8]-m[2]*m[6], m[2]*m[3]-m[0]*m[5],
    m[3]*m[7]-m[4]*m[6], m[1]*m[6]-m[0]*m[7], m[0]*m[4]-m[1]*m[3],
  ];
}
function multmm(a, b) {
  const c = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += a[3*i+k] * b[3*k+j];
      c[3*i+j] = s;
    }
  return c;
}
function multmv(m, v) {
  return [
    m[0]*v[0]+m[1]*v[1]+m[2]*v[2],
    m[3]*v[0]+m[4]*v[1]+m[5]*v[2],
    m[6]*v[0]+m[7]*v[1]+m[8]*v[2],
  ];
}
function basisToPoints(x1,y1,x2,y2,x3,y3,x4,y4) {
  const m = [x1,x2,x3, y1,y2,y3, 1,1,1];
  const v = multmv(adj(m), [x4,y4,1]);
  return multmm(m, [v[0],0,0, 0,v[1],0, 0,0,v[2]]);
}
function general2DProjection(
  x1s,y1s,x1d,y1d, x2s,y2s,x2d,y2d,
  x3s,y3s,x3d,y3d, x4s,y4s,x4d,y4d
) {
  const s = basisToPoints(x1s,y1s, x2s,y2s, x3s,y3s, x4s,y4s);
  const d = basisToPoints(x1d,y1d, x2d,y2d, x3d,y3d, x4d,y4d);
  return multmm(d, adj(s));
}

/** p = [TL, TR, BR, BL] en px dentro del contenedor de la foto */
export function matrix3dFor(w, h, p) {
  let t = general2DProjection(
    0, 0, p[0].x, p[0].y,
    w, 0, p[1].x, p[1].y,
    0, h, p[3].x, p[3].y,
    w, h, p[2].x, p[2].y
  );
  if (!t[8]) return "none";
  for (let i = 0; i < 9; i++) t[i] = t[i] / t[8];
  const m = [t[0],t[3],0,t[6], t[1],t[4],0,t[7], 0,0,1,0, t[2],t[5],0,t[8]];
  return `matrix3d(${m.join(",")})`;
}
```

Uso en el componente del soporte: convertir las esquinas de % a px según el tamaño renderizado de la foto (medir con `ResizeObserver`); el elemento del arte se layoutea en `left:0; top:0` con `width` ≈ distancia TL→TR y `height` ≈ distancia TL→BL, `transform-origin: 0 0`, `transform: matrix3dFor(w, h, esquinasPx)`, y la `<img>` interna con `object-fit: fill`. El overlay de luz es un segundo div con el mismo transform y un gradiente.

## 9. Subida y tratamiento de imágenes (client-side, en `lib/imagenes.js`)

- Fotos de puntos: redimensionar a máx 2400 px de lado mayor, exportar JPEG calidad 0.85 antes de subir.
- Artes de clientes: máx 1600 px de lado mayor, JPEG 0.85, con fondo blanco si el original trae transparencia.
- Paths en Storage: `fotos/{shoppingId}/{puntoId}.jpg` y `artes/{shoppingId}/{clienteId}/{soporteId}.jpg`. Subir con upsert para que reemplazar sea sobrescribir. Al reemplazar, sumar `?v={timestamp}` a la URL guardada para romper caché.
- La subida física la hace la función serverless `subir-archivo.js` (recibe el archivo ya comprimido + destino, valida `x-admin-key`, sube con service role y devuelve la URL pública).

## 10. Variables de entorno

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # solo en funciones serverless, nunca en el cliente
ADMIN_KEY=                   # clave del editor
```

Incluir `.env.example` en el repo y `.env` en `.gitignore`.

## 11. Fases de trabajo

Una fase por sesión. Al cerrar cada fase: `npm run dev` funcionando, commit con mensaje descriptivo.

**Fase 1 — Visor con datos locales.** Proyecto Vite + estructura del repo + visor completo (sección 6) leyendo `/public/config.demo.json` con 2–3 fotos placeholder. Sin Supabase todavía. *Criterio: se navega el recorrido completo y los artes de un cliente de prueba se ven montados en perspectiva desde el JSON.*

**Fase 2 — Editor local.** Modo edición completo (sección 7) trabajando en memoria: esquinas, soportes, hotspots, puntos, artes (como dataURL) y export/import JSON. *Criterio: sobre una foto real se calibra un soporte nuevo desde cero, se le sube un arte, y el JSON exportado reproduce todo al importarlo.*

**Fase 3 — Supabase + links por cliente.** Schema y buckets (4.2), lectura pública desde el visor, funciones `/api` con `ADMIN_KEY`, guardado desde el editor, subida real de fotos y artes, ruta `?cliente=`. *Criterio: un link público por cliente funciona desde datos remotos, y sin la clave no se puede escribir nada.*

**Fase 4 — Pulido.** Precarga de fotos vecinas, zoom del editor, home con lista de shoppings, marca de agua, estados de carga y error prolijos, y un `README.md` con: setup, deploy en Vercel, cómo crear un shopping desde cero y la guía de fotos (sección 13).

## 12. Criterios de aceptación globales

- Funciona bien en celular, incluido el arrastre de esquinas con el dedo.
- Un anunciante con su link ve solo su marca y no tiene forma de editar nada.
- Sin `ADMIN_KEY` correcta no existe ningún camino de escritura a Supabase.
- La config completa es exportable e importable como JSON en cualquier momento.
- Liviano: fotos con `loading="lazy"` fuera del punto activo, sin dependencias innecesarias.

## 13. Guía de fotos (trabajo de campo)

- Horizontal, a la altura del pecho, celular firme (idealmente apoyado o con estabilizador).
- El soporte debe quedar **completo y lo más frontal posible** dentro del cuadro; si está muy escorzado, el montaje pierde realismo.
- Evitar contraluces fuertes contra vidrieras; HDR del celular está bien.
- Una foto por parada del recorrido. Antes de fotografiar, dibujar la cadena de paradas y hacia dónde apunta cada flecha: eso define qué fotos hacen falta.
- No importa si los soportes tienen publicidad actual: la zona calibrada la tapa.

## 14. Cómo trabajar este documento con Claude Code

1. Crear el repo en GitHub (ej: `recorrido-movimagen`), clonarlo y copiar este archivo como `SPEC.md` en la raíz.
2. Crear también un `CLAUDE.md` mínimo con tres líneas: "Stack y decisiones: ver SPEC.md, respetarlo. Sin over-engineering: la opción más simple gana. UI y textos en español rioplatense (vos)."
3. Abrir `claude` en la carpeta y pedir: "Leé SPEC.md e implementá la Fase 1 completa. Al terminar, corré la app, verificá el criterio de la fase y hacé commit."
4. Probar con `npm run dev`, pedir ajustes si hace falta, y avanzar fase por fase de la misma manera. Para el deploy: conectar el repo a Vercel y cargar las variables de entorno de la sección 10.
