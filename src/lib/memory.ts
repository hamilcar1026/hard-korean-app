import { createClient } from './supabase'
import type { MemoryGameMode, MemoryScoreRow } from '@/types'

export type PublicMemoryWorkerRow = {
  user_id: string
  display_name: string
  total_runs: number
  week_runs: number
  best_moves: number | null
  best_duration_ms: number | null
}

type ScoreFilters = {
  level: number
  pairCount: number
  gameMode: MemoryGameMode
}

type SaveMemoryScoreInput = ScoreFilters & {
  userId: string
  moves: number
  durationMs: number
  isPublic: boolean
  fallbackName?: string
}

function normalizeMemoryError(message?: string | null) {
  if (!message) return null

  if (
    message.includes('memory_scores') &&
    (message.includes('does not exist') || message.includes('relation'))
  ) {
    return 'Memory score storage is not set up yet. Run supabase_schema_v3.sql in Supabase first.'
  }

  if (message.includes('infinite recursion detected in policy for relation "profiles"')) {
    return 'Supabase policy recursion is blocking leaderboard reads. Run supabase_schema_v4.sql in Supabase to fix the profiles policy.'
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

export async function saveMemoryScore(input: SaveMemoryScoreInput) {
  const supabase = createClient()
  const displayName = await getDisplayName(input.userId, input.fallbackName)

  const { error } = await supabase.from('memory_scores').insert({
    user_id: input.userId,
    display_name: displayName,
    level: input.level,
    pair_count: input.pairCount,
    game_mode: input.gameMode,
    moves: input.moves,
    duration_ms: input.durationMs,
    is_public: input.isPublic,
    completed_at: new Date().toISOString(),
  })

  return { error: normalizeMemoryError(error?.message) }
}

export async function getMemoryLeaderboard(filters: ScoreFilters, limit = 10): Promise<{
  data: MemoryScoreRow[]
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('memory_scores')
    .select('id, user_id, display_name, level, pair_count, game_mode, moves, duration_ms, is_public, completed_at')
    .eq('is_public', true)
    .eq('level', filters.level)
    .eq('pair_count', filters.pairCount)
    .eq('game_mode', filters.gameMode)
    .order('moves', { ascending: true })
    .order('duration_ms', { ascending: true })
    .order('completed_at', { ascending: true })
    .limit(limit)

  return {
    data: (data as MemoryScoreRow[] | null) ?? [],
    error: normalizeMemoryError(error?.message),
  }
}

export async function getUserMemoryBest(
  userId: string,
  filters: ScoreFilters
): Promise<{ data: MemoryScoreRow | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('memory_scores')
    .select('id, user_id, display_name, level, pair_count, game_mode, moves, duration_ms, is_public, completed_at')
    .eq('user_id', userId)
    .eq('level', filters.level)
    .eq('pair_count', filters.pairCount)
    .eq('game_mode', filters.gameMode)
    .order('moves', { ascending: true })
    .order('duration_ms', { ascending: true })
    .order('completed_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return {
    data: (data as MemoryScoreRow | null) ?? null,
    error: normalizeMemoryError(error?.message),
  }
}

export async function getUserRecentMemoryScores(
  userId: string,
  limit = 5
): Promise<{ data: MemoryScoreRow[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('memory_scores')
    .select('id, user_id, display_name, level, pair_count, game_mode, moves, duration_ms, is_public, completed_at')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(limit)

  return {
    data: (data as MemoryScoreRow[] | null) ?? [],
    error: normalizeMemoryError(error?.message),
  }
}

export async function getWeeklyMemoryLeaders(limit = 5): Promise<{
  data: MemoryScoreRow[]
  error: string | null
}> {
  return getPublicMemoryLeaders({ period: 'week' }, limit)
}

export async function getPublicMemoryLeaders(
  filters: {
    period?: 'week' | 'all'
    pairCount?: number | 'all'
    gameMode?: MemoryGameMode | 'all'
  },
  limit = 5
): Promise<{
  data: MemoryScoreRow[]
  error: string | null
}> {
  const supabase = createClient()
  let query = supabase
    .from('memory_scores')
    .select('id, user_id, display_name, level, pair_count, game_mode, moves, duration_ms, is_public, completed_at')
    .eq('is_public', true)
    .order('moves', { ascending: true })
    .order('duration_ms', { ascending: true })
    .order('completed_at', { ascending: true })
    .limit(limit)

  if (filters.period === 'week') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('completed_at', weekAgo)
  }

  if (filters.pairCount && filters.pairCount !== 'all') {
    query = query.eq('pair_count', filters.pairCount)
  }

  if (filters.gameMode && filters.gameMode !== 'all') {
    query = query.eq('game_mode', filters.gameMode)
  }

  const { data, error } = await query

  return {
    data: (data as MemoryScoreRow[] | null) ?? [],
    error: normalizeMemoryError(error?.message),
  }
}

export async function getPublicMemoryWorkers(
  period: 'week' | 'all',
  limit = 5
): Promise<{
  data: PublicMemoryWorkerRow[]
  error: string | null
}> {
  const supabase = createClient()
  let query = supabase
    .from('memory_scores')
    .select('user_id, display_name, moves, duration_ms, completed_at')
    .eq('is_public', true)

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  if (period === 'week') {
    query = query.gte('completed_at', weekAgo)
  }

  const { data, error } = await query

  if (error) {
    return { data: [], error: normalizeMemoryError(error.message) }
  }

  const rows = (data as Array<{
    user_id: string
    display_name: string
    moves: number
    duration_ms: number
    completed_at: string
  }> | null) ?? []

  const workers = new Map<string, PublicMemoryWorkerRow>()

  rows.forEach((row) => {
    const current = workers.get(row.user_id) ?? {
      user_id: row.user_id,
      display_name: row.display_name,
      total_runs: 0,
      week_runs: 0,
      best_moves: null,
      best_duration_ms: null,
    }

    current.total_runs += 1
    if (new Date(row.completed_at).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000) {
      current.week_runs += 1
    }

    const isBetter =
      current.best_moves === null ||
      row.moves < current.best_moves ||
      (row.moves === current.best_moves &&
        (current.best_duration_ms === null || row.duration_ms < current.best_duration_ms))

    if (isBetter) {
      current.best_moves = row.moves
      current.best_duration_ms = row.duration_ms
    }

    workers.set(row.user_id, current)
  })

  const sorted = [...workers.values()]
    .sort((a, b) => {
      const aRuns = period === 'week' ? a.week_runs : a.total_runs
      const bRuns = period === 'week' ? b.week_runs : b.total_runs
      if (bRuns !== aRuns) return bRuns - aRuns
      if ((a.best_moves ?? Infinity) !== (b.best_moves ?? Infinity)) {
        return (a.best_moves ?? Infinity) - (b.best_moves ?? Infinity)
      }
      return (a.best_duration_ms ?? Infinity) - (b.best_duration_ms ?? Infinity)
    })
    .slice(0, limit)

  return { data: sorted, error: null }
}
