create or replace function public.get_hard_worker_leaders(
  period_name text default 'week',
  result_limit integer default 5
)
returns table (
  user_id uuid,
  display_name text,
  memory_completed bigint,
  crossword_completed bigint,
  quiz_completed bigint,
  total_completed bigint,
  best_memory_moves integer
)
language sql
security definer
set search_path = public
as $$
  with cutoff as (
    select case
      when period_name = 'week' then now() - interval '7 days'
      else null
    end as since_at
  ),
  memory_rows as (
    select
      ms.user_id,
      max(ms.display_name) as display_name,
      count(*)::bigint as memory_completed,
      min(ms.moves)::integer as best_memory_moves
    from memory_scores ms
    cross join cutoff c
    where ms.is_public = true
      and (c.since_at is null or ms.completed_at >= c.since_at)
    group by ms.user_id
  ),
  crossword_rows as (
    select
      cc.user_id,
      max(cc.display_name) as display_name,
      count(*)::bigint as crossword_completed
    from crossword_completions cc
    cross join cutoff c
    where cc.is_public = true
      and (c.since_at is null or cc.completed_at >= c.since_at)
    group by cc.user_id
  ),
  quiz_rows as (
    select
      qa.user_id,
      count(*)::bigint as quiz_completed
    from quiz_attempts qa
    cross join cutoff c
    where c.since_at is null or qa.created_at >= c.since_at
    group by qa.user_id
  ),
  combined as (
    select
      coalesce(m.user_id, cw.user_id, q.user_id) as user_id,
      coalesce(m.display_name, cw.display_name, split_part(p.email, '@', 1), 'Learner') as display_name,
      coalesce(m.memory_completed, 0::bigint) as memory_completed,
      coalesce(cw.crossword_completed, 0::bigint) as crossword_completed,
      coalesce(q.quiz_completed, 0::bigint) as quiz_completed,
      coalesce(m.best_memory_moves, null) as best_memory_moves
    from memory_rows m
    full outer join crossword_rows cw on cw.user_id = m.user_id
    full outer join quiz_rows q on q.user_id = coalesce(m.user_id, cw.user_id)
    left join profiles p on p.id = coalesce(m.user_id, cw.user_id, q.user_id)
  )
  select
    c.user_id,
    c.display_name,
    c.memory_completed,
    c.crossword_completed,
    c.quiz_completed,
    (c.memory_completed + c.crossword_completed + c.quiz_completed)::bigint as total_completed,
    c.best_memory_moves
  from combined c
  where c.user_id is not null
  order by
    (c.memory_completed + c.crossword_completed + c.quiz_completed) desc,
    c.crossword_completed desc,
    c.best_memory_moves asc nulls last
  limit greatest(result_limit, 1);
$$;

grant execute on function public.get_hard_worker_leaders(text, integer) to anon, authenticated;
