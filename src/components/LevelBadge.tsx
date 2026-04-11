const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  2: 'bg-sky-950    text-sky-300    border-sky-800',
  3: 'bg-amber-950  text-amber-300  border-amber-800',
  4: 'bg-orange-950 text-orange-300 border-orange-800',
  5: 'bg-[#3A1020]  text-[#FF8E9E]  border-[#6B3040]',
  6: 'bg-purple-950 text-purple-300 border-purple-800',
}

export default function LevelBadge({ level }: { level: number }) {
  const cls = LEVEL_COLORS[level] ?? 'bg-card-surface text-text-muted border-border'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border ${cls}`}>
      TOPIK {level}
    </span>
  )
}
