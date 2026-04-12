import { createClient } from './supabase'
import type { UserProgressRow } from '@/types'

export type ProgressStatus = 'known' | 'learning'

export async function saveProgress(
  userId: string,
  itemType: 'vocab' | 'grammar',
  itemId: number,
  status: ProgressStatus,
) {
  const supabase = createClient()
  const { error } = await supabase.from('user_progress').upsert(
    {
      user_id: userId,
      item_type: itemType,
      item_id: itemId,
      status,
      reviewed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,item_type,item_id' },
  )
  return error
}

export async function getUserProgress(userId: string): Promise<{
  data: UserProgressRow[]
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_progress')
    .select('item_type, item_id, status, reviewed_at')
    .eq('user_id', userId)
    .order('reviewed_at', { ascending: false })

  return {
    data: (data as UserProgressRow[] | null) ?? [],
    error: error?.message ?? null,
  }
}
