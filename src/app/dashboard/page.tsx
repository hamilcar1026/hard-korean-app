'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase'
import StudentDashboard from '@/components/StudentDashboard'
import type { MemoryScoreRow } from '@/types'

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
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null) return '—'

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

    const { data: progress, error: pErr } = await supabase
      .from('user_progress')
      .select('user_id, status')

    if (pErr) { setError(pErr.message); setFetching(false); return }

    const { data: memoryScores, error: mErr } = await supabase
      .from('memory_scores')
      .select('user_id, moves, duration_ms, is_public, completed_at')

    if (mErr && !mErr.message.includes('memory_scores')) {
      setError(mErr.message)
      setFetching(false)
      return
    }

    const { data: profiles, error: prErr } = await supabase
      .from('profiles')
      .select('id, email')

    if (prErr) { setError(prErr.message); setFetching(false); return }

    const emailMap: Record<string, string> = {}
    for (const p of profiles ?? []) emailMap[p.id] = p.email

    const agg: Record<string, { known: number; learning: number }> = {}
    for (const row of progress ?? []) {
      if (!agg[row.user_id]) agg[row.user_id] = { known: 0, learning: 0 }
      if (row.status === 'known') agg[row.user_id].known++
      else if (row.status === 'learning') agg[row.user_id].learning++
    }

    const memoryAgg: Record<string, {
      bestMoves: number | null
      bestTimeMs: number | null
      recentRuns: number
      publicRuns: number
    }> = {}

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    for (const row of (memoryScores as Pick<MemoryScoreRow, 'user_id' | 'moves' | 'duration_ms' | 'is_public' | 'completed_at'>[] | null) ?? []) {
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
          current.bestTimeMs !== null &&
          row.duration_ms < current.bestTimeMs)

      if (isBetter) {
        current.bestMoves = row.moves
        current.bestTimeMs = row.duration_ms
      }

      if (row.is_public) {
        current.publicRuns += 1
      }

      if (new Date(row.completed_at).getTime() >= weekAgo) {
        current.recentRuns += 1
      }
    }

    const studentIds = new Set([
      ...Object.keys(agg),
      ...Object.keys(memoryAgg),
    ])

    const result: StudentStat[] = [...studentIds].map((uid) => {
      const counts = agg[uid] ?? { known: 0, learning: 0 }
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
      }
    }).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return b.memory_recent_runs - a.memory_recent_runs
    })

    setStats(result)
    setFetching(false)
  }

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/auth'); return }
    if (role === 'teacher') {
      queueMicrotask(() => {
        void loadStats()
      })
    }
  }, [loading, role, router, user])

  if (loading) {
    return (
      <div className="text-center py-20 text-text-faint">Loading...</div>
    )
  }

  if (!user) return null

  if (!role) return null

  if (role !== 'teacher') {
    return <StudentDashboard />
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text mb-1">Teacher Dashboard</h1>
        <p className="text-text-subtle text-sm">Track student study progress and memory game activity.</p>
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
        <div className="text-center py-20 text-text-faint">
          No study records yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-subtle">
                <th className="pb-3 pr-6 font-semibold">Student Email</th>
                <th className="pb-3 pr-6 font-semibold text-emerald-400">Known</th>
                <th className="pb-3 pr-6 font-semibold text-amber-400">Learning</th>
                <th className="pb-3 pr-6 font-semibold">Total</th>
                <th className="pb-3 pr-6 font-semibold">Best Memory</th>
                <th className="pb-3 pr-6 font-semibold">Runs This Week</th>
                <th className="pb-3 font-semibold">Public Shares</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr
                  key={s.user_id}
                  className="border-b border-border hover:bg-card-surface transition-colors"
                >
                  <td className="py-3 pr-6 text-text font-medium truncate max-w-[220px]">
                    {s.email}
                  </td>
                  <td className="py-3 pr-6 text-emerald-400 font-semibold">{s.known}</td>
                  <td className="py-3 pr-6 text-amber-400 font-semibold">{s.learning}</td>
                  <td className="py-3 text-text-subtle">
                    {s.total}
                    {s.total > 0 && (
                      <span className="ml-2 text-xs text-text-faint">
                        ({Math.round((s.known / s.total) * 100)}% known)
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-6 text-text-subtle">
                    {s.memory_best_moves === null ? (
                      '—'
                    ) : (
                      <span>
                        {s.memory_best_moves} moves
                        <span className="ml-2 text-xs text-text-faint">
                          {formatDuration(s.memory_best_time_ms)}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-6 text-text">{s.memory_recent_runs}</td>
                  <td className="py-3 text-text">{s.memory_public_runs}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-text-faint text-right">
            Total students: {stats.length}
          </p>
        </div>
      )}
    </div>
  )
}
