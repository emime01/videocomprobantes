# Manual de uso — Recorridos Virtuales Movimagen

Guía funcional para el equipo comercial. Para detalles técnicos de instalación/deploy, ver [`README.md`](./README.md).

## 1. Qué es

Una app donde cada **soporte publicitario** (columna, banner, panel de bus, pantalla) de un shopping, medianera, bus o freeshop está fotografiado y calibrado. Al cliente le mandás un link, y ve **su marca montada en perspectiva** sobre las fotos reales del lugar, como si ya estuviera instalada. Sirve para vender antes de imprimir un solo vinilo.

## 2. Los tres roles del sistema

| Rol | Qué hace | Dónde |
|---|---|---|
| **Planner / vendedor** | Navega la landing, ve qué soportes existen por categoría | Home (`/`) |
| **Quien arma el inventario** | Fotografía el lugar, calibra los soportes una vez | **Armar** (`#/{id}/editor`) |
| **Quien vende** | Carga la marca de cada cliente sobre soportes ya armados | **Clientes** (`#/{id}/clientes`) |

**Separación clave:** armar (calibrar soportes) y cargar clientes (subir artes) son pasos distintos. Un soporte se calibra **una sola vez**; después, cualquier cliente nuevo solo necesita su imagen, sin tocar la calibración.

## 3. La landing (Home)

En `/` ves todos los recorridos agrupados por categoría: **Shoppings, Pantallas gigantes, Medianeras, Carteles en buses, Freeshops** (o cualquier otra que definas). Es una landing **solo de lectura**, pensada para que un planner navegue el inventario: cada card tiene únicamente **Ver recorrido →**, que abre el visor público a pantalla completa. No hay botones para crear ni ícono de edición — nada de administración vive acá.

Toda la administración (crear recorridos/propuestas, y el acceso a "Armar"/"Clientes" de cada uno) está en **`#/admin`**, un panel aparte al que se llega por el link discreto "Equipo Movimagen · administrar →" al pie de la landing. Ahí sí cada card tiene su ícono ⚙ con "Armar"/"Clientes", y abajo están los formularios de "+ Crear" recorrido y "+ Crear propuesta". Sigue pidiendo tu clave de administrador al guardar/publicar si la app está conectada a Supabase.

## 4. Armar un recorrido

Entrás por el ícono ⚙ → **Armar** de una card, o creás uno nuevo desde la Home.

1. **Nombre y categoría** del recorrido (arriba del panel derecho).
2. **+ Punto (subir foto)**: cada parada del recorrido es una foto. Subís las fotos del lugar, una por parada.
3. Con una parada seleccionada, **tocá sobre la foto** para crear un soporte (**+ Soporte**) y arrastrá sus 4 esquinas hasta que calcen con el panel/columna real.
   - **Zoom 16x**: activalo para calibrar con precisión quirúrgica, sobre todo en soportes chicos o fotos de alta resolución.
   - **Orientación** (vertical/horizontal): define qué formato de arte espera ese soporte.
   - **Capa del arte**: "Encima de la foto" (normal, la mayoría de los casos) o "Debajo de la foto" — usalo en soportes de forma compleja (ej. la trasera curva de un bus) donde preparaste la foto con un **hueco transparente** recortado; el arte del cliente aparece por detrás, encajando en ese hueco.
4. **Hotspots**: flechas que conectan una parada con la siguiente, para que el cliente navegue el recorrido tocando.
5. **Guardar / Publicar** (arriba): si la app está conectada a Supabase, el botón dice "Publicar" y sube todo a la base; si no, queda guardado en tu navegador.

Este modo **no** carga imágenes de clientes — para eso está "Clientes" (sección 5).

## 5. Cargar un cliente (modo Clientes)

Entrás por el ícono ⚙ → **Clientes** de un recorrido ya armado.

