-- Aida Cockings order intake. Run once in Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  customer_name text not null check (char_length(customer_name) between 2 and 90),
  phone text not null check (char_length(phone) between 10 and 16),
  district text not null check (char_length(district) between 2 and 80),
  address text not null check (char_length(address) between 5 and 500),
  delivery_date date not null,
  delivery_time text not null,
  notes text not null default '',
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 30),
  total_toman bigint not null check (total_toman > 0),
  status text not null default 'new' check (status in ('new','confirmed','preparing','delivered','cancelled')),
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;
revoke all on table public.orders from anon, authenticated;
grant insert on table public.orders to anon, authenticated;

drop policy if exists "Visitors can submit orders" on public.orders;
create policy "Visitors can submit orders"
on public.orders for insert to anon, authenticated
with check (
  char_length(customer_name) between 2 and 90
  and char_length(phone) between 10 and 16
  and char_length(address) between 5 and 500
  and jsonb_typeof(items) = 'array'
  and jsonb_array_length(items) between 1 and 30
  and total_toman > 0
);

-- There is intentionally no public SELECT/UPDATE/DELETE policy.
-- Manage orders privately in Supabase Dashboard > Table Editor > orders.
