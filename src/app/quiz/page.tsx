'use client'

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import LevelBadge from '@/components/LevelBadge'
import TTSButton from '@/components/TTSButton'
import { useAuth } from '@/contexts/AuthContext'
import { vocabData } from '@/lib/data'
import { getUserProgress } from '@/lib/progress'
import { getUserRecentQuizAttempts, saveQuizAttempt } from '@/lib/quiz'
import type { QuizAttemptRow } from '@/types'

const LEVELS = [1, 2, 3, 4, 5, 6]
const DEFAULT_QUIZ_SIZE = 10

type QuizMode = 'word_to_meaning' | 'meaning_to_word' | 'example_blank' | 'typing'
type QuizWordFilter = 'all' | 'learning'

type ChoiceQuestion = {
  type: 'word_to_meaning' | 'meaning_to_word' | 'example_blank'
  prompt: string
  secondary?: string
  level: number
  correct: string
  choices: string[]
  speechText?: string
}

type TypeQuestion = {
  type: 'typing'
  meaning: string
  pos: string
  level: number
  example_kr: string
  correct: string
}

type Question = ChoiceQuestion | TypeQuestion

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function isCorrectTyping(input: string, correct: string) {
  const userNorm = normalize(input)
  const answers = correct.split('/').map((p) => normalize(p.trim()))
  return answers.some((a) => a === userNorm)
}

function blankWordInExample(example: string, word: string) {
  if (!example) return ''
  return example.replace(word, '_____')
}

