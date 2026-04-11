import type { GrammarItem } from '@/types'
import LevelBadge from './LevelBadge'
import TTSButton from './TTSButton'

interface Props {
  item: GrammarItem
}

function parseExample(ex: string): { kr: string; en: string } {
  // Format: "한국어 예문. (English translation.)"
  const match = ex.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  if (match) return { kr: match[1].trim(), en: match[2].trim() }
  // Fallback: old " / " separator
  const parts = ex.split(' / ')
  return { kr: parts[0]?.trim() ?? ex, en: parts[1]?.trim() ?? '' }
}

export default function GrammarCard({ item }: Props) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 hover:border-border-hover transition-all hover:shadow-md hover:shadow-[#FF6B6B11]">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <LevelBadge level={item.level} />
          <span className="text-xs text-text-subtle bg-card-surface px-2 py-0.5 rounded-lg border border-border">
            {item.category}
          </span>
        </div>
      </div>

      {/* Main form + TTS */}
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-2xl font-bold text-text">{item.form}</h3>
        <TTSButton text={item.form} />
      </div>

      {/* Meaning */}
      {item.meaning && (
        <p className="text-sm text-coral-light mb-2">{item.meaning}</p>
      )}

      {/* Conjugation rule */}
      {item.conjugation_rule && (
        <div
          className="rounded-xl px-3 py-2 mb-3 border"
          style={{ background: 'var(--t-conjugation-bg)', borderColor: 'var(--t-conjugation-border)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--t-conjugation-label)' }}>
            Conjugation
          </p>
          <p className="text-sm text-text-muted leading-snug">{item.conjugation_rule}</p>
        </div>
      )}

      {/* Related forms */}
      {item.related && (
        <p className="text-xs text-text-faint mb-3">
          <span className="text-text-subtle">Related: </span>
          {item.related}
        </p>
      )}

      {/* Examples */}
      {item.examples && item.examples.length > 0 && (
        <ul className="space-y-2 mt-2 border-t border-border pt-2">
          {item.examples.map((ex, i) => {
            const { kr, en } = parseExample(ex)
            return (
              <li key={i} className="text-sm leading-relaxed">
                <div className="flex items-start gap-1.5">
                  <TTSButton text={kr} />
                  <span className="text-text-muted">{kr}</span>
                </div>
                {en && <p className="text-text-faint text-xs mt-0.5 ml-6">{en}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
