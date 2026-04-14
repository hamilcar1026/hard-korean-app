'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { grammarData, vocabData } from '@/lib/data'
import { getUserMemoryBest, getUserRecentMemoryScores } from '@/lib/memory'
import { getUserProgress } from '@/lib/progress'
import { getUserRecentQuizAttempts } from '@/lib/quiz'
import type {
  GrammarItem,
  MemoryScoreRow,
  QuizAttemptRow,
  UserProgressRow,
  VocabItem,
} from '@/types'

type ReviewItem =
  | { kind: 'vocab'; item: VocabItem; reviewed_at: string }
  | { kind: 'grammar'; item: GrammarItem; reviewed_at: string }

const LEVELS = [1, 2, 3, 4, 5, 6]

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

function getQuizModeLabel(mode: string) {
  switch (mode) {
    case 'word_to_meaning':
      return 'Word to Meaning'
    case 'meaning_to_word':
      return 'Meaning to Word'
    case 'example_blank':
      return 'Example Blank'
    case 'typing':
      return 'Type the Word'
    case 'grammar_form_to_meaning':
      return 'Grammar to Meaning'
    case 'grammar_meaning_to_form':
      return 'Meaning to Grammar'
    case 'grammar_example_blank':
      return 'Grammar Blank'
    default:
      return mode
  }
}

function isGrammarQuizMode(mode?: string | null) {
  return typeof mode === 'string' && mode.startsWith('grammar_')
}

function getLevelProgress(progress: UserProgressRow[]) {
  const knownVocab = new Set(
    progress
      .filter((item) => item.item_type === 'vocab' && item.status === 'known')
      .map((item) => item.item_id)
  )
  const knownGrammar = new Set(
    progress
      .filter((item) => item.item_type === 'grammar' && item.status === 'known')
      .map((item) => item.item_id)
  )

  return LEVELS.map((level) => {
    const vocabItems = vocabData.filter((item) => item.level === level)
    const grammarItems = grammarData.filter((item) => item.level === level)
    const total = vocabItems.length + grammarItems.length
    const completed =
      vocabItems.filter((item) => item.id && knownVocab.has(item.id)).length +
      grammarItems.filter((item) => item.id && knownGrammar.has(item.id)).length

    return {
      level,
      completed,
      total,
      pct: total === 0 ? 0 : Math.round((completed / total) * 100),
    }
  })
}

function buildReviewItems(progress: UserProgressRow[]) {
  return progress
    .filter((item) => item.status === 'learning')
    .slice(0, 5)
    .flatMap((entry): ReviewItem[] => {
      if (entry.item_type === 'vocab') {
        const item = vocabData.find((v) => v.id === entry.item_id)
        return item ? [{ kind: 'vocab', item, reviewed_at: entry.reviewed_at }] : []
      }

      const item = grammarData.find((g) => g.id === entry.item_id)
      return item ? [{ kind: 'grammar', item, reviewed_at: entry.reviewed_at }] : []
    })
}

