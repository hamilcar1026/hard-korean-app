'use client'

import { useMemo, useState } from 'react'
import { saveCrosswordCompletion } from '@/lib/activity'
import { useAuth } from '@/contexts/AuthContext'
import { vocabData } from '@/lib/data'
import type { VocabItem } from '@/types'

type Orientation = 'across' | 'down'

type Placement = {
  word: VocabItem
  answer: string
  clue: string
  pos: string
  row: number
  col: number
  orientation: Orientation
  number?: number
}

type Cell = {
  row: number
  col: number
  answer: string
  clueNumber?: number
}

type CrosswordPuzzle = {
  width: number
  height: number
  cells: Cell[]
  placements: Placement[]
}

const LEVELS = [1, 2, 3, 4, 5, 6]
const TARGET_WORD_COUNT = 4
const MAX_ATTEMPTS = 160

function getCellKey(row: number, col: number) {
  return `${row}-${col}`
}

function splitBlocks(word: string) {
  return [...word.trim()]
}

function isGoodCrosswordWord(item: VocabItem) {
  return /^[\uAC00-\uD7A3]{2,4}$/.test(item.word.trim())
}

function shuffle<T>(items: T[]) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function getIntersectingPairs(a: string, b: string) {
  const matches: Array<{ aIndex: number; bIndex: number }> = []
  const aBlocks = splitBlocks(a)
  const bBlocks = splitBlocks(b)

  aBlocks.forEach((blockA, aIndex) => {
    bBlocks.forEach((blockB, bIndex) => {
      if (blockA === blockB) {
        matches.push({ aIndex, bIndex })
      }
    })
  })

  return matches
}

function getOccupiedCells(placements: Placement[]) {
  const occupied = new Map<string, { answer: string; orientation: Orientation }>()

  placements.forEach((placement) => {
    splitBlocks(placement.answer).forEach((block, index) => {
      const row = placement.row + (placement.orientation === 'down' ? index : 0)
      const col = placement.col + (placement.orientation === 'across' ? index : 0)
      occupied.set(getCellKey(row, col), { answer: block, orientation: placement.orientation })
    })
  })

  return occupied
}

function getContiguousSequence(
  occupied: Map<string, { answer: string; orientation: Orientation }>,
  row: number,
  col: number,
  orientation: Orientation
) {
  const rowStep = orientation === 'down' ? 1 : 0
  const colStep = orientation === 'across' ? 1 : 0
  let startRow = row
  let startCol = col

  while (occupied.has(getCellKey(startRow - rowStep, startCol - colStep))) {
    startRow -= rowStep
    startCol -= colStep
  }

  let answer = ''
  let currentRow = startRow
  let currentCol = startCol

  while (occupied.has(getCellKey(currentRow, currentCol))) {
    answer += occupied.get(getCellKey(currentRow, currentCol))?.answer ?? ''
    currentRow += rowStep
    currentCol += colStep
  }

  return { row: startRow, col: startCol, answer }
}

function isValidCrosswordLayout(placements: Placement[]) {
  const occupied = getOccupiedCells(placements)

  for (const placement of placements) {
    const answerBlocks = splitBlocks(placement.answer)
    const rowStep = placement.orientation === 'down' ? 1 : 0
    const colStep = placement.orientation === 'across' ? 1 : 0

    const beforeKey = getCellKey(placement.row - rowStep, placement.col - colStep)
    const afterKey = getCellKey(
      placement.row + rowStep * answerBlocks.length,
      placement.col + colStep * answerBlocks.length
    )

    if (occupied.has(beforeKey) || occupied.has(afterKey)) {
      return false
    }

    for (const [index] of answerBlocks.entries()) {
      const row = placement.row + rowStep * index
      const col = placement.col + colStep * index
      const horizontal = getContiguousSequence(occupied, row, col, 'across')
      const vertical = getContiguousSequence(occupied, row, col, 'down')

      if (placement.orientation === 'across') {
        if (vertical.answer.length > 1) {
          const matchesPlacedWord = placements.some(
            (candidate) =>
              candidate.orientation === 'down' &&
              candidate.row === vertical.row &&
              candidate.col === vertical.col &&
              candidate.answer === vertical.answer
          )

          if (!matchesPlacedWord) return false
        }
      } else if (horizontal.answer.length > 1) {
        const matchesPlacedWord = placements.some(
          (candidate) =>
            candidate.orientation === 'across' &&
            candidate.row === horizontal.row &&
            candidate.col === horizontal.col &&
            candidate.answer === horizontal.answer
        )

        if (!matchesPlacedWord) return false
      }
    }
  }

  return true
}

