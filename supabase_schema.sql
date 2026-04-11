-- Hard Korean – Supabase Schema
-- Run this in the Supabase SQL editor

-- ─── Vocabulary ──────────────────────────────────────────────────────────────
create table if not exists vocabulary (
  id            serial primary key,
  level         smallint not null check (level between 1 and 6),
  word          text     not null,
  pos           text     not null,
  romanization  text     not null,
  meaning       text     not null,
  example_kr    text     not null default '',
  example_en    text     not null default '',
  created_at    timestamptz default now()
);

create index if not exists vocab_level_idx on vocabulary (level);
create index if not exists vocab_word_idx  on vocabulary using gin (to_tsvector('simple', word));

-- ─── Grammar ─────────────────────────────────────────────────────────────────
create table if not exists grammar (
  id         serial primary key,
  level      smallint not null check (level between 1 and 6),
  category   text     not null,
  form       text     not null,
  related    text     not null default '',
  meaning    text     not null default '',
  examples   text[]   not null default '{}',
  created_at timestamptz default now()
);

create index if not exists grammar_level_idx on grammar (level);

-- ─── User progress (optional, requires auth) ─────────────────────────────────
create table if not exists user_progress (
  id           serial primary key,
  user_id      uuid    references auth.users on delete cascade,
  item_type    text    not null check (item_type in ('vocab', 'grammar')),
  item_id      integer not null,
  status       text    not null check (status in ('new', 'learning', 'known')) default 'new',
  reviewed_at  timestamptz default now(),
  unique (user_id, item_type, item_id)
);

-- RLS
alter table vocabulary    enable row level security;
alter table grammar       enable row level security;
alter table user_progress enable row level security;

-- Public read access to vocab & grammar
create policy "public read vocabulary"
  on vocabulary for select using (true);

create policy "public read grammar"
  on grammar for select using (true);

-- Users can manage their own progress
create policy "users manage own progress"
  on user_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
