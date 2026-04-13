import type { GrammarItem } from '@/types'
import LevelBadge from './LevelBadge'
import TTSButton from './TTSButton'

interface Props {
  item: GrammarItem
}

function parseExample(example: string): { kr: string; en: string } {
  const match = example.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  if (match) return { kr: match[1].trim(), en: match[2].trim() }
  const parts = example.split(' / ')
  return { kr: parts[0]?.trim() ?? example, en: parts[1]?.trim() ?? '' }
}

export default function GrammarNotesCard({ item }: Props) {
  return (
    <article className="bg-card border border-border rounded-3xl p-6">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <LevelBadge level={item.level} />
        <span className="text-xs text-text-subtle bg-card-surface px-2 py-0.5 rounded-lg border border-border">
          {item.category}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-3xl font-black text-text">{item.form}</h2>
        <TTSButton text={item.form} />
      </div>

      {item.meaning ? (
        <section className="mb-4">
          <p className="text-xs uppercase tracking-wide text-text-subtle mb-1">Meaning</p>
          <p className="text-base text-coral-light">{item.meaning}</p>
        </section>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {item.conjugation_rule ? (
          <section
            className="rounded-2xl px-4 py-3 border"
            style={{ background: 'var(--t-conjugation-bg)', borderColor: 'var(--t-conjugation-border)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--t-conjugation-label)' }}>
              Form Rule
            </p>
            <p className="text-sm text-text-muted leading-relaxed">{item.conjugation_rule}</p>
          </section>
        ) : null}

        {item.related ? (
          <section className="rounded-2xl px-4 py-3 border border-border bg-card-surface">
            <p className="text-xs uppercase tracking-wide text-text-subtle mb-1">Related Grammar</p>
            <p className="text-sm text-text-muted leading-relaxed">{item.related}</p>
          </section>
        ) : null}
      </div>

      {item.examples?.length ? (
        <section className="mt-5 border-t border-border pt-4">
          <p className="text-xs uppercase tracking-wide text-text-subtle mb-3">Examples</p>
          <div className="space-y-4">
            {item.examples.map((example, index) => {
              const { kr, en } = parseExample(example)
              return (
                <div key={index} className="bg-card-surface border border-border rounded-2xl p-4">
                  <div className="flex items-start gap-2">
                    <TTSButton text={kr} />
                    <div>
                      <p className="text-sm text-text leading-relaxed">{kr}</p>
                      {en ? <p className="text-sm text-text-faint mt-1">{en}</p> : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}
    </article>
  )
}
