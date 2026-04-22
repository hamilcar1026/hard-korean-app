'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import StudentDashboard from '@/components/StudentDashboard'
import { createClient } from '@/lib/supabase'
import type { MemoryScoreRow, QuizAttemptRow } from '@/types'

function isGrammarQuizMode(mode?: string | null) {
  return typeof mode === 'string' && mode.startsWith('grammar_')
}

function normalizeDashboardError(message?: string | null) {
  if (!message) return ''

  if (
    message.includes('user_progress') &&
    (message.includes('schema cache') || message.includes('does not exist') || message.includes('relation'))
  ) {
    return 'Study progress is not set up in the current Supabase project. Run supabase_schema.sql on the same Supabase project used by Vercel.'
  }

  if (
    message.includes('quiz_attempts') &&
    (message.includes('schema cache') || message.includes('does not exist') || message.includes('relation'))
  ) {
    return 'Quiz history is not set up in the current Supabase project. Run supabase_schema_v6.sql on the same Supabase project used by Vercel.'
  }

  if (
    message.includes('memory_scores') &&
    (message.includes('schema cache') || message.includes('does not exist') || message.includes('relation'))
  ) {
    return 'Memory scores are not set up in the current Supabase project. Run supabase_schema_v3.sql on the same Supabase project used by Vercel.'
  }

  if (
    message.includes('crossword_completions') &&
    (message.includes('schema cache') || message.includes('does not exist') || message.includes('relation'))
  ) {
    return 'Crossword completions are not set up in the current Supabase project. Run supabase_schema_v9.sql on the same Supabase project used by Vercel.'
  }

  return 'Could not load dashboard data from Supabase right now.'
}

