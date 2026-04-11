'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { vocabData } from '@/lib/data'
import FlashCard from '@/components/FlashCard'
import LevelBadge from '@/components/LevelBadge'
import TTSButton from '@/components/TTSButton'
import { useAuth } from '@/contexts/AuthContext'
import { saveProgress } from '@/lib/progress'
import type { VocabItem } from '@/types'

const LEVELS = [1, 2, 3, 4, 5, 6]
const PAGE_SIZE = 20

function VocabContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()

  const levelParam = searchParams.get('level')
  const modeParam = searchParams.get('mode') ?? 'list'

  const [selectedLevel, setSelectedLevel] = useState<number | null>(
    levelParam ? Number(levelParam) : null
  )
  const [mode, setMode] = useState<'list' | 'flashcard'>(
    modeParam === 'flashcard' ? 'flashcard' : 'list'
  )
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [cardIndex, setCardIndex] = useState(0)
  const [pageInputActive, setPageInputActive] = useState(false)
  const [pageInputVal, setPageInputVal] = useState('')

  const filtered = useMemo(() => {
    let items = selectedLevel ? vocabData.filter((v) => v.level === selectedLevel) : vocabData
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        (v) =>
          v.word.includes(q) ||
          v.meaning.toLowerCase().includes(q) ||
          v.romanization.toLowerCase().includes(q)
      )
    }
    return items
  }, [selectedLevel, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => {
    setPage(0)
    setCardIndex(0)
  }, [selectedLevel, search])

  const handleLevelChange = (lvl: number | null) => {
    setSelectedLevel(lvl)
    const params = new URLSearchParams()
    if (lvl) params.set('level', String(lvl))
    if (mode === 'flashcard') params.set('mode', 'flashcard')
    router.replace(`/vocabulary?${params}`)
  }

  const handleModeChange = (m: 'list' | 'flashcard') => {
    setMode(m)
    setCardIndex(0)
    const params = new URLSearchParams()
    if (selectedLevel) params.set('level', String(selectedLevel))
    if (m === 'flashcard') params.set('mode', 'flashcard')
    router.replace(`/vocabulary?${params}`)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text mb-2">Vocabulary</h1>
        <p className="text-text-subtle">
          {filtered.length.toLocaleString()} words
          {selectedLevel ? ` · TOPIK Level ${selectedLevel}` : ' · All levels'}
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Level selector */}
        <div className="flex flex-wrap gap-2">
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
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => handleLevelChange(l)}
              className={`px-3 py-1 text-sm rounded-xl font-medium transition-colors ${
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

        {/* Mode toggle */}
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => handleModeChange('list')}
            className={`px-4 py-1.5 text-sm rounded-xl font-medium transition-colors ${
              mode === 'list'
                ? 'text-white'
                : 'bg-card-surface text-text-subtle hover:bg-border hover:text-text'
            }`}
            style={mode === 'list' ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
          >
            List
          </button>
          <button
            onClick={() => handleModeChange('flashcard')}
            className={`px-4 py-1.5 text-sm rounded-xl font-medium transition-colors ${
              mode === 'flashcard'
                ? 'text-white'
                : 'bg-card-surface text-text-subtle hover:bg-border hover:text-text'
            }`}
            style={mode === 'flashcard' ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
          >
            Flashcards
          </button>
        </div>
      </div>

      {/* Search (list mode only) */}
      {mode === 'list' && (
        <input
          type="text"
          placeholder="Search words, meanings..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mb-6 px-4 py-2.5 bg-card border border-border rounded-xl text-text placeholder-text-faint focus:outline-none focus:border-border-hover transition-colors"
        />
      )}

      {/* Flashcard mode */}
      {mode === 'flashcard' && filtered.length > 0 && (
        <div className="flex justify-center py-8">
          <FlashCard
            item={filtered[cardIndex]}
            current={cardIndex}
            total={filtered.length}
            onNext={() => setCardIndex((i) => Math.min(i + 1, filtered.length - 1))}
            onPrev={() => setCardIndex((i) => Math.max(i - 1, 0))}
            onGoTo={(i) => setCardIndex(i)}
            onKnown={user && filtered[cardIndex].id != null
              ? () => saveProgress(user.id, 'vocab', filtered[cardIndex].id!, 'known').then(() => {})
              : undefined
            }
            onUnknown={user && filtered[cardIndex].id != null
              ? () => saveProgress(user.id, 'vocab', filtered[cardIndex].id!, 'learning').then(() => {})
              : undefined
            }
            loginHint={!user}
          />
        </div>
      )}

      {/* List mode */}
      {mode === 'list' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {pageItems.map((item: VocabItem, idx: number) => (
              <div
                key={`${item.word}-${idx}`}
                className="bg-card border border-border rounded-2xl p-4 hover:border-border-hover transition-all hover:shadow-md hover:shadow-[#FF6B6B11]"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-bold text-text">{item.word}</span>
                    <TTSButton text={item.word} />
                  </div>
                  <LevelBadge level={item.level} />
                </div>
                <p className="text-xs text-text-subtle mb-1">{item.romanization}</p>
                <p className="text-xs text-text-faint mb-2">{item.pos}</p>
                <p className="text-sm text-coral-light leading-snug">{item.meaning}</p>
                {item.example_kr && (
                  <div className="mt-2 border-t border-border pt-2">
                    <div className="flex items-start gap-1.5">
                      <TTSButton text={item.example_kr} />
                      <p className="text-xs text-text-muted leading-relaxed">{item.example_kr}</p>
                    </div>
                    {item.example_en && (
                      <p className="text-xs text-text-faint mt-0.5">{item.example_en}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                disabled={page === 0}
                className="btn-ghost px-4 py-2 rounded-xl disabled:opacity-30"
              >
                ← Prev
              </button>
              <div className="flex items-center gap-1.5 text-sm text-text-subtle">
                {pageInputActive ? (
                  <input
                    type="number"
                    autoFocus
                    value={pageInputVal}
                    onChange={(e) => setPageInputVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const n = parseInt(pageInputVal, 10)
                        if (!isNaN(n) && n >= 1 && n <= totalPages) setPage(n - 1)
                        setPageInputActive(false)
                        setPageInputVal('')
                      } else if (e.key === 'Escape') {
                        setPageInputActive(false)
                        setPageInputVal('')
                      }
                    }}
                    onBlur={() => { setPageInputActive(false); setPageInputVal('') }}
                    className="w-14 text-center px-2 py-0.5 bg-card border border-border-hover rounded-lg text-text focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                ) : (
                  <button
                    onClick={() => { setPageInputActive(true); setPageInputVal(String(page + 1)) }}
                    className="min-w-[2rem] text-center px-2 py-0.5 rounded-lg hover:bg-card-surface hover:text-text transition-colors"
                  >
                    {page + 1}
                  </button>
                )}
                <span>/ {totalPages}</span>
              </div>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
                disabled={page === totalPages - 1}
                className="btn-ghost px-4 py-2 rounded-xl disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-20 text-text-faint">No results found.</div>
      )}
    </div>
  )
}

export default function VocabularyPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-text-faint">Loading...</div>}>
      <VocabContent />
    </Suspense>
  )
}
