import Link from 'next/link'
import HomeStudyPanel from '@/components/HomeStudyPanel'
import { getGrammarByLevel, getVocabByLevel } from '@/lib/data'

const LEVELS = [1, 2, 3, 4, 5, 6]

const LEVEL_INFO: Record<number, { label: string; accent: string; border: string; desc: string }> = {
  1: { label: 'Beginner 1', accent: 'from-emerald-500 to-teal-400', border: 'border-emerald-800 hover:border-emerald-500', desc: 'Survival Korean' },
  2: { label: 'Beginner 2', accent: 'from-sky-500 to-blue-400', border: 'border-sky-800 hover:border-sky-500', desc: 'Daily life basics' },
  3: { label: 'Intermediate 1', accent: 'from-amber-500 to-yellow-400', border: 'border-amber-800 hover:border-amber-500', desc: 'Social topics' },
  4: { label: 'Intermediate 2', accent: 'from-orange-500 to-amber-400', border: 'border-orange-800 hover:border-orange-500', desc: 'Abstract ideas' },
  5: { label: 'Advanced 1', accent: 'from-coral to-coral-light', border: 'border-[#6B3040] hover:border-coral', desc: 'Professional Korean' },
  6: { label: 'Advanced 2', accent: 'from-purple-500 to-pink-soft', border: 'border-purple-900 hover:border-purple-500', desc: 'Native-level mastery' },
}

export default function HomePage() {
  const stats = LEVELS.map((level) => ({
    level,
    vocab: getVocabByLevel(level).length,
    grammar: getGrammarByLevel(level).length,
    ...LEVEL_INFO[level],
  }))

  return (
    <div>
      <div
        className="relative overflow-hidden"
        style={{ background: 'var(--t-hero-bg)' }}
      >
        <div
          className="absolute -top-20 -left-20 w-80 h-80 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: '#FF6B6B' }}
        />
        <div
          className="absolute -top-10 -right-20 w-60 h-60 rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: '#F9A8D4' }}
        />

        <div className="relative max-w-6xl mx-auto px-4 py-20 text-center">
          <div className="inline-block mb-4 px-4 py-1 rounded-full bg-card-surface border border-border text-xs text-text-muted font-semibold tracking-widest uppercase">
            TOPIK Study Platform
          </div>
          <h1
            className="text-6xl sm:text-7xl font-black mb-5 leading-tight"
            style={{
              background: 'var(--t-hero-title)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Hard Korean
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto mb-8 leading-relaxed">
            TOPIK vocabulary &amp; grammar, straight from the official word list.
            No shortcuts. Study hard.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link
              href="/vocabulary"
              className="btn-coral px-7 py-3 rounded-2xl text-sm shadow-lg"
            >
              Start Vocabulary
            </Link>
            <Link
              href="/grammar"
              className="btn-ghost px-7 py-3 rounded-2xl text-sm border border-border"
            >
              Study Grammar
            </Link>
          </div>
        </div>
      </div>

      <HomeStudyPanel />

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-3 gap-4 mb-14 max-w-lg mx-auto">
          {[
            { label: 'Total Words', value: stats.reduce((sum, item) => sum + item.vocab, 0).toLocaleString() },
            { label: 'Grammar Points', value: stats.reduce((sum, item) => sum + item.grammar, 0).toLocaleString() },
            { label: 'TOPIK Levels', value: '6' },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="text-center bg-card border border-border rounded-2xl py-5 px-2 shadow-sm"
            >
              <p
                className="text-2xl font-black"
                style={{ background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
              >
                {value}
              </p>
              <p className="text-xs text-text-subtle mt-1">{label}</p>
            </div>
          ))}
        </div>

        <h2 className="text-sm font-bold text-text-subtle uppercase tracking-widest mb-5">Choose a Level</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map(({ level, label, accent, border, desc, vocab, grammar }) => (
            <div
              key={level}
              className={`bg-card border-2 ${border} rounded-2xl p-6 transition-all hover:shadow-lg hover:-translate-y-0.5 hover:shadow-[#FF6B6B22]`}
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span className={`text-3xl font-black bg-gradient-to-r ${accent} bg-clip-text text-transparent`}>
                  TOPIK {level}
                </span>
              </div>
              <p className="text-sm font-semibold text-text-muted mb-1">{label}</p>
              <p className="text-xs text-text-faint mb-5">{desc}</p>
              <div className="flex gap-2 text-xs text-text-subtle mb-4">
                <span>{vocab} words</span>
                <span>•</span>
                <span>{grammar} grammar</span>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/vocabulary?level=${level}`}
                  className="flex-1 text-center px-3 py-1.5 bg-card-surface text-text-muted text-sm rounded-xl hover:text-text hover:bg-border transition-colors"
                >
                  Vocab
                </Link>
                <Link
                  href={`/grammar?level=${level}`}
                  className="flex-1 text-center px-3 py-1.5 bg-card-surface text-text-muted text-sm rounded-xl hover:text-text hover:bg-border transition-colors"
                >
                  Grammar
                </Link>
                <Link
                  href={`/quiz?level=${level}`}
                  className="flex-1 text-center px-3 py-1.5 text-sm rounded-xl text-white font-semibold transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #FF6B6B, #FF8E9E)' }}
                >
                  Quiz
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
