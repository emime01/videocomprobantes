-- Schema Fase 3 (SPEC 4.2). Pegar completo en el SQL Editor de Supabase y correr.
-- Es idempotente: se puede correr más de una vez sin romper nada.

-- ── Tablas ──────────────────────────────────────────────────────────────

create table if not exists shoppings (
  id text primary key,              -- slug: "demo-shopping"
  nombre text not null,
  config jsonb not null,            -- el JSON completo del recorrido
  actualizado_en timestamptz default now()
);

create table if not exists clientes (
  id text not null,                 -- slug: "grido"
  shopping_id text not null references shoppings(id) on delete cascade,
  nombre text not null,
  activo boolean default true,
  primary key (shopping_id, id)
);

create table if not exists artes (
  shopping_id text not null,
  cliente_id text not null,
  soporte_id text not null,         -- id de soporte dentro del config
  url text not null,                -- URL pública en Storage
  primary key (shopping_id, cliente_id, soporte_id)
);

-- ── RLS: lectura anónima en todo, escritura en nada ─────────────────────
-- Las escrituras van solo por las funciones /api con la service role key.

alter table shoppings enable row level security;
alter table clientes enable row level security;
alter table artes enable row level security;

drop policy if exists "lectura anonima" on shoppings;
create policy "lectura anonima" on shoppings for select using (true);

drop policy if exists "lectura anonima" on clientes;
create policy "lectura anonima" on clientes for select using (true);

drop policy if exists "lectura anonima" on artes;
create policy "lectura anonima" on artes for select using (true);

-- ── Storage: buckets públicos para fotos y artes ────────────────────────

insert into storage.buckets (id, name, public) values ('fotos', 'fotos', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('artes', 'artes', true)
  on conflict (id) do nothing;

-- ── Datos demo (opcional, para arrancar con algo publicado) ─────────────
-- Las fotos apuntan a /demo/*.svg, que sirve el mismo deploy de Vercel.

insert into shoppings (id, nombre, config) values (
  'demo-shopping',
  'Demo Shopping',
  '{"id":"demo-shopping","nombre":"Demo Shopping","categoria":"Shoppings","puntos":[{"id":"p1","nombre":"Atrio de entrada","foto":"/demo/p1.svg","hotspots":[{"to":"p2","x":50,"y":70,"label":"Pasillo central"}],"soportes":[{"id":"s1","nombre":"Columna LED · Atrio","orientacion":"v","esquinas":[{"x":68,"y":18},{"x":80,"y":21},{"x":80,"y":88},{"x":68,"y":85}]}]},{"id":"p2","nombre":"Pasillo central","foto":"/demo/p2.svg","hotspots":[{"to":"p1","x":8,"y":60,"label":"Atrio de entrada"},{"to":"p3","x":90,"y":62,"label":"Plaza de comidas"}],"soportes":[{"id":"s2","nombre":"Banner colgante · Pasillo","orientacion":"h","esquinas":[{"x":30,"y":12},{"x":70,"y":10},{"x":72,"y":30},{"x":28,"y":32}]}]},{"id":"p3","nombre":"Plaza de comidas","foto":"/demo/p3.svg","hotspots":[{"to":"p2","x":12,"y":62,"label":"Pasillo central"}],"soportes":[{"id":"s3","nombre":"Columna · Plaza de comidas","orientacion":"v","esquinas":[{"x":55,"y":22},{"x":66,"y":24},{"x":65.5,"y":90},{"x":54.5,"y":88}]}]}]}'::jsonb
) on conflict (id) do nothing;

insert into shoppings (id, nombre, config) values (
  'demo-bus',
  'Bus · Línea 405',
  '{"id":"demo-bus","nombre":"Bus · Línea 405","categoria":"Buses","puntos":[{"id":"b1","nombre":"Frente","foto":"/demo/bus-frente.svg","hotspots":[{"to":"b2","x":88,"y":55,"label":"Lateral"}],"soportes":[{"id":"bs1","nombre":"Panel frontal","orientacion":"h","esquinas":[{"x":33.5,"y":55.5},{"x":66.5,"y":55.5},{"x":66.5,"y":66.5},{"x":33.5,"y":66.5}]}]},{"id":"b2","nombre":"Lateral","foto":"/demo/bus-lateral.svg","hotspots":[{"to":"b1","x":8,"y":55,"label":"Frente"},{"to":"b3","x":92,"y":55,"label":"Trasera"}],"soportes":[{"id":"bs2","nombre":"Lateral completo","orientacion":"h","esquinas":[{"x":22.5,"y":37.5},{"x":70,"y":37.5},{"x":70,"y":65},{"x":22.5,"y":65}]}]},{"id":"b3","nombre":"Trasera","foto":"/demo/bus-trasera.svg","hotspots":[{"to":"b2","x":10,"y":55,"label":"Lateral"}],"soportes":[{"id":"bs3","nombre":"Panel trasero","orientacion":"h","esquinas":[{"x":31.7,"y":50},{"x":68.3,"y":50},{"x":68.3,"y":65.5},{"x":31.7,"y":65.5}]}]}]}'::jsonb
) on conflict (id) do nothing;

insert into clientes (shopping_id, id, nombre) values
  ('demo-shopping', 'grido', 'Grido'),
  ('demo-bus', 'grido', 'Grido')
on conflict (shopping_id, id) do nothing;

insert into artes (shopping_id, cliente_id, soporte_id, url) values
  ('demo-shopping', 'grido', 's1', '/demo/arte-grido-v.svg'),
  ('demo-shopping', 'grido', 's2', '/demo/arte-grido-h.svg'),
  ('demo-shopping', 'grido', 's3', '/demo/arte-grido-v.svg'),
  ('demo-bus', 'grido', 'bs1', '/demo/arte-grido-h.svg'),
  ('demo-bus', 'grido', 'bs2', '/demo/arte-grido-h.svg'),
  ('demo-bus', 'grido', 'bs3', '/demo/arte-grido-h.svg')
on conflict (shopping_id, cliente_id, soporte_id) do nothing;
