-- Kōru — Supabase Schema
-- Run this in Supabase SQL Editor

create table if not exists clients (
  id text primary key,
  name text not null,
  slug text,
  country text,
  industry text,
  logo_initial text,
  status text default 'active',
  contact_name text,
  contact_email text,
  has_new_activity boolean default false,
  created_at timestamptz default now()
);

create table if not exists projects (
  id text primary key,
  client_id text references clients(id) on delete cascade,
  name text not null,
  season text,
  status text default 'active',
  start_date date,
  target_completion date,
  portal_unlocked_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

create table if not exists factories (
  id text primary key,
  name text not null,
  city text,
  country text,
  categories text[],
  specialities text[],
  rating integer default 3,
  contact_name text,
  contact_email text,
  contact_phone text,
  min_order_value numeric,
  moq_units integer,
  sample_lead_time_days integer,
  lead_time_days integer,
  capacity_per_month integer,
  established_year integer,
  notes text,
  created_at timestamptz default now()
);

create table if not exists products (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  factory_id text references factories(id),
  name text not null,
  category text,
  stage text default 'brief',
  target_cost_usd numeric,
  quoted_cost_usd numeric,
  quoted_cost_currency text default 'USD',
  quoted_cost_local numeric,
  moq integer,
  order_qty integer,
  lead_time_days integer,
  colorways text[],
  notes text,
  created_at timestamptz default now()
);

create table if not exists milestones (
  id text primary key,
  product_id text references products(id) on delete cascade,
  title text not null,
  due_date date,
  completed_at timestamptz,
  notes text
);

create table if not exists samples (
  id text primary key,
  product_id text references products(id) on delete cascade,
  round integer default 1,
  status text default 'sent',
  courier text,
  tracking_number text,
  sent_date date,
  received_date date,
  feedback text,
  approved_at timestamptz
);

create table if not exists costs (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  product_id text references products(id),
  category text,
  description text,
  amount numeric,
  currency text default 'GBP',
  fx_rate numeric default 1,
  amount_gbp numeric,
  direction text default 'out',
  cost_type text default 'cogs',
  billable_to_client boolean default false,
  paid_by text,
  date_paid date,
  created_at timestamptz default now()
);

create table if not exists tasks (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  product_id text references products(id),
  title text not null,
  status text default 'todo',
  assigned_to text,
  assigned_initials text,
  due_date date,
  notes text,
  created_at timestamptz default now()
);

create table if not exists updates (
  id text primary key,
  product_id text references products(id) on delete cascade,
  author text,
  author_initials text,
  text text,
  visible_to_client boolean default false,
  created_at timestamptz default now()
);

create table if not exists contracts (
  id text primary key,
  client_id text references clients(id) on delete cascade,
  name text,
  status text default 'pending',
  date date,
  filename text,
  size_kb integer
);

create table if not exists portal_files (
  id text primary key,
  client_id text references clients(id) on delete cascade,
  project_id text references projects(id),
  filename text,
  size_kb integer,
  source text default 'agency',
  uploaded_at timestamptz default now()
);

create table if not exists leads (
  id text primary key default gen_random_uuid()::text,
  company_name text not null,
  contact_name text,
  contact_email text,
  country text,
  industry text,
  product_interest text,
  estimated_budget text,
  message text,
  status text default 'new',
  source text default 'brief_form',
  created_at timestamptz default now()
);

-- Enable Row Level Security (open for now — add policies when you add auth)
alter table clients enable row level security;
alter table projects enable row level security;
alter table factories enable row level security;
alter table products enable row level security;
alter table milestones enable row level security;
alter table samples enable row level security;
alter table costs enable row level security;
alter table tasks enable row level security;
alter table updates enable row level security;
alter table contracts enable row level security;
alter table portal_files enable row level security;
alter table leads enable row level security;

-- Permissive policies for now (lock down per-user when you add auth)
create policy "allow_all" on clients for all using (true) with check (true);
create policy "allow_all" on projects for all using (true) with check (true);
create policy "allow_all" on factories for all using (true) with check (true);
create policy "allow_all" on products for all using (true) with check (true);
create policy "allow_all" on milestones for all using (true) with check (true);
create policy "allow_all" on samples for all using (true) with check (true);
create policy "allow_all" on costs for all using (true) with check (true);
create policy "allow_all" on tasks for all using (true) with check (true);
create policy "allow_all" on updates for all using (true) with check (true);
create policy "allow_all" on contracts for all using (true) with check (true);
create policy "allow_all" on portal_files for all using (true) with check (true);
create policy "allow_all" on leads for all using (true) with check (true);
