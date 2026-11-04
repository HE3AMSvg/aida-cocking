-- Aida Cockings production schema
-- Run this entire file once in Supabase Dashboard > SQL Editor.
-- This migration intentionally does not insert fake products or example prices.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- Disable the prototype table/policy from the first draft if it was created.
-- This prevents the old client-side price submission path from remaining writable.
do $$
begin
  if pg_catalog.to_regclass('public.orders') is not null then
    execute 'drop policy if exists "Visitors can submit orders" on public.orders';
    execute 'revoke all privileges on table public.orders from anon, authenticated';
  end if;
end
$$;

create table if not exists public.aida_products (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  slug text not null unique,
  name text not null check (pg_catalog.char_length(name) between 2 and 100),
  category text not null check (category in ('کیک','شیرینی','دسر','باکس هدیه')),
  description text not null default '' check (pg_catalog.char_length(description) <= 500),
  price_toman bigint not null check (price_toman between 1 and 1000000000),
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table if not exists public.aida_orders (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  order_code text not null unique,
  customer_name text not null check (pg_catalog.char_length(customer_name) between 2 and 90),
  phone text not null check (pg_catalog.char_length(phone) between 10 and 16),
  district text not null check (pg_catalog.char_length(district) between 2 and 80),
  address text not null check (pg_catalog.char_length(address) between 5 and 500),
  delivery_date date not null,
  delivery_time text not null check (delivery_time in ('10:00-13:00','13:00-16:00','16:00-19:00','19:00-21:00')),
  notes text not null default '' check (pg_catalog.char_length(notes) <= 700),
  total_toman bigint not null check (total_toman > 0),
  status text not null default 'new' check (status in ('new','confirmed','preparing','delivered','cancelled')),
  created_at timestamptz not null default pg_catalog.now()
);

create table if not exists public.aida_order_items (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  order_id uuid not null references public.aida_orders(id) on delete cascade,
  product_id uuid references public.aida_products(id) on delete set null,
  product_name_snapshot text not null,
  quantity integer not null check (quantity between 1 and 20),
  unit_price_toman bigint not null check (unit_price_toman > 0),
  line_total_toman bigint generated always as (quantity * unit_price_toman) stored
);

create index if not exists aida_products_public_catalog_idx
  on public.aida_products (is_active, sort_order, name);
create index if not exists aida_orders_created_at_idx
  on public.aida_orders (created_at desc);
create index if not exists aida_orders_phone_created_idx
  on public.aida_orders (phone, created_at desc);
create index if not exists aida_order_items_order_idx
  on public.aida_order_items (order_id);

create table if not exists private.aida_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default pg_catalog.now()
);

-- Admin-check helper. The private schema is not exposed through the public Data API.
create or replace function private.is_aida_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.aida_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_aida_admin() from public, anon;
grant execute on function private.is_aida_admin() to authenticated;

-- Small public helper so the management UI can confirm admin membership after sign-in.
create or replace function public.aida_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_aida_admin();
$$;

revoke all on function public.aida_is_admin() from public, anon, authenticated;
grant execute on function public.aida_is_admin() to authenticated;

-- Update product timestamps on edits.
create or replace function private.set_aida_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.set_aida_updated_at() from public, anon, authenticated;
drop trigger if exists aida_products_set_updated_at on public.aida_products;
create trigger aida_products_set_updated_at
before update on public.aida_products
for each row execute function private.set_aida_updated_at();

-- Row Level Security and minimal table grants.
alter table public.aida_products enable row level security;
alter table public.aida_orders enable row level security;
alter table public.aida_order_items enable row level security;
alter table private.aida_admins enable row level security;

revoke all privileges on table public.aida_products from public, anon, authenticated;
revoke all privileges on table public.aida_orders from public, anon, authenticated;
revoke all privileges on table public.aida_order_items from public, anon, authenticated;
revoke all privileges on table private.aida_admins from public, anon, authenticated;

