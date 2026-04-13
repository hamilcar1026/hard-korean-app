-- Hard Korean Schema v7: ensure progress + quiz tables exist
-- Run this in the Supabase SQL editor for the SAME project used by Vercel

create or replace function public.is_teacher()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'teacher'
  );
$$;

create table if not exists user_progress (
  id           serial primary key,
  user_id      uuid references auth.users on delete cascade,
  item_type    text not null check (item_type in ('vocab', 'grammar')),
  item_id      integer not null,
  status       text not null check (status in ('learning', 'known')) default 'learning',
  reviewed_at  timestamptz default now(),
  unique (user_id, item_type, item_id)
);

alter table user_progress enable row level security;

drop policy if exists "users manage own progress" on user_progress;
create policy "users manage own progress"
  on user_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "teachers read all progress" on user_progress;
create policy "teachers read all progress"
  on user_progress for select
  using (public.is_teacher());

create table if not exists quiz_attempts (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  level           smallint check (level between 1 and 6),
  quiz_mode       text not null,
  score           integer not null check (score >= 0),
  total_questions integer not null check (total_questions > 0),
  correct_pct     integer not null check (correct_pct between 0 and 100),
  created_at      timestamptz not null default now()
);

create index if not exists quiz_attempts_user_idx
  on quiz_attempts (user_id, created_at desc);

alter table quiz_attempts enable row level security;

drop policy if exists "users manage own quiz attempts" on quiz_attempts;
create policy "users manage own quiz attempts"
  on quiz_attempts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "teachers read all quiz attempts" on quiz_attempts;
create policy "teachers read all quiz attempts"
  on quiz_attempts for select
  using (public.is_teacher());
