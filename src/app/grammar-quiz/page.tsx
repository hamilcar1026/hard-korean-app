'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import LevelBadge from '@/components/LevelBadge'
import TTSButton from '@/components/TTSButton'
import { useAuth } from '@/contexts/AuthContext'
import { grammarData } from '@/lib/data'
import { getUserRecentQuizAttempts, saveQuizAttempt } from '@/lib/quiz'
import type { GrammarItem, QuizAttemptRow } from '@/types'

const LEVELS = [1, 2, 3, 4, 5, 6]
const QUESTION_COUNT = 10

type GrammarQuizMode = 'form_to_meaning' | 'meaning_to_form' | 'example_blank'

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
  usedForm?: string
  exampleEnglish?: string
}

type AnswerResult = {
  chosen: string
  correct: string
  ok: boolean
}

type StartQuizOptions = {
  resetUsed?: boolean
}

function isGrammarQuizMode(mode?: string | null) {
  return typeof mode === 'string' && mode.startsWith('grammar_')
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
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

function getMeaningTokens(text: string) {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z\s-]/g, ' ')
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter(
      (token) =>
        ![
          'used',
          'to',
          'show',
          'mean',
          'means',
          'marker',
          'form',
          'after',
          'before',
          'the',
          'a',
          'an',
          'or',
          'and',
          'of',
          'in',
          'on',
        ].includes(token)
    )
}

function meaningsOverlap(a: string, b: string) {
  const tokensA = new Set(getMeaningTokens(a))
  const tokensB = new Set(getMeaningTokens(b))

  for (const token of tokensA) {
    if (tokensB.has(token)) return true
  }

  return false
}

function getModeLabel(mode: GrammarQuizMode) {
  switch (mode) {
    case 'form_to_meaning':
      return 'Grammar -> Meaning'
    case 'meaning_to_form':
      return 'Meaning -> Grammar'
    case 'example_blank':
      return 'Example Blank'
    default:
      return mode
  }
}

function getShortExplanation(question: GrammarQuestion) {
  if (question.mode === 'example_blank' && question.usedForm) {
    if (question.usedForm === question.form) {
      return `Correct form: ${question.usedForm}.`
    }
    return `Correct form: ${question.usedForm} (${question.form}).`
  }

  if (question.mode === 'meaning_to_form') {
    return `The matching grammar form is ${question.form}.`
  }

  return `This grammar means: ${question.meaning}.`
}

function getExampleParts(example: string) {
  const match = example.match(/^(.*)\s+\((.*)\)\s*$/)
  if (!match) {
    return { korean: example.trim(), english: '' }
  }

  return {
    korean: match[1].trim(),
    english: match[2].trim(),
  }
}

