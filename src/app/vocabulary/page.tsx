'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { vocabData } from '@/lib/data'
import FlashCard from '@/components/FlashCard'
import LevelBadge from '@/components/LevelBadge'
import TTSButton from '@/components/TTSButton'
import FavoriteButton from '@/components/FavoriteButton'
import { useAuth } from '@/contexts/AuthContext'
import { getUserProgress, saveProgress } from '@/lib/progress'
import { getUserFavorites, setFavorite } from '@/lib/favorites'
import type { UserProgressRow, VocabItem } from '@/types'

const LEVELS = [1, 2, 3, 4, 5, 6]
const PAGE_SIZE = 20

type StatusFilter = 'all' | 'known' | 'learning' | 'unmarked' | 'favorites'

const POS_DISPLAY_ORDER = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'determiner',
  'numeral',
  'interjection',
  'dependent noun',
  'suffix',
  'abbreviated form',
  'mixed / other',
] as const

function normalizePosLabel(pos: string) {
  const value = pos.trim().toLowerCase()

  if (value === '접사') return 'suffix'
  if (value === '줄어든꼴' || value === '줄어든말') return 'abbreviated form'
  if (value === 'noun' || value === 'verb' || value === 'adjective' || value === 'adverb') {
    return value
  }
  if (value === 'determiner') return 'determiner'
  if (value === 'numeral') return 'numeral'
  if (value === 'interjection') return 'interjection'
  if (value === 'dependent noun') return 'dependent noun'

  const parts = value
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return 'mixed / other'
  if (parts.every((part) => part === 'verb' || part === 'adjective')) {
    return 'verb / adjective'
  }
  if (parts.every((part) => part === 'numeral' || part === 'determiner')) {
    return 'numeral / determiner'
  }
  if (parts.every((part) => part === 'noun' || part === 'determiner')) {
    return 'noun / determiner'
  }
  if (parts.every((part) => part === 'noun' || part === 'adverb')) {
    return 'noun / adverb'
  }

  return 'mixed / other'
}

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedPos, setSelectedPos] = useState('All')
  const [progress, setProgress] = useState<UserProgressRow[]>([])
  const [favoriteIds, setFavoriteIds] = useState<number[]>([])

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const loadProgress = async () => {
      const result = await getUserProgress(user.id)
      if (cancelled || result.error) return
      setProgress(result.data.filter((row) => row.item_type === 'vocab'))
    }

    void loadProgress()

    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const loadFavorites = async () => {
      const result = await getUserFavorites(user.id, 'vocab')
      if (cancelled || result.error) return
      setFavoriteIds(result.data.map((row) => row.item_id))
    }

    void loadFavorites()

    return () => {
      cancelled = true
    }
  }, [user])

  const progressMap = useMemo(() => {
    const source = user ? progress : []
    const map = new Map<number, UserProgressRow['status']>()
    for (const row of source) {
      map.set(row.item_id, row.status)
    }
    return map
  }, [progress, user])

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])

  const posOptions = useMemo(() => {
    const normalized = new Set(vocabData.map((item) => normalizePosLabel(item.pos)).filter(Boolean))
    return ['All', ...POS_DISPLAY_ORDER.filter((label) => normalized.has(label))]
  }, [])

  const filtered = useMemo(() => {
    let items = selectedLevel ? vocabData.filter((v) => v.level === selectedLevel) : vocabData

    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        (v) =>
          v.word.toLowerCase().includes(q) ||
          v.meaning.toLowerCase().includes(q) ||
          v.romanization.toLowerCase().includes(q) ||
          normalizePosLabel(v.pos).toLowerCase().includes(q) ||
          v.example_kr.toLowerCase().includes(q) ||
          v.example_en.toLowerCase().includes(q)
      )
    }

    if (selectedPos !== 'All') {
      items = items.filter((v) => normalizePosLabel(v.pos) === selectedPos)
    }

    if (statusFilter !== 'all') {
      items = items.filter((item) => {
        if (statusFilter === 'favorites') {
          return item.id != null && favoriteSet.has(item.id)
        }
        const status = item.id != null ? progressMap.get(item.id) : undefined
        if (statusFilter === 'known') return status === 'known'
        if (statusFilter === 'learning') return status === 'learning'
        return status == null
      })
    }

    return items
  }, [favoriteSet, progressMap, search, selectedLevel, selectedPos, statusFilter])

  const toggleFavorite = async (itemId: number) => {
    if (!user) return
    const next = !favoriteSet.has(itemId)
    const error = await setFavorite(user.id, 'vocab', itemId, next)
    if (error) return
    setFavoriteIds((prev) =>
      next ? [...prev, itemId] : prev.filter((existingId) => existingId !== itemId)
    )
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleLevelChange = (lvl: number | null) => {
    setSelectedLevel(lvl)
    setPage(0)
    setCardIndex(0)
    const params = new URLSearchParams()
    if (lvl) params.set('level', String(lvl))
    if (mode === 'flashcard') params.set('mode', 'flashcard')
    router.replace(`/vocabulary?${params}`)
  }

  const handleModeChange = (nextMode: 'list' | 'flashcard') => {
    setMode(nextMode)
    setCardIndex(0)
    const params = new URLSearchParams()
    if (selectedLevel) params.set('level', String(selectedLevel))
    if (nextMode === 'flashcard') params.set('mode', 'flashcard')
    router.replace(`/vocabulary?${params}`)
  }

  const clearFilters = () => {
    setSearch('')
    setSelectedPos('All')
    setStatusFilter('all')
    setPage(0)
    setCardIndex(0)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text mb-2">Vocabulary</h1>
        <p className="text-text-subtle">
          {filtered.length.toLocaleString()} words
          {selectedLevel ? ` / TOPIK Level ${selectedLevel}` : ' / All levels'}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
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

      {mode === 'list' ? (
        <div className="bg-card border border-border rounded-2xl p-4 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.8fr_0.8fr_auto] gap-3">
            <input
              type="text"
              placeholder="Search words, meanings, romanization, or examples..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
                setCardIndex(0)
              }}
              className="w-full px-4 py-2.5 bg-card-surface border border-border rounded-xl text-text placeholder-text-faint focus:outline-none focus:border-border-hover transition-colors"
            />

            <select
              value={selectedPos}
              onChange={(e) => {
                setSelectedPos(e.target.value)
                setPage(0)
              }}
              className="w-full px-4 py-2.5 bg-card-surface border border-border rounded-xl text-text focus:outline-none focus:border-border-hover transition-colors"
            >
              {posOptions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos === 'All' ? 'All Parts of Speech' : pos}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter)
                setPage(0)
              }}
              disabled={!user}
              className="w-full px-4 py-2.5 bg-card-surface border border-border rounded-xl text-text focus:outline-none focus:border-border-hover transition-colors disabled:opacity-40"
            >
              <option value="all">All Study States</option>
              <option value="known">Known Only</option>
              <option value="learning">Learning Only</option>
              <option value="unmarked">Unmarked Only</option>
              <option value="favorites">Favorites Only</option>
            </select>

            <button onClick={clearFilters} className="btn-ghost px-4 py-2.5 rounded-xl">
              Clear
            </button>
          </div>

          <p className="mt-3 text-[11px] sm:text-xs text-text-faint">
            Current view: {filtered.length.toLocaleString()} matches •{' '}
            {selectedPos === 'All' ? 'All parts of speech' : selectedPos} •{' '}
            {statusFilter === 'all'
              ? 'All study states'
              : statusFilter === 'known'
                ? 'Known only'
                : statusFilter === 'learning'
                  ? 'Learning only'
                  : statusFilter === 'unmarked'
                    ? 'Unmarked only'
                    : 'Favorites only'}
            {!user ? ' • Log in to filter by study state' : ''}
          </p>
        </div>
      ) : null}

      {mode === 'flashcard' && filtered.length > 0 ? (
        <div className="flex justify-center py-8">
          <FlashCard
            item={filtered[cardIndex]}
            current={cardIndex}
            total={filtered.length}
            onNext={() => setCardIndex((index) => Math.min(index + 1, filtered.length - 1))}
            onPrev={() => setCardIndex((index) => Math.max(index - 1, 0))}
            onGoTo={(index) => setCardIndex(index)}
            onKnown={
              user && filtered[cardIndex].id != null
                ? () => saveProgress(user.id, 'vocab', filtered[cardIndex].id!, 'known').then(() => {})
                : undefined
            }
            onUnknown={
              user && filtered[cardIndex].id != null
                ? () => saveProgress(user.id, 'vocab', filtered[cardIndex].id!, 'learning').then(() => {})
                : undefined
            }
            onToggleFavorite={
              user && filtered[cardIndex].id != null
                ? () => void toggleFavorite(filtered[cardIndex].id!)
                : undefined
            }
            isFavorite={filtered[cardIndex].id != null && favoriteSet.has(filtered[cardIndex].id!)}
            loginHint={!user}
          />
        </div>
      ) : null}

      {mode === 'list' ? (
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
                    <FavoriteButton
                      active={item.id != null && favoriteSet.has(item.id)}
                      onToggle={
                        user && item.id != null
                          ? () => void toggleFavorite(item.id!)
                          : undefined
                      }
                    />
                  </div>
                  <LevelBadge level={item.level} />
                </div>
                <p className="text-xs text-text-subtle mb-1">{item.romanization}</p>
                <p className="text-xs text-text-faint mb-2">{normalizePosLabel(item.pos)}</p>
                <p className="text-sm text-coral-light leading-snug">{item.meaning}</p>
                {item.example_kr ? (
                  <div className="mt-2 border-t border-border pt-2">
                    <div className="flex items-start gap-1.5">
                      <TTSButton text={item.example_kr} />
                      <p className="text-xs text-text-muted leading-relaxed">{item.example_kr}</p>
                    </div>
                    {item.example_en ? (
                      <p className="text-xs text-text-faint mt-0.5">{item.example_en}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 0))}
                disabled={page === 0}
                className="btn-ghost px-4 py-2 rounded-xl disabled:opacity-30"
              >
                Prev
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
                        const nextPage = parseInt(pageInputVal, 10)
                        if (!Number.isNaN(nextPage) && nextPage >= 1 && nextPage <= totalPages) {
                          setPage(nextPage - 1)
                        }
                        setPageInputActive(false)
                        setPageInputVal('')
                      } else if (e.key === 'Escape') {
                        setPageInputActive(false)
                        setPageInputVal('')
                      }
                    }}
                    onBlur={() => {
                      setPageInputActive(false)
                      setPageInputVal('')
                    }}
                    className="w-14 text-center px-2 py-0.5 bg-card border border-border-hover rounded-lg text-text focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                ) : (
                  <button
                    onClick={() => {
                      setPageInputActive(true)
                      setPageInputVal(String(page + 1))
                    }}
                    className="min-w-[2rem] text-center px-2 py-0.5 rounded-lg hover:bg-card-surface hover:text-text transition-colors"
                  >
                    {page + 1}
                  </button>
                )}
                <span>/ {totalPages}</span>
              </div>
              <button
                onClick={() => setPage((currentPage) => Math.min(currentPage + 1, totalPages - 1))}
                disabled={page === totalPages - 1}
                className="btn-ghost px-4 py-2 rounded-xl disabled:opacity-30"
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-text-faint">No results found.</div>
      ) : null}
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
