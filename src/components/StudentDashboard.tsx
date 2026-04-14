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

function isGrammarQuizMode(mode: string) {
  return mode.startsWith('grammar_')
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
    .slice(0, 8)
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
        getUserRecentQuizAttempts(user.id, 5),
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
    const vocabularyQuizAttempts = recentQuizAttempts.filter((attempt) => !isGrammarQuizMode(attempt.quiz_mode))
    const grammarQuizAttempts = recentQuizAttempts.filter((attempt) => isGrammarQuizMode(attempt.quiz_mode))
    const bestQuiz = vocabularyQuizAttempts.reduce<QuizAttemptRow | null>((best, attempt) => {
      if (!best) return attempt
      if (attempt.correct_pct !== best.correct_pct) {
        return attempt.correct_pct > best.correct_pct ? attempt : best
      }
      return attempt.score > best.score ? attempt : best
    }, null)
    const bestGrammarQuiz = grammarQuizAttempts.reduce<QuizAttemptRow | null>((best, attempt) => {
      if (!best) return attempt
      if (attempt.correct_pct !== best.correct_pct) {
        return attempt.correct_pct > best.correct_pct ? attempt : best
      }
      return attempt.score > best.score ? attempt : best
    }, null)

    return {
      levelProgress,
      reviewItems,
      known,
      learning,
      reviewedToday,
      bestQuiz,
      bestGrammarQuiz,
      vocabularyQuizAttempts,
      grammarQuizAttempts,
    }
  }, [progress, recentQuizAttempts])

  if (!user) return null

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text mb-1">Study Dashboard</h1>
        <p className="text-text-subtle text-sm">Track your progress and jump back into review fast.</p>
      </div>

      {error && (
        <p
          className="text-coral text-sm rounded-xl px-3 py-2 border mb-6"
          style={{ background: 'var(--t-error-box-bg)', borderColor: 'var(--t-error-box-border)' }}
        >
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Known</p>
          <p className="text-3xl font-black text-emerald-400">{loading ? '...' : stats.known}</p>
          <p className="text-sm text-text-muted mt-1">Items you&apos;ve marked as learned</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Review Queue</p>
          <p className="text-3xl font-black text-amber-400">{loading ? '...' : stats.learning}</p>
          <p className="text-sm text-text-muted mt-1">Items to revisit soon</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Reviewed Today</p>
          <p className="text-3xl font-black text-text">{loading ? '...' : stats.reviewedToday}</p>
          <p className="text-sm text-text-muted mt-1">Study actions recorded today</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-6 mb-6">
        <section className="bg-card border border-border rounded-3xl p-6">
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-black text-text">Memory Record</h2>
              <p className="text-sm text-text-subtle">Your saved matching results and competitive runs.</p>
            </div>
            <Link href="/memory" className="text-sm text-coral hover:text-coral-light transition-colors">
              Play
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="bg-card-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Best Saved Run</p>
              {loading ? (
                <p className="text-sm text-text-faint">Loading...</p>
              ) : memoryBest ? (
                <>
                  <p className="text-2xl font-black text-text">{memoryBest.moves} moves</p>
                  <p className="text-sm text-text-muted mt-1">
                    L{memoryBest.level} / {memoryBest.pair_count} pairs / {formatDuration(memoryBest.duration_ms)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-text-faint">Save a memory result to set your first record.</p>
              )}
            </div>

            <div className="bg-card-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Competition</p>
              {loading ? (
                <p className="text-sm text-text-faint">Loading...</p>
              ) : recentMemoryScores.some((entry) => entry.is_public) ? (
                <>
                  <p className="text-2xl font-black text-text">Public</p>
                  <p className="text-sm text-text-muted mt-1">You already have a shared run on the leaderboard.</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-black text-text">Private</p>
                  <p className="text-sm text-text-muted mt-1">Turn on sharing after a game to compete with others.</p>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">Recent Memory Runs</h3>
              <Link href="/memory" className="text-xs text-text-subtle hover:text-text transition-colors">
                Open leaderboard
              </Link>
            </div>

            {loading ? (
              <p className="text-sm text-text-faint">Loading memory history...</p>
            ) : recentMemoryScores.length === 0 ? (
              <p className="text-sm text-text-faint">Your saved memory games will show up here.</p>
            ) : (
              recentMemoryScores.map((entry) => (
                <div key={entry.id} className="bg-card-surface border border-border rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-text-subtle mb-1">
                        TOPIK {entry.level} / {entry.pair_count} pairs / {entry.game_mode === 'review' ? 'Review' : 'All cards'}
                      </p>
                      <p className="font-bold text-text">
                        {entry.moves} moves / {formatDuration(entry.duration_ms)}
                      </p>
                      <p className="text-sm text-text-muted mt-1">{formatTimestamp(entry.completed_at)}</p>
                    </div>
                    <span className="text-xs shrink-0 rounded-full border border-border px-3 py-1 text-text-subtle">
                      {entry.is_public ? 'Public' : 'Private'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-card border border-border rounded-3xl p-6">
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-black text-text">Level Progress</h2>
              <p className="text-sm text-text-subtle">Completion based on items marked known.</p>
            </div>
            <Link href="/vocabulary" className="text-sm text-coral hover:text-coral-light transition-colors">
              Study more
            </Link>
          </div>

          <div className="space-y-4">
            {stats.levelProgress.map((level) => (
              <div key={level.level}>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-semibold text-text">TOPIK {level.level}</span>
                  <span className="text-text-subtle">
                    {loading ? '...' : `${level.completed} / ${level.total} (${level.pct}%)`}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-card-surface overflow-hidden">
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

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <section className="bg-card border border-border rounded-3xl p-6">
          <div className="mb-5">
            <h2 className="text-xl font-black text-text">Review Next</h2>
            <p className="text-sm text-text-subtle">Recent items still marked as learning.</p>
          </div>

          {loading ? (
            <p className="text-sm text-text-faint">Loading review list...</p>
          ) : stats.reviewItems.length === 0 ? (
            <div>
              <p className="text-sm text-text-faint mb-4">Your review queue is empty. Nice work.</p>
              <Link href="/quiz" className="btn-ghost px-4 py-2 rounded-xl text-sm inline-block">
                Start a fresh quiz
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.reviewItems.map((entry, index) => (
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
              ))}
              <Link href="/memory" className="btn-ghost px-4 py-3 rounded-2xl text-sm inline-block w-full text-center">
                Warm up with memory game
              </Link>
            </div>
          )}
        </section>

        <section className="bg-card border border-border rounded-3xl p-6">
          <div className="mb-5">
            <h2 className="text-xl font-black text-text">Quiz Snapshot</h2>
            <p className="text-sm text-text-subtle">Track vocabulary and grammar quiz results separately.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div className="bg-card-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Best Vocab Quiz</p>
              {loading ? (
                <p className="text-sm text-text-faint">Loading...</p>
              ) : stats.bestQuiz ? (
                <>
                  <p className="text-2xl font-black text-text">{stats.bestQuiz.correct_pct}%</p>
                  <p className="text-sm text-text-muted mt-1">
                    {stats.bestQuiz.score}/{stats.bestQuiz.total_questions} / {getQuizModeLabel(stats.bestQuiz.quiz_mode)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-text-faint">Save a quiz result to see your quiz stats here.</p>
              )}
            </div>

            <div className="bg-card-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Best Grammar Quiz</p>
              {loading ? (
                <p className="text-sm text-text-faint">Loading...</p>
              ) : stats.bestGrammarQuiz ? (
                <>
                  <p className="text-2xl font-black text-text">{stats.bestGrammarQuiz.correct_pct}%</p>
                  <p className="text-sm text-text-muted mt-1">
                    {stats.bestGrammarQuiz.score}/{stats.bestGrammarQuiz.total_questions} / {getQuizModeLabel(stats.bestGrammarQuiz.quiz_mode)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-text-faint">Save a grammar quiz result to see it here.</p>
              )}
            </div>

            <div className="bg-card-surface border border-border rounded-2xl p-4">
              <p className="text-xs text-text-subtle uppercase tracking-wide mb-2">Saved Attempts</p>
              <p className="text-2xl font-black text-text">{loading ? '...' : recentQuizAttempts.length}</p>
              <p className="text-sm text-text-muted mt-1">
                {loading
                  ? 'Loading...'
                  : `${stats.vocabularyQuizAttempts.length} vocab / ${stats.grammarQuizAttempts.length} grammar`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text">Recent Vocabulary Quiz Runs</h3>
                <Link href="/quiz" className="text-xs text-text-subtle hover:text-text transition-colors">
                  Open
                </Link>
              </div>
              {loading ? (
                <p className="text-sm text-text-faint">Loading quiz history...</p>
              ) : stats.vocabularyQuizAttempts.length === 0 ? (
                <p className="text-sm text-text-faint">Save a vocabulary quiz result to start tracking it here.</p>
              ) : (
                stats.vocabularyQuizAttempts.map((attempt) => (
                  <div key={attempt.id} className="bg-card-surface border border-border rounded-2xl p-4">
                    <p className="font-bold text-text">
                      {attempt.score}/{attempt.total_questions} / {attempt.correct_pct}%
                    </p>
                    <p className="text-sm text-text-muted mt-1">
                      {getQuizModeLabel(attempt.quiz_mode)} / {attempt.level ? `TOPIK ${attempt.level}` : 'All levels'}
                    </p>
                    <p className="text-xs text-text-faint mt-2">{formatTimestamp(attempt.created_at)}</p>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text">Recent Grammar Quiz Runs</h3>
                <Link href="/grammar-quiz" className="text-xs text-text-subtle hover:text-text transition-colors">
                  Open
                </Link>
              </div>
              {loading ? (
                <p className="text-sm text-text-faint">Loading grammar quiz history...</p>
              ) : stats.grammarQuizAttempts.length === 0 ? (
                <p className="text-sm text-text-faint">Save a grammar quiz result to start tracking it here.</p>
              ) : (
                stats.grammarQuizAttempts.map((attempt) => (
                  <div key={attempt.id} className="bg-card-surface border border-border rounded-2xl p-4">
                    <p className="font-bold text-text">
                      {attempt.score}/{attempt.total_questions} / {attempt.correct_pct}%
                    </p>
                    <p className="text-sm text-text-muted mt-1">
                      {getQuizModeLabel(attempt.quiz_mode)} / {attempt.level ? `TOPIK ${attempt.level}` : 'All levels'}
                    </p>
                    <p className="text-xs text-text-faint mt-2">{formatTimestamp(attempt.created_at)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Link href="/quiz" className="btn-ghost px-4 py-3 rounded-2xl text-sm inline-block w-full text-center">
              Take a vocabulary quiz
            </Link>
            <Link href="/grammar-quiz" className="btn-ghost px-4 py-3 rounded-2xl text-sm inline-block w-full text-center">
              Take a grammar quiz
            </Link>
            <Link href="/memory" className="btn-ghost px-4 py-3 rounded-2xl text-sm inline-block w-full text-center">
              Play memory game
            </Link>
            <Link href="/vocabulary" className="btn-ghost px-4 py-3 rounded-2xl text-sm inline-block w-full text-center">
              Review vocabulary
            </Link>
            <Link href="/grammar" className="btn-ghost px-4 py-3 rounded-2xl text-sm inline-block w-full text-center">
              Study grammar
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