function canPlaceWord(placements: Placement[], candidate: Placement) {
  const occupied = getOccupiedCells(placements)
  let intersections = 0

  for (const [index, block] of splitBlocks(candidate.answer).entries()) {
    const row = candidate.row + (candidate.orientation === 'down' ? index : 0)
    const col = candidate.col + (candidate.orientation === 'across' ? index : 0)
    const existing = occupied.get(getCellKey(row, col))

    if (!existing) continue
    if (existing.answer !== block || existing.orientation === candidate.orientation) {
      return false
    }

    intersections += 1
  }

  if (placements.length > 0 && intersections === 0) {
    return false
  }

  return isValidCrosswordLayout([...placements, candidate])
}

function normalizePuzzle(placements: Placement[]) {
  const rows: number[] = []
  const cols: number[] = []

  placements.forEach((placement) => {
    splitBlocks(placement.answer).forEach((_, index) => {
      rows.push(placement.row + (placement.orientation === 'down' ? index : 0))
      cols.push(placement.col + (placement.orientation === 'across' ? index : 0))
    })
  })

  const minRow = Math.min(...rows)
  const minCol = Math.min(...cols)

  return placements.map((placement) => ({
    ...placement,
    row: placement.row - minRow,
    col: placement.col - minCol,
  }))
}

function assignNumbers(placements: Placement[]) {
  const starts = [...new Set(placements.map((placement) => `${placement.row}-${placement.col}`))]
    .map((key) => {
      const [row, col] = key.split('-').map(Number)
      return { row, col }
    })
    .sort((a, b) => a.row - b.row || a.col - b.col)

  const numberMap = new Map(starts.map((start, index) => [getCellKey(start.row, start.col), index + 1]))

  return placements.map((placement) => ({
    ...placement,
    number: numberMap.get(getCellKey(placement.row, placement.col)),
  }))
}

function buildPuzzleFromPlacements(placements: Placement[]): CrosswordPuzzle {
  const normalized = assignNumbers(normalizePuzzle(placements))
  const cells = new Map<string, Cell>()

  normalized.forEach((placement) => {
    splitBlocks(placement.answer).forEach((block, index) => {
      const row = placement.row + (placement.orientation === 'down' ? index : 0)
      const col = placement.col + (placement.orientation === 'across' ? index : 0)
      const key = getCellKey(row, col)
      const current = cells.get(key)

      cells.set(key, {
        row,
        col,
        answer: block,
        clueNumber: index === 0 ? placement.number : current?.clueNumber,
      })
    })
  })

  const maxRow = Math.max(...[...cells.values()].map((cell) => cell.row))
  const maxCol = Math.max(...[...cells.values()].map((cell) => cell.col))

  return {
    width: maxCol + 1,
    height: maxRow + 1,
    cells: [...cells.values()],
    placements: normalized.sort((a, b) => (a.number ?? 0) - (b.number ?? 0) || a.orientation.localeCompare(b.orientation)),
  }
}

function buildEmptyEntries(puzzle: CrosswordPuzzle | null) {
  if (!puzzle) return {}
  return Object.fromEntries(puzzle.cells.map((cell) => [getCellKey(cell.row, cell.col), ''])) as Record<string, string>
}

function buildPuzzleKey(level: number, puzzle: CrosswordPuzzle | null) {
  if (!puzzle) return ''
  return [
    `level:${level}`,
    ...puzzle.placements.map(
      (placement) => `${placement.number}:${placement.orientation}:${placement.row},${placement.col}:${placement.answer}`
    ),
  ].join('|')
}

function tryGeneratePuzzle(level: number): CrosswordPuzzle | null {
  const pool = shuffle(vocabData.filter((item) => item.level === level && isGoodCrosswordWord(item))).slice(0, 48)

  if (pool.length < TARGET_WORD_COUNT) return null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const placements: Placement[] = [
      {
        word: pool[attempt % pool.length],
        answer: pool[attempt % pool.length].word.trim(),
        clue: pool[attempt % pool.length].meaning,
        pos: pool[attempt % pool.length].pos,
        row: 0,
        col: 0,
        orientation: 'across',
      },
    ]

    const used = new Set([placements[0].word.id])
    const candidates = shuffle(pool.filter((item) => item.id !== placements[0].word.id))

    for (const word of candidates) {
      if (used.has(word.id)) continue

      const answer = word.word.trim()
      let placed = false

      for (const anchor of shuffle(placements)) {
        const intersections = shuffle(getIntersectingPairs(anchor.answer, answer))

        for (const match of intersections) {
          const nextOrientation: Orientation = anchor.orientation === 'across' ? 'down' : 'across'
          const row = nextOrientation === 'down' ? anchor.row - match.bIndex : anchor.row + match.aIndex
          const col = nextOrientation === 'across' ? anchor.col - match.bIndex : anchor.col + match.aIndex

          const candidatePlacement: Placement = {
            word,
            answer,
            clue: word.meaning,
            pos: word.pos,
            row,
            col,
            orientation: nextOrientation,
          }

          if (canPlaceWord(placements, candidatePlacement)) {
            placements.push(candidatePlacement)
            used.add(word.id)
            placed = true
            break
          }
        }

        if (placed) break
      }

      if (placements.length === TARGET_WORD_COUNT) {
        return buildPuzzleFromPlacements(placements)
      }
    }
  }

  return null
}

