export interface GrammarItem {
  id?: number
  level: number
  category: string
  form: string
  related: string
  conjugation_rule: string
  meaning: string
  examples: string[]
}

export interface VocabItem {
  id?: number
  level: number
  word: string
  pos: string
  romanization: string
  meaning: string
  example_kr: string
  example_en: string
}

export type StudyLevel = 1 | 2 | 3 | 4 | 5 | 6
