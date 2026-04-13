import { createClient } from './supabase'
import type { UserProgressRow } from '@/types'

export type ProgressStatus = 'known' | 'learning'

function normalizeProgressError(message?: string | null) {
  if (!message) return null

  if (
    message.includes('user_progress') &&
    (message.includes('does not exist') ||
      message.includes('relation') ||
      message.includes('schema cache'))
  ) {
    return 'Progress tracking is not set up in the current Supabase project. Run supabase_schema.sql on the same Supabase project used by Vercel.'
  }

  if (message.includes('permission denied') || message.includes('row-level security')) {
    return 'Progress saving is blocked by Supabase permissions. Check the user_progress policies.'
  }

  if (message.includes('JWT') || message.includes('auth') || message.includes('session')) {
    return 'Your login session expired. Log in again and try saving progress.'
  }

  if (message.includes('fetch')) {
    return 'Could not reach Supabase. Check your connection and project settings.'
  }

  return 'Could not load or save progress right now.'
}

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
  return normalizeProgressError(error?.message)
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
    error: normalizeProgressError(error?.message),
  }
}
