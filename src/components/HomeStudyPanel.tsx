'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { grammarData, vocabData } from '@/lib/data'
import { getPublicMemoryLeaders } from '@/lib/memory'
import { getUserProgress } from '@/lib/progress'
import type { MemoryGameMode, MemoryScoreRow, UserProgressRow } from '@/types'

const PAIR_FILTERS = ['all', 3, 4, 6, 8] as const
const PERIOD_FILTERS = ['week', 'all'] as const
const MODE_FILTERS = ['all', 'review'] as const

type PeriodFilter = (typeof PERIOD_FILTERS)[number]
type PairFilter = (typeof PAIR_FILTERS)[number]
type ModeFilter = (typeof MODE_FILTERS)[number]

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

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function getPeriodLabel(period: PeriodFilter) {
  return period === 'week' ? 'This Week' : 'All Time'
}

function getModeLabel(mode: ModeFilter) {
  return mode === 'all' ? 'All Cards' : 'Review Queue'
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
  pairFilter,
  modeFilter,
  currentUserId,
  onPeriodChange,
  onPairChange,
  onModeChange,
}: {
  leaders: MemoryScoreRow[]
  leaderboardError: string
  leaderboardLoading: boolean
  periodFilter: PeriodFilter
  pairFilter: PairFilter
  modeFilter: ModeFilter
  currentUserId?: string
  onPeriodChange: (period: PeriodFilter) => void
  onPairChange: (pair: PairFilter) => void
  onModeChange: (mode: ModeFilter) => void
}) {
  const currentUserRank = currentUserId
    ? leaders.findIndex((entry) => entry.user_id === currentUserId) + 1 || null
    : null

  return (
    <div className="bg-card border border-border rounded-3xl p-6 sm:p-8">
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-subtle mb-3">Memory Ranking</p>
          <h2 className="text-2xl font-black text-text">{getPeriodLabel(periodFilter)} Fastest Runs</h2>
        </div>
        <Link href="/memory" className="text-sm text-coral hover:text-coral-light transition-colors">
          Open game
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex flex-wrap gap-2">
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

        <div className="flex flex-wrap gap-2">
          {PAIR_FILTERS.map((value) => (
            <button
              key={String(value)}
              onClick={() => onPairChange(value)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                pairFilter === value
                  ? 'text-white'
                  : 'bg-card-surface text-text-subtle hover:bg-border hover:text-text'
              }`}
              style={pairFilter === value ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
            >
              {value === 'all' ? 'All Sizes' : `${value} Pairs`}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {MODE_FILTERS.map((value) => (
            <button
              key={value}
              onClick={() => onModeChange(value)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                modeFilter === value
                  ? 'text-white'
                  : 'bg-card-surface text-text-subtle hover:bg-border hover:text-text'
              }`}
              style={modeFilter === value ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
            >
              {getModeLabel(value)}
            </button>
          ))}
        </div>
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
          <p className="text-sm text-text-muted mt-1">Your best public score is currently on this board.</p>
        </div>
      ) : null}

      {leaderboardError ? (
        <p className="text-sm text-coral">{leaderboardError}</p>
      ) : leaderboardLoading ? (
        <p className="text-sm text-text-faint">Loading ranking...</p>
      ) : leaders.length === 0 ? (
        <p className="text-sm text-text-faint">
          No public runs for this filter yet. Share a memory result to kick off the board.
        </p>
      ) : (
        <div className="space-y-3">
          {leaders.map((entry, index) => {
            const isCurrentUser = currentUserId === entry.user_id
            const placementBadge = getPlacementBadge(index)
            return (
              <div
                key={entry.id}
                className={`rounded-2xl p-4 border ${
                  isCurrentUser ? 'bg-card border-coral/60 shadow-sm' : 'bg-card-surface border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-xs uppercase tracking-wide text-text-subtle">
                        #{index + 1} • {entry.display_name}
                        {isCurrentUser ? ' • You' : ''}
                      </p>
                      {placementBadge ? <Badge label={placementBadge} tone="gold" /> : null}
                      {isCurrentUser ? <Badge label="Your Best" tone="accent" /> : null}
                    </div>
                    <p className="font-bold text-text">
                      {entry.moves} moves • {formatDuration(entry.duration_ms)}
                    </p>
                    <p className="text-sm text-text-muted mt-1">
                      TOPIK {entry.level} • {entry.pair_count} pairs •{' '}
                      {entry.game_mode === 'review' ? 'Review' : 'All cards'}
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
  const [leaders, setLeaders] = useState<MemoryScoreRow[]>([])
  const [error, setError] = useState('')
  const [fetching, setFetching] = useState(false)
  const [leaderboardError, setLeaderboardError] = useState('')
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('week')
  const [pairFilter, setPairFilter] = useState<PairFilter>('all')
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all')

  useEffect(() => {
    let cancelled = false

    const loadLeaderboard = async () => {
      setLeaderboardLoading(true)
      setLeaderboardError('')
      const result = await getPublicMemoryLeaders(
        {
          period: periodFilter,
          pairCount: pairFilter,
          gameMode: modeFilter as MemoryGameMode | 'all',
        },
        5
      )

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
  }, [modeFilter, pairFilter, periodFilter])

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
      pairFilter={pairFilter}
      modeFilter={modeFilter}
      currentUserId={user?.id}
      onPeriodChange={setPeriodFilter}
      onPairChange={setPairFilter}
      onModeChange={setModeFilter}
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

          {error && (
            <p className="mt-4 text-sm text-coral">{error}</p>
          )}

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
