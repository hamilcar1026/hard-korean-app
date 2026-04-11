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

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/auth'); return }
    if (role && role !== 'teacher') { router.replace('/'); return }
    if (role === 'teacher') loadStats()
  }, [user, role, loading])

  const loadStats = async () => {
    setFetching(true)
    setError('')
    const supabase = createClient()

    // Fetch all progress records (teacher RLS policy allows this)
    const { data: progress, error: pErr } = await supabase
      .from('user_progress')
      .select('user_id, status')

    if (pErr) { setError(pErr.message); setFetching(false); return }

    // Fetch all profiles for email lookup
    const { data: profiles, error: prErr } = await supabase
      .from('profiles')
      .select('id, email')

    if (prErr) { setError(prErr.message); setFetching(false); return }

    const emailMap: Record<string, string> = {}
    for (const p of profiles ?? []) emailMap[p.id] = p.email

    // Aggregate per user
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

  // Still loading auth state
  if (loading) {
    return (
      <div className="text-center py-20 text-text-faint">Loading...</div>
    )
  }

  // Not logged in (redirect happens via useEffect, but render null to avoid flash)
  if (!user) return null

  // Not a teacher – redirect happens in useEffect, render nothing to avoid flash
  if (!role || role !== 'teacher') return null

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text mb-1">선생님 대시보드</h1>
        <p className="text-text-subtle text-sm">학생별 학습 진도 현황</p>
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
        <div className="text-center py-20 text-text-faint">불러오는 중...</div>
      ) : stats.length === 0 ? (
        <div className="text-center py-20 text-text-faint">
          아직 학습 기록이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-subtle">
                <th className="pb-3 pr-6 font-semibold">학생 이메일</th>
                <th className="pb-3 pr-6 font-semibold text-emerald-400">알았다 ✓</th>
                <th className="pb-3 pr-6 font-semibold text-amber-400">몰랐다 😅</th>
                <th className="pb-3 font-semibold">전체</th>
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
                        ({Math.round((s.known / s.total) * 100)}% 알았다)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-text-faint text-right">
            총 {stats.length}명의 학생
          </p>
        </div>
      )}
    </div>
  )
}