grant select on table public.aida_products to anon, authenticated;
grant insert, update on table public.aida_products to authenticated;
grant select, update on table public.aida_orders to authenticated;
grant select on table public.aida_order_items to authenticated;

drop policy if exists "Public can view active Aida products" on public.aida_products;
create policy "Public can view active Aida products"
on public.aida_products for select
to anon
using (is_active = true);

drop policy if exists "Signed-in users can view active products or admins all products" on public.aida_products;
create policy "Signed-in users can view active products or admins all products"
on public.aida_products for select
to authenticated
using (is_active = true or (select private.is_aida_admin()));

drop policy if exists "Aida admins manage products" on public.aida_products;
create policy "Aida admins manage products"
on public.aida_products for all
to authenticated
using ((select private.is_aida_admin()))
with check ((select private.is_aida_admin()));

drop policy if exists "Aida admins read orders" on public.aida_orders;
create policy "Aida admins read orders"
on public.aida_orders for select
to authenticated
using ((select private.is_aida_admin()));

drop policy if exists "Aida admins update order status" on public.aida_orders;
create policy "Aida admins update order status"
on public.aida_orders for update
to authenticated
using ((select private.is_aida_admin()))
with check ((select private.is_aida_admin()));

drop policy if exists "Aida admins read order items" on public.aida_order_items;
create policy "Aida admins read order items"
on public.aida_order_items for select
to authenticated
using ((select private.is_aida_admin()));

