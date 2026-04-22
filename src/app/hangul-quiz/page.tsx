'use client'

import { useMemo, useState } from 'react'
import TTSButton from '@/components/TTSButton'

type JamoType = 'vowel' | 'consonant'
type JamoFilter = 'all' | JamoType
type QuizMode = 'hangul_to_roman' | 'roman_to_hangul'

type JamoItem = {
  hangul: string
  roman: string
  type: JamoType
  soundText: string
  note?: string
  acceptedAnswers?: string[]
}

const JAMO: JamoItem[] = [
  { hangul: 'ㅏ', roman: 'a', type: 'vowel', soundText: '아', acceptedAnswers: ['아'] },
  { hangul: 'ㅓ', roman: 'eo', type: 'vowel', soundText: '어', acceptedAnswers: ['어'] },
  { hangul: 'ㅗ', roman: 'o', type: 'vowel', soundText: '오', acceptedAnswers: ['오'] },
  { hangul: 'ㅜ', roman: 'u', type: 'vowel', soundText: '우', acceptedAnswers: ['우'] },
  { hangul: 'ㅡ', roman: 'eu', type: 'vowel', soundText: '으', acceptedAnswers: ['으'] },
  { hangul: 'ㅣ', roman: 'i', type: 'vowel', soundText: '이', acceptedAnswers: ['이'] },
  { hangul: 'ㅐ', roman: 'ae', type: 'vowel', soundText: '애', acceptedAnswers: ['애'] },
  { hangul: 'ㅔ', roman: 'e', type: 'vowel', soundText: '에', acceptedAnswers: ['에'] },
  { hangul: 'ㅚ', roman: 'oe', type: 'vowel', soundText: '외', acceptedAnswers: ['외'] },
  { hangul: 'ㅟ', roman: 'wi', type: 'vowel', soundText: '위', acceptedAnswers: ['위'] },
  { hangul: 'ㅑ', roman: 'ya', type: 'vowel', soundText: '야', acceptedAnswers: ['야'] },
  { hangul: 'ㅕ', roman: 'yeo', type: 'vowel', soundText: '여', acceptedAnswers: ['여'] },
  { hangul: 'ㅛ', roman: 'yo', type: 'vowel', soundText: '요', acceptedAnswers: ['요'] },
  { hangul: 'ㅠ', roman: 'yu', type: 'vowel', soundText: '유', acceptedAnswers: ['유'] },
  { hangul: 'ㅒ', roman: 'yae', type: 'vowel', soundText: '얘', acceptedAnswers: ['얘'] },
  { hangul: 'ㅖ', roman: 'ye', type: 'vowel', soundText: '예', acceptedAnswers: ['예'] },
  { hangul: 'ㅘ', roman: 'wa', type: 'vowel', soundText: '와', acceptedAnswers: ['와'] },
  { hangul: 'ㅙ', roman: 'wae', type: 'vowel', soundText: '왜', acceptedAnswers: ['왜'] },
  { hangul: 'ㅝ', roman: 'wo', type: 'vowel', soundText: '워', acceptedAnswers: ['워'] },
  { hangul: 'ㅞ', roman: 'we', type: 'vowel', soundText: '웨', acceptedAnswers: ['웨'] },
  { hangul: 'ㅢ', roman: 'ui', type: 'vowel', soundText: '의', acceptedAnswers: ['의'] },
  { hangul: 'ㄱ', roman: 'g/k', type: 'consonant', soundText: '가', note: 'sound sample: 가' },
  { hangul: 'ㄴ', roman: 'n', type: 'consonant', soundText: '나', note: 'sound sample: 나' },
  { hangul: 'ㄷ', roman: 'd/t', type: 'consonant', soundText: '다', note: 'sound sample: 다' },
  { hangul: 'ㄹ', roman: 'r/l', type: 'consonant', soundText: '라', note: 'sound sample: 라' },
  { hangul: 'ㅁ', roman: 'm', type: 'consonant', soundText: '마', note: 'sound sample: 마' },
  { hangul: 'ㅂ', roman: 'b/p', type: 'consonant', soundText: '바', note: 'sound sample: 바' },
  { hangul: 'ㅅ', roman: 's', type: 'consonant', soundText: '사', note: 'sound sample: 사' },
  { hangul: 'ㅇ', roman: 'ng / silent', type: 'consonant', soundText: '아', note: 'sound sample: 아' },
  { hangul: 'ㅈ', roman: 'j', type: 'consonant', soundText: '자', note: 'sound sample: 자' },
  { hangul: 'ㅊ', roman: 'ch', type: 'consonant', soundText: '차', note: 'sound sample: 차' },
  { hangul: 'ㅋ', roman: 'k', type: 'consonant', soundText: '카', note: 'sound sample: 카' },
  { hangul: 'ㅌ', roman: 't', type: 'consonant', soundText: '타', note: 'sound sample: 타' },
  { hangul: 'ㅍ', roman: 'p', type: 'consonant', soundText: '파', note: 'sound sample: 파' },
  { hangul: 'ㅎ', roman: 'h', type: 'consonant', soundText: '하', note: 'sound sample: 하' },
  { hangul: 'ㄲ', roman: 'kk', type: 'consonant', soundText: '까', note: 'sound sample: 까' },
  { hangul: 'ㄸ', roman: 'tt', type: 'consonant', soundText: '따', note: 'sound sample: 따' },
  { hangul: 'ㅃ', roman: 'pp', type: 'consonant', soundText: '빠', note: 'sound sample: 빠' },
  { hangul: 'ㅆ', roman: 'ss', type: 'consonant', soundText: '싸', note: 'sound sample: 싸' },
  { hangul: 'ㅉ', roman: 'jj', type: 'consonant', soundText: '짜', note: 'sound sample: 짜' },
]

