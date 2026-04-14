'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import StudentDashboard from '@/components/StudentDashboard'
import { createClient } from '@/lib/supabase'
import type { MemoryScoreRow, QuizAttemptRow } from '@/types'

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
  quiz_best_pct: number | null
  quiz_recent_attempts: number
  memory_best_moves: number | null
  memory_best_time_ms: number | null
  memory_recent_runs: number
  crossword_recent_completions: number
  weekly_activity: number
  monthly_activity: number
  yearly_activity: number
  latest_activity_at: string | null
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null) return 'No record'

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

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card-surface px-3 py-2 min-w-[88px]">
      <p className="text-[10px] uppercase tracking-wide text-text-faint mb-1">{label}</p>
      <p className="font-bold text-text text-sm">{value}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { user, role, loading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<StudentStat[]>([])
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

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
      supabase.from('memory_scores').select('user_id, moves, duration_ms, completed_at'),
      supabase.from('quiz_attempts').select('user_id, correct_pct, created_at'),
      supabase.from('crossword_completions').select('user_id, completed_at'),
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
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000
    const yearAgo = now - 365 * 24 * 60 * 60 * 1000

    const emailMap: Record<string, string> = {}
    for (const profile of profiles ?? []) {
      emailMap[profile.id] = profile.email
    }

    const progressAgg: Record<string, { known: number; learning: number }> = {}
    const activityAgg: Record<string, { week: number; month: number; year: number; latestAt: string | null }> = {}
    const quizAgg: Record<string, { bestPct: number | null; recentAttempts: number }> = {}
    const memoryAgg: Record<string, { bestMoves: number | null; bestTimeMs: number | null; recentRuns: number }> = {}
    const crosswordAgg: Record<string, { recentCompletions: number }> = {}

    const bumpActivity = (userId: string, timestamp: string) => {
      if (!activityAgg[userId]) {
        activityAgg[userId] = { week: 0, month: 0, year: 0, latestAt: null }
      }

      const time = new Date(timestamp).getTime()
      if (time >= weekAgo) activityAgg[userId].week += 1
      if (time >= monthAgo) activityAgg[userId].month += 1
      if (time >= yearAgo) activityAgg[userId].year += 1

      const currentLatest = activityAgg[userId].latestAt
      if (!currentLatest || time > new Date(currentLatest).getTime()) {
        activityAgg[userId].latestAt = timestamp
      }
    }

    for (const row of progress ?? []) {
      if (!progressAgg[row.user_id]) {
        progressAgg[row.user_id] = { known: 0, learning: 0 }
      }
      if (row.status === 'known') progressAgg[row.user_id].known += 1
      if (row.status === 'learning') progressAgg[row.user_id].learning += 1
      bumpActivity(row.user_id, row.reviewed_at)
    }

    for (const row of (memoryScores as Pick<MemoryScoreRow, 'user_id' | 'moves' | 'duration_ms' | 'completed_at'>[] | null) ?? []) {
      if (!memoryAgg[row.user_id]) {
        memoryAgg[row.user_id] = { bestMoves: null, bestTimeMs: null, recentRuns: 0 }
      }

      const current = memoryAgg[row.user_id]
      const isBetter =
        current.bestMoves === null ||
        row.moves < current.bestMoves ||
        (row.moves === current.bestMoves &&
          (current.bestTimeMs === null || row.duration_ms < current.bestTimeMs))

      if (isBetter) {
        current.bestMoves = row.moves
        current.bestTimeMs = row.duration_ms
      }

      if (new Date(row.completed_at).getTime() >= weekAgo) {
        current.recentRuns += 1
      }

      bumpActivity(row.user_id, row.completed_at)
    }

    for (const row of (quizAttempts as Pick<QuizAttemptRow, 'user_id' | 'correct_pct' | 'created_at'>[] | null) ?? []) {
      if (!quizAgg[row.user_id]) {
        quizAgg[row.user_id] = { bestPct: null, recentAttempts: 0 }
      }

      const current = quizAgg[row.user_id]
      if (current.bestPct === null || row.correct_pct > current.bestPct) {
        current.bestPct = row.correct_pct
      }
      if (new Date(row.created_at).getTime() >= weekAgo) {
        current.recentAttempts += 1
      }

      bumpActivity(row.user_id, row.created_at)
    }

    for (const row of ((crosswordCompletions as Array<{ user_id: string; completed_at: string }> | null) ?? [])) {
      if (!crosswordAgg[row.user_id]) {
        crosswordAgg[row.user_id] = { recentCompletions: 0 }
      }

      if (new Date(row.completed_at).getTime() >= weekAgo) {
        crosswordAgg[row.user_id].recentCompletions += 1
      }

      bumpActivity(row.user_id, row.completed_at)
    }

    const studentIds = new Set([
      ...Object.keys(progressAgg),
      ...Object.keys(memoryAgg),
      ...Object.keys(quizAgg),
      ...Object.keys(crosswordAgg),
      ...Object.keys(activityAgg),
    ])

    const result: StudentStat[] = [...studentIds]
      .map((uid) => {
        const progressInfo = progressAgg[uid] ?? { known: 0, learning: 0 }
        return {
          user_id: uid,
          email: emailMap[uid] ?? uid,
          known: progressInfo.known,
          learning: progressInfo.learning,
          total: progressInfo.known + progressInfo.learning,
          quiz_best_pct: quizAgg[uid]?.bestPct ?? null,
          quiz_recent_attempts: quizAgg[uid]?.recentAttempts ?? 0,
          memory_best_moves: memoryAgg[uid]?.bestMoves ?? null,
          memory_best_time_ms: memoryAgg[uid]?.bestTimeMs ?? null,
          memory_recent_runs: memoryAgg[uid]?.recentRuns ?? 0,
          crossword_recent_completions: crosswordAgg[uid]?.recentCompletions ?? 0,
          weekly_activity: activityAgg[uid]?.week ?? 0,
          monthly_activity: activityAgg[uid]?.month ?? 0,
          yearly_activity: activityAgg[uid]?.year ?? 0,
          latest_activity_at: activityAgg[uid]?.latestAt ?? null,
        }
      })
      .sort((a, b) => {
        if (b.weekly_activity !== a.weekly_activity) return b.weekly_activity - a.weekly_activity
        if (b.total !== a.total) return b.total - a.total
        return b.monthly_activity - a.monthly_activity
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
          A cleaner weekly view of progress, practice variety, and recent student activity.
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
        <div className="space-y-4">
          {stats.map((student) => (
            <div key={student.user_id} className="bg-card border border-border rounded-3xl p-5">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-text">{student.email}</h2>
                  <p className="text-sm text-text-muted mt-1">
                    Latest activity: {formatTimestamp(student.latest_activity_at)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <MiniStat label="Known" value={student.known} />
                  <MiniStat label="Learning" value={student.learning} />
                  <MiniStat label="Tracked" value={student.total} />
                  <MiniStat label="Study 7d" value={student.weekly_activity} />
                  <MiniStat label="Study 30d" value={student.monthly_activity} />
                  <MiniStat label="Study 365d" value={student.yearly_activity} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
                <div className="bg-card-surface border border-border rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-wide text-text-subtle mb-2">This Week</p>
                  <p className="text-sm text-text">Quiz {student.quiz_recent_attempts}</p>
                  <p className="text-sm text-text">Memory {student.memory_recent_runs}</p>
                  <p className="text-sm text-text">Crossword {student.crossword_recent_completions}</p>
                </div>

                <div className="bg-card-surface border border-border rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-wide text-text-subtle mb-2">Best Quiz</p>
                  <p className="text-lg font-bold text-text">
                    {student.quiz_best_pct === null ? 'No record' : `${student.quiz_best_pct}%`}
                  </p>
                  <p className="text-xs text-text-faint mt-2">Highest saved quiz score</p>
                </div>

                <div className="bg-card-surface border border-border rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-wide text-text-subtle mb-2">Best Memory</p>
                  <p className="text-lg font-bold text-text">
                    {student.memory_best_moves === null ? 'No record' : `${student.memory_best_moves} moves`}
                  </p>
                  <p className="text-xs text-text-faint mt-2">
                    {student.memory_best_moves === null ? 'No saved memory run yet' : formatDuration(student.memory_best_time_ms)}
                  </p>
                </div>
              </div>

              {student.total === 0 ? (
                <p className="mt-4 text-xs text-text-faint">
                  This student has activity records, but has not marked any vocabulary or grammar items as known or learning yet.
                </p>
              ) : null}
            </div>
          ))}

          <div className="text-xs text-text-faint space-y-1">
            <p>`Study 7d / 30d / 365d` combines saved progress reviews, quiz completions, memory sessions, and crossword completions.</p>
            <p>`Tracked` counts only vocabulary and grammar items saved as known or learning.</p>
          </div>
        </div>
      )}
    </div>
  )
}