1. **+ Nuevo**: creás el cliente/anunciante (ej. "Grido").
2. Con el cliente seleccionado, subís su arte:
   - **Carga masiva por formato** (recomendado, salvo en Buses): subís **una imagen vertical** y se aplica sola a todos los soportes verticales del recorrido, y lo mismo con **una horizontal**. Ahorra tiempo cuando el recorrido tiene muchos soportes del mismo formato.
   - **Soporte por soporte**: para ajustar uno en particular, o en recorridos de Buses (sus soportes tienen formas más específicas — frente/lateral/trasera — y conviene cargarlos uno por uno).
3. El panel izquierdo muestra el **preview en vivo**: así se ve montado, en cada parada.
4. **Publicar / Guardar**, y **Copiar link para [Cliente]** — ese es el link que le mandás.

## 6. Propuestas: combinar varios lugares

Si querés ofrecerle a un cliente **Shopping Colonia + Shopping Paysandú + un Bus** en una sola experiencia, creás una **Propuesta**:

1. Desde la Home, **+ Crear propuesta**.
2. Nombre + elegís los lugares (ya armados) **en el orden** en que se van a recorrer.
3. Al crear, queda como un recorrido más en la Home, con su propio link `?cliente=x#/tu-propuesta`.

El cliente lo recorre de **corrido**: al cruzar de un lugar a otro aparece un cartel breve ("Ahora en Bus · Línea 405"), sin cortes. Los artes que ve son los que ya cargaste para ese cliente en cada lugar por separado (modo Clientes) — una propuesta no tiene artes propios, reutiliza los de los lugares que combina.

## 7. La experiencia del cliente (visor)

Cuando el anunciante abre `...?cliente=grido#/demo-shopping`:

1. **Apertura**: "Preparamos esta experiencia para Grido" (una vez por sesión).
2. **Recorrido a pantalla completa**: toca las flechas naranjas para avanzar, o usa las paradas de abajo. El arte se "monta" con una pequeña animación al llegar a cada parada.
3. **Tocar un soporte** abre una ficha con nombre, ubicación, formato y un botón de consulta directa.
4. **▶ Tour automático**: reproduce el recorrido solo, útil para presentaciones.
5. **Cierre**: al terminar, "¿Estás listo para llevar tu marca al siguiente nivel?" con un resumen y un botón de contacto.

Sin `?cliente=` en el link (o con un cliente inexistente), los soportes muestran **"Espacio disponible · tu marca acá"** — así se ofrece el inventario libre a cualquiera que abra el recorrido general.

## 8. Contacto de los botones "Anunciá acá" / "Consultar"

Se configura en `public/catalogo.json`, bloque `contacto`:

```json
"contacto": { "whatsapp": "59899123456", "email": "comercial@movimagen.com.uy" }
```

Con `whatsapp` cargado (número con código de país, sin `+`), todos los CTA abren WhatsApp con el mensaje ya escrito. Si queda vacío, usan el email.

## 9. Modo local vs modo conectado (Supabase)

- **Sin credenciales de Supabase**: todo funciona igual pero guardado en el navegador de quien edita (no se comparte entre dispositivos). Es el modo del deploy en GitHub Pages, para pruebas y demos.
- **Con Supabase configurado** (deploy en Vercel): los datos viven en una base compartida. Cualquiera con el link ve lo mismo desde cualquier dispositivo, y editar pide tu clave de administrador (`ADMIN_KEY`). Este es el modo de producción real.

Instrucciones de activación en el [`README.md`](./README.md), sección "Activar Supabase + Vercel".

## 10. Identidad de marca

- Colores: naranja `#eb691c` (oficial del manual) y blanco.
- Tipografía: **Fredoka** (Google Fonts) — alternativa gratuita a BC Alphapipe, la tipográfica oficial del manual, que es de pago. Si en algún momento se adquiere la licencia, se puede reemplazar en `index.html`/`styles.css`.
- Logo: extraído del manual de marca, en `public/marca/` (wordmark blanco/naranja, monograma M+V, favicon).
