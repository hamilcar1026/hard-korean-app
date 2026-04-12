-- Hard Korean Schema v5: Safe RLS repair for partially initialized projects
-- Run this if v4 fails because some tables do not exist yet.
-- This script only updates tables that already exist.

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

do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'drop policy if exists "teachers read all profiles" on public.profiles';
    execute '
      create policy "teachers read all profiles"
      on public.profiles for select
      using (public.is_teacher())
    ';
  end if;

  if to_regclass('public.user_progress') is not null then
    execute 'drop policy if exists "teachers read all progress" on public.user_progress';
    execute '
      create policy "teachers read all progress"
      on public.user_progress for select
      using (public.is_teacher())
    ';
  end if;

  if to_regclass('public.memory_scores') is not null then
    execute 'drop policy if exists "teachers read all memory scores" on public.memory_scores';
    execute '
      create policy "teachers read all memory scores"
      on public.memory_scores for select
      using (public.is_teacher())
    ';

    execute 'alter table public.memory_scores drop constraint if exists memory_scores_pair_count_check';
    execute '
      alter table public.memory_scores
      add constraint memory_scores_pair_count_check
      check (pair_count in (3, 4, 6, 8))
    ';
  end if;
end
$$;
