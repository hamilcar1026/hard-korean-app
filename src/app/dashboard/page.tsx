'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase'

interface StudentStat {
  user_id: string
  email: string
  known: number
  learning: number
  total: number
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

    const result: StudentStat[] = Object.entries(agg).map(([uid, counts]) => ({
      user_id: uid,
      email: emailMap[uid] ?? uid,
      known: counts.known,
      learning: counts.learning,
      total: counts.known + counts.learning,
    })).sort((a, b) => b.total - a.total)

    setStats(result)
    setFetching(false)
  }

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/auth'); return }
    if (role && role !== 'teacher') { router.replace('/'); return }
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

  if (!role || role !== 'teacher') return null

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text mb-1">Teacher Dashboard</h1>
        <p className="text-text-subtle text-sm">Track student study progress</p>
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
                <th className="pb-3 font-semibold">Total</th>
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
