'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import LevelBadge from '@/components/LevelBadge'
import TTSButton from '@/components/TTSButton'
import { grammarData } from '@/lib/data'
import type { GrammarItem } from '@/types'

const LEVELS = [1, 2, 3, 4, 5, 6]
const QUESTION_COUNT = 10

type GrammarQuizMode = 'form_to_meaning' | 'meaning_to_form'

type GrammarQuestion = {
  itemId: number
  level: number
  category: string
  form: string
  meaning: string
  related: string
  conjugationRule: string
  examples: string[]
  prompt: string
  secondary?: string
  correct: string
  choices: string[]
  mode: GrammarQuizMode
}

type AnswerResult = {
  chosen: string
  correct: string
  ok: boolean
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = getKey(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getModeLabel(mode: GrammarQuizMode) {
  return mode === 'form_to_meaning' ? 'Grammar -> Meaning' : 'Meaning -> Grammar'
}

function buildQuestion(item: GrammarItem, pool: GrammarItem[], mode: GrammarQuizMode): GrammarQuestion {
  if (mode === 'form_to_meaning') {
    const distractors = uniqueBy(
      shuffle(pool.filter((entry) => entry.id !== item.id)),
      (entry) => entry.meaning
    )
      .slice(0, 3)
      .map((entry) => entry.meaning)

    return {
      itemId: item.id ?? 0,
      level: item.level,
      category: item.category,
      form: item.form,
      meaning: item.meaning,
      related: item.related,
      conjugationRule: item.conjugation_rule,
      examples: item.examples,
      prompt: item.form,
      secondary: item.category,
      correct: item.meaning,
      choices: shuffle(uniqueBy([item.meaning, ...distractors], (value) => value)),
      mode,
    }
  }

  const distractors = uniqueBy(
    shuffle(pool.filter((entry) => entry.id !== item.id)),
    (entry) => entry.form
  )
    .slice(0, 3)
    .map((entry) => entry.form)

  return {
    itemId: item.id ?? 0,
    level: item.level,
    category: item.category,
    form: item.form,
    meaning: item.meaning,
    related: item.related,
    conjugationRule: item.conjugation_rule,
    examples: item.examples,
    prompt: item.meaning,
    secondary: item.category,
    correct: item.form,
    choices: shuffle(uniqueBy([item.form, ...distractors], (value) => value)),
    mode,
  }
}

function GrammarQuizContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const levelParam = searchParams.get('level')

  const [selectedLevel, setSelectedLevel] = useState<number | null>(
    levelParam ? Number(levelParam) : 1
  )
  const [quizMode, setQuizMode] = useState<GrammarQuizMode>('form_to_meaning')
  const [questions, setQuestions] = useState<GrammarQuestion[] | null>(null)
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const [answers, setAnswers] = useState<AnswerResult[]>([])

  const pool = useMemo(
    () => (selectedLevel ? grammarData.filter((item) => item.level === selectedLevel) : grammarData),
    [selectedLevel]
  )

  const current = questions?.[qIndex] ?? null
  const totalQuestions = questions?.length ?? QUESTION_COUNT
  const currentResult = submitted ? answers[qIndex] : null

  const startQuiz = () => {
    if (pool.length < 4) return
    const picked = shuffle(pool).slice(0, Math.min(QUESTION_COUNT, pool.length))
    const nextQuestions = picked.map((item) => buildQuestion(item, pool, quizMode))
    setQuestions(nextQuestions)
    setQIndex(0)
    setSelected(null)
    setSubmitted(false)
    setScore(0)
    setFinished(false)
    setAnswers([])
  }

  const handleSubmit = () => {
    if (!current || !selected || submitted) return
    const ok = selected === current.correct
    const result: AnswerResult = {
      chosen: selected,
      correct: current.correct,
      ok,
    }

    setSubmitted(true)
    setAnswers((prev) => {
      const next = [...prev]
      next[qIndex] = result
      return next
    })
    if (ok) setScore((prev) => prev + 1)
  }

  const handleNext = () => {
    if (!questions) return
    if (qIndex >= questions.length - 1) {
      setFinished(true)
      return
    }
    setQIndex((prev) => prev + 1)
    setSelected(null)
    setSubmitted(false)
  }

  const handleLevelChange = (level: number | null) => {
    setSelectedLevel(level)
    setQuestions(null)
    setQIndex(0)
    setSelected(null)
    setSubmitted(false)
    setFinished(false)
    setAnswers([])
    const params = new URLSearchParams()
    if (level) params.set('level', String(level))
    router.replace(`/grammar-quiz?${params}`)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-3xl font-black text-text mb-2">Grammar Quiz</h1>
          <p className="text-text-subtle max-w-2xl">
            Practice grammar with clear multiple-choice questions. This first version
            focuses on meaning and form matching so every answer stays unambiguous.
          </p>
        </div>
        <Link href="/grammar" className="btn-ghost px-4 py-2 rounded-xl">
          Back to Grammar
        </Link>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 mb-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => handleLevelChange(null)}
            className={`px-3 py-1 text-sm rounded-xl font-medium transition-colors ${
              selectedLevel === null
                ? 'text-white'
                : 'bg-card-surface text-text-subtle hover:bg-border hover:text-text'
            }`}
            style={selectedLevel === null ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
          >
            All
          </button>
          {LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => handleLevelChange(level)}
              className={`px-3 py-1 text-sm rounded-xl font-medium transition-colors ${
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

        <div className="flex flex-wrap gap-2 mb-4">
          {(
            [
              ['form_to_meaning', 'Grammar -> Meaning'],
              ['meaning_to_form', 'Meaning -> Grammar'],
            ] as [GrammarQuizMode, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setQuizMode(value)
                setQuestions(null)
                setQIndex(0)
                setSelected(null)
                setSubmitted(false)
                setFinished(false)
                setAnswers([])
              }}
              className={`px-3 py-1.5 text-sm rounded-xl font-medium transition-colors ${
                quizMode === value
                  ? 'text-white'
                  : 'bg-card-surface text-text-subtle hover:bg-border hover:text-text'
              }`}
              style={quizMode === value ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-text-subtle">
            {pool.length} grammar points
            {selectedLevel ? ` / TOPIK Level ${selectedLevel}` : ' / All levels'}
          </div>
          <button
            onClick={startQuiz}
            disabled={pool.length < 4}
            className="btn-coral px-5 py-2 rounded-xl disabled:opacity-50"
          >
            {questions ? 'Restart Quiz' : 'Start Quiz'}
          </button>
        </div>
      </div>

      {!questions && (
        <div className="bg-card border border-border rounded-2xl p-6 text-text-subtle">
          Start a grammar quiz to practice meaning and form matching. Each question has
          four choices and a short explanation after you answer.
        </div>
      )}

      {current && !finished && (
        <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
            <div className="flex items-center gap-3">
              <LevelBadge level={current.level} />
              <span className="text-sm text-text-subtle">{getModeLabel(current.mode)}</span>
            </div>
            <div className="text-sm text-text-subtle">
              Question {qIndex + 1} / {totalQuestions}
            </div>
          </div>

          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-faint mb-3">
              {current.mode === 'form_to_meaning' ? 'Grammar Form' : 'Meaning'}
            </p>
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                <h2 className="text-3xl sm:text-4xl font-black text-text break-words">
                  {current.prompt}
                </h2>
                {current.secondary && (
                  <p className="mt-2 text-text-subtle">{current.secondary}</p>
                )}
              </div>
              {current.mode === 'form_to_meaning' && (
                <TTSButton text={current.form} className="shrink-0" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {current.choices.map((choice) => {
              const isSelected = selected === choice
              const isCorrect = submitted && choice === current.correct
              const isWrong = submitted && isSelected && choice !== current.correct

              return (
                <button
                  key={choice}
                  onClick={() => !submitted && setSelected(choice)}
                  disabled={submitted}
                  className={`text-left rounded-2xl border px-4 py-3 transition-colors ${
                    isCorrect
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                      : isWrong
                        ? 'border-coral bg-rose-50 text-coral-dark'
                        : isSelected
                          ? 'border-coral bg-rose-50 text-text'
                          : 'border-border bg-card-surface text-text hover:border-border-hover'
                  }`}
                >
                  {choice}
                </button>
              )
            })}
          </div>

          {!submitted ? (
            <button
              onClick={handleSubmit}
              disabled={!selected}
              className="btn-coral px-5 py-2 rounded-xl disabled:opacity-50"
            >
              Check Answer
            </button>
          ) : (
            <div className="space-y-4">
              <div
                className={`rounded-2xl border px-4 py-4 ${
                  currentResult?.ok
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-rose-200 bg-rose-50'
                }`}
              >
                <p className="font-semibold text-text mb-2">
                  {currentResult?.ok ? 'Correct' : 'Not quite'}
                </p>
                <div className="grid gap-2 text-sm text-text-subtle">
                  <p>
                    <span className="font-semibold text-text">Grammar:</span> {current.form}
                  </p>
                  <p>
                    <span className="font-semibold text-text">Meaning:</span> {current.meaning}
                  </p>
                  {current.conjugationRule && (
                    <p>
                      <span className="font-semibold text-text">Rule:</span>{' '}
                      {current.conjugationRule}
                    </p>
                  )}
                  {current.related && (
                    <p>
                      <span className="font-semibold text-text">Related:</span> {current.related}
                    </p>
                  )}
                  {current.examples[0] && (
                    <p>
                      <span className="font-semibold text-text">Example:</span>{' '}
                      {current.examples[0]}
                    </p>
                  )}
                </div>
              </div>

              <button onClick={handleNext} className="btn-coral px-5 py-2 rounded-xl">
                {qIndex === totalQuestions - 1 ? 'See Results' : 'Next Question'}
              </button>
            </div>
          )}
        </div>
      )}

      {finished && questions && (
        <div className="bg-card border border-border rounded-3xl p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-text-faint font-semibold mb-2">
            Grammar Quiz Complete
          </p>
          <h2 className="text-3xl font-black text-text mb-2">
            {score} / {totalQuestions}
          </h2>
          <p className="text-text-subtle mb-6">
            You finished the {getModeLabel(quizMode)} set for
            {selectedLevel ? ` TOPIK ${selectedLevel}` : ' all levels'}.
          </p>

          <div className="grid gap-3 mb-6">
            {questions.map((question, index) => {
              const result = answers[index]
              if (!result) return null

              return (
                <div key={`${question.itemId}-${index}`} className="rounded-2xl border border-border bg-card-surface px-4 py-3">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-sm font-semibold text-text">Question {index + 1}</span>
                    <span className={`text-xs font-semibold ${result.ok ? 'text-emerald-600' : 'text-coral'}`}>
                      {result.ok ? 'Correct' : 'Wrong'}
                    </span>
                  </div>
                  <p className="text-text mb-1">{question.prompt}</p>
                  <p className="text-sm text-text-subtle">
                    Correct answer: {question.correct}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={startQuiz} className="btn-coral px-5 py-2 rounded-xl">
              Try Again
            </button>
            <Link href={selectedLevel ? `/grammar?level=${selectedLevel}` : '/grammar'} className="btn-ghost px-5 py-2 rounded-xl">
              Study Grammar
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default function GrammarQuizPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto px-4 py-8 text-text-subtle">Loading grammar quiz...</div>
      }
    >
      <GrammarQuizContent />
    </Suspense>
  )
}
