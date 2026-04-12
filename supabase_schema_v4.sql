-- Hard Korean Schema v4: Fix recursive teacher RLS policies
-- Run this if profiles or leaderboard queries show
-- "infinite recursion detected in policy for relation \"profiles\""

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

drop policy if exists "teachers read all profiles" on profiles;
create policy "teachers read all profiles"
  on profiles for select
  using (public.is_teacher());

drop policy if exists "teachers read all progress" on user_progress;
create policy "teachers read all progress"
  on user_progress for select
  using (public.is_teacher());

drop policy if exists "teachers read all memory scores" on memory_scores;
create policy "teachers read all memory scores"
  on memory_scores for select
  using (public.is_teacher());

alter table memory_scores
  drop constraint if exists memory_scores_pair_count_check;

alter table memory_scores
  add constraint memory_scores_pair_count_check
  check (pair_count in (3, 4, 6, 8));
