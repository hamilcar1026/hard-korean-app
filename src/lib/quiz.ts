import { createClient } from './supabase'
import type { QuizAttemptRow } from '@/types'

function normalizeQuizError(message?: string | null) {
  if (!message) return null

  if (
    message.includes('quiz_attempts') &&
    (message.includes('does not exist') || message.includes('relation'))
  ) {
    return 'Quiz result storage is not set up yet. Run supabase_schema_v6.sql in Supabase first.'
  }

  return message
}

export async function saveQuizAttempt(input: {
  userId: string
  level: number | null
  quizMode: string
  score: number
  totalQuestions: number
}) {
  const supabase = createClient()
  const correctPct =
    input.totalQuestions === 0 ? 0 : Math.round((input.score / input.totalQuestions) * 100)

  const { error } = await supabase.from('quiz_attempts').insert({
    user_id: input.userId,
    level: input.level,
    quiz_mode: input.quizMode,
    score: input.score,
    total_questions: input.totalQuestions,
    correct_pct: correctPct,
    created_at: new Date().toISOString(),
  })

  return { error: normalizeQuizError(error?.message) }
}

export async function getUserRecentQuizAttempts(
  userId: string,
  limit = 5
): Promise<{ data: QuizAttemptRow[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('id, user_id, level, quiz_mode, score, total_questions, correct_pct, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return {
    data: (data as QuizAttemptRow[] | null) ?? [],
    error: normalizeQuizError(error?.message),
  }
}
