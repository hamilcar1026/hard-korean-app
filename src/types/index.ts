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

export interface UserProgressRow {
  item_type: 'vocab' | 'grammar'
  item_id: number
  status: 'known' | 'learning'
  reviewed_at: string
}

export type MemoryGameMode = 'all' | 'review'

export interface MemoryScoreRow {
  id: number
  user_id: string
  display_name: string
  level: number
  pair_count: number
  game_mode: MemoryGameMode
  moves: number
  duration_ms: number
  is_public: boolean
  completed_at: string
}

export interface QuizAttemptRow {
  id: number
  user_id: string
  level: number | null
  quiz_mode: string
  score: number
  total_questions: number
  correct_pct: number
  created_at: string
}
