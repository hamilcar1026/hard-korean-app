'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { VocabItem } from '@/types'
import LevelBadge from './LevelBadge'
import TTSButton from './TTSButton'

interface Props {
  item: VocabItem
  onNext: () => void
  onPrev: () => void
  onGoTo: (index: number) => void
  current: number
  total: number
  /** Called when user marks the card as known. Omit if not logged in. */
  onKnown?: () => void
  /** Called when user marks the card as unknown. Omit if not logged in. */
  onUnknown?: () => void
  /** Show a login nudge instead of progress buttons when not logged in. */
  loginHint?: boolean
}

export default function FlashCard({
  item, onNext, onPrev, onGoTo, current, total,
  onKnown, onUnknown, loginHint,
}: Props) {
  const [flipped, setFlipped] = useState(false)
  const [inputActive, setInputActive] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedStatus, setSavedStatus] = useState<'known' | 'learning' | null>(null)

  const handleNext = () => {
    setFlipped(false)
    setSavedStatus(null)
    setTimeout(onNext, 50)
  }
  const handlePrev = () => {
    setFlipped(false)
    setSavedStatus(null)
    setTimeout(onPrev, 50)
  }

  const handleKnown = async () => {
    if (!onKnown || saving) return
    setSaving(true)
    await onKnown()
    setSavedStatus('known')
    setSaving(false)
    setTimeout(handleNext, 300)
  }

  const handleUnknown = async () => {
    if (!onUnknown || saving) return
    setSaving(true)
    await onUnknown()
    setSavedStatus('learning')
    setSaving(false)
    setTimeout(handleNext, 300)
  }

  const showProgressButtons = flipped && (onKnown || onUnknown)
  const showLoginHint = flipped && loginHint

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg">
      {/* Progress indicator */}
      <div className="w-full flex items-center justify-between text-sm text-text-subtle">
        <span>{current + 1} / {total}</span>
        <LevelBadge level={item.level} />
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-card-surface rounded-full">
        <div
          className="h-1 rounded-full transition-all"
          style={{
            width: `${((current + 1) / total) * 100}%`,
            background: 'linear-gradient(90deg, #FF6B6B, #FF8E9E)',
          }}
        />
      </div>

      {/* Card */}
      <div
        className="w-full cursor-pointer"
        style={{ perspective: '1000px' }}
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          className="relative w-full transition-transform duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            minHeight: '16rem',
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-2xl bg-card border border-border flex flex-col items-center justify-center gap-3 p-6"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="flex items-center gap-3">
              <p className="text-5xl font-bold text-text">{item.word}</p>
              <TTSButton text={item.word} size="md" />
            </div>
            <p className="text-text-muted text-lg">{item.romanization}</p>
            <p className="text-text-subtle text-sm">{item.pos}</p>
            <p className="text-text-faint text-xs mt-3">tap to flip</p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 rounded-2xl border flex flex-col items-center justify-center gap-3 p-6"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: 'linear-gradient(135deg, var(--t-card-back-from), var(--t-card-back-to))',
              borderColor: 'var(--t-card-back-border)',
            }}
          >
            <p className="text-2xl font-bold text-coral-light">{item.meaning}</p>
            {item.example_kr && (
              <div className="text-center mt-2 space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <p className="text-text-muted text-sm">{item.example_kr}</p>
                  <TTSButton text={item.example_kr} />
                </div>
                {item.example_en && (
                  <p className="text-text-subtle text-xs">{item.example_en}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 알았다 / 몰랐다 */}
      {showProgressButtons && (
        <div className="flex gap-3 w-full">
          <button
            onClick={(e) => { e.stopPropagation(); handleUnknown() }}
            disabled={saving || savedStatus !== null}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:opacity-60 ${
              savedStatus === 'learning'
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'bg-card border-border hover:border-amber-400 hover:text-amber-400 text-text-subtle'
            }`}
          >
            몰랐다 😅
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleKnown() }}
            disabled={saving || savedStatus !== null}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:opacity-60 ${
              savedStatus === 'known'
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : 'bg-card border-border hover:border-emerald-400 hover:text-emerald-400 text-text-subtle'
            }`}
          >
            알았다 ✓
          </button>
        </div>
      )}

      {/* Login hint when not logged in */}
      {showLoginHint && (
        <p className="text-xs text-text-faint text-center">
          <Link href="/auth" className="text-coral hover:text-coral-light underline underline-offset-2">
            로그인
          </Link>
          하면 학습 진도를 저장할 수 있어요.
        </p>
      )}

      {/* Prev / Next controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={handlePrev}
          disabled={current === 0}
          className="btn-ghost px-6 py-2 rounded-xl text-sm"
        >
          ← Prev
        </button>

        <div className="flex items-center gap-1.5 text-sm text-text-subtle">
          {inputActive ? (
            <input
              type="number"
              autoFocus
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const n = parseInt(inputVal, 10)
                  if (!isNaN(n) && n >= 1 && n <= total) {
                    setFlipped(false)
                    setSavedStatus(null)
                    setTimeout(() => onGoTo(n - 1), 50)
                  }
                  setInputActive(false)
                  setInputVal('')
                } else if (e.key === 'Escape') {
                  setInputActive(false)
                  setInputVal('')
                }
              }}
              onBlur={() => { setInputActive(false); setInputVal('') }}
              className="w-14 text-center px-2 py-0.5 bg-card border border-border-hover rounded-lg text-text focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          ) : (
            <button
              onClick={() => { setInputActive(true); setInputVal(String(current + 1)) }}
              className="min-w-[2rem] text-center px-2 py-0.5 rounded-lg hover:bg-card-surface hover:text-text transition-colors"
            >
              {current + 1}
            </button>
          )}
          <span>/ {total}</span>
        </div>

        <button
          onClick={handleNext}
          disabled={current === total - 1}
          className="btn-coral px-6 py-2 rounded-xl text-sm"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