function shuffle<T>(items: T[]) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function makeChoiceSet(correct: JamoItem, pool: JamoItem[]) {
  const distractors = shuffle(pool.filter((item) => item.hangul !== correct.hangul)).slice(0, 3)
  return shuffle([correct, ...distractors])
}

function makeInitialChoiceSet(correct: JamoItem, pool: JamoItem[]) {
  return [correct, ...pool.filter((item) => item.hangul !== correct.hangul).slice(0, 3)]
}

export default function HangulQuizPage() {
  const [filter, setFilter] = useState<JamoFilter>('all')
  const [mode, setMode] = useState<QuizMode>('hangul_to_roman')
  const [current, setCurrent] = useState(JAMO[0])
  const [choices, setChoices] = useState(() => makeInitialChoiceSet(JAMO[0], JAMO))
  const [typed, setTyped] = useState('')
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle')
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [chartOpen, setChartOpen] = useState(false)

  const pool = useMemo(() => (filter === 'all' ? JAMO : JAMO.filter((item) => item.type === filter)), [filter])

  const startNewQuestion = (nextPool = pool) => {
    const next = shuffle(nextPool)[0]
    setCurrent(next)
    setChoices(makeChoiceSet(next, nextPool))
    setTyped('')
    setFeedback('idle')
  }

  const updateFilter = (nextFilter: JamoFilter) => {
    const nextPool = nextFilter === 'all' ? JAMO : JAMO.filter((item) => item.type === nextFilter)
    setFilter(nextFilter)
    startNewQuestion(nextPool)
  }

  const answerChoice = (choice: JamoItem) => {
    if (feedback !== 'idle') return
    const ok = choice.hangul === current.hangul
    setFeedback(ok ? 'correct' : 'wrong')
    setScore((prev) => ({ correct: prev.correct + (ok ? 1 : 0), total: prev.total + 1 }))
  }

  const checkTyped = () => {
    if (feedback !== 'idle') return
    const normalizedTyped = typed.trim()
    const accepted = new Set([current.hangul, ...(current.acceptedAnswers ?? [])])
    const ok = accepted.has(normalizedTyped)
    setFeedback(ok ? 'correct' : 'wrong')
    setScore((prev) => ({ correct: prev.correct + (ok ? 1 : 0), total: prev.total + 1 }))
  }

  const resetScore = () => {
    setScore({ correct: 0, total: 0 })
    startNewQuestion()
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <section className="mb-8">
        <p className="text-xs sm:text-sm uppercase tracking-[0.28em] text-text-subtle mb-3">Hangul Trainer</p>
        <h1 className="text-3xl sm:text-5xl font-black text-text mb-3">Hangul Quiz</h1>
        <p className="text-text-subtle max-w-2xl">
          Practice Korean vowels and consonants by matching Hangul letters with romanized sounds, then reverse it by typing the Hangul.
        </p>
      </section>

      <section className="bg-card border border-border rounded-3xl p-5 sm:p-6 mb-6">
        <div className="flex flex-wrap gap-2 mb-5">
          {[
            ['all', 'All letters'],
            ['vowel', 'Vowels'],
            ['consonant', 'Consonants'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => updateFilter(value as JamoFilter)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                filter === value ? 'bg-coral text-white' : 'bg-card-surface text-text-muted hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setMode('hangul_to_roman')
              startNewQuestion()
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              mode === 'hangul_to_roman' ? 'bg-text text-white' : 'bg-card-surface text-text-muted hover:text-text'
            }`}
          >
            Hangul → Romanization
          </button>
          <button
            onClick={() => {
              setMode('roman_to_hangul')
              startNewQuestion()
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              mode === 'roman_to_hangul' ? 'bg-text text-white' : 'bg-card-surface text-text-muted hover:text-text'
            }`}
          >
            Romanization → Hangul
          </button>
        </div>
      </section>

      <section className="bg-card border border-border rounded-3xl p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-text-subtle mb-2">
              {current.type === 'vowel' ? 'Vowel' : 'Consonant'}
            </p>
            <div className="flex items-center gap-3">
              <h2 className="text-7xl sm:text-8xl font-black text-text">
                {mode === 'hangul_to_roman' ? current.hangul : current.roman}
              </h2>
              <TTSButton text={current.soundText} size="md" />
            </div>
            {current.note ? <p className="text-sm text-text-faint mt-3">{current.note}</p> : null}
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-text-subtle">Score</p>
            <p className="text-2xl font-black text-text">
              {score.correct}/{score.total}
            </p>
          </div>
        </div>

        {mode === 'hangul_to_roman' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {choices.map((choice) => {
              const isCorrect = feedback !== 'idle' && choice.hangul === current.hangul
              const isWrong = feedback === 'wrong' && choice.hangul !== current.hangul
              return (
                <button
                  key={choice.hangul}
                  onClick={() => answerChoice(choice)}
                  className={`text-left rounded-2xl border px-5 py-4 text-xl font-bold transition-colors ${
                    isCorrect
                      ? 'border-green-500 bg-green-50 text-green-800'
                      : isWrong
                        ? 'border-border bg-card-surface text-text-muted'
                        : 'border-border bg-card-surface text-text hover:border-coral'
                  }`}
                >
                  {choice.roman}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="max-w-md">
            <label htmlFor="hangul-answer" className="block text-sm font-bold text-text mb-2">
              Type the Hangul letter
            </label>
            <input
              id="hangul-answer"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') checkTyped()
              }}
              className="w-full rounded-2xl border border-border bg-card-surface px-5 py-4 text-3xl font-black text-text focus:outline-none focus:border-coral"
              placeholder="Type here"
              maxLength={2}
              disabled={feedback !== 'idle'}
            />
            <button onClick={checkTyped} className="btn-coral px-5 py-3 rounded-xl mt-4" disabled={feedback !== 'idle'}>
              Check
            </button>
          </div>
        )}

        {feedback !== 'idle' ? (
          <div
            className={`mt-6 rounded-2xl border px-5 py-4 ${
              feedback === 'correct' ? 'border-green-300 bg-green-50 text-green-900' : 'border-coral bg-pink-soft/30 text-text'
            }`}
          >
            <p className="font-black mb-1">{feedback === 'correct' ? 'Correct' : 'Not quite'}</p>
            <p>
              {current.hangul} = <span className="font-bold">{current.roman}</span>
            </p>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={() => startNewQuestion()} className="btn-coral px-5 py-2.5 rounded-xl">
                Next
              </button>
              <button onClick={resetScore} className="btn-ghost px-4 py-2.5 rounded-xl">
                Reset score
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-6 bg-card border border-border rounded-3xl p-5 sm:p-6">
        <button
          type="button"
          onClick={() => setChartOpen((open) => !open)}
          className="w-full flex items-center justify-between gap-4 text-left"
          aria-expanded={chartOpen}
        >
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-text-subtle mb-1">Hint</p>
            <h2 className="text-xl font-black text-text">Letter Chart</h2>
          </div>
          <span className="rounded-xl bg-card-surface px-4 py-2 text-sm font-bold text-text-muted">
            {chartOpen ? 'Hide chart' : 'Show chart'}
          </span>
        </button>

        {chartOpen ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-5">
            {pool.map((item) => (
              <div key={item.hangul} className="rounded-2xl border border-border bg-card-surface px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-3xl font-black text-text">{item.hangul}</span>
                  <TTSButton text={item.soundText} />
                </div>
                <p className="text-sm font-bold text-coral mt-2">{item.roman}</p>
                <p className="text-xs text-text-faint capitalize">{item.type}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  )
}
