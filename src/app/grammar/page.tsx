'use client'

import { useState, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { grammarData } from '@/lib/data'
import GrammarCard from '@/components/GrammarCard'

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
  const [selectedLevel, setSelectedLevel] = useState<number | null>(
    levelParam ? Number(levelParam) : null
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
      items = items.filter(
        (g) =>
          g.form.toLowerCase().includes(q) ||
          g.meaning.toLowerCase().includes(q) ||
          g.category.toLowerCase().includes(q)
      )
    }
    return items
  }, [selectedLevel, selectedCategory, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleLevelChange = (lvl: number | null) => {
    setSelectedLevel(lvl)
    setPage(0)
    const params = new URLSearchParams()
    if (lvl) params.set('level', String(lvl))
    router.replace(`/grammar?${params}`)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-text mb-2">Grammar</h1>
        <p className="text-text-subtle">
          {filtered.length} grammar points
          {selectedLevel ? ` • TOPIK Level ${selectedLevel}` : ' • All levels'}
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

      <div className="flex flex-wrap gap-2 mb-5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => { setSelectedCategory(cat); setPage(0) }}
            className={`px-3 py-1 text-xs rounded-xl font-medium transition-colors ${
              selectedCategory === cat
                ? 'text-white'
                : 'bg-card-surface text-text-faint hover:bg-border hover:text-text-subtle'
            }`}
            style={selectedCategory === cat ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
          >
            {cat}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Search grammar forms, meanings..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0) }}
        className="w-full mb-6 px-4 py-2.5 bg-card border border-border rounded-xl text-text placeholder-text-faint focus:outline-none focus:border-border-hover transition-colors"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pageItems.map((item, idx) => (
          <GrammarCard key={`${item.form}-${idx}`} item={item} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 0))}
            disabled={page === 0}
            className="btn-ghost px-4 py-2 rounded-xl disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-text-subtle text-sm">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
            disabled={page === totalPages - 1}
            className="btn-ghost px-4 py-2 rounded-xl disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-20 text-text-faint">No results found.</div>
      )}
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
