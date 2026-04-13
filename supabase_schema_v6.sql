-- Hard Korean Schema v6: Quiz result storage
-- Run this AFTER supabase_schema.sql and supabase_schema_v2.sql

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

create policy "users manage own quiz attempts"
  on quiz_attempts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "teachers read all quiz attempts"
  on quiz_attempts for select
  using (public.is_teacher());
