'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getHardWorkerLeaders, type HardWorkerRow } from '@/lib/activity'
import { useAuth } from '@/contexts/AuthContext'
import { grammarData, vocabData } from '@/lib/data'
import { getUserProgress } from '@/lib/progress'
import type { UserProgressRow } from '@/types'

const PERIOD_FILTERS = ['week', 'all'] as const
type PeriodFilter = (typeof PERIOD_FILTERS)[number]

function getNextLevel(progress: UserProgressRow[]) {
  const knownVocab = new Set(
    progress
      .filter((item) => item.item_type === 'vocab' && item.status === 'known')
      .map((item) => item.item_id)
  )

  for (const level of [1, 2, 3, 4, 5, 6]) {
    const levelVocab = vocabData.filter((item) => item.level === level)
    const completed = levelVocab.filter((item) => item.id && knownVocab.has(item.id)).length
    if (completed < levelVocab.length) return level
  }

  return 6
}

function isReviewedToday(reviewedAt: string) {
  return new Date(reviewedAt).toDateString() === new Date().toDateString()
}

function getPeriodLabel(period: PeriodFilter) {
  return period === 'week' ? 'This Week' : 'All Time'
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

function getPlacementBadge(index: number) {
  if (index === 0) return 'Top 1'
  if (index === 1) return 'Top 2'
  if (index === 2) return 'Top 3'
  return null
}

function Badge({ label, tone = 'default' }: { label: string; tone?: 'default' | 'accent' | 'gold' }) {
  const toneClass =
    tone === 'gold'
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : tone === 'accent'
        ? 'bg-coral/10 text-coral border-coral/30'
        : 'bg-card-surface text-text-subtle border-border'

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${toneClass}`}>
      {label}
    </span>
  )
}

function RankingCard({
  leaders,
  leaderboardError,
  leaderboardLoading,
  periodFilter,
  weekRangeLabel,
  currentUserId,
  onPeriodChange,
}: {
  leaders: HardWorkerRow[]
  leaderboardError: string
  leaderboardLoading: boolean
  periodFilter: PeriodFilter
  weekRangeLabel: string
  currentUserId?: string
  onPeriodChange: (period: PeriodFilter) => void
}) {
  const currentUserRank = currentUserId
    ? leaders.findIndex((entry) => entry.user_id === currentUserId) + 1 || null
    : null

  return (
    <div className="bg-card border border-border rounded-3xl p-6 sm:p-8">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-subtle mb-3">Study Ranking</p>
        <h2 className="text-2xl font-black text-text">Hard Workers {getPeriodLabel(periodFilter)}</h2>
        <p className="text-sm text-text-muted mt-2">
          Ranked by completed public memory sessions, saved crossword clears, and finished quizzes.
        </p>
        <p className="text-xs font-semibold uppercase tracking-wide text-text-faint mt-2">
          {periodFilter === 'week' ? `Period: ${weekRangeLabel}` : 'Period: All time'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {PERIOD_FILTERS.map((value) => (
          <button
            key={value}
            onClick={() => onPeriodChange(value)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              periodFilter === value
                ? 'text-white'
                : 'bg-card-surface text-text-subtle hover:bg-border hover:text-text'
            }`}
            style={periodFilter === value ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
          >
            {getPeriodLabel(value)}
          </button>
        ))}
      </div>

      {currentUserRank ? (
        <div className="bg-card-surface border border-border rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-text-subtle mb-1">Your Position</p>
              <p className="text-2xl font-black text-text">#{currentUserRank}</p>
            </div>
            {currentUserRank <= 3 ? <Badge label={`Top ${currentUserRank}`} tone="gold" /> : null}
          </div>
          <p className="text-sm text-text-muted mt-1">Based on completed memory, crossword, and quiz sessions.</p>
        </div>
      ) : null}

      {leaderboardError ? (
        <p className="text-sm text-coral">{leaderboardError}</p>
      ) : leaderboardLoading ? (
        <p className="text-sm text-text-faint">Loading ranking...</p>
      ) : leaders.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card-surface px-4 py-4">
          <p className="text-sm font-semibold text-text">No completed sessions {periodFilter === 'week' ? 'this week' : 'yet'}.</p>
          <p className="text-sm text-text-muted mt-1">
            {periodFilter === 'week'
              ? `This week runs ${weekRangeLabel}. Switch to All Time to see earlier records.`
              : 'Complete a quiz, public memory game, or public crossword to start the ranking.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaders.map((entry, index) => {
            const isCurrentUser = currentUserId === entry.user_id
            const placementBadge = getPlacementBadge(index)

            return (
              <div
                key={entry.user_id}
                className={`rounded-2xl px-4 py-2.5 border ${
                  isCurrentUser ? 'bg-card border-coral/60 shadow-sm' : 'bg-card-surface border-border'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs uppercase tracking-wide text-text-subtle truncate">
                        #{index + 1} · {entry.display_name}
                        {isCurrentUser ? ' · You' : ''}
                      </p>
                      {placementBadge ? <Badge label={placementBadge} tone="gold" /> : null}
                      {isCurrentUser ? <Badge label="You" tone="accent" /> : null}
                    </div>
                    <p className="text-sm text-text mt-1 leading-tight truncate">
                      <span className="font-bold">{entry.total_completed}</span> sessions · M {entry.memory_completed} · C {entry.crossword_completed} · Q {entry.quiz_completed}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function HomeStudyPanel() {
  const { user, loading } = useAuth()
  const [progress, setProgress] = useState<UserProgressRow[]>([])
  const [leaders, setLeaders] = useState<HardWorkerRow[]>([])
  const [error, setError] = useState('')
  const [fetching, setFetching] = useState(false)
  const [leaderboardError, setLeaderboardError] = useState('')
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('week')
  const weekRangeLabel = getCurrentWeekRangeLabel()

  useEffect(() => {
    let cancelled = false

    const loadLeaderboard = async () => {
      setLeaderboardLoading(true)
      setLeaderboardError('')
      const result = await getHardWorkerLeaders(periodFilter, 5)

      if (cancelled) return

      if (result.error) {
        setLeaderboardError(result.error)
        setLeaders([])
      } else {
        setLeaders(result.data)
      }
      setLeaderboardLoading(false)
    }

    void loadLeaderboard()

    return () => {
      cancelled = true
    }
  }, [periodFilter])

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const load = async () => {
      setFetching(true)
      const result = await getUserProgress(user.id)
      if (cancelled) return
      if (result.error) {
        setError(result.error)
      } else {
        setProgress(result.data)
      }
      setFetching(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [user])

  if (loading) return null

  const rankingCard = (
    <RankingCard
      leaders={leaders}
      leaderboardError={leaderboardError}
      leaderboardLoading={leaderboardLoading}
      periodFilter={periodFilter}
      weekRangeLabel={weekRangeLabel}
      currentUserId={user?.id}
      onPeriodChange={setPeriodFilter}
    />
  )

  if (!user) {
    return (
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-subtle mb-3">Today&apos;s Study</p>
                <h2 className="text-2xl sm:text-3xl font-black text-text mb-3">Start with a simple study loop</h2>
                <p className="text-sm sm:text-base text-text-muted max-w-2xl">
                  Pick a level, study a small set of words, then test yourself with flashcards or a quiz.
                </p>
              </div>
              <Link href="/auth" className="btn-coral px-5 py-3 rounded-2xl text-sm text-center">
                Log in to save progress
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
              {[
                { title: '1. Learn', value: '20 words', desc: 'Start with a focused vocabulary block.' },
                { title: '2. Review', value: 'Flashcards', desc: 'Flip through what you just studied.' },
                { title: '3. Check', value: 'Quick quiz', desc: 'See what actually stuck.' },
              ].map((item) => (
                <div key={item.title} className="bg-card-surface border border-border rounded-2xl p-4">
                  <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">{item.title}</p>
                  <p className="text-xl font-black text-text mb-1">{item.value}</p>
                  <p className="text-sm text-text-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {rankingCard}
        </div>
      </section>
    )
  }

  const learningCount = progress.filter((item) => item.status === 'learning').length
  const knownCount = progress.filter((item) => item.status === 'known').length
  const reviewedToday = progress.filter((item) => isReviewedToday(item.reviewed_at)).length
  const nextLevel = getNextLevel(progress)
  const totalItems = vocabData.length + grammarData.length

  return (
    <section className="max-w-6xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-subtle mb-3">Today&apos;s Study</p>
              <h2 className="text-2xl sm:text-3xl font-black text-text mb-3">Keep your study streak moving</h2>
              <p className="text-sm sm:text-base text-text-muted max-w-2xl">
                Review weak items first, then push into your next TOPIK level.
              </p>
            </div>
            <Link href="/dashboard" className="btn-coral px-5 py-3 rounded-2xl text-sm text-center">
              Open Dashboard
            </Link>
          </div>

          {error ? <p className="mt-4 text-sm text-coral">{error}</p> : null}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            <div className="bg-card-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Review Queue</p>
              <p className="text-3xl font-black text-text mb-1">{fetching ? '...' : learningCount}</p>
              <p className="text-sm text-text-muted">Items marked as still learning</p>
            </div>
            <div className="bg-card-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Reviewed Today</p>
              <p className="text-3xl font-black text-text mb-1">{fetching ? '...' : reviewedToday}</p>
              <p className="text-sm text-text-muted">Cards touched in today&apos;s session</p>
            </div>
            <div className="bg-card-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Next Target</p>
              <p className="text-3xl font-black text-text mb-1">TOPIK {nextLevel}</p>
              <p className="text-sm text-text-muted">Keep building toward your next level</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Link href={`/vocabulary?level=${nextLevel}&mode=flashcard`} className="btn-ghost px-5 py-3 rounded-2xl text-sm text-center">
              Review vocabulary
            </Link>
            <Link href={`/memory?level=${nextLevel}`} className="btn-ghost px-5 py-3 rounded-2xl text-sm text-center">
              Play memory game
            </Link>
            <Link href={`/grammar?level=${nextLevel}`} className="btn-ghost px-5 py-3 rounded-2xl text-sm text-center">
              Study grammar
            </Link>
            <Link href={`/quiz?level=${nextLevel}`} className="btn-ghost px-5 py-3 rounded-2xl text-sm text-center">
              Take a quiz
            </Link>
          </div>

          <p className="mt-4 text-xs text-text-faint">
            Known so far: {knownCount} / {totalItems} tracked study items.
          </p>
        </div>

        {rankingCard}
      </div>
    </section>
  )
}