function getModeLabel(mode: QuizMode | string) {
  switch (mode) {
    case 'word_to_meaning':
      return 'Word -> Meaning'
    case 'meaning_to_word':
      return 'Meaning -> Word'
    case 'example_blank':
      return 'Example Blank'
    case 'typing':
      return 'Type the Word'
    default:
      return mode
  }
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function QuizContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const levelParam = searchParams.get('level')
  const inputRef = useRef<HTMLInputElement>(null)

  const [selectedLevel, setSelectedLevel] = useState<number | null>(
    levelParam ? Number(levelParam) : 1
  )
  const [quizMode, setQuizMode] = useState<QuizMode>('word_to_meaning')
  const [wordFilter, setWordFilter] = useState<QuizWordFilter>('all')
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const [answers, setAnswers] = useState<{ display: string; chosen: string; correct: string; ok: boolean }[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveError, setSaveError] = useState('')
  const [recentAttempts, setRecentAttempts] = useState<QuizAttemptRow[]>([])
  const [attemptsLoading, setAttemptsLoading] = useState(false)
  const [learningIds, setLearningIds] = useState<number[]>([])
  const [progressLoading, setProgressLoading] = useState(false)

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const loadProgress = async () => {
      setProgressLoading(true)
      const result = await getUserProgress(user.id)
      if (cancelled) return
      if (!result.error) {
        setLearningIds(
          result.data
            .filter((row) => row.item_type === 'vocab' && row.status === 'learning')
            .map((row) => row.item_id)
        )
      }
      setProgressLoading(false)
    }

    void loadProgress()

    return () => {
      cancelled = true
    }
  }, [user])

  const filteredWords = useMemo(() => {
    if (wordFilter !== 'learning') return vocabData
    const idSet = new Set(learningIds)
    return vocabData.filter((item) => item.id != null && idSet.has(item.id))
  }, [learningIds, wordFilter])

  const pool = useMemo(
    () => (selectedLevel ? filteredWords.filter((v) => v.level === selectedLevel) : filteredWords),
    [filteredWords, selectedLevel]
  )

  const totalQuestions = questions?.length ?? DEFAULT_QUIZ_SIZE

  useEffect(() => {
    if (!user || !finished) return

    let cancelled = false

    const loadRecent = async () => {
      setAttemptsLoading(true)
      const result = await getUserRecentQuizAttempts(user.id, 5)
      if (cancelled) return
      if (!result.error) {
        setRecentAttempts(result.data)
      }
      setAttemptsLoading(false)
    }

    void loadRecent()

    return () => {
      cancelled = true
    }
  }, [finished, user])

  const generateQuiz = () => {
    if (pool.length < 4) return
    const picked = shuffle(pool).slice(0, DEFAULT_QUIZ_SIZE)

    const qs: Question[] = picked.map((item) => {
      if (quizMode === 'typing') {
        return {
          type: 'typing',
          meaning: item.meaning,
          pos: item.pos,
          level: item.level,
          example_kr: blankWordInExample(item.example_kr, item.word) || item.example_kr,
          correct: item.word,
        } satisfies TypeQuestion
      }

      if (quizMode === 'word_to_meaning') {
        const distractors = shuffle(pool.filter((v) => v.word !== item.word)).slice(0, 3)
        return {
          type: 'word_to_meaning',
          prompt: item.word,
          secondary: item.romanization,
          level: item.level,
          correct: item.meaning,
          choices: shuffle([item.meaning, ...distractors.map((d) => d.meaning)]),
          speechText: item.word,
        } satisfies ChoiceQuestion
      }

      if (quizMode === 'meaning_to_word') {
        const distractors = shuffle(pool.filter((v) => v.word !== item.word)).slice(0, 3)
        return {
          type: 'meaning_to_word',
          prompt: item.meaning,
          secondary: item.pos,
          level: item.level,
          correct: item.word,
          choices: shuffle([item.word, ...distractors.map((d) => d.word)]),
        } satisfies ChoiceQuestion
      }

      const distractors = shuffle(pool.filter((v) => v.word !== item.word)).slice(0, 3)
      return {
        type: 'example_blank',
        prompt: blankWordInExample(item.example_kr, item.word) || item.example_kr,
        secondary: item.example_en,
        level: item.level,
        correct: item.word,
        choices: shuffle([item.word, ...distractors.map((d) => d.word)]),
      } satisfies ChoiceQuestion
    })

    setQuestions(qs)
    setQIndex(0)
    setSelected(null)
    setTyped('')
    setSubmitted(false)
    setScore(0)
    setFinished(false)
    setAnswers([])
    setSaveStatus('idle')
    setSaveError('')
  }

  const startQuizWithQuestions = (nextQuestions: Question[]) => {
    setQuestions(nextQuestions)
    setQIndex(0)
    setSelected(null)
    setTyped('')
    setSubmitted(false)
    setScore(0)
    setFinished(false)
    setAnswers([])
    setSaveStatus('idle')
    setSaveError('')
  }

  const handleLevelChange = (lvl: number | null) => {
    setSelectedLevel(lvl)
    setQuestions(null)
    const params = new URLSearchParams()
    if (lvl) params.set('level', String(lvl))
    router.replace(`/quiz?${params}`)
  }

  const advance = (ok: boolean, chosen: string, correct: string, display: string) => {
    if (ok) setScore((s) => s + 1)
    setAnswers((prev) => [...prev, { display, chosen, correct, ok }])
    setTimeout(() => {
      if (qIndex + 1 >= totalQuestions) {
        setFinished(true)
      } else {
        setQIndex((i) => i + 1)
        setSelected(null)
        setTyped('')
        setSubmitted(false)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }, 1000)
  }

  const handleChoiceAnswer = (choice: string) => {
    if (selected) return
    const q = questions![qIndex] as ChoiceQuestion
    setSelected(choice)
    advance(choice === q.correct, choice, q.correct, q.prompt)
  }

  const handleTypingSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (submitted) return
    const q = questions![qIndex] as TypeQuestion
    const ok = isCorrectTyping(typed, q.correct)
    setSubmitted(true)
    advance(ok, typed, q.correct, q.meaning)
  }

  const handleSaveAttempt = async () => {
    if (!user || !finished || saveStatus !== 'idle') return

    setSaveStatus('saving')
    setSaveError('')

    const result = await saveQuizAttempt({
      userId: user.id,
      level: selectedLevel,
      quizMode,
      score,
      totalQuestions,
    })

    if (result.error) {
      setSaveStatus('idle')
      setSaveError(result.error)
      return
    }

    setSaveStatus('saved')
    const recentResult = await getUserRecentQuizAttempts(user.id, 5)
    if (!recentResult.error) {
      setRecentAttempts(recentResult.data)
    }
  }

  if (!questions) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-black text-text mb-2">Quiz</h1>
        <p className="text-text-subtle mb-8">Mix up your vocabulary practice with different question types.</p>

        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => handleLevelChange(l)}
              className={`px-4 py-2 text-sm rounded-xl font-medium transition-colors ${
                selectedLevel === l
                  ? 'text-white'
                  : 'bg-card-surface text-text-subtle hover:bg-border hover:text-text'
              }`}
              style={selectedLevel === l ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
            >
              Level {l}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {(
            [
              ['word_to_meaning', 'Word -> Meaning'],
              ['meaning_to_word', 'Meaning -> Word'],
              ['example_blank', 'Example Blank'],
              ['typing', 'Type the Word'],
            ] as [QuizMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setQuizMode(mode)}
              className={`px-4 py-3 text-sm font-semibold rounded-2xl border transition-colors ${
                quizMode === mode
                  ? 'text-white border-transparent'
                  : 'bg-card text-text-subtle border-border hover:text-text hover:border-border-hover'
              }`}
              style={quizMode === mode ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {(
            [
              ['all', 'All Words', 'Use the full vocabulary pool.'],
              ['learning', 'Learning Only', 'Practice only words marked as learning.'],
            ] as [QuizWordFilter, string, string][]
          ).map(([mode, label, description]) => (
            <button
              key={mode}
              onClick={() => setWordFilter(mode)}
              className={`px-4 py-4 text-left rounded-2xl border transition-colors ${
                wordFilter === mode
                  ? 'text-white border-transparent'
                  : 'bg-card text-text-subtle border-border hover:text-text hover:border-border-hover'
              }`}
              style={wordFilter === mode ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
            >
              <p className="font-semibold">{label}</p>
              <p className={`text-xs mt-1 ${wordFilter === mode ? 'text-white/85' : 'text-text-faint'}`}>
                {description}
              </p>
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 mb-8 text-left">
          <p className="text-text-muted text-sm">
            <span className="font-bold text-text">{DEFAULT_QUIZ_SIZE} questions</span> / {getModeLabel(quizMode)} /{' '}
            {selectedLevel ? `TOPIK Level ${selectedLevel}` : 'All levels'}
          </p>
          <p className="text-text-faint text-xs mt-2">
            Pool: {pool.length.toLocaleString()} words
            {wordFilter === 'learning' ? ' / Learning only' : ''}
          </p>
          {wordFilter === 'learning' && !user ? (
            <p className="text-coral text-xs mt-2">Log in to use the Learning Only quiz filter.</p>
          ) : null}
          {wordFilter === 'learning' && user && progressLoading ? (
            <p className="text-text-faint text-xs mt-2">Loading your learning list...</p>
          ) : null}
          {wordFilter === 'learning' && user && !progressLoading && pool.length < 4 ? (
            <p className="text-coral text-xs mt-2">Mark at least 4 vocabulary words as learning to start this mode.</p>
          ) : null}
        </div>

        <button
          onClick={generateQuiz}
          disabled={pool.length < 4 || (wordFilter === 'learning' && (!user || progressLoading))}
          className="btn-coral px-8 py-3 rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Start Quiz
        </button>
      </div>
    )
  }

  if (finished) {
    const wrongQuestions = questions.filter((_, index) => !answers[index]?.ok)
    const pct = Math.round((score / totalQuestions) * 100)
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div
            className="text-6xl font-black mb-2"
            style={{ background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            {score}/{totalQuestions}
          </div>
          <div className={`text-xl font-bold mb-4 ${pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-coral'}`}>
            {pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good work!' : 'Keep studying!'}
          </div>
          <p className="text-text-subtle">{pct}% correct</p>
        </div>

        <div className="space-y-2 mb-8">
          {answers.map(({ display, chosen, correct, ok }, i) => (
            <div
              key={i}
              className="p-3 rounded-xl text-sm border"
              style={ok
                ? { background: 'var(--t-result-ok-bg)', borderColor: 'var(--t-result-ok-border)' }
                : { background: 'var(--t-result-err-bg)', borderColor: 'var(--t-result-err-border)' }
              }
            >
              <div className="flex items-center gap-3">
                <span className={ok ? 'text-emerald-500' : 'text-coral'}>{ok ? 'O' : 'X'}</span>
                <span className="font-bold text-text">{display}</span>
                {!ok && (
                  <span className="text-text-subtle text-xs ml-auto">
                    {chosen ? `You: ${chosen}` : 'No answer'} / Answer: {correct}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 mb-8">
          {user ? (
            <>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-text">Save this quiz result</p>
                  <p className="text-sm text-text-subtle">Keep a record of your score and recent quiz history.</p>
                </div>
                <button
                  onClick={handleSaveAttempt}
                  disabled={saveStatus !== 'idle'}
                  className="btn-coral px-5 py-3 rounded-2xl text-sm disabled:opacity-40"
                >
                  {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save Result'}
                </button>
              </div>
              {saveError ? <p className="text-sm text-coral mt-3">{saveError}</p> : null}
              {saveStatus === 'saved' ? <p className="text-sm text-emerald-400 mt-3">Quiz result saved.</p> : null}
            </>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-text">Log in to save quiz history</p>
                <p className="text-sm text-text-subtle">Your recent quiz attempts will show up here after saving.</p>
              </div>
              <Link href="/auth" className="btn-coral px-5 py-3 rounded-2xl text-sm text-center">
                Log In
              </Link>
            </div>
          )}

          {user ? (
            <div className="mt-5">
              <p className="text-xs uppercase tracking-wide text-text-subtle mb-3">Recent Quiz Attempts</p>
              {attemptsLoading ? (
                <p className="text-sm text-text-faint">Loading recent attempts...</p>
              ) : recentAttempts.length === 0 ? (
                <p className="text-sm text-text-faint">Your saved quiz history will appear here.</p>
              ) : (
                <div className="space-y-3">
                  {recentAttempts.map((attempt) => (
                    <div key={attempt.id} className="bg-card-surface border border-border rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-text">
                            {attempt.score}/{attempt.total_questions} / {attempt.correct_pct}%
                          </p>
                          <p className="text-sm text-text-muted mt-1">
                            {getModeLabel(attempt.quiz_mode)} / {attempt.level ? `TOPIK ${attempt.level}` : 'All levels'}
                          </p>
                        </div>
                        <p className="text-xs text-text-faint shrink-0">{formatTimestamp(attempt.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex gap-3 justify-center">
          <button onClick={generateQuiz} className="btn-coral px-6 py-2 rounded-xl">
            Try Again
          </button>
          {wrongQuestions.length > 0 ? (
            <button
              onClick={() => startQuizWithQuestions(wrongQuestions)}
              className="btn-ghost px-6 py-2 rounded-xl"
            >
              Retry Wrong Answers
            </button>
          ) : null}
          <button onClick={() => setQuestions(null)} className="btn-ghost px-6 py-2 rounded-xl">
            Change Settings
          </button>
        </div>
      </div>
    )
  }

  const q = questions[qIndex]

  if (q.type !== 'typing') {
    const showTTS = q.type === 'word_to_meaning' && q.speechText

    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <QuizHeader qIndex={qIndex} score={score} level={q.level} totalQuestions={totalQuestions} />

        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3">
            <p className="text-4xl sm:text-5xl font-black text-text">{q.prompt}</p>
            {showTTS ? <TTSButton text={q.speechText!} size="md" /> : null}
          </div>
          {q.secondary ? <p className="text-text-muted text-lg mt-2">{q.secondary}</p> : null}
          <p className="text-text-subtle text-sm mt-3">
            {q.type === 'word_to_meaning'
              ? 'What does this mean?'
              : q.type === 'meaning_to_word'
                ? 'Which Korean word matches this meaning?'
                : 'Which word best completes the sentence?'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {q.choices.map((choice) => {
            let cls = 'bg-card border border-border text-text-muted hover:border-border-hover hover:text-text'
            let style: React.CSSProperties = {}
            if (selected) {
              if (choice === q.correct) {
                cls = 'border text-emerald-700 dark:text-emerald-200'
                style = { background: 'var(--t-result-ok-bg)', borderColor: 'var(--t-result-ok-border)' }
              } else if (choice === selected) {
                cls = 'border text-coral-light'
                style = { background: 'var(--t-result-err-bg)', borderColor: 'var(--t-result-err-border)' }
              } else {
                cls = 'bg-card border border-border text-text-faint opacity-50'
              }
            }
            return (
              <button
                key={choice}
                onClick={() => handleChoiceAnswer(choice)}
                disabled={!!selected}
                className={`w-full text-left px-5 py-3.5 rounded-xl font-medium transition-colors ${cls}`}
                style={style}
              >
                {choice}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const isOk = submitted ? isCorrectTyping(typed, q.correct) : null

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <QuizHeader qIndex={qIndex} score={score} level={q.level} totalQuestions={totalQuestions} />

      <div className="text-center mb-8">
        <p className="text-3xl font-black text-text mb-2">{q.meaning}</p>
        <p className="text-text-subtle text-sm">{q.pos}</p>
        {q.example_kr && (
          <p className="text-text-muted text-sm mt-3 italic">{q.example_kr}</p>
        )}
        <p className="text-text-faint text-xs mt-4">Type the Korean word</p>
      </div>

      <form onSubmit={handleTypingSubmit} className="space-y-4">
        <input
          ref={inputRef}
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={submitted}
          autoFocus
          placeholder="Korean word..."
          className="w-full px-5 py-4 text-xl text-center rounded-xl border bg-card text-text placeholder-text-faint focus:outline-none transition-colors"
          style={submitted
            ? isOk
              ? { borderColor: '#22c55e', background: 'var(--t-result-ok-bg)' }
              : { borderColor: 'var(--t-input-wrong-border)', background: 'var(--t-input-wrong-bg)' }
            : undefined
          }
        />

        {submitted && !isOk && (
          <div className="text-center">
            <p className="text-coral text-sm">Incorrect</p>
            <div className="flex items-center justify-center gap-2 mt-1">
              <p className="text-emerald-400 font-bold">{q.correct}</p>
              <TTSButton text={q.correct} />
            </div>
          </div>
        )}
        {submitted && isOk && (
          <p className="text-center text-emerald-400 text-sm font-bold">Correct!</p>
        )}

        {!submitted && (
          <button
            type="submit"
            disabled={!typed.trim()}
            className="btn-coral w-full py-3 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Check
          </button>
        )}
      </form>
    </div>
  )
}

function QuizHeader({ qIndex, score, level, totalQuestions }: { qIndex: number; score: number; level: number; totalQuestions: number }) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <LevelBadge level={level} />
          <span className="text-text-subtle text-sm">{qIndex + 1} / {totalQuestions}</span>
        </div>
        <span className="text-text-subtle text-sm">Score: {score}</span>
      </div>
      <div className="w-full h-1 bg-card-surface rounded-full mb-8">
        <div
          className="h-1 rounded-full transition-all"
          style={{
            width: `${((qIndex + 1) / totalQuestions) * 100}%`,
            background: 'linear-gradient(90deg, #FF6B6B, #FF8E9E)',
          }}
        />
      </div>
    </>
  )
}

export default function QuizPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-text-faint">Loading...</div>}>
      <QuizContent />
    </Suspense>
  )
}
