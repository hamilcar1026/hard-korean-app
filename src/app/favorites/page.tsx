'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import LevelBadge from '@/components/LevelBadge'
import TTSButton from '@/components/TTSButton'
import FavoriteButton from '@/components/FavoriteButton'
import { useAuth } from '@/contexts/AuthContext'
import { grammarData, vocabData } from '@/lib/data'
import { getUserFavorites, setFavorite } from '@/lib/favorites'
import type { GrammarItem, VocabItem } from '@/types'

type FavoriteFilter = 'all' | 'vocab' | 'grammar'

type FavoriteViewItem =
  | { kind: 'vocab'; item: VocabItem; createdAt: string }
  | { kind: 'grammar'; item: GrammarItem; createdAt: string }

const LEVELS = [1, 2, 3, 4, 5, 6]

function formatSavedAt(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function parseGrammarExample(example: string) {
  const match = example.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  if (match) return { kr: match[1].trim(), en: match[2].trim() }
  return { kr: example, en: '' }
}

export default function FavoritesPage() {
  const { user, loading } = useAuth()
  const [items, setItems] = useState<FavoriteViewItem[]>([])
  const [error, setError] = useState('')
  const [fetching, setFetching] = useState(false)
  const [filter, setFilter] = useState<FavoriteFilter>('all')
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const load = async () => {
      setFetching(true)
      setError('')
      const result = await getUserFavorites(user.id)
      if (cancelled) return

      if (result.error) {
        setError(result.error)
        setItems([])
        setFetching(false)
        return
      }

      const nextItems = result.data.flatMap<FavoriteViewItem>((entry) => {
        if (entry.item_type === 'vocab') {
          const item = vocabData.find((candidate) => candidate.id === entry.item_id)
          return item ? [{ kind: 'vocab', item, createdAt: entry.created_at }] : []
        }

        const item = grammarData.find((candidate) => candidate.id === entry.item_id)
        return item ? [{ kind: 'grammar', item, createdAt: entry.created_at }] : []
      })

      setItems(nextItems)
      setFetching(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [user])

  const filtered = useMemo(() => {
    let next = items

    if (filter !== 'all') {
      next = next.filter((entry) => entry.kind === filter)
    }

    if (selectedLevel) {
      next = next.filter((entry) => entry.item.level === selectedLevel)
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      next = next.filter((entry) => {
        if (entry.kind === 'vocab') {
          return (
            entry.item.word.toLowerCase().includes(q) ||
            entry.item.meaning.toLowerCase().includes(q) ||
            entry.item.example_kr.toLowerCase().includes(q) ||
            entry.item.example_en.toLowerCase().includes(q)
          )
        }

        return (
          entry.item.form.toLowerCase().includes(q) ||
          entry.item.meaning.toLowerCase().includes(q) ||
          entry.item.examples.join(' ').toLowerCase().includes(q)
        )
      })
    }

    return next
  }, [filter, items, search, selectedLevel])

  const counts = useMemo(
    () => ({
      all: items.length,
      vocab: items.filter((entry) => entry.kind === 'vocab').length,
      grammar: items.filter((entry) => entry.kind === 'grammar').length,
    }),
    [items]
  )

  const removeFavorite = async (kind: 'vocab' | 'grammar', itemId?: number) => {
    if (!user || itemId == null) return
    const nextError = await setFavorite(user.id, kind, itemId, false)
    if (nextError) {
      setError(nextError)
      return
    }
    setItems((prev) => prev.filter((entry) => !(entry.kind === kind && entry.item.id === itemId)))
  }

  if (loading) {
    return <div className="text-center py-20 text-text-faint">Loading...</div>
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-card border border-border rounded-3xl p-8 text-center">
          <h1 className="text-3xl font-black text-text mb-3">Favorites</h1>
          <p className="text-text-subtle mb-6">Log in to keep your saved vocabulary and grammar in one place.</p>
          <Link href="/auth" className="btn-coral px-6 py-3 rounded-2xl inline-block">
            Log In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div>
          <h1 className="text-3xl font-black text-text mb-2">Favorites</h1>
          <p className="text-text-subtle">Keep your saved vocabulary and grammar easy to revisit.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/vocabulary" className="btn-ghost px-4 py-2 rounded-xl text-sm">
            Open Vocabulary
          </Link>
          <Link href="/grammar" className="btn-ghost px-4 py-2 rounded-xl text-sm">
            Open Grammar
          </Link>
          <Link href="/quiz" className="btn-coral px-4 py-2 rounded-xl text-sm">
            Take a Quiz
          </Link>
        </div>
      </div>

      {error ? (
        <p
          className="text-coral text-sm rounded-xl px-3 py-2 border mb-6"
          style={{ background: 'var(--t-error-box-bg)', borderColor: 'var(--t-error-box-border)' }}
        >
          {error}
        </p>
      ) : null}

      <div className="bg-card border border-border rounded-2xl p-4 mb-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {(
            [
              ['all', `All (${counts.all})`],
              ['vocab', `Vocabulary (${counts.vocab})`],
              ['grammar', `Grammar (${counts.grammar})`],
            ] as [FavoriteFilter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === value
                  ? 'text-white'
                  : 'bg-card-surface text-text-subtle hover:bg-border hover:text-text'
              }`}
              style={filter === value ? { background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.8fr_auto] gap-3">
          <input
            type="text"
            placeholder="Search your saved words, meanings, forms, or examples..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 bg-card-surface border border-border rounded-xl text-text placeholder-text-faint focus:outline-none focus:border-border-hover transition-colors"
          />

          <select
            value={selectedLevel ?? ''}
            onChange={(e) => setSelectedLevel(e.target.value ? Number(e.target.value) : null)}
            className="w-full px-4 py-2.5 bg-card-surface border border-border rounded-xl text-text focus:outline-none focus:border-border-hover transition-colors"
          >
            <option value="">All Levels</option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                TOPIK {level}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setSearch('')
              setSelectedLevel(null)
              setFilter('all')
            }}
            className="btn-ghost px-4 py-2.5 rounded-xl"
          >
            Clear
          </button>
        </div>
      </div>

      {fetching ? (
        <div className="text-center py-20 text-text-faint">Loading favorites...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-3xl p-8 text-center">
          <p className="text-text-faint mb-4">No favorites found for this filter yet.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/vocabulary" className="btn-ghost px-4 py-2 rounded-xl text-sm">
              Save vocabulary
            </Link>
            <Link href="/grammar" className="btn-ghost px-4 py-2 rounded-xl text-sm">
              Save grammar
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((entry, index) =>
            entry.kind === 'vocab' ? (
              <div
                key={`vocab-${entry.item.id ?? index}`}
                className="bg-card border border-border rounded-3xl p-5"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h2 className="text-2xl font-black text-text">{entry.item.word}</h2>
                      <TTSButton text={entry.item.word} size="md" />
                      <FavoriteButton
                        active
                        onToggle={() => void removeFavorite('vocab', entry.item.id)}
                        size="md"
                      />
                      <LevelBadge level={entry.item.level} />
                    </div>
                    <p className="text-sm text-text-muted">{entry.item.romanization} / {entry.item.pos}</p>
                    <p className="text-base text-coral-light mt-2">{entry.item.meaning}</p>
                    {entry.item.example_kr ? (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex items-start gap-2">
                          <TTSButton text={entry.item.example_kr} />
                          <div>
                            <p className="text-sm text-text-muted">{entry.item.example_kr}</p>
                            {entry.item.example_en ? (
                              <p className="text-sm text-text-faint mt-1">{entry.item.example_en}</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="shrink-0 flex flex-col gap-2">
                    <Link
                      href={`/vocabulary?level=${entry.item.level}`}
                      className="btn-ghost px-4 py-2 rounded-xl text-sm text-center"
                    >
                      Open in Vocabulary
                    </Link>
                    <Link
                      href={`/vocabulary?level=${entry.item.level}&mode=flashcard`}
                      className="btn-ghost px-4 py-2 rounded-xl text-sm text-center"
                    >
                      Flashcards
                    </Link>
                    <p className="text-xs text-text-faint text-right">Saved {formatSavedAt(entry.createdAt)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div
                key={`grammar-${entry.item.id ?? index}`}
                className="bg-card border border-border rounded-3xl p-5"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h2 className="text-2xl font-black text-text">{entry.item.form}</h2>
                      <TTSButton text={entry.item.form} size="md" />
                      <FavoriteButton
                        active
                        onToggle={() => void removeFavorite('grammar', entry.item.id)}
                        size="md"
                      />
                      <LevelBadge level={entry.item.level} />
                      <span className="text-xs text-text-subtle bg-card-surface px-2 py-0.5 rounded-lg border border-border">
                        {entry.item.category}
                      </span>
                    </div>
                    <p className="text-base text-coral-light">{entry.item.meaning}</p>
                    {entry.item.conjugation_rule ? (
                      <p className="text-sm text-text-muted mt-3">{entry.item.conjugation_rule}</p>
                    ) : null}
                    {entry.item.examples[0] ? (
                      <div className="mt-4 pt-4 border-t border-border">
                        {(() => {
                          const example = parseGrammarExample(entry.item.examples[0])
                          return (
                            <div className="flex items-start gap-2">
                              <TTSButton text={example.kr} />
                              <div>
                                <p className="text-sm text-text-muted">{example.kr}</p>
                                {example.en ? (
                                  <p className="text-sm text-text-faint mt-1">{example.en}</p>
                                ) : null}
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    ) : null}
                  </div>

                  <div className="shrink-0 flex flex-col gap-2">
                    <Link
                      href={`/grammar?level=${entry.item.level}`}
                      className="btn-ghost px-4 py-2 rounded-xl text-sm text-center"
                    >
                      Open in Grammar
                    </Link>
                    <p className="text-xs text-text-faint text-right">Saved {formatSavedAt(entry.createdAt)}</p>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
