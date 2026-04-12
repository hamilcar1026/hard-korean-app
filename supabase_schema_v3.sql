-- Hard Korean Schema v3: Memory game scores + public leaderboard
-- Run this AFTER supabase_schema.sql and supabase_schema_v2.sql in the Supabase SQL editor

create table if not exists memory_scores (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  level        smallint not null check (level between 1 and 6),
  pair_count   smallint not null check (pair_count in (3, 4, 6, 8)),
  game_mode    text not null check (game_mode in ('all', 'review')),
  moves        integer not null check (moves > 0),
  duration_ms  integer not null check (duration_ms >= 0),
  is_public    boolean not null default false,
  completed_at timestamptz not null default now()
);

create index if not exists memory_scores_public_board_idx
  on memory_scores (is_public, level, pair_count, game_mode, moves, duration_ms, completed_at);

create index if not exists memory_scores_user_idx
  on memory_scores (user_id, completed_at desc);

alter table memory_scores enable row level security;

create policy "public read memory leaderboard"
  on memory_scores for select
  using (is_public = true);

create policy "users manage own memory scores"
  on memory_scores for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "teachers read all memory scores"
  on memory_scores for select
  using (public.is_teacher());
