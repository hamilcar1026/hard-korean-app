'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase'
import StudentDashboard from '@/components/StudentDashboard'
import type { MemoryScoreRow, QuizAttemptRow } from '@/types'

interface StudentStat {
  user_id: string
  email: string
  known: number
  learning: number
  total: number
  memory_best_moves: number | null
  memory_best_time_ms: number | null
  memory_recent_runs: number
  memory_public_runs: number
  quiz_recent_attempts: number
  quiz_best_pct: number | null
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null) return 'No record'

  const totalSeconds = Math.max(1, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
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
      .select('user_id, status')

    if (progressError) {
      setError(progressError.message)
      setFetching(false)
      return
    }

    const { data: memoryScores, error: memoryError } = await supabase
      .from('memory_scores')
      .select('user_id, moves, duration_ms, is_public, completed_at')

    if (memoryError && !memoryError.message.includes('memory_scores')) {
      setError(memoryError.message)
      setFetching(false)
      return
    }

    const { data: quizAttempts, error: quizError } = await supabase
      .from('quiz_attempts')
      .select('user_id, correct_pct, created_at')

    if (quizError && !quizError.message.includes('quiz_attempts')) {
      setError(quizError.message)
      setFetching(false)
      return
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email')

    if (profilesError) {
      setError(profilesError.message)
      setFetching(false)
      return
    }

    const emailMap: Record<string, string> = {}
    for (const profile of profiles ?? []) {
      emailMap[profile.id] = profile.email
    }

    const progressAgg: Record<string, { known: number; learning: number }> = {}
    for (const row of progress ?? []) {
      if (!progressAgg[row.user_id]) progressAgg[row.user_id] = { known: 0, learning: 0 }
      if (row.status === 'known') progressAgg[row.user_id].known += 1
      if (row.status === 'learning') progressAgg[row.user_id].learning += 1
    }

    const memoryAgg: Record<
      string,
      {
        bestMoves: number | null
        bestTimeMs: number | null
        recentRuns: number
        publicRuns: number
      }
    > = {}

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
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
    }

    const quizAgg: Record<string, { recentAttempts: number; bestPct: number | null }> = {}
    for (const row of (quizAttempts as Pick<QuizAttemptRow, 'user_id' | 'correct_pct' | 'created_at'>[] | null) ?? []) {
      if (!quizAgg[row.user_id]) {
        quizAgg[row.user_id] = { recentAttempts: 0, bestPct: null }
      }

      if (new Date(row.created_at).getTime() >= weekAgo) {
        quizAgg[row.user_id].recentAttempts += 1
      }

      if (
        quizAgg[row.user_id].bestPct === null ||
        row.correct_pct > (quizAgg[row.user_id].bestPct ?? 0)
      ) {
        quizAgg[row.user_id].bestPct = row.correct_pct
      }
    }

    const studentIds = new Set([
      ...Object.keys(progressAgg),
      ...Object.keys(memoryAgg),
      ...Object.keys(quizAgg),
    ])

    const result: StudentStat[] = [...studentIds]
      .map((uid) => {
        const counts = progressAgg[uid] ?? { known: 0, learning: 0 }
        return {
          user_id: uid,
          email: emailMap[uid] ?? uid,
          known: counts.known,
          learning: counts.learning,
          total: counts.known + counts.learning,
          memory_best_moves: memoryAgg[uid]?.bestMoves ?? null,
          memory_best_time_ms: memoryAgg[uid]?.bestTimeMs ?? null,
          memory_recent_runs: memoryAgg[uid]?.recentRuns ?? 0,
          memory_public_runs: memoryAgg[uid]?.publicRuns ?? 0,
          quiz_recent_attempts: quizAgg[uid]?.recentAttempts ?? 0,
          quiz_best_pct: quizAgg[uid]?.bestPct ?? null,
        }
      })
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total
        if (b.quiz_recent_attempts !== a.quiz_recent_attempts) return b.quiz_recent_attempts - a.quiz_recent_attempts
        return b.memory_recent_runs - a.memory_recent_runs
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
        <p className="text-text-subtle text-sm">Track student study progress, quiz scores, and memory activity.</p>
      </div>

      {error && (
        <p
          className="text-coral text-sm rounded-xl px-3 py-2 border mb-6"
          style={{ background: 'var(--t-error-box-bg)', borderColor: 'var(--t-error-box-border)' }}
        >
          {error}
        </p>
      )}

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
                <th className="pb-3 pr-6 font-semibold">Total</th>
                <th className="pb-3 pr-6 font-semibold">Best Quiz</th>
                <th className="pb-3 pr-6 font-semibold">Quiz Runs This Week</th>
                <th className="pb-3 pr-6 font-semibold">Best Memory</th>
                <th className="pb-3 pr-6 font-semibold">Memory Runs This Week</th>
                <th className="pb-3 font-semibold">Public Shares</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((student) => (
                <tr
                  key={student.user_id}
                  className="border-b border-border hover:bg-card-surface transition-colors"
                >
                  <td className="py-3 pr-6 text-text font-medium truncate max-w-[220px]">{student.email}</td>
                  <td className="py-3 pr-6 text-emerald-400 font-semibold">{student.known}</td>
                  <td className="py-3 pr-6 text-amber-400 font-semibold">{student.learning}</td>
                  <td className="py-3 pr-6 text-text-subtle">
                    {student.total}
                    {student.total > 0 ? (
                      <span className="ml-2 text-xs text-text-faint">
                        ({Math.round((student.known / student.total) * 100)}% known)
                      </span>
                    ) : null}
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
                  <td className="py-3 text-text">{student.memory_public_runs}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-text-faint text-right">Total students: {stats.length}</p>
        </div>
      )}
    </div>
  )
}
