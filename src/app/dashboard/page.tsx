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

  return 'Could not load dashboard data from Supabase right now.'
}

interface StudentStat {
  user_id: string
  email: string
  known: number
  learning: number
  total: number
  latest_progress_at: string | null
  memory_best_moves: number | null
  memory_best_time_ms: number | null
  memory_recent_runs: number
  memory_public_runs: number
  quiz_recent_attempts: number
  quiz_best_pct: number | null
  latest_activity_at: string | null
  weekly_activity: number
  monthly_activity: number
  yearly_activity: number
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

    const { data: progress, error: progressError } = await supabase
      .from('user_progress')
      .select('user_id, status, reviewed_at')

    if (progressError) {
      setError(normalizeDashboardError(progressError.message))
      setFetching(false)
      return
    }

    const { data: memoryScores, error: memoryError } = await supabase
      .from('memory_scores')
      .select('user_id, moves, duration_ms, is_public, completed_at')

    if (memoryError && !memoryError.message.includes('memory_scores')) {
      setError(normalizeDashboardError(memoryError.message))
      setFetching(false)
      return
    }

    const { data: quizAttempts, error: quizError } = await supabase
      .from('quiz_attempts')
      .select('user_id, correct_pct, created_at')

    if (quizError && !quizError.message.includes('quiz_attempts')) {
      setError(normalizeDashboardError(quizError.message))
      setFetching(false)
      return
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email')

    if (profilesError) {
      setError(normalizeDashboardError(profilesError.message))
      setFetching(false)
      return
    }

    const emailMap: Record<string, string> = {}
    for (const profile of profiles ?? []) {
      emailMap[profile.id] = profile.email
    }

    const progressAgg: Record<string, { known: number; learning: number; latestAt: string | null }> = {}
    for (const row of progress ?? []) {
      if (!progressAgg[row.user_id]) {
        progressAgg[row.user_id] = { known: 0, learning: 0, latestAt: null }
      }
      const current = progressAgg[row.user_id]

      if (row.status === 'known') current.known += 1
      if (row.status === 'learning') current.learning += 1

      if (!current.latestAt || new Date(row.reviewed_at).getTime() > new Date(current.latestAt).getTime()) {
        current.latestAt = row.reviewed_at
      }
    }

    const memoryAgg: Record<
      string,
      {
        bestMoves: number | null
        bestTimeMs: number | null
        recentRuns: number
        publicRuns: number
        latestAt: string | null
      }
    > = {}

    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000
    const yearAgo = now - 365 * 24 * 60 * 60 * 1000

    const activityAgg: Record<string, { weekly: number; monthly: number; yearly: number }> = {}

    const bumpActivity = (userId: string, timestamp: string) => {
      if (!activityAgg[userId]) {
        activityAgg[userId] = { weekly: 0, monthly: 0, yearly: 0 }
      }

      const time = new Date(timestamp).getTime()
      if (time >= weekAgo) activityAgg[userId].weekly += 1
      if (time >= monthAgo) activityAgg[userId].monthly += 1
      if (time >= yearAgo) activityAgg[userId].yearly += 1
    }

    for (const row of (memoryScores as Pick<
      MemoryScoreRow,
      'user_id' | 'moves' | 'duration_ms' | 'is_public' | 'completed_at'
    >[] | null) ?? []) {
      if (!memoryAgg[row.user_id]) {
        memoryAgg[row.user_id] = {
          bestMoves: null,
          bestTimeMs: null,
          recentRuns: 0,
          publicRuns: 0,
          latestAt: null,
        }
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

      if (row.is_public) current.publicRuns += 1
      if (new Date(row.completed_at).getTime() >= weekAgo) current.recentRuns += 1
      bumpActivity(row.user_id, row.completed_at)

      if (!current.latestAt || new Date(row.completed_at).getTime() > new Date(current.latestAt).getTime()) {
        current.latestAt = row.completed_at
      }
    }

    const quizAgg: Record<string, { recentAttempts: number; bestPct: number | null; latestAt: string | null }> = {}
    for (const row of (quizAttempts as Pick<QuizAttemptRow, 'user_id' | 'correct_pct' | 'created_at'>[] | null) ?? []) {
      if (!quizAgg[row.user_id]) {
        quizAgg[row.user_id] = { recentAttempts: 0, bestPct: null, latestAt: null }
      }
      const current = quizAgg[row.user_id]

      if (new Date(row.created_at).getTime() >= weekAgo) {
        current.recentAttempts += 1
      }
      bumpActivity(row.user_id, row.created_at)

      if (current.bestPct === null || row.correct_pct > (current.bestPct ?? 0)) {
        current.bestPct = row.correct_pct
      }

      if (!current.latestAt || new Date(row.created_at).getTime() > new Date(current.latestAt).getTime()) {
        current.latestAt = row.created_at
      }
    }

    for (const row of progress ?? []) {
      bumpActivity(row.user_id, row.reviewed_at)
    }

    const studentIds = new Set([
      ...Object.keys(progressAgg),
      ...Object.keys(memoryAgg),
      ...Object.keys(quizAgg),
      ...Object.keys(activityAgg),
    ])

    const result: StudentStat[] = [...studentIds]
      .map((uid) => {
        const counts = progressAgg[uid] ?? { known: 0, learning: 0, latestAt: null }
        const latestCandidates = [
          counts.latestAt,
          memoryAgg[uid]?.latestAt ?? null,
          quizAgg[uid]?.latestAt ?? null,
        ].filter(Boolean) as string[]

        return {
          user_id: uid,
          email: emailMap[uid] ?? uid,
          known: counts.known,
          learning: counts.learning,
          total: counts.known + counts.learning,
          latest_progress_at: counts.latestAt,
          memory_best_moves: memoryAgg[uid]?.bestMoves ?? null,
          memory_best_time_ms: memoryAgg[uid]?.bestTimeMs ?? null,
          memory_recent_runs: memoryAgg[uid]?.recentRuns ?? 0,
          memory_public_runs: memoryAgg[uid]?.publicRuns ?? 0,
          quiz_recent_attempts: quizAgg[uid]?.recentAttempts ?? 0,
          quiz_best_pct: quizAgg[uid]?.bestPct ?? null,
          latest_activity_at:
            latestCandidates.length === 0
              ? null
              : latestCandidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0],
          weekly_activity: activityAgg[uid]?.weekly ?? 0,
          monthly_activity: activityAgg[uid]?.monthly ?? 0,
          yearly_activity: activityAgg[uid]?.yearly ?? 0,
        }
      })
      .sort((a, b) => {
        const bActivity = b.weekly_activity
        const aActivity = a.weekly_activity
        if (bActivity !== aActivity) return bActivity - aActivity
        if (b.total !== a.total) return b.total - a.total
        return b.memory_public_runs - a.memory_public_runs
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

  const overallWeekly = stats.reduce((sum, student) => sum + student.weekly_activity, 0)
  const overallMonthly = stats.reduce((sum, student) => sum + student.monthly_activity, 0)
  const overallYearly = stats.reduce((sum, student) => sum + student.yearly_activity, 0)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text mb-1">Teacher Dashboard</h1>
        <p className="text-text-subtle text-sm">
          Track saved progress, recent practice, and which students are actually active this week.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Weekly Study</p>
          <p className="text-3xl font-black text-text mb-1">{overallWeekly}</p>
          <p className="text-sm text-text-muted">Saved study actions from the last 7 days</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Monthly Study</p>
          <p className="text-3xl font-black text-text mb-1">{overallMonthly}</p>
          <p className="text-sm text-text-muted">Saved study actions from the last 30 days</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Yearly Study</p>
          <p className="text-3xl font-black text-text mb-1">{overallYearly}</p>
          <p className="text-sm text-text-muted">Saved study actions from the last 365 days</p>
        </div>
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
                <th className="pb-3 pr-6 font-semibold text-emerald-400">Known</th>
                <th className="pb-3 pr-6 font-semibold text-amber-400">Learning</th>
                <th className="pb-3 pr-6 font-semibold">Tracked Items</th>
                <th className="pb-3 pr-6 font-semibold">Best Quiz Score</th>
                <th className="pb-3 pr-6 font-semibold">Quiz Attempts 7d</th>
                <th className="pb-3 pr-6 font-semibold">Best Memory Run</th>
                <th className="pb-3 pr-6 font-semibold">Memory Sessions 7d</th>
                <th className="pb-3 pr-6 font-semibold">Shared Memory Runs</th>
                <th className="pb-3 pr-6 font-semibold">Study 7d</th>
                <th className="pb-3 pr-6 font-semibold">Study 30d</th>
                <th className="pb-3 pr-6 font-semibold">Study 365d</th>
                <th className="pb-3 font-semibold">Latest Activity</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((student) => (
                <tr
                  key={student.user_id}
                  className="border-b border-border hover:bg-card-surface transition-colors"
                >
                  <td className="py-3 pr-6 text-text font-medium truncate max-w-[240px]">{student.email}</td>
                  <td className="py-3 pr-6 text-emerald-400 font-semibold">{student.known}</td>
                  <td className="py-3 pr-6 text-amber-400 font-semibold">{student.learning}</td>
                  <td className="py-3 pr-6 text-text-subtle">
                    {student.total}
                    {student.total > 0 ? (
                      <span className="ml-2 text-xs text-text-faint">
                        ({Math.round((student.known / student.total) * 100)}% known)
                      </span>
                    ) : (
                      <span className="ml-2 text-xs text-text-faint">No vocab/grammar marked yet</span>
                    )}
                  </td>
                  <td className="py-3 pr-6 text-text">
                    {student.quiz_best_pct === null ? 'No record' : `${student.quiz_best_pct}%`}
                  </td>
                  <td className="py-3 pr-6 text-text">{student.quiz_recent_attempts}</td>
                  <td className="py-3 pr-6 text-text-subtle">
                    {student.memory_best_moves === null ? (
                      'No record'
                    ) : (
                      <span>
                        {student.memory_best_moves} moves
                        <span className="ml-2 text-xs text-text-faint">
                          {formatDuration(student.memory_best_time_ms)}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-6 text-text">{student.memory_recent_runs}</td>
                  <td className="py-3 pr-6 text-text">{student.memory_public_runs}</td>
                  <td className="py-3 pr-6 text-text">{student.weekly_activity}</td>
                  <td className="py-3 pr-6 text-text">{student.monthly_activity}</td>
                  <td className="py-3 pr-6 text-text">{student.yearly_activity}</td>
                  <td className="py-3 text-text-subtle">{formatTimestamp(student.latest_activity_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 text-xs text-text-faint space-y-1">
            <p>`Tracked Items` counts only saved vocabulary/grammar progress, so a student can have memory sessions even when this number is still 0.</p>
            <p>`Best Quiz Score` is the highest saved quiz percentage. `Quiz Attempts 7d` is how many quizzes they finished in the last 7 days.</p>
            <p>`Best Memory Run` is the saved run with the fewest moves. `Memory Sessions 7d` is how many memory games they completed in the last 7 days.</p>
            <p>`Study 7d / 30d / 365d` combines saved progress reviews, quiz completions, and memory sessions.</p>
          </div>
          <p className="mt-4 text-xs text-text-faint text-right">Total students: {stats.length}</p>
        </div>
      )}
    </div>
  )
}
