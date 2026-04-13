'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { grammarData } from '@/lib/data'
import GrammarCard from '@/components/GrammarCard'
import GrammarNotesCard from '@/components/GrammarNotesCard'

const LEVELS = [1, 2, 3, 4, 5, 6]
const PAGE_SIZE = 24

const CATEGORIES = [
  'All',
  'particle',
  'connective ending',
  'sentence-final ending',
  'pre-final ending',
  'adnominal/nominalizing ending',
  'expression',
]

function GrammarContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const levelParam = searchParams.get('level')
  const viewParam = searchParams.get('view')
  const [selectedLevel, setSelectedLevel] = useState<number | null>(
    levelParam ? Number(levelParam) : null
  )
  const [viewMode, setViewMode] = useState<'card' | 'notes'>(
    viewParam === 'notes' ? 'notes' : 'card'
  )
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    let items = selectedLevel ? grammarData.filter((g) => g.level === selectedLevel) : grammarData

    if (selectedCategory !== 'All') {
      items = items.filter((g) => g.category === selectedCategory)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter((g) => {
        const examples = g.examples.join(' ').toLowerCase()
        return (
          g.form.toLowerCase().includes(q) ||
          g.meaning.toLowerCase().includes(q) ||
          g.category.toLowerCase().includes(q) ||
          g.related.toLowerCase().includes(q) ||
          g.conjugation_rule.toLowerCase().includes(q) ||
          examples.includes(q)
        )
      })
    }

    return items
  }, [search, selectedCategory, selectedLevel])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleLevelChange = (lvl: number | null) => {
    setSelectedLevel(lvl)
    setPage(0)
    const params = new URLSearchParams()
    if (lvl) params.set('level', String(lvl))
    if (viewMode === 'notes') params.set('view', 'notes')
    router.replace(`/grammar?${params}`)
  }

  const handleViewModeChange = (nextMode: 'card' | 'notes') => {
    setViewMode(nextMode)
    setPage(0)
    const params = new URLSearchParams()
    if (selectedLevel) params.set('level', String(selectedLevel))
    if (nextMode === 'notes') params.set('view', 'notes')
    router.replace(`/grammar?${params}`)
  }

  const clearFilters = () => {
    setSelectedCategory('All')
    setSearch('')
    setPage(0)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text mb-2">Grammar</h1>
        <p className="text-text-subtle">
          {filtered.length} grammar points
          {selectedLevel ? ` / TOPIK Level ${selectedLevel}` : ' / All levels'}
        </p>
      </div>

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

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleViewModeChange('card')}
          className={`px-4 py-1.5 text-sm rounded-xl font-medium transition-colors ${
            viewMode === 'card'
              ? 'text-white'
              : 'bg-card-surface text-text-subtle hover:bg-border hover:text-text'
          }`}
          style={viewMode === 'card' ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
        >
          Cards
        </button>
        <button
          onClick={() => handleViewModeChange('notes')}
          className={`px-4 py-1.5 text-sm rounded-xl font-medium transition-colors ${
            viewMode === 'notes'
              ? 'text-white'
              : 'bg-card-surface text-text-subtle hover:bg-border hover:text-text'
          }`}
          style={viewMode === 'notes' ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
        >
          Notes
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 mb-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => {
                setSelectedCategory(category)
                setPage(0)
              }}
              className={`px-3 py-1 text-xs rounded-xl font-medium transition-colors ${
                selectedCategory === category
                  ? 'text-white'
                  : 'bg-card-surface text-text-faint hover:bg-border hover:text-text-subtle'
              }`}
              style={selectedCategory === category ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
          <input
            type="text"
            placeholder="Search forms, meanings, related grammar, rules, or examples..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            className="w-full px-4 py-2.5 bg-card-surface border border-border rounded-xl text-text placeholder-text-faint focus:outline-none focus:border-border-hover transition-colors"
          />
          <button onClick={clearFilters} className="btn-ghost px-4 py-2.5 rounded-xl">
            Clear
          </button>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-xs text-text-subtle">
          <span>{filtered.length} matches</span>
          <span>{selectedCategory === 'All' ? 'All categories' : selectedCategory}</span>
          <span>{search.trim() ? 'Expanded search enabled' : 'Browse mode'}</span>
        </div>
      </div>

      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pageItems.map((item, idx) => (
            <GrammarCard key={`${item.form}-${idx}`} item={item} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {pageItems.map((item, idx) => (
            <GrammarNotesCard key={`${item.form}-${idx}`} item={item} />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 0))}
            disabled={page === 0}
            className="btn-ghost px-4 py-2 rounded-xl disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-text-subtle text-sm">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((currentPage) => Math.min(currentPage + 1, totalPages - 1))}
            disabled={page === totalPages - 1}
            className="btn-ghost px-4 py-2 rounded-xl disabled:opacity-30"
          >
            Next
          </button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-text-faint">No results found.</div>
      ) : null}
    </div>
  )
}

export default function GrammarPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-text-faint">Loading...</div>}>
      <GrammarContent />
    </Suspense>
  )
}