-- Secure public order intake. Product prices are read from the database,
-- never trusted from the browser. This function is the only public write path.
create or replace function public.aida_submit_order(
  p_customer_name text,
  p_phone text,
  p_district text,
  p_address text,
  p_delivery_date date,
  p_delivery_time text,
  p_notes text,
  p_items jsonb,
  p_website text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_phone text;
  v_district text;
  v_address text;
  v_notes text;
  v_item jsonb;
  v_snapshot jsonb;
  v_snapshots jsonb := '[]'::jsonb;
  v_product_id uuid;
  v_product_name text;
  v_product_price bigint;
  v_quantity integer;
  v_total bigint := 0;
  v_order_id uuid;
  v_order_code text;
begin
  if coalesce(p_website, '') <> '' then
    raise exception using errcode = '22023', message = 'Invalid request';
  end if;

  v_name := pg_catalog.btrim(coalesce(p_customer_name, ''));
  v_phone := pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_phone, '')), '[[:space:]()\-]', '', 'g');
  v_district := pg_catalog.btrim(coalesce(p_district, ''));
  v_address := pg_catalog.btrim(coalesce(p_address, ''));
  v_notes := pg_catalog.btrim(coalesce(p_notes, ''));

  if pg_catalog.char_length(v_name) not between 2 and 90 then
    raise exception using errcode = '22023', message = 'Please enter a valid customer name';
  end if;
  if v_phone !~ '^(\+?98|0)?9[0-9]{9}$' then
    raise exception using errcode = '22023', message = 'Please enter a valid mobile number';
  end if;
  if pg_catalog.char_length(v_district) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'Please enter a valid district';
  end if;
  if pg_catalog.char_length(v_address) not between 5 and 500 then
    raise exception using errcode = '22023', message = 'Please enter a valid delivery address';
  end if;
  if pg_catalog.char_length(v_notes) > 700 then
    raise exception using errcode = '22023', message = 'Order notes are too long';
  end if;
  if p_delivery_date is null
     or p_delivery_date < (pg_catalog.now() at time zone 'Asia/Tehran')::date
     or p_delivery_date > ((pg_catalog.now() at time zone 'Asia/Tehran')::date + 90) then
    raise exception using errcode = '22023', message = 'Please choose a valid delivery date';
  end if;
  if p_delivery_time not in ('10:00-13:00','13:00-16:00','16:00-19:00','19:00-21:00') then
    raise exception using errcode = '22023', message = 'Please choose a valid delivery time';
  end if;
  if p_items is null
     or pg_catalog.jsonb_typeof(p_items) <> 'array'
     or pg_catalog.jsonb_array_length(p_items) < 1
     or pg_catalog.jsonb_array_length(p_items) > 20 then
    raise exception using errcode = '22023', message = 'Invalid order items';
  end if;

  -- A basic duplicate-submit guard for accidental repeated clicks.
  if exists (
    select 1 from public.aida_orders
    where phone = v_phone and created_at > pg_catalog.now() - interval '60 seconds'
  ) then
    raise exception using errcode = '22023', message = 'Please wait before submitting another order';
  end if;

  for v_item in
    select value from pg_catalog.jsonb_array_elements(p_items) as item_rows(value)
  loop
    if pg_catalog.jsonb_typeof(v_item) <> 'object' then
      raise exception using errcode = '22023', message = 'Invalid product item';
    end if;

    begin
      v_product_id := (v_item ->> 'product_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;
    exception when others then
      raise exception using errcode = '22023', message = 'Invalid product item';
    end;

    if v_quantity < 1 or v_quantity > 20 then
      raise exception using errcode = '22023', message = 'Invalid product quantity';
    end if;

    select product.id, product.name, product.price_toman
      into v_product_id, v_product_name, v_product_price
    from public.aida_products as product
    where product.id = v_product_id
      and product.is_active = true
    for share;

    if not found then
      raise exception using errcode = '22023', message = 'A selected product is no longer available';
    end if;

    v_total := v_total + (v_product_price * v_quantity);
    v_snapshots := v_snapshots || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'product_id', v_product_id,
        'product_name', v_product_name,
        'quantity', v_quantity,
        'unit_price_toman', v_product_price
      )
    );
  end loop;

  v_order_code := 'AIDA-' || pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.aida_orders (
    order_code, customer_name, phone, district, address,
    delivery_date, delivery_time, notes, total_toman
  )
  values (
    v_order_code, v_name, v_phone, v_district, v_address,
    p_delivery_date, p_delivery_time, v_notes, v_total
  )
  returning id into v_order_id;

  for v_snapshot in
    select value from pg_catalog.jsonb_array_elements(v_snapshots) as snapshots(value)
  loop
    insert into public.aida_order_items (
      order_id, product_id, product_name_snapshot, quantity, unit_price_toman
    )
    values (
      v_order_id,
      (v_snapshot ->> 'product_id')::uuid,
      v_snapshot ->> 'product_name',
      (v_snapshot ->> 'quantity')::integer,
      (v_snapshot ->> 'unit_price_toman')::bigint
    );
  end loop;

  return pg_catalog.jsonb_build_object(
    'order_code', v_order_code,
    'total_toman', v_total
  );
end;
$$;

revoke all on function public.aida_submit_order(text,text,text,text,date,text,text,jsonb,text) from public, authenticated, anon;
grant execute on function public.aida_submit_order(text,text,text,text,date,text,text,jsonb,text) to anon, authenticated;

-- Product photos are public to view, but only signed-in Aida admins can upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aida-product-images', 'aida-product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view Aida product photos" on storage.objects;
create policy "Anyone can view Aida product photos"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'aida-product-images');

drop policy if exists "Aida admins upload product photos" on storage.objects;
create policy "Aida admins upload product photos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'aida-product-images' and (select private.is_aida_admin()));

drop policy if exists "Aida admins update product photos" on storage.objects;
create policy "Aida admins update product photos"
on storage.objects for update
to authenticated
using (bucket_id = 'aida-product-images' and (select private.is_aida_admin()))
with check (bucket_id = 'aida-product-images' and (select private.is_aida_admin()));

-- IMPORTANT: create the owner account in Supabase Authentication first.
-- Then replace the email below and run this statement to grant admin access:
-- insert into private.aida_admins (user_id)
-- select id from auth.users where lower(email) = lower('OWNER_EMAIL_HERE')
-- on conflict (user_id) do nothing;
