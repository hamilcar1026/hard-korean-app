import { createClient } from './supabase'

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
