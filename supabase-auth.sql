-- ─────────────────────────────────────────────────────────────
-- Kōru — Auth schema
-- Run this ONCE in Supabase SQL Editor after setting up the main schema
-- ─────────────────────────────────────────────────────────────

-- 1. Profiles table — one row per agency user (admin or team member)
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text not null,
  full_name   text,
  role        text not null default 'agency_member'
                check (role in ('agency_admin', 'agency_member')),
  created_at  timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Admins can read all profiles (needed for team management later)
create policy "profiles_admin_read_all"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'agency_admin'
    )
  );


-- 2. Auto-create a profile row whenever a new auth user is created
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'agency_member')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ─────────────────────────────────────────────────────────────
-- HOW TO CREATE YOUR FIRST ADMIN USER
-- 1. Go to Supabase Dashboard → Authentication → Users → Add user
-- 2. Enter your email + a strong password, click Create User
-- 3. Then run this to promote them to agency_admin
--    (replace the email below with yours):
--
-- update public.profiles set role = 'agency_admin'
-- where email = 'you@youragency.com';
-- ─────────────────────────────────────────────────────────────
