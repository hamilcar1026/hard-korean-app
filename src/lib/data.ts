import type { GrammarItem, VocabItem } from '@/types'

// Import JSON directly – bundled at build time (no Supabase needed for read-only data)
import grammarRaw from '@/grammar.json'
import vocabRaw from '@/vocabulary.json'

// Assign stable sequential IDs so progress can be saved per-item
export const vocabData: VocabItem[] = (vocabRaw as VocabItem[]).map((v, i) => ({ ...v, id: i + 1 }))
export const grammarData: GrammarItem[] = (grammarRaw as GrammarItem[]).map((g, i) => ({ ...g, id: i + 1 }))

export function getVocabByLevel(level: number): VocabItem[] {
  return vocabData.filter((v) => v.level === level)
}

export function getGrammarByLevel(level: number): GrammarItem[] {
  return grammarData.filter((g) => g.level === level)
}

export function getVocabLevels(): number[] {
  return [...new Set(vocabData.map((v) => v.level))].sort()
}

export function getGrammarLevels(): number[] {
  return [...new Set(grammarData.map((g) => g.level))].sort()
}
