-- Hard Korean Schema v8: favorites
-- Run this in the Supabase SQL editor for the SAME project used by Vercel

create table if not exists favorite_items (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  item_type  text not null check (item_type in ('vocab', 'grammar')),
  item_id    integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

create index if not exists favorite_items_user_idx
  on favorite_items (user_id, created_at desc);

alter table favorite_items enable row level security;

drop policy if exists "users manage own favorites" on favorite_items;
create policy "users manage own favorites"
  on favorite_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "teachers read all favorites" on favorite_items;
create policy "teachers read all favorites"
  on favorite_items for select
  using (public.is_teacher());
