'use client'

import React, { useState, useMemo, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { vocabData } from '@/lib/data'
import LevelBadge from '@/components/LevelBadge'
import TTSButton from '@/components/TTSButton'

const LEVELS    = [1, 2, 3, 4, 5, 6]
const QUIZ_SIZE = 10

type QuizMode = 'multiple' | 'typing'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Multiple-choice question ─────────────────────────────────────────────────
interface MCQuestion {
  type: 'multiple'
  word: string
  romanization: string
  level: number
  correct: string
  choices: string[]
}

// ── Typing question ──────────────────────────────────────────────────────────
interface TypeQuestion {
  type: 'typing'
  meaning: string
  pos: string
  level: number
  example_kr: string
  correct: string   // Korean word
}

type Question = MCQuestion | TypeQuestion

// ── Helpers ──────────────────────────────────────────────────────────────────
function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function isCorrectTyping(input: string, correct: string) {
  const userNorm = normalize(input)
  const answers  = correct.split('/').map((p) => normalize(p.trim()))
  return answers.some((a) => a === userNorm)
}

// ── Quiz Content ─────────────────────────────────────────────────────────────
function QuizContent() {
  const searchParams  = useSearchParams()
  const router        = useRouter()
  const levelParam    = searchParams.get('level')
  const inputRef      = useRef<HTMLInputElement>(null)

  const [selectedLevel, setSelectedLevel] = useState<number | null>(
    levelParam ? Number(levelParam) : 1
  )
  const [quizMode, setQuizMode]   = useState<QuizMode>('multiple')
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [qIndex, setQIndex]       = useState(0)
  const [selected, setSelected]   = useState<string | null>(null)   // MC
  const [typed, setTyped]         = useState('')                     // typing
  const [submitted, setSubmitted] = useState(false)                  // typing
  const [score, setScore]         = useState(0)
  const [finished, setFinished]   = useState(false)
  const [answers, setAnswers]     = useState<{ display: string; chosen: string; correct: string; ok: boolean }[]>([])

  const pool = useMemo(
    () => (selectedLevel ? vocabData.filter((v) => v.level === selectedLevel) : vocabData),
    [selectedLevel]
  )

  const generateQuiz = useCallback(() => {
    if (pool.length < 4) return
    const picked = shuffle(pool).slice(0, QUIZ_SIZE)

    let qs: Question[]
    if (quizMode === 'multiple') {
      qs = picked.map((item) => {
        const distractors = shuffle(pool.filter((v) => v.word !== item.word)).slice(0, 3)
        const choices = shuffle([item.meaning, ...distractors.map((d) => d.meaning)])
        return {
          type:         'multiple',
          word:         item.word,
          romanization: item.romanization,
          level:        item.level,
          correct:      item.meaning,
          choices,
        } satisfies MCQuestion
      })
    } else {
      qs = picked.map((item) => ({
        type:       'typing',
        meaning:    item.meaning,
        pos:        item.pos,
        level:      item.level,
        example_kr: item.example_kr,
        correct:    item.word,
      } satisfies TypeQuestion))
    }

    setQuestions(qs)
    setQIndex(0)
    setSelected(null)
    setTyped('')
    setSubmitted(false)
    setScore(0)
    setFinished(false)
    setAnswers([])
  }, [pool, quizMode])

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
      if (qIndex + 1 >= QUIZ_SIZE) {
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

  // MC answer handler
  const handleMCAnswer = (choice: string) => {
    if (selected) return
    const q = questions![qIndex] as MCQuestion
    setSelected(choice)
    advance(choice === q.correct, choice, q.correct, q.word)
  }

  // Typing submit handler
  const handleTypingSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (submitted) return
    const q = questions![qIndex] as TypeQuestion
    const ok = isCorrectTyping(typed, q.correct)
    setSubmitted(true)
    advance(ok, typed, q.correct, q.meaning)
  }

  // ── Setup screen ─────────────────────────────────────────────────────────
  if (!questions) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-black text-text mb-2">Quiz</h1>
        <p className="text-text-subtle mb-8">Test your vocabulary knowledge</p>

        {/* Level selector */}
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

        {/* Mode selector */}
        <div className="flex bg-card rounded-xl p-1 mb-6 max-w-xs mx-auto border border-border">
          {([['multiple', 'Multiple Choice'], ['typing', 'Type the Word']] as [QuizMode, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setQuizMode(m)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                quizMode === m
                  ? 'text-white'
                  : 'text-text-subtle hover:text-text-muted'
              }`}
              style={quizMode === m ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 mb-8 text-left">
          <p className="text-text-muted text-sm">
            <span className="font-bold text-text">{QUIZ_SIZE} questions</span> ·{' '}
            {quizMode === 'multiple' ? 'Multiple choice' : 'Type the Korean word'} ·{' '}
            {selectedLevel ? `TOPIK Level ${selectedLevel}` : 'All levels'}
          </p>
          <p className="text-text-faint text-xs mt-2">Pool: {pool.length.toLocaleString()} words</p>
        </div>

        <button
          onClick={generateQuiz}
          disabled={pool.length < 4}
          className="btn-coral px-8 py-3 rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Start Quiz →
        </button>
      </div>
    )
  }

  // ── Results screen ────────────────────────────────────────────────────────
  if (finished) {
    const pct = Math.round((score / QUIZ_SIZE) * 100)
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div
            className="text-6xl font-black mb-2"
            style={{ background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            {score}/{QUIZ_SIZE}
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
                <span className={ok ? 'text-emerald-500' : 'text-coral'}>{ok ? '✓' : '✗'}</span>
                <span className="font-bold text-text">{display}</span>
                {!ok && (
                  <span className="text-text-subtle text-xs ml-auto">
                    {chosen ? `You: ${chosen}` : 'No answer'} → {correct}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 justify-center">
          <button onClick={generateQuiz} className="btn-coral px-6 py-2 rounded-xl">
            Try Again
          </button>
          <button onClick={() => setQuestions(null)} className="btn-ghost px-6 py-2 rounded-xl">
            Change Settings
          </button>
        </div>
      </div>
    )
  }

  const q = questions[qIndex]

  // ── Multiple-choice screen ────────────────────────────────────────────────
  if (q.type === 'multiple') {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <QuizHeader qIndex={qIndex} score={score} level={q.level} />

        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3">
            <p className="text-6xl font-black text-text">{q.word}</p>
            <TTSButton text={q.word} size="md" />
          </div>
          <p className="text-text-muted text-lg mt-2">{q.romanization}</p>
          <p className="text-text-subtle text-sm mt-1">What does this mean?</p>
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
                onClick={() => handleMCAnswer(choice)}
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

  // ── Typing screen ─────────────────────────────────────────────────────────
  const isOk = submitted ? isCorrectTyping(typed, q.correct) : null

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <QuizHeader qIndex={qIndex} score={score} level={q.level} />

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
            Check →
          </button>
        )}
      </form>
    </div>
  )
}

// ── Shared progress header ────────────────────────────────────────────────────
function QuizHeader({ qIndex, score, level }: { qIndex: number; score: number; level: number }) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <LevelBadge level={level} />
          <span className="text-text-subtle text-sm">{qIndex + 1} / {QUIZ_SIZE}</span>
        </div>
        <span className="text-text-subtle text-sm">Score: {score}</span>
      </div>
      <div className="w-full h-1 bg-card-surface rounded-full mb-8">
        <div
          className="h-1 rounded-full transition-all"
          style={{
            width: `${((qIndex + 1) / QUIZ_SIZE) * 100}%`,
            background: 'linear-gradient(90deg, #FF6B6B, #FF8E9E)',
          }}
        />
      </div>
    </>
  )
}

// ── Page wrapper ──────────────────────────────────────────────────────────────
export default function QuizPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-text-faint">Loading...</div>}>
      <QuizContent />
    </Suspense>
  )
}