function getFormVariants(form: string) {
  return form
    .split(/[\/,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/[0-9]/g, '').replace(/^-+/, '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
}

function makeBlankQuestionData(item: GrammarItem) {
  const firstExample = item.examples[0]
  if (!firstExample) return null

  const { korean, english } = getExampleParts(firstExample)
  if (!korean) return null

  for (const variant of getFormVariants(item.form)) {
    if (korean.includes(variant)) {
      return {
        blankedKorean: korean.replace(variant, '_____'),
        usedForm: variant,
        english,
      }
    }
  }

  return null
}

function buildQuestion(item: GrammarItem, pool: GrammarItem[], mode: GrammarQuizMode): GrammarQuestion {
  if (mode === 'example_blank') {
    const blankData = makeBlankQuestionData(item)
    if (!blankData) {
      return buildQuestion(item, pool, 'meaning_to_form')
    }

    const blankablePool = pool
      .map((entry) => {
        const data = makeBlankQuestionData(entry)
        if (!data || entry.id === item.id) return null
        return { entry, usedForm: data.usedForm }
      })
      .filter((entry): entry is { entry: GrammarItem; usedForm: string } => Boolean(entry))

    const distractors = uniqueBy(
      blankablePool.filter((entry) => !meaningsOverlap(entry.entry.meaning, item.meaning)),
      (entry) => entry.usedForm
    )
      .slice(0, 3)
      .map((entry) => entry.usedForm)

    return {
      itemId: item.id ?? 0,
      level: item.level,
      category: item.category,
      form: item.form,
      meaning: item.meaning,
      related: item.related,
      conjugationRule: item.conjugation_rule,
      examples: item.examples,
      prompt: blankData.blankedKorean,
      secondary: blankData.english || item.meaning,
      correct: blankData.usedForm,
      choices: shuffle(uniqueBy([blankData.usedForm, ...distractors], (value) => value)),
      mode,
      usedForm: blankData.usedForm,
      exampleEnglish: blankData.english,
    }
  }

  if (mode === 'form_to_meaning') {
    const distractors = uniqueBy(
      shuffle(
        pool.filter(
          (entry) => entry.id !== item.id && !meaningsOverlap(entry.meaning, item.meaning)
        )
      ),
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
  const { user } = useAuth()
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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const [recentAttempts, setRecentAttempts] = useState<QuizAttemptRow[]>([])
  const [attemptsLoading, setAttemptsLoading] = useState(false)
  const [usedQuestionIds, setUsedQuestionIds] = useState<number[]>([])

  const levelPool = useMemo(
    () => (selectedLevel ? grammarData.filter((item) => item.level === selectedLevel) : grammarData),
    [selectedLevel]
  )
  const blankPool = useMemo(
    () => levelPool.filter((item) => makeBlankQuestionData(item)),
    [levelPool]
  )
  const pool = quizMode === 'example_blank' ? blankPool : levelPool

  const current = questions?.[qIndex] ?? null
  const totalQuestions = questions?.length ?? QUESTION_COUNT
  const currentResult = submitted ? answers[qIndex] : null
  const usedQuestionIdSet = useMemo(() => new Set(usedQuestionIds), [usedQuestionIds])
  const remainingPool = useMemo(
    () => pool.filter((item) => item.id && !usedQuestionIdSet.has(item.id)),
    [pool, usedQuestionIdSet]
  )
  const remainingCount = remainingPool.length
  const grammarRecentAttempts = useMemo(
    () => recentAttempts.filter((attempt) => isGrammarQuizMode(attempt.quiz_mode)),
    [recentAttempts]
  )

  const startQuiz = (options: StartQuizOptions = {}) => {
    if (pool.length < 4) return
    const basePool = options.resetUsed ? pool : remainingPool
    const sourcePool = basePool.length > 0 ? basePool : pool
    const picked = shuffle(sourcePool).slice(0, Math.min(QUESTION_COUNT, sourcePool.length))
    const nextQuestions = picked.map((item) => buildQuestion(item, pool, quizMode))
    const pickedIds = picked.map((item) => item.id).filter((id): id is number => typeof id === 'number')

    setQuestions(nextQuestions)
    setUsedQuestionIds((prev) => {
      const next = options.resetUsed ? new Set<number>() : new Set(prev)
      pickedIds.forEach((id) => next.add(id))
      return [...next]
    })
    setQIndex(0)
    setSelected(null)
    setSubmitted(false)
    setScore(0)
    setFinished(false)
    setAnswers([])
    setSaveStatus('idle')
    setSaveError('')
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

  const retryWrongAnswers = () => {
    if (!questions || answers.length === 0) return
    const wrongQuestions = questions.filter((_, index) => answers[index] && !answers[index].ok)
    if (wrongQuestions.length === 0) return

    setQuestions(wrongQuestions)
    setQIndex(0)
    setSelected(null)
    setSubmitted(false)
    setScore(0)
    setFinished(false)
    setAnswers([])
    setSaveStatus('idle')
    setSaveError('')
  }

  const handleLevelChange = (level: number | null) => {
    setSelectedLevel(level)
    setQuestions(null)
    setQIndex(0)
    setSelected(null)
    setSubmitted(false)
    setFinished(false)
    setAnswers([])
    setSaveStatus('idle')
    setSaveError('')
    setUsedQuestionIds([])
    const params = new URLSearchParams()
    if (level) params.set('level', String(level))
    router.replace(`/grammar-quiz?${params}`)
  }

  useEffect(() => {
    if (!finished || !questions || !user || saveStatus !== 'idle') return

    let cancelled = false

    const saveResult = async () => {
      setSaveStatus('saving')
      const result = await saveQuizAttempt({
        userId: user.id,
        level: selectedLevel,
        quizMode: `grammar_${quizMode}`,
        score,
        totalQuestions,
      })

      if (cancelled) return

      if (result.error) {
        setSaveError(result.error)
        setSaveStatus('error')
        return
      }

      setSaveStatus('saved')
      setSaveError('')
      setAttemptsLoading(true)
      const recentResult = await getUserRecentQuizAttempts(user.id, 8)
      if (cancelled) return
      if (!recentResult.error) {
        setRecentAttempts(recentResult.data)
      }
      setAttemptsLoading(false)
    }

    void saveResult()

    return () => {
      cancelled = true
    }
  }, [finished, questions, quizMode, saveStatus, score, selectedLevel, totalQuestions, user])

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
              ['example_blank', 'Example Blank'],
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
                setUsedQuestionIds([])
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
            {usedQuestionIds.length > 0 ? ` / ${remainingCount} left in this round` : ''}
          </div>
          <button
            onClick={() => startQuiz({ resetUsed: true })}
            disabled={pool.length < 4}
            className="btn-coral px-5 py-2 rounded-xl disabled:opacity-50"
          >
            {questions ? 'Restart From Beginning' : 'Start Quiz'}
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
              {current.mode === 'example_blank'
                ? 'Sentence'
                : current.mode === 'form_to_meaning'
                  ? 'Grammar Form'
                  : 'Meaning'}
            </p>
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                <h2 className="text-3xl sm:text-4xl font-black text-text break-words">
                  {current.prompt}
                </h2>
                {current.secondary && (
                  <p className="mt-2 text-text-subtle">
                    {current.mode === 'example_blank' ? current.secondary : current.secondary}
                  </p>
                )}
              </div>
              {(current.mode === 'form_to_meaning' || current.mode === 'example_blank') && (
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
                <p className="mb-4 text-sm text-text-subtle">{getShortExplanation(current)}</p>
                <div className="grid gap-2 text-sm text-text-subtle">
                  {current.usedForm && (
                    <p>
                      <span className="font-semibold text-text">Used here:</span> {current.usedForm}
                    </p>
                  )}
                  <p>
                    <span className="font-semibold text-text">Basic form:</span> {current.form}
                  </p>
                  <p>
                    <span className="font-semibold text-text">Meaning:</span> {current.meaning}
                  </p>
                  {current.mode !== 'example_blank' && current.conjugationRule && (
                    <p>
                      <span className="font-semibold text-text">Rule:</span>{' '}
                      {current.conjugationRule}
                    </p>
                  )}
                  {current.related && current.mode !== 'example_blank' ? (
                    <p>
                      <span className="font-semibold text-text">Related:</span> {current.related}
                    </p>
                  ) : null}
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
            {remainingCount > 0 ? ` ${remainingCount} grammar points are still unused in this round.` : ' You have covered every grammar point in this round.'}
          </p>

          {user ? (
            <div className="mb-6 rounded-2xl border border-border bg-card-surface px-4 py-3 text-sm text-text-subtle">
              {saveStatus === 'saving'
                ? 'Saving this grammar quiz result...'
                : saveStatus === 'saved'
                  ? 'Grammar quiz result saved.'
                  : saveError || 'Waiting to save your grammar quiz result.'}
            </div>
          ) : (
            <div className="mb-6 rounded-2xl border border-border bg-card-surface px-4 py-3 text-sm text-text-subtle">
              Log in if you want your grammar quiz results to appear in your dashboard.
            </div>
          )}

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
            {remainingCount > 0 ? (
              <button onClick={() => startQuiz()} className="btn-coral px-5 py-2 rounded-xl">
                Continue Remaining
              </button>
            ) : null}
            <button onClick={() => startQuiz({ resetUsed: true })} className={remainingCount > 0 ? 'btn-ghost px-5 py-2 rounded-xl' : 'btn-coral px-5 py-2 rounded-xl'}>
              Restart From Beginning
            </button>
            {answers.some((answer) => !answer.ok) ? (
              <button onClick={retryWrongAnswers} className="btn-ghost px-5 py-2 rounded-xl">
                Retry Wrong Answers
              </button>
            ) : null}
            <Link href={selectedLevel ? `/grammar?level=${selectedLevel}` : '/grammar'} className="btn-ghost px-5 py-2 rounded-xl">
              Study Grammar
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-text">Recent Grammar Quiz Saves</h3>
              <Link href="/dashboard" className="text-xs text-text-subtle hover:text-text transition-colors">
                Open dashboard
              </Link>
            </div>

            {user ? (
              attemptsLoading ? (
                <p className="text-sm text-text-faint">Loading grammar quiz history...</p>
              ) : grammarRecentAttempts.length === 0 ? (
                <p className="text-sm text-text-faint">Your saved grammar quiz runs will show up here.</p>
              ) : (
                grammarRecentAttempts.map((attempt) => (
                  <div key={attempt.id} className="rounded-2xl border border-border bg-card-surface px-4 py-3">
                    <p className="font-bold text-text">
                      {attempt.score}/{attempt.total_questions} / {attempt.correct_pct}%
                    </p>
                    <p className="text-sm text-text-muted mt-1">
                      {getModeLabel(
                        attempt.quiz_mode === 'grammar_form_to_meaning'
                          ? 'form_to_meaning'
                          : attempt.quiz_mode === 'grammar_example_blank'
                            ? 'example_blank'
                            : 'meaning_to_form'
                      )}{' '}
                      / {attempt.level ? `TOPIK ${attempt.level}` : 'All levels'}
                    </p>
                    <p className="text-xs text-text-faint mt-2">{formatTimestamp(attempt.created_at)}</p>
                  </div>
                ))
              )
            ) : null}
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
