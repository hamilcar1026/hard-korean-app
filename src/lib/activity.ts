import { createClient } from './supabase'

export type HardWorkerRow = {
  user_id: string
  display_name: string
  memory_completed: number
  crossword_completed: number
  quiz_completed: number
  total_completed: number
  best_memory_moves: number | null
}

function normalizeActivityError(message?: string | null) {
  if (!message) return null

  if (message.includes('get_hard_worker_leaders')) {
    return 'Hard worker ranking sync is not set up yet. Run supabase_schema_v10.sql on the same Supabase project used by Vercel.'
  }

  if (
    message.includes('crossword_completions') &&
    (message.includes('does not exist') || message.includes('relation') || message.includes('schema cache'))
  ) {
    return 'Crossword completion storage is not set up yet. Run supabase_schema_v9.sql on the same Supabase project used by Vercel.'
  }

  return message
}

async function getDisplayName(userId: string, fallbackName?: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('id', userId)
    .single()

  const profileName = typeof data?.display_name === 'string' ? data.display_name.trim() : ''
  if (profileName) return profileName

  const emailName =
    typeof data?.email === 'string' && data.email.includes('@')
      ? data.email.split('@')[0]
      : ''
  if (emailName) return emailName

  if (fallbackName?.trim()) return fallbackName.trim()
  return 'Learner'
}

function getWeekStartIso() {
  const start = new Date()
  const daysSinceMonday = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - daysSinceMonday)
  start.setHours(0, 0, 0, 0)
  return start.toISOString()
}

export async function saveCrosswordCompletion(input: {
  userId: string
  level: number
  puzzleKey: string
  includeInPublicStats: boolean
  fallbackName?: string
}) {
  const supabase = createClient()
  const displayName = await getDisplayName(input.userId, input.fallbackName)

  const { error } = await supabase.from('crossword_completions').insert({
    user_id: input.userId,
    display_name: displayName,
    level: input.level,
    puzzle_key: input.puzzleKey,
    is_public: input.includeInPublicStats,
    completed_at: new Date().toISOString(),
  })

  return { error: normalizeActivityError(error?.message) }
}

export async function getHardWorkerLeaders(
  period: 'week' | 'all',
  limit = 5
): Promise<{ data: HardWorkerRow[]; error: string | null }> {
  const supabase = createClient()

  const { data: rpcData, error: rpcError } = await supabase.rpc('get_hard_worker_leaders', {
    period_name: period,
    result_limit: limit,
  })

  if (!rpcError && rpcData) {
    return {
      data: ((rpcData as HardWorkerRow[] | null) ?? []).map((row) => ({
        user_id: row.user_id,
        display_name: row.display_name,
        memory_completed: Number(row.memory_completed ?? 0),
        crossword_completed: Number(row.crossword_completed ?? 0),
        quiz_completed: Number(row.quiz_completed ?? 0),
        total_completed: Number(row.total_completed ?? 0),
        best_memory_moves:
          row.best_memory_moves === null || row.best_memory_moves === undefined
            ? null
            : Number(row.best_memory_moves),
      })),
      error: null,
    }
  }

  const since =
    period === 'week'
      ? getWeekStartIso()
      : null

  let memoryQuery = supabase
    .from('memory_scores')
    .select('user_id, display_name, moves, completed_at')
    .eq('is_public', true)

  let crosswordQuery = supabase
    .from('crossword_completions')
    .select('user_id, display_name, completed_at')
    .eq('is_public', true)

  let quizQuery = supabase
    .from('quiz_attempts')
    .select('user_id, created_at')

  if (since) {
    memoryQuery = memoryQuery.gte('completed_at', since)
    crosswordQuery = crosswordQuery.gte('completed_at', since)
    quizQuery = quizQuery.gte('created_at', since)
  }

  const [
    { data: memoryRows, error: memoryError },
    { data: crosswordRows, error: crosswordError },
    { data: quizRows, error: quizError },
  ] = await Promise.all([memoryQuery, crosswordQuery, quizQuery])

  const normalizedError =
    (rpcError &&
    !rpcError.message.includes('Could not find the function public.get_hard_worker_leaders') &&
    !rpcError.message.includes('get_hard_worker_leaders')
      ? normalizeActivityError(rpcError.message)
      : null) ??
    normalizeActivityError(memoryError?.message) ??
    normalizeActivityError(crosswordError?.message) ??
    normalizeActivityError(quizError?.message)

  if (normalizedError) {
    return { data: [], error: normalizedError }
  }

  const leaders = new Map<string, HardWorkerRow>()

  ;((memoryRows as Array<{
    user_id: string
    display_name: string
    moves: number
  }> | null) ?? []).forEach((row) => {
    const current = leaders.get(row.user_id) ?? {
      user_id: row.user_id,
      display_name: row.display_name,
      memory_completed: 0,
      crossword_completed: 0,
      quiz_completed: 0,
      total_completed: 0,
      best_memory_moves: null,
    }

    current.memory_completed += 1
    current.total_completed += 1
    if (current.best_memory_moves === null || row.moves < current.best_memory_moves) {
      current.best_memory_moves = row.moves
    }
    leaders.set(row.user_id, current)
  })

  ;((crosswordRows as Array<{
    user_id: string
    display_name: string
  }> | null) ?? []).forEach((row) => {
    const current = leaders.get(row.user_id) ?? {
      user_id: row.user_id,
      display_name: row.display_name,
      memory_completed: 0,
      crossword_completed: 0,
      quiz_completed: 0,
      total_completed: 0,
      best_memory_moves: null,
    }

    current.crossword_completed += 1
    current.total_completed += 1
    leaders.set(row.user_id, current)
  })

  ;((quizRows as Array<{
    user_id: string
  }> | null) ?? []).forEach((row) => {
    const current = leaders.get(row.user_id) ?? {
      user_id: row.user_id,
      display_name: 'Learner',
      memory_completed: 0,
      crossword_completed: 0,
      quiz_completed: 0,
      total_completed: 0,
      best_memory_moves: null,
    }

    current.quiz_completed += 1
    current.total_completed += 1
    leaders.set(row.user_id, current)
  })

  const data = [...leaders.values()]
    .sort((a, b) => {
      if (b.total_completed !== a.total_completed) return b.total_completed - a.total_completed
      if (b.crossword_completed !== a.crossword_completed) return b.crossword_completed - a.crossword_completed
      return (a.best_memory_moves ?? Infinity) - (b.best_memory_moves ?? Infinity)
    })
    .slice(0, limit)

  return { data, error: null }
}
