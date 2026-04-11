-- Hard Korean – Schema v2: Profiles + Teacher RLS
-- Run this AFTER supabase_schema.sql in the Supabase SQL editor

-- ─── Profiles ────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  role         text not null default 'student' check (role in ('student', 'teacher')),
  display_name text,
  created_at   timestamptz default now()
);

alter table profiles enable row level security;

-- Users can read/update their own profile
create policy "users manage own profile"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Teachers can read all profiles
create policy "teachers read all profiles"
  on profiles for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'teacher'
    )
  );

-- Teachers can also read all user_progress
create policy "teachers read all progress"
  on user_progress for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'teacher'
    )
  );

-- ─── Auto-create profile on signup ───────────────────────────────────────────
-- Teacher email is fixed; matches NEXT_PUBLIC_TEACHER_EMAIL in .env.local
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  assigned_role text := 'student';
begin
  if new.email = 'hamilcar1026@gmail.com' then
    assigned_role := 'teacher';
  end if;

  insert into public.profiles (id, email, role)
  values (new.id, new.email, assigned_role)
  on conflict (id) do update set role = excluded.role;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
