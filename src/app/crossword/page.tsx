'use client'

import { useMemo, useState } from 'react'

type Cell = {
  row: number
  col: number
  answer: string
  clueNumber?: number
}

const GRID_SIZE = 3

const CELLS: Cell[] = [
  { row: 0, col: 0, answer: '학', clueNumber: 1 },
  { row: 0, col: 1, answer: '교', clueNumber: 2 },
  { row: 1, col: 1, answer: '실', clueNumber: 3 },
  { row: 1, col: 2, answer: '수', clueNumber: 4 },
  { row: 2, col: 2, answer: '업' },
]

const ACROSS = [
  { number: 1, answer: '학교', clue: 'school' },
  { number: 3, answer: '실수', clue: 'mistake' },
]

const DOWN = [
  { number: 2, answer: '교실', clue: 'classroom' },
  { number: 4, answer: '수업', clue: 'lesson / class' },
]

function getCellKey(row: number, col: number) {
  return `${row}-${col}`
}

export default function CrosswordPage() {
  const initialEntries = useMemo(
    () =>
      Object.fromEntries(CELLS.map((cell) => [getCellKey(cell.row, cell.col), ''])) as Record<string, string>,
    []
  )

  const [entries, setEntries] = useState<Record<string, string>>(initialEntries)
  const [checked, setChecked] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const correctCount = CELLS.filter((cell) => {
    const key = getCellKey(cell.row, cell.col)
    return entries[key] === cell.answer
  }).length

  const allCorrect = correctCount === CELLS.length

  const fillAnswer = (value: string) => value.trim().slice(0, 1)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-subtle mb-3">Mini Puzzle</p>
        <h1 className="text-3xl font-black text-text mb-2">Korean Crossword</h1>
        <p className="text-text-subtle max-w-2xl">
          A small demo crossword with Korean syllable blocks. Fill one block per square and use the clues to complete the grid.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-8">
        <section className="bg-card border border-border rounded-3xl p-6">
          <div className="grid gap-2 mx-auto w-fit" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 4.5rem))` }}>
            {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
              const row = Math.floor(index / GRID_SIZE)
              const col = index % GRID_SIZE
              const cell = CELLS.find((candidate) => candidate.row === row && candidate.col === col)

              if (!cell) {
                return (
                  <div
                    key={index}
                    className="aspect-square rounded-2xl"
                    style={{ background: 'var(--t-result-err-bg)' }}
                  />
                )
              }

              const key = getCellKey(row, col)
              const currentValue = revealed ? cell.answer : entries[key]
              const isCorrect = checked && entries[key] === cell.answer
              const isWrong = checked && entries[key] && entries[key] !== cell.answer

              return (
                <div key={index} className="relative">
                  {cell.clueNumber ? (
                    <span className="absolute left-2 top-1 text-[10px] font-semibold text-text-faint">
                      {cell.clueNumber}
                    </span>
                  ) : null}
                  <input
                    value={currentValue}
                    onChange={(e) => {
                      setChecked(false)
                      setRevealed(false)
                      setEntries((prev) => ({
                        ...prev,
                        [key]: fillAnswer(e.target.value),
                      }))
                    }}
                    className={`aspect-square w-full rounded-2xl border text-center text-3xl font-black bg-card text-text focus:outline-none transition-colors ${
                      isCorrect ? 'border-emerald-400' : isWrong ? 'border-coral' : 'border-border'
                    }`}
                    maxLength={1}
                  />
                </div>
              )
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => setChecked(true)}
              className="btn-coral px-5 py-3 rounded-2xl text-sm"
            >
              Check Answers
            </button>
            <button
              onClick={() => {
                setEntries(initialEntries)
                setChecked(false)
                setRevealed(false)
              }}
              className="btn-ghost px-5 py-3 rounded-2xl text-sm"
            >
              Reset
            </button>
            <button
              onClick={() => {
                setRevealed(true)
                setChecked(false)
              }}
              className="btn-ghost px-5 py-3 rounded-2xl text-sm"
            >
              Reveal
            </button>
          </div>

          <div className="mt-5 text-sm text-text-subtle">
            {revealed ? 'Answers revealed.' : checked ? `${correctCount} / ${CELLS.length} squares correct.` : 'Enter one Korean block per square.'}
            {checked && allCorrect ? <span className="text-emerald-400 font-semibold"> Puzzle complete.</span> : null}
          </div>
        </section>

        <section className="bg-card border border-border rounded-3xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-black text-text mb-3">Across</h2>
              <div className="space-y-3">
                {ACROSS.map((clue) => (
                  <div key={clue.number} className="bg-card-surface border border-border rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-wide text-text-subtle mb-1">{clue.number} Across</p>
                    <p className="text-sm text-text">{clue.clue}</p>
                    <p className="text-xs text-text-faint mt-2">{clue.answer.length} blocks</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-black text-text mb-3">Down</h2>
              <div className="space-y-3">
                {DOWN.map((clue) => (
                  <div key={clue.number} className="bg-card-surface border border-border rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-wide text-text-subtle mb-1">{clue.number} Down</p>
                    <p className="text-sm text-text">{clue.clue}</p>
                    <p className="text-xs text-text-faint mt-2">{clue.answer.length} blocks</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-card-surface p-4">
            <p className="text-sm font-semibold text-text mb-1">How This Demo Works</p>
            <p className="text-sm text-text-subtle">
              This first version uses a hand-made mini puzzle so we can test Korean crossword interaction before building automatic puzzle generation.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
