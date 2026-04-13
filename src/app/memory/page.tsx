'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { vocabData } from '@/lib/data'
import {
  getMemoryLeaderboard,
  getUserMemoryBest,
  getUserRecentMemoryScores,
  saveMemoryScore,
} from '@/lib/memory'
import { getUserProgress } from '@/lib/progress'
import { playTextToSpeech } from '@/lib/tts'
import type { MemoryGameMode, MemoryScoreRow, UserProgressRow, VocabItem } from '@/types'

const LEVELS = [1, 2, 3, 4, 5, 6]
const PAIR_OPTIONS = [3, 4, 6, 8]

type Card = {
  id: string
  pairId: number
  kind: 'word' | 'meaning'
  value: string
  meta: VocabItem
}

type MoveSnapshot = {
  matched: number[]
  moves: number
  finished: boolean
  roundDurationMs: number
}

function shuffle<T>(arr: T[]) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function buildDeck(items: VocabItem[]) {
  return shuffle(
    items.flatMap((item) => [
      {
        id: `w-${item.id}`,
        pairId: item.id ?? 0,
        kind: 'word' as const,
        value: item.word,
        meta: item,
      },
      {
        id: `m-${item.id}`,
        pairId: item.id ?? 0,
        kind: 'meaning' as const,
        value: item.meaning,
        meta: item,
      },
    ])
  )
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function isSameScore(entry: MemoryScoreRow, score: { userId: string; moves: number; durationMs: number }) {
  return (
    entry.user_id === score.userId &&
    entry.moves === score.moves &&
    entry.duration_ms === score.durationMs
  )
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

function MemoryContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const initialLevel = Number(searchParams.get('level') ?? 1)

  const [selectedLevel, setSelectedLevel] = useState(
    LEVELS.includes(initialLevel) ? initialLevel : 1
  )
  const [pairCount, setPairCount] = useState(4)
  const [gameMode, setGameMode] = useState<MemoryGameMode>('all')
  const [cards, setCards] = useState<Card[]>([])
  const [flipped, setFlipped] = useState<string[]>([])
  const [matched, setMatched] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [gameStarted, setGameStarted] = useState(false)
  const [locked, setLocked] = useState(false)
  const [finished, setFinished] = useState(false)
  const [progress, setProgress] = useState<UserProgressRow[]>([])
  const [progressLoading, setProgressLoading] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [roundDurationMs, setRoundDurationMs] = useState(0)
  const [shareScore, setShareScore] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [scoreRefreshKey, setScoreRefreshKey] = useState(0)
  const [leaderboard, setLeaderboard] = useState<MemoryScoreRow[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [leaderboardError, setLeaderboardError] = useState('')
  const [personalBest, setPersonalBest] = useState<MemoryScoreRow | null>(null)
  const [recentScores, setRecentScores] = useState<MemoryScoreRow[]>([])
  const [scoresLoading, setScoresLoading] = useState(false)
  const [savedRank, setSavedRank] = useState<number | null>(null)
  const [newPersonalBest, setNewPersonalBest] = useState(false)
  const [moveHistory, setMoveHistory] = useState<MoveSnapshot[]>([])
  const [autoPlayAudio, setAutoPlayAudio] = useState(true)
  const mismatchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const load = async () => {
      setProgressLoading(true)
      const result = await getUserProgress(user.id)
      if (cancelled) return
      if (!result.error) {
        setProgress(result.data)
      }
      setProgressLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [user])

  const effectiveMode: MemoryGameMode = user ? gameMode : 'all'
  const effectiveProgress = useMemo(() => (user ? progress : []), [progress, user])

  const levelPool = useMemo(
    () => vocabData.filter((item) => item.level === selectedLevel),
    [selectedLevel]
  )

  const reviewIds = useMemo(
    () =>
      new Set(
        effectiveProgress
          .filter((item) => item.item_type === 'vocab' && item.status === 'learning')
          .map((item) => item.item_id)
      ),
    [effectiveProgress]
  )

  const reviewPool = useMemo(
    () => levelPool.filter((item) => item.id && reviewIds.has(item.id)),
    [levelPool, reviewIds]
  )

  const activePool = effectiveMode === 'review' ? reviewPool : levelPool

  useEffect(() => {
    let cancelled = false

    const loadScores = async () => {
      setLeaderboardLoading(true)
      setScoresLoading(Boolean(user))
      setLeaderboardError('')

      const leaderboardResult = await getMemoryLeaderboard({
        level: selectedLevel,
        pairCount,
        gameMode: effectiveMode,
      })

      if (cancelled) return

      if (leaderboardResult.error) {
        setLeaderboard([])
        setLeaderboardError(leaderboardResult.error)
      } else {
        setLeaderboard(leaderboardResult.data)
      }
      setLeaderboardLoading(false)

      if (!user) {
        setPersonalBest(null)
        setRecentScores([])
        setScoresLoading(false)
        return
      }

      const [bestResult, recentResult] = await Promise.all([
        getUserMemoryBest(user.id, {
          level: selectedLevel,
          pairCount,
          gameMode: effectiveMode,
        }),
        getUserRecentMemoryScores(user.id),
      ])

      if (cancelled) return

      if (bestResult.error || recentResult.error) {
        setLeaderboardError(bestResult.error ?? recentResult.error ?? '')
      }

      setPersonalBest(bestResult.data)
      setRecentScores(recentResult.data)
      setScoresLoading(false)
    }

    void loadScores()

    return () => {
      cancelled = true
    }
  }, [effectiveMode, pairCount, scoreRefreshKey, selectedLevel, user])

  const currentUserRank = useMemo(() => {
    if (!user) return null
    const index = leaderboard.findIndex((entry) => entry.user_id === user.id)
    return index === -1 ? null : index + 1
  }, [leaderboard, user])

  const startGame = (startedAt: number) => {
    if (mismatchTimeoutRef.current) {
      clearTimeout(mismatchTimeoutRef.current)
      mismatchTimeoutRef.current = null
    }
    const chosen = shuffle(activePool).slice(0, pairCount)
    setCards(buildDeck(chosen))
    setFlipped([])
    setMatched([])
    setMoves(0)
    setFinished(false)
    setLocked(false)
    setRoundDurationMs(0)
    setShareScore(false)
    setSaveStatus('idle')
    setSaveMessage('')
    setSaveError('')
    setSavedRank(null)
    setNewPersonalBest(false)
    setMoveHistory([])
    setStartTime(startedAt)
    setGameStarted(true)
  }

  const handleLevelChange = (level: number) => {
    setSelectedLevel(level)
    setGameStarted(false)
    const params = new URLSearchParams()
    params.set('level', String(level))
    router.replace(`/memory?${params}`)
  }

  const handleFlip = (card: Card, interactionTime: number) => {
    if (locked || flipped.includes(card.id) || matched.includes(card.pairId)) return

    const nextFlipped = [...flipped, card.id]
    setFlipped(nextFlipped)
    if (autoPlayAudio && card.kind === 'word') {
      void playTextToSpeech(card.value)
    }

    if (nextFlipped.length !== 2) return

    setMoveHistory((history) => [
      ...history,
      {
        matched: [...matched],
        moves,
        finished,
        roundDurationMs,
      },
    ])
    setMoves((value) => value + 1)
    const selectedCards = cards.filter((item) => nextFlipped.includes(item.id))
    const isMatch =
      selectedCards.length === 2 &&
      selectedCards[0].pairId === selectedCards[1].pairId &&
      selectedCards[0].kind !== selectedCards[1].kind

    if (isMatch) {
      const pairId = selectedCards[0].pairId
      const nextMatched = [...matched, pairId]
      setMatched(nextMatched)
      setFlipped([])
      if (nextMatched.length === pairCount) {
        setFinished(true)
        if (startTime !== null) {
          setRoundDurationMs(Math.max(0, Math.round(interactionTime - startTime)))
        }
      }
      return
    }

    setLocked(true)
    mismatchTimeoutRef.current = setTimeout(() => {
      setFlipped([])
      setLocked(false)
      mismatchTimeoutRef.current = null
    }, 800)
  }

  const handleUndoMove = () => {
    if (moveHistory.length === 0) return

    if (mismatchTimeoutRef.current) {
      clearTimeout(mismatchTimeoutRef.current)
      mismatchTimeoutRef.current = null
    }

    const previous = moveHistory[moveHistory.length - 1]
    setMoveHistory((history) => history.slice(0, -1))
    setMatched(previous.matched)
    setMoves(previous.moves)
    setFinished(previous.finished)
    setRoundDurationMs(previous.roundDurationMs)
    setFlipped([])
    setLocked(false)
    setSaveStatus('idle')
    setSaveMessage('')
    setSaveError('')
    setSavedRank(null)
    setNewPersonalBest(false)
  }

  const handleSaveScore = async () => {
    if (!user || !finished || roundDurationMs <= 0) return

    setSaveStatus('saving')
    setSaveError('')
    setSaveMessage('')
    setSavedRank(null)
    setNewPersonalBest(false)

    const currentScore = {
      userId: user.id,
      moves,
      durationMs: roundDurationMs,
    }

    const wasBetterThanBest =
      !personalBest ||
      moves < personalBest.moves ||
      (moves === personalBest.moves && roundDurationMs < personalBest.duration_ms)

    const result = await saveMemoryScore({
      userId: user.id,
      fallbackName: user.email?.split('@')[0],
      level: selectedLevel,
      pairCount,
      gameMode: effectiveMode,
      moves,
      durationMs: roundDurationMs,
      isPublic: shareScore,
    })

    if (result.error) {
      setSaveStatus('idle')
      setSaveError(result.error)
      return
    }

    let nextSavedRank: number | null = null

    if (shareScore) {
      const leaderboardResult = await getMemoryLeaderboard({
        level: selectedLevel,
        pairCount,
        gameMode: effectiveMode,
      })

      if (!leaderboardResult.error) {
        setLeaderboard(leaderboardResult.data)
        const rankIndex = leaderboardResult.data.findIndex((entry) => isSameScore(entry, currentScore))
        nextSavedRank = rankIndex === -1 ? null : rankIndex + 1
        setSavedRank(nextSavedRank)
      }
    }

    setNewPersonalBest(wasBetterThanBest)
    setSaveStatus('saved')
    setSaveMessage(
      shareScore
        ? nextSavedRank
          ? `Result saved and shared. You are now #${nextSavedRank} on this board.`
          : 'Result saved and shared to the leaderboard.'
        : 'Result saved privately. You can keep competing anytime.'
    )
    setScoreRefreshKey((value) => value + 1)
  }

  const renderCompetitionPanel = () => (
    <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6 mt-8">
      <section className="bg-card border border-border rounded-3xl p-6">
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-black text-text">Leaderboard</h2>
            <p className="text-sm text-text-subtle">
              Public scores for Level {selectedLevel} • {pairCount} pairs •{' '}
              {effectiveMode === 'review' ? 'Review queue' : 'All cards'}
            </p>
          </div>
          <p className="text-xs uppercase tracking-wide text-text-faint">Opt-in only</p>
        </div>

        {currentUserRank ? (
          <div className="bg-card-surface border border-border rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-subtle mb-1">Your Current Position</p>
                <p className="text-2xl font-black text-text">#{currentUserRank}</p>
              </div>
              {currentUserRank <= 3 ? <Badge label={`Top ${currentUserRank}`} tone="gold" /> : null}
            </div>
            <p className="text-sm text-text-muted mt-1">Based on your best public score for this setup.</p>
          </div>
        ) : null}

        {leaderboardError && (
          <p
            className="text-coral text-sm rounded-xl px-3 py-2 border mb-4"
            style={{ background: 'var(--t-error-box-bg)', borderColor: 'var(--t-error-box-border)' }}
          >
            {leaderboardError}
          </p>
        )}

        {leaderboardLoading ? (
          <p className="text-sm text-text-faint">Loading leaderboard...</p>
        ) : leaderboard.length === 0 ? (
          <p className="text-sm text-text-faint">
            No public scores yet for this setup. Save a result and share it to start the board.
          </p>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry, index) => {
              const isCurrentUser = user?.id === entry.user_id
              const placementBadge = getPlacementBadge(index)
              return (
                <div
                  key={entry.id}
                  className={`rounded-2xl px-4 py-3 flex items-center justify-between gap-4 border ${
                    isCurrentUser ? 'bg-card border-coral/60 shadow-sm' : 'bg-card-surface border-border'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-xs uppercase tracking-wide text-text-subtle">
                        #{index + 1} • {entry.display_name}
                        {isCurrentUser ? ' • You' : ''}
                      </p>
                      {placementBadge ? <Badge label={placementBadge} tone="gold" /> : null}
                      {isCurrentUser ? <Badge label="Your Best" tone="accent" /> : null}
                    </div>
                    <p className="text-sm text-text-muted">
                      {formatDuration(entry.duration_ms)} • {formatTimestamp(entry.completed_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-text text-lg">{entry.moves} moves</p>
                    <p className="text-xs text-text-faint">
                      {entry.game_mode === 'review' ? 'Review queue' : 'All cards'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="bg-card border border-border rounded-3xl p-6">
        <div className="mb-5">
          <h2 className="text-xl font-black text-text">Your Record</h2>
          <p className="text-sm text-text-subtle">Save private scores, or share them when you want to compete.</p>
        </div>

        {!user ? (
          <div className="bg-card-surface border border-border rounded-2xl p-5">
            <p className="font-bold text-text mb-1">Log in to save your runs</p>
            <p className="text-sm text-text-subtle mb-4">
              Signing in unlocks personal history and the public leaderboard.
            </p>
            <Link href="/auth" className="btn-coral px-4 py-2 rounded-xl inline-block text-sm">
              Log In
            </Link>
          </div>
        ) : scoresLoading ? (
          <p className="text-sm text-text-faint">Loading your score history...</p>
        ) : (
          <div className="space-y-4">
            <div className="bg-card-surface border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <p className="text-xs text-text-subtle uppercase tracking-wide">Personal Best</p>
                {newPersonalBest ? <Badge label="New Best" tone="accent" /> : null}
              </div>
              {personalBest ? (
                <>
                  <p className="text-2xl font-black text-text">{personalBest.moves} moves</p>
                  <p className="text-sm text-text-muted mt-1">
                    {formatDuration(personalBest.duration_ms)} •{' '}
                    {personalBest.is_public ? 'Public' : 'Private'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-text-faint">No saved score for this setup yet.</p>
              )}
            </div>

            <div className="bg-card-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-subtle uppercase tracking-wide mb-3">Recent Runs</p>
              {recentScores.length === 0 ? (
                <p className="text-sm text-text-faint">Your finished games will appear here.</p>
              ) : (
                <div className="space-y-3">
                  {recentScores.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-semibold text-text">
                          L{entry.level} • {entry.pair_count} pairs •{' '}
                          {entry.game_mode === 'review' ? 'Review' : 'All'}
                        </p>
                        <p className="text-text-faint">{formatTimestamp(entry.completed_at)}</p>
                      </div>
                      <p className="shrink-0 text-text-subtle">
                        {entry.moves} moves • {formatDuration(entry.duration_ms)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )

  if (!gameStarted) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 sm:py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-text mb-2">Memory Match</h1>
          <p className="text-text-subtle max-w-xl mx-auto">
            Match Korean words with their meanings to lock them in faster, then save your best run.
          </p>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-subtle mb-3">Choose a Level</p>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => handleLevelChange(level)}
                  className={`px-4 py-2 text-sm rounded-xl font-medium transition-colors ${
                    selectedLevel === level
                      ? 'text-white'
                      : 'bg-card-surface text-text-subtle hover:bg-border hover:text-text'
                  }`}
                  style={selectedLevel === level ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
                >
                  Level {level}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-subtle mb-3">Game Mode</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setGameMode('all')}
                className={`px-4 py-2 text-sm rounded-xl font-medium transition-colors ${
                  effectiveMode === 'all'
                    ? 'text-white'
                    : 'bg-card-surface text-text-subtle hover:bg-border hover:text-text'
                }`}
                style={effectiveMode === 'all' ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
              >
                All Cards
              </button>
              <button
                onClick={() => setGameMode('review')}
                disabled={!user}
                className={`px-4 py-2 text-sm rounded-xl font-medium transition-colors disabled:opacity-40 ${
                  effectiveMode === 'review'
                    ? 'text-white'
                    : 'bg-card-surface text-text-subtle hover:bg-border hover:text-text'
                }`}
                style={effectiveMode === 'review' ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
              >
                Review Queue
              </button>
            </div>
            {!user && (
              <p className="text-xs text-text-faint mt-2">Log in to play using your learning queue.</p>
            )}
          </div>

          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-subtle mb-3">Audio</p>
            <label className="flex items-start gap-3 bg-card-surface border border-border rounded-2xl p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={autoPlayAudio}
                onChange={(event) => setAutoPlayAudio(event.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block font-semibold text-text">Auto-play Korean cards</span>
                <span className="block text-sm text-text-subtle">
                  Automatically read the Korean word aloud whenever a word card flips open.
                </span>
              </span>
            </label>
          </div>

          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-subtle mb-3">Deck Size</p>
            <div className="flex gap-2">
              {PAIR_OPTIONS.map((size) => (
                <button
                  key={size}
                  onClick={() => setPairCount(size)}
                  className={`px-4 py-2 text-sm rounded-xl font-medium transition-colors ${
                    pairCount === size
                      ? 'text-white'
                      : 'bg-card-surface text-text-subtle hover:bg-border hover:text-text'
                  }`}
                  style={pairCount === size ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
                >
                  {size} pairs
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-card-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Active Pool</p>
              <p className="text-2xl font-black text-text">
                {progressLoading && effectiveMode === 'review' ? '...' : activePool.length}
              </p>
              <p className="text-sm text-text-muted mt-1">
                {effectiveMode === 'review' ? 'Learning words in this level' : 'Available vocabulary cards'}
              </p>
            </div>
            <div className="bg-card-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Memory Goal</p>
              <p className="text-2xl font-black text-text">{pairCount}</p>
              <p className="text-sm text-text-muted mt-1">Pairs to clear this round</p>
            </div>
            <div className="bg-card-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Compete</p>
              <p className="text-2xl font-black text-text">{leaderboardLoading ? '...' : leaderboard.length}</p>
              <p className="text-sm text-text-muted mt-1">Public scores visible for this setup</p>
            </div>
          </div>

          {effectiveMode === 'review' && activePool.length === 0 ? (
            <div className="bg-card-surface border border-border rounded-2xl p-5 mb-8">
              <p className="font-bold text-text mb-1">No review cards in this level yet</p>
              <p className="text-sm text-text-subtle">
                Mark some vocabulary as still learning, then come back for a focused memory round.
              </p>
            </div>
          ) : null}

          <button
            onClick={(event) => startGame(event.timeStamp)}
            disabled={activePool.length < pairCount}
            className="btn-coral w-full py-3 rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Start Memory Game
          </button>
        </div>

        {renderCompetitionPanel()}
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 sm:py-12">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-text mb-2">Memory Match</h1>
          <p className="text-text-subtle">
            TOPIK Level {selectedLevel} • {pairCount} pairs •{' '}
            {effectiveMode === 'review' ? 'Review queue' : 'All cards'}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="bg-card border border-border rounded-2xl px-4 py-3">
            <p className="text-text-faint text-xs uppercase tracking-wide mb-1">Moves</p>
            <p className="font-black text-text text-xl">{moves}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl px-4 py-3">
            <p className="text-text-faint text-xs uppercase tracking-wide mb-1">Matched</p>
            <p className="font-black text-text text-xl">
              {matched.length} / {pairCount}
            </p>
          </div>
        </div>
      </div>

      {finished && (
        <div className="mb-6 bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-xl font-black text-text">Board cleared</p>
            {newPersonalBest ? <Badge label="New Best" tone="accent" /> : null}
            {savedRank && savedRank <= 3 ? <Badge label={`Top ${savedRank}`} tone="gold" /> : null}
          </div>
          <p className="text-text-subtle mb-4">
            Nice work. You matched all {pairCount} pairs in {moves} moves and {formatDuration(roundDurationMs)}.
          </p>

          {user ? (
            <div className="bg-card-surface border border-border rounded-2xl p-4 mb-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shareScore}
                  onChange={(event) => setShareScore(event.target.checked)}
                  disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold text-text">Share this score publicly</span>
                  <span className="block text-sm text-text-subtle">
                    Keep it off to save privately. Turn it on if you want your name on the leaderboard.
                  </span>
                </span>
              </label>

              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button
                  onClick={handleSaveScore}
                  disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                  className="btn-coral px-5 py-3 rounded-2xl text-sm disabled:opacity-40"
                >
                  {saveStatus === 'saving'
                    ? 'Saving...'
                    : saveStatus === 'saved'
                      ? 'Saved'
                      : 'Save Result'}
                </button>
                {saveMessage ? <p className="text-sm text-emerald-400 self-center">{saveMessage}</p> : null}
                {saveError ? <p className="text-sm text-coral self-center">{saveError}</p> : null}
              </div>

              {savedRank ? (
                <p className="text-sm text-text mt-3">
                  Your latest public score is currently <span className="font-bold">#{savedRank}</span> on this board.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="bg-card-surface border border-border rounded-2xl p-4 mb-4">
              <p className="font-semibold text-text mb-1">Log in to save this run</p>
              <p className="text-sm text-text-subtle mb-4">
                Signing in lets you keep personal history and join the public leaderboard.
              </p>
              <Link href="/auth" className="btn-coral px-4 py-2 rounded-xl inline-block text-sm">
                Log In
              </Link>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={(event) => startGame(event.timeStamp)} className="btn-coral px-5 py-3 rounded-2xl text-sm">
              Play Again
            </button>
            <button
              onClick={() => setGameStarted(false)}
              className="btn-ghost px-5 py-3 rounded-2xl text-sm"
            >
              Change Settings
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((card) => {
          const isOpen = flipped.includes(card.id) || matched.includes(card.pairId)
          return (
            <button
              key={card.id}
              onClick={(event) => handleFlip(card, event.timeStamp)}
              disabled={matched.includes(card.pairId)}
              className="aspect-[4/5] rounded-2xl text-left p-3 border transition-all duration-300"
              style={
                isOpen
                  ? {
                      background: 'linear-gradient(135deg, var(--t-card-back-from), var(--t-card-back-to))',
                      borderColor: 'var(--t-card-back-border)',
                    }
                  : {
                      background: 'var(--color-card)',
                      borderColor: 'var(--color-border)',
                    }
              }
            >
              <div className="h-full flex flex-col justify-between">
                <p className="text-[10px] uppercase tracking-[0.25em] text-text-faint">
                  {isOpen ? (card.kind === 'word' ? 'Korean' : 'Meaning') : 'Memory'}
                </p>
                <div>
                  <p
                    className={`font-black leading-tight ${
                      isOpen ? 'text-text text-lg sm:text-xl' : 'text-3xl text-text-subtle text-center'
                    }`}
                  >
                    {isOpen ? card.value : '?'}
                  </p>
                  {isOpen && card.kind === 'word' && (
                    <p className="text-xs text-text-subtle mt-2">{card.meta.romanization}</p>
                  )}
                </div>
                <p className="text-xs text-text-faint">
                  {isOpen ? `TOPIK ${card.meta.level}` : 'Tap to flip'}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {!finished && (
        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <button
            onClick={handleUndoMove}
            disabled={moveHistory.length === 0}
            className="btn-ghost px-5 py-3 rounded-2xl text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Undo Last Move
          </button>
          <button onClick={(event) => startGame(event.timeStamp)} className="btn-ghost px-5 py-3 rounded-2xl text-sm">
            Shuffle New Board
          </button>
          <button
            onClick={() => setGameStarted(false)}
            className="btn-ghost px-5 py-3 rounded-2xl text-sm"
          >
            Back to Settings
          </button>
        </div>
      )}

      {renderCompetitionPanel()}
    </div>
  )
}

export default function MemoryPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-text-faint">Loading...</div>}>
      <MemoryContent />
    </Suspense>
  )
}