interface StudentStat {
  user_id: string
  email: string
  known: number
  learning: number
  total: number
  completed_sessions_all: number
  completed_sessions_7d: number
  completed_sessions_30d: number
  completed_sessions_365d: number
  vocab_quiz_attempts_7d: number
  grammar_quiz_attempts_7d: number
  memory_sessions_7d: number
  crossword_completions_7d: number
  avg_vocab_quiz_score: number | null
  avg_grammar_quiz_score: number | null
  avg_memory_time_ms: number | null
  latest_activity_at: string | null
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null) return 'No data'

  const totalSeconds = Math.max(1, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatTimestamp(value: string | null) {
  if (!value) return 'No recent activity'

  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getWeekStartTime() {
  const start = new Date()
  const daysSinceMonday = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - daysSinceMonday)
  start.setHours(0, 0, 0, 0)
  return start.getTime()
}

function formatRangeDate(date: Date) {
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function getCurrentWeekRangeLabel() {
  const start = new Date()
  const daysSinceMonday = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - daysSinceMonday)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  return `${formatRangeDate(start)} - ${formatRangeDate(end)}`
}

export default function DashboardPage() {
  const { user, role, loading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<StudentStat[]>([])
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')
  const weekRangeLabel = getCurrentWeekRangeLabel()

  const loadStats = async () => {
    setFetching(true)
    setError('')
    const supabase = createClient()

    const [
      { data: progress, error: progressError },
      { data: memoryScores, error: memoryError },
      { data: quizAttempts, error: quizError },
      { data: crosswordCompletions, error: crosswordError },
      { data: profiles, error: profilesError },
    ] = await Promise.all([
      supabase.from('user_progress').select('user_id, status, reviewed_at'),
      supabase.from('memory_scores').select('user_id, duration_ms, completed_at').eq('is_public', true),
      supabase.from('quiz_attempts').select('user_id, correct_pct, created_at, quiz_mode'),
      supabase.from('crossword_completions').select('user_id, completed_at').eq('is_public', true),
      supabase.from('profiles').select('id, email'),
    ])

    const blockingError =
      progressError?.message ??
      (memoryError && !memoryError.message.includes('memory_scores') ? memoryError.message : null) ??
      (quizError && !quizError.message.includes('quiz_attempts') ? quizError.message : null) ??
      (crosswordError && !crosswordError.message.includes('crossword_completions') ? crosswordError.message : null) ??
      profilesError?.message ??
      null

    if (blockingError) {
      setError(normalizeDashboardError(blockingError))
      setFetching(false)
      return
    }

    const now = Date.now()
    const weekStart = getWeekStartTime()
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000
    const yearAgo = now - 365 * 24 * 60 * 60 * 1000

    const emailMap: Record<string, string> = {}
    for (const profile of profiles ?? []) {
      emailMap[profile.id] = profile.email
    }

    const progressAgg: Record<string, { known: number; learning: number }> = {}
    const completedAgg: Record<string, { all: number; week: number; month: number; year: number; latestAt: string | null }> = {}
    const quizAgg: Record<
      string,
      {
        vocabAttempts7d: number
        grammarAttempts7d: number
        vocabTotalPct: number
        grammarTotalPct: number
        vocabCount: number
        grammarCount: number
      }
    > = {}
    const memoryAgg: Record<string, { sessions7d: number; totalDuration: number; count: number }> = {}
    const crosswordAgg: Record<string, { completions7d: number }> = {}

    const bumpCompleted = (userId: string, timestamp: string) => {
      if (!completedAgg[userId]) {
        completedAgg[userId] = { all: 0, week: 0, month: 0, year: 0, latestAt: null }
      }

      const time = new Date(timestamp).getTime()
      completedAgg[userId].all += 1
      if (time >= weekStart) completedAgg[userId].week += 1
      if (time >= monthAgo) completedAgg[userId].month += 1
      if (time >= yearAgo) completedAgg[userId].year += 1

      const latestAt = completedAgg[userId].latestAt
      if (!latestAt || time > new Date(latestAt).getTime()) {
        completedAgg[userId].latestAt = timestamp
      }
    }

    for (const row of progress ?? []) {
      if (!progressAgg[row.user_id]) {
        progressAgg[row.user_id] = { known: 0, learning: 0 }
      }
      if (row.status === 'known') progressAgg[row.user_id].known += 1
      if (row.status === 'learning') progressAgg[row.user_id].learning += 1
    }

    for (const row of (memoryScores as Pick<MemoryScoreRow, 'user_id' | 'duration_ms' | 'completed_at'>[] | null) ?? []) {
      if (!memoryAgg[row.user_id]) {
        memoryAgg[row.user_id] = { sessions7d: 0, totalDuration: 0, count: 0 }
      }

      const current = memoryAgg[row.user_id]
      current.totalDuration += row.duration_ms
      current.count += 1
      if (new Date(row.completed_at).getTime() >= weekStart) {
        current.sessions7d += 1
      }

      bumpCompleted(row.user_id, row.completed_at)
    }

    for (const row of (quizAttempts as Pick<QuizAttemptRow, 'user_id' | 'correct_pct' | 'created_at' | 'quiz_mode'>[] | null) ?? []) {
      if (!quizAgg[row.user_id]) {
        quizAgg[row.user_id] = {
          vocabAttempts7d: 0,
          grammarAttempts7d: 0,
          vocabTotalPct: 0,
          grammarTotalPct: 0,
          vocabCount: 0,
          grammarCount: 0,
        }
      }

      const current = quizAgg[row.user_id]
      const isGrammar = isGrammarQuizMode(row.quiz_mode)
      if (isGrammar) {
        current.grammarTotalPct += row.correct_pct
        current.grammarCount += 1
      } else {
        current.vocabTotalPct += row.correct_pct
        current.vocabCount += 1
      }
      if (new Date(row.created_at).getTime() >= weekStart) {
        if (isGrammar) {
          current.grammarAttempts7d += 1
        } else {
          current.vocabAttempts7d += 1
        }
      }

      bumpCompleted(row.user_id, row.created_at)
    }

    for (const row of ((crosswordCompletions as Array<{ user_id: string; completed_at: string }> | null) ?? [])) {
      if (!crosswordAgg[row.user_id]) {
        crosswordAgg[row.user_id] = { completions7d: 0 }
      }

      if (new Date(row.completed_at).getTime() >= weekStart) {
        crosswordAgg[row.user_id].completions7d += 1
      }

      bumpCompleted(row.user_id, row.completed_at)
    }

    const studentIds = new Set([
      ...Object.keys(progressAgg),
      ...Object.keys(memoryAgg),
      ...Object.keys(quizAgg),
      ...Object.keys(crosswordAgg),
      ...Object.keys(completedAgg),
    ])

    const result: StudentStat[] = [...studentIds]
      .map((uid) => {
        const progressInfo = progressAgg[uid] ?? { known: 0, learning: 0 }
        const quizInfo = quizAgg[uid] ?? {
          vocabAttempts7d: 0,
          grammarAttempts7d: 0,
          vocabTotalPct: 0,
          grammarTotalPct: 0,
          vocabCount: 0,
          grammarCount: 0,
        }
        const memoryInfo = memoryAgg[uid] ?? { sessions7d: 0, totalDuration: 0, count: 0 }

        return {
          user_id: uid,
          email: emailMap[uid] ?? uid,
          known: progressInfo.known,
          learning: progressInfo.learning,
          total: progressInfo.known + progressInfo.learning,
          completed_sessions_all: completedAgg[uid]?.all ?? 0,
          completed_sessions_7d: completedAgg[uid]?.week ?? 0,
          completed_sessions_30d: completedAgg[uid]?.month ?? 0,
          completed_sessions_365d: completedAgg[uid]?.year ?? 0,
          vocab_quiz_attempts_7d: quizInfo.vocabAttempts7d,
          grammar_quiz_attempts_7d: quizInfo.grammarAttempts7d,
          memory_sessions_7d: memoryInfo.sessions7d,
          crossword_completions_7d: crosswordAgg[uid]?.completions7d ?? 0,
          avg_vocab_quiz_score:
            quizInfo.vocabCount > 0 ? Math.round(quizInfo.vocabTotalPct / quizInfo.vocabCount) : null,
          avg_grammar_quiz_score:
            quizInfo.grammarCount > 0
              ? Math.round(quizInfo.grammarTotalPct / quizInfo.grammarCount)
              : null,
          avg_memory_time_ms: memoryInfo.count > 0 ? Math.round(memoryInfo.totalDuration / memoryInfo.count) : null,
          latest_activity_at: completedAgg[uid]?.latestAt ?? null,
        }
      })
      .sort((a, b) => {
        if (b.completed_sessions_7d !== a.completed_sessions_7d) return b.completed_sessions_7d - a.completed_sessions_7d
        if (b.completed_sessions_all !== a.completed_sessions_all) return b.completed_sessions_all - a.completed_sessions_all
        return b.total - a.total
      })

    setStats(result)
    setFetching(false)
  }

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/auth')
      return
    }
    if (role === 'teacher') {
      queueMicrotask(() => {
        void loadStats()
      })
    }
  }, [loading, role, router, user])

  if (loading) {
    return <div className="text-center py-20 text-text-faint">Loading...</div>
  }

  if (!user || !role) return null

  if (role !== 'teacher') {
    return <StudentDashboard />
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text mb-1">Teacher Dashboard</h1>
        <p className="text-text-subtle text-sm">
          A compact view for large classes: averages, counts, and recent activity.
        </p>
        <p className="text-text-faint text-xs font-semibold uppercase tracking-wide mt-2">
          This week: {weekRangeLabel}
        </p>
      </div>

      {error ? (
        <p
          className="text-coral text-sm rounded-xl px-3 py-2 border mb-6"
          style={{ background: 'var(--t-error-box-bg)', borderColor: 'var(--t-error-box-border)' }}
        >
          {error}
        </p>
      ) : null}

      {fetching ? (
        <div className="text-center py-20 text-text-faint">Loading student progress...</div>
      ) : stats.length === 0 ? (
        <div className="text-center py-20 text-text-faint">No study records yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-subtle">
                <th className="pb-3 pr-6 font-semibold">Student Email</th>
                <th className="pb-3 pr-6 font-semibold">Tracked</th>
                <th className="pb-3 pr-6 font-semibold">Known</th>
                <th className="pb-3 pr-6 font-semibold">Learning</th>
                <th className="pb-3 pr-6 font-semibold">Completed All</th>
                <th className="pb-3 pr-6 font-semibold">Completed This Week</th>
                <th className="pb-3 pr-6 font-semibold">Completed 30d</th>
                <th className="pb-3 pr-6 font-semibold">Completed 365d</th>
                <th className="pb-3 pr-6 font-semibold">Vocab Quiz This Week</th>
                <th className="pb-3 pr-6 font-semibold">Grammar Quiz This Week</th>
                <th className="pb-3 pr-6 font-semibold">Memory This Week</th>
                <th className="pb-3 pr-6 font-semibold">Crossword This Week</th>
                <th className="pb-3 pr-6 font-semibold">Avg Vocab Quiz</th>
                <th className="pb-3 pr-6 font-semibold">Avg Grammar Quiz</th>
                <th className="pb-3 pr-6 font-semibold">Avg Memory Time</th>
                <th className="pb-3 font-semibold">Latest Activity</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((student) => (
                <tr key={student.user_id} className="border-b border-border hover:bg-card-surface transition-colors">
                  <td className="py-3 pr-6 text-text font-medium truncate max-w-[240px]">{student.email}</td>
                  <td className="py-3 pr-6 text-text">{student.total}</td>
                  <td className="py-3 pr-6 text-emerald-400 font-semibold">{student.known}</td>
                  <td className="py-3 pr-6 text-amber-400 font-semibold">{student.learning}</td>
                  <td className="py-3 pr-6 text-text font-semibold">{student.completed_sessions_all}</td>
                  <td className="py-3 pr-6 text-text">{student.completed_sessions_7d}</td>
                  <td className="py-3 pr-6 text-text">{student.completed_sessions_30d}</td>
                  <td className="py-3 pr-6 text-text">{student.completed_sessions_365d}</td>
                  <td className="py-3 pr-6 text-text">{student.vocab_quiz_attempts_7d}</td>
                  <td className="py-3 pr-6 text-text">{student.grammar_quiz_attempts_7d}</td>
                  <td className="py-3 pr-6 text-text">{student.memory_sessions_7d}</td>
                  <td className="py-3 pr-6 text-text">{student.crossword_completions_7d}</td>
                  <td className="py-3 pr-6 text-text">
                    {student.avg_vocab_quiz_score === null ? 'No data' : `${student.avg_vocab_quiz_score}%`}
                  </td>
                  <td className="py-3 pr-6 text-text">
                    {student.avg_grammar_quiz_score === null ? 'No data' : `${student.avg_grammar_quiz_score}%`}
                  </td>
                  <td className="py-3 pr-6 text-text">
                    {formatDuration(student.avg_memory_time_ms)}
                  </td>
                  <td className="py-3 text-text-subtle">{formatTimestamp(student.latest_activity_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 text-xs text-text-faint space-y-1">
            <p>`Tracked / Known / Learning` comes only from saved vocabulary and grammar progress.</p>
            <p>`Avg Vocab Quiz` and `Avg Grammar Quiz` are based on saved quiz results for each type.</p>
            <p>`Avg Memory Time` is the average saved memory completion time.</p>
            <p>`Completed` uses the same definition as the home ranking: public memory sessions, public crossword clears, and saved quiz attempts.</p>
          </div>
        </div>
      )}
    </div>
  )
}