function getTodayCount(progress: UserProgressRow[]) {
  const today = new Date().toDateString()
  return progress.filter((item) => new Date(item.reviewed_at).toDateString() === today).length
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const [progress, setProgress] = useState<UserProgressRow[]>([])
  const [memoryBest, setMemoryBest] = useState<MemoryScoreRow | null>(null)
  const [recentMemoryScores, setRecentMemoryScores] = useState<MemoryScoreRow[]>([])
  const [recentQuizAttempts, setRecentQuizAttempts] = useState<QuizAttemptRow[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const load = async () => {
      setLoading(true)
      const [progressResult, bestResult, recentMemoryResult, recentQuizResult] = await Promise.all([
        getUserProgress(user.id),
        getUserMemoryBest(user.id, {
          level: 1,
          pairCount: 6,
          gameMode: 'all',
        }),
        getUserRecentMemoryScores(user.id, 4),
        getUserRecentQuizAttempts(user.id, 6),
      ])

      if (cancelled) return

      if (
        progressResult.error ||
        bestResult.error ||
        recentMemoryResult.error ||
        recentQuizResult.error
      ) {
        setError(
          progressResult.error ??
            bestResult.error ??
            recentMemoryResult.error ??
            recentQuizResult.error ??
            ''
        )
      } else {
        setProgress(progressResult.data)
        setMemoryBest(bestResult.data)
        setRecentMemoryScores(recentMemoryResult.data)
        setRecentQuizAttempts(recentQuizResult.data)
      }
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [user])

  const stats = useMemo(() => {
    const levelProgress = getLevelProgress(progress)
    const reviewItems = buildReviewItems(progress)
    const known = progress.filter((item) => item.status === 'known').length
    const learning = progress.filter((item) => item.status === 'learning').length
    const reviewedToday = getTodayCount(progress)
    const tracked = known + learning
    const nextLevel = levelProgress.find((level) => level.completed < level.total) ?? levelProgress[levelProgress.length - 1]
    const vocabularyQuizAttempts = recentQuizAttempts.filter((attempt) => !isGrammarQuizMode(attempt.quiz_mode))
    const grammarQuizAttempts = recentQuizAttempts.filter((attempt) => isGrammarQuizMode(attempt.quiz_mode))
    const latestQuiz = recentQuizAttempts[0] ?? null
    const latestMemory = recentMemoryScores[0] ?? null

    return {
      levelProgress,
      reviewItems,
      known,
      learning,
      reviewedToday,
      tracked,
      nextLevel,
      vocabularyQuizAttempts,
      grammarQuizAttempts,
      latestQuiz,
      latestMemory,
    }
  }, [progress, recentMemoryScores, recentQuizAttempts])

  if (!user) return null

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text mb-1">Study Dashboard</h1>
        <p className="text-text-subtle text-sm">Today’s progress, quick review, and your latest saved activity.</p>
      </div>

      {error && (
        <p
          className="text-coral text-sm rounded-xl px-3 py-2 border mb-6"
          style={{ background: 'var(--t-error-box-bg)', borderColor: 'var(--t-error-box-border)' }}
        >
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Today</p>
          <p className="text-3xl font-black text-text">{loading ? '...' : stats.reviewedToday}</p>
          <p className="text-sm text-text-muted mt-1">saved study actions</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Review Queue</p>
          <p className="text-3xl font-black text-amber-400">{loading ? '...' : stats.learning}</p>
          <p className="text-sm text-text-muted mt-1">items marked learning</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Known</p>
          <p className="text-3xl font-black text-emerald-400">{loading ? '...' : stats.known}</p>
          <p className="text-sm text-text-muted mt-1">items marked known</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Next Target</p>
          <p className="text-3xl font-black text-text">
            {loading ? '...' : `TOPIK ${stats.nextLevel?.level ?? 1}`}
          </p>
          <p className="text-sm text-text-muted mt-1">
            {loading
              ? 'Loading...'
              : `${stats.nextLevel?.completed ?? 0}/${stats.nextLevel?.total ?? 0} complete`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6 mb-6">
        <section className="bg-card border border-border rounded-3xl p-6">
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-black text-text">Focus Today</h2>
              <p className="text-sm text-text-subtle">Jump straight into the next useful action.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <Link href="/vocabulary" className="btn-ghost px-4 py-3 rounded-2xl text-sm text-center">
              Review vocabulary
            </Link>
            <Link href="/grammar" className="btn-ghost px-4 py-3 rounded-2xl text-sm text-center">
              Study grammar
            </Link>
            <Link href="/quiz" className="btn-ghost px-4 py-3 rounded-2xl text-sm text-center">
              Vocabulary quiz
            </Link>
            <Link href="/grammar-quiz" className="btn-ghost px-4 py-3 rounded-2xl text-sm text-center">
              Grammar quiz
            </Link>
            <Link href="/memory" className="btn-ghost px-4 py-3 rounded-2xl text-sm text-center">
              Memory game
            </Link>
            <Link href="/crossword" className="btn-ghost px-4 py-3 rounded-2xl text-sm text-center">
              Crossword
            </Link>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">Review Next</h3>
              <span className="text-xs text-text-faint">
                {loading ? '...' : `${stats.reviewItems.length} ready`}
              </span>
            </div>

            {loading ? (
              <p className="text-sm text-text-faint">Loading review list...</p>
            ) : stats.reviewItems.length === 0 ? (
              <p className="text-sm text-text-faint">Your review queue is empty. Nice work.</p>
            ) : (
              stats.reviewItems.map((entry, index) => (
                <div
                  key={`${entry.kind}-${entry.item.id ?? index}`}
                  className="bg-card-surface border border-border rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-text-subtle mb-1">
                        {entry.kind === 'vocab' ? 'Vocabulary' : 'Grammar'} / TOPIK {entry.item.level}
                      </p>
                      <p className="font-bold text-text">
                        {entry.kind === 'vocab' ? entry.item.word : entry.item.form}
                      </p>
                      <p className="text-sm text-text-muted mt-1">
                        {entry.kind === 'vocab' ? entry.item.meaning : entry.item.meaning || entry.item.category}
                      </p>
                    </div>
                    <Link
                      href={
                        entry.kind === 'vocab'
                          ? `/vocabulary?level=${entry.item.level}&mode=flashcard`
                          : `/grammar?level=${entry.item.level}`
                      }
                      className="btn-ghost px-3 py-2 rounded-xl text-xs shrink-0"
                    >
                      Review
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-card border border-border rounded-3xl p-6">
          <div className="mb-5">
            <h2 className="text-xl font-black text-text">Progress Snapshot</h2>
            <p className="text-sm text-text-subtle">Compact view of your saved records.</p>
          </div>

          <div className="space-y-4 mb-5">
            <div className="bg-card-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Tracked Items</p>
              <p className="text-2xl font-black text-text">{loading ? '...' : stats.tracked}</p>
              <p className="text-sm text-text-muted mt-1">
                {loading ? 'Loading...' : `${stats.known} known / ${stats.learning} learning`}
              </p>
            </div>

            <div className="bg-card-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Latest Quiz</p>
              {loading ? (
                <p className="text-sm text-text-faint">Loading...</p>
              ) : stats.latestQuiz ? (
                <>
                  <p className="text-2xl font-black text-text">{stats.latestQuiz.correct_pct}%</p>
                  <p className="text-sm text-text-muted mt-1">
                    {getQuizModeLabel(stats.latestQuiz.quiz_mode)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-text-faint">No saved quiz yet.</p>
              )}
            </div>

            <div className="bg-card-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Best Memory</p>
              {loading ? (
                <p className="text-sm text-text-faint">Loading...</p>
              ) : memoryBest ? (
                <>
                  <p className="text-2xl font-black text-text">{memoryBest.moves} moves</p>
                  <p className="text-sm text-text-muted mt-1">
                    {formatDuration(memoryBest.duration_ms)} / L{memoryBest.level}
                  </p>
                </>
              ) : (
                <p className="text-sm text-text-faint">No saved memory run yet.</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">Recent Saved Activity</h3>
              <Link href="/favorites" className="text-xs text-text-subtle hover:text-text transition-colors">
                Favorites
              </Link>
            </div>

            {!loading && stats.latestQuiz ? (
              <div className="bg-card-surface border border-border rounded-2xl p-4">
                <p className="text-xs uppercase tracking-wide text-text-subtle mb-1">Quiz</p>
                <p className="font-bold text-text">
                  {stats.latestQuiz.score}/{stats.latestQuiz.total_questions} / {stats.latestQuiz.correct_pct}%
                </p>
                <p className="text-sm text-text-muted mt-1">
                  {getQuizModeLabel(stats.latestQuiz.quiz_mode)}
                </p>
                <p className="text-xs text-text-faint mt-2">{formatTimestamp(stats.latestQuiz.created_at)}</p>
              </div>
            ) : null}

            {!loading && stats.latestMemory ? (
              <div className="bg-card-surface border border-border rounded-2xl p-4">
                <p className="text-xs uppercase tracking-wide text-text-subtle mb-1">Memory</p>
                <p className="font-bold text-text">
                  {stats.latestMemory.moves} moves / {formatDuration(stats.latestMemory.duration_ms)}
                </p>
                <p className="text-sm text-text-muted mt-1">
                  TOPIK {stats.latestMemory.level} / {stats.latestMemory.pair_count} pairs
                </p>
                <p className="text-xs text-text-faint mt-2">{formatTimestamp(stats.latestMemory.completed_at)}</p>
              </div>
            ) : null}

            {!loading && !stats.latestQuiz && !stats.latestMemory ? (
              <p className="text-sm text-text-faint">Your saved quiz and game activity will show up here.</p>
            ) : null}
          </div>
        </section>
      </div>

      <section className="bg-card border border-border rounded-3xl p-6">
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-black text-text">Level Progress</h2>
            <p className="text-sm text-text-subtle">Completion based on items marked known.</p>
          </div>
          <div className="text-right text-sm text-text-subtle">
            <p>{loading ? '...' : `${stats.vocabularyQuizAttempts.length} vocab quiz saves`}</p>
            <p>{loading ? '...' : `${stats.grammarQuizAttempts.length} grammar quiz saves`}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.levelProgress.map((level) => (
            <div key={level.level} className="bg-card-surface border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-semibold text-text">TOPIK {level.level}</span>
                <span className="text-text-subtle">
                  {loading ? '...' : `${level.completed} / ${level.total} (${level.pct}%)`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-card overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${level.pct}%`,
                    background: 'linear-gradient(90deg, #FF6B6B, #FF8E9E)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