const INITIAL_LEVEL = 1
const INITIAL_PUZZLE = tryGeneratePuzzle(INITIAL_LEVEL)

export default function CrosswordPage() {
  const { user } = useAuth()
  const [selectedLevel, setSelectedLevel] = useState(INITIAL_LEVEL)
  const [puzzle, setPuzzle] = useState<CrosswordPuzzle | null>(INITIAL_PUZZLE)
  const [checked, setChecked] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [entries, setEntries] = useState<Record<string, string>>(() => buildEmptyEntries(INITIAL_PUZZLE))
  const [includeInPublicStats, setIncludeInPublicStats] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')

  const loadPuzzle = (level: number) => {
    const nextPuzzle = tryGeneratePuzzle(level)
    setSelectedLevel(level)
    setPuzzle(nextPuzzle)
    setEntries(buildEmptyEntries(nextPuzzle))
    setChecked(false)
    setRevealed(false)
    setIncludeInPublicStats(false)
    setSaveStatus('idle')
    setSaveMessage('')
    setSaveError('')
  }

  const cellMap = useMemo(() => {
    if (!puzzle) return new Map<string, Cell>()
    return new Map(puzzle.cells.map((cell) => [getCellKey(cell.row, cell.col), cell]))
  }, [puzzle])

  const correctCount = puzzle
    ? puzzle.cells.filter((cell) => entries[getCellKey(cell.row, cell.col)] === cell.answer).length
    : 0

  const allCorrect = Boolean(puzzle && correctCount === puzzle.cells.length)
  const puzzleKey = buildPuzzleKey(selectedLevel, puzzle)
  const across = puzzle?.placements.filter((placement) => placement.orientation === 'across') ?? []
  const down = puzzle?.placements.filter((placement) => placement.orientation === 'down') ?? []

  const handleSaveCompletion = async () => {
    if (!user || !puzzle || !allCorrect || saveStatus === 'saving' || saveStatus === 'saved') return

    setSaveStatus('saving')
    setSaveMessage('')
    setSaveError('')

    const result = await saveCrosswordCompletion({
      userId: user.id,
      level: selectedLevel,
      puzzleKey,
      includeInPublicStats,
      fallbackName: user.email?.split('@')[0],
    })

    if (result.error) {
      setSaveStatus('idle')
      setSaveError(result.error)
      return
    }

    setSaveStatus('saved')
    setSaveMessage(
      includeInPublicStats
        ? 'Crossword saved. This completed session is now included in public records.'
        : 'Crossword saved privately. This session will stay out of public records.'
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-subtle mb-3">Mini Puzzle</p>
        <h1 className="text-3xl font-black text-text mb-2">Korean Crossword</h1>
        <p className="text-text-subtle max-w-2xl">
          Practice TOPIK vocabulary by filling in a small Korean crossword puzzle.
        </p>
      </div>

      <div className="bg-card border border-border rounded-3xl p-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-subtle mb-3">Choose a Level</p>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => loadPuzzle(level)}
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
            <p className="text-sm text-text-subtle mt-3">
              Jump to any TOPIK level you want, or move upward one level at a time.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => loadPuzzle(selectedLevel)} className="btn-coral px-5 py-3 rounded-2xl text-sm">
              New Puzzle
            </button>
            <button
              onClick={() => {
                const currentIndex = LEVELS.indexOf(selectedLevel)
                const nextLevel = LEVELS[(currentIndex + 1) % LEVELS.length]
                loadPuzzle(nextLevel)
              }}
              className="btn-ghost px-5 py-3 rounded-2xl text-sm"
            >
              Next Level
            </button>
          </div>
        </div>
      </div>

      {!puzzle ? (
        <div className="bg-card border border-border rounded-3xl p-6">
          <p className="font-bold text-text mb-2">No crossword was generated this round</p>
          <p className="text-text-subtle mb-4">
            Try another level or generate a new puzzle. The generator only uses short words that can actually cross.
          </p>
          <button onClick={() => loadPuzzle(selectedLevel)} className="btn-coral px-5 py-3 rounded-2xl text-sm">
            Try Again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-8">
          <section className="bg-card border border-border rounded-3xl p-6">
            <div
              className="grid gap-2 mx-auto w-fit"
              style={{ gridTemplateColumns: `repeat(${puzzle.width}, minmax(0, 4.5rem))` }}
            >
              {Array.from({ length: puzzle.width * puzzle.height }).map((_, index) => {
                const row = Math.floor(index / puzzle.width)
                const col = index % puzzle.width
                const cell = cellMap.get(getCellKey(row, col))

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
                const currentValue = revealed ? cell.answer : entries[key] ?? ''
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
                      onChange={(event) => {
                        setChecked(false)
                        setRevealed(false)
                        setEntries((prev) => ({
                          ...prev,
                          [key]: event.target.value.trim().slice(0, 1),
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
              <button onClick={() => setChecked(true)} className="btn-coral px-5 py-3 rounded-2xl text-sm">
                Check Answers
              </button>
              <button
                onClick={() => {
                  setEntries(buildEmptyEntries(puzzle))
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
              {revealed
                ? 'Answers revealed.'
                : checked
                  ? `${correctCount} / ${puzzle.cells.length} squares correct.`
                  : 'Enter one Korean block per square.'}
              {checked && allCorrect ? <span className="text-emerald-400 font-semibold"> Puzzle complete.</span> : null}
            </div>

            {allCorrect ? (
              user ? (
                <div className="mt-5 bg-card-surface border border-border rounded-2xl p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeInPublicStats}
                      onChange={(event) => setIncludeInPublicStats(event.target.checked)}
                      disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-semibold text-text">Include this completed session in public records</span>
                      <span className="block text-sm text-text-subtle">
                        Turn this on if you want this crossword clear to count in Hard Workers.
                      </span>
                    </span>
                  </label>

                  <div className="flex flex-col sm:flex-row gap-3 mt-4">
                    <button
                      onClick={() => void handleSaveCompletion()}
                      disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                      className="btn-coral px-5 py-3 rounded-2xl text-sm disabled:opacity-40"
                    >
                      {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save Completion'}
                    </button>
                    {saveMessage ? <p className="text-sm text-emerald-400 self-center">{saveMessage}</p> : null}
                    {saveError ? <p className="text-sm text-coral self-center">{saveError}</p> : null}
                  </div>
                </div>
              ) : (
                <div className="mt-5 bg-card-surface border border-border rounded-2xl p-4">
                  <p className="font-semibold text-text mb-1">Log in to save this crossword</p>
                  <p className="text-sm text-text-subtle">
                    Signing in lets you choose whether this completed session appears in public stats.
                  </p>
                </div>
              )
            ) : null}
          </section>

          <section className="bg-card border border-border rounded-3xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-lg font-black text-text mb-3">Across</h2>
                <div className="space-y-3">
                  {across.map((clue) => (
                    <div key={`${clue.number}-across`} className="bg-card-surface border border-border rounded-2xl p-4">
                      <p className="text-xs uppercase tracking-wide text-text-subtle mb-1">{clue.number} Across</p>
                      <p className="text-xs text-text-faint mb-2">{clue.pos}</p>
                      <p className="text-sm text-text">{clue.clue}</p>
                      <p className="text-xs text-text-faint mt-2">{clue.answer.length} blocks</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-lg font-black text-text mb-3">Down</h2>
                <div className="space-y-3">
                  {down.map((clue) => (
                    <div key={`${clue.number}-down`} className="bg-card-surface border border-border rounded-2xl p-4">
                      <p className="text-xs uppercase tracking-wide text-text-subtle mb-1">{clue.number} Down</p>
                      <p className="text-xs text-text-faint mb-2">{clue.pos}</p>
                      <p className="text-sm text-text">{clue.clue}</p>
                      <p className="text-xs text-text-faint mt-2">{clue.answer.length} blocks</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-card-surface p-4">
              <p className="text-sm font-semibold text-text mb-1">Puzzle Notes</p>
              <p className="text-sm text-text-subtle">
                Each clue keeps the original part of speech and meaning so the puzzle still feels like study material.
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
