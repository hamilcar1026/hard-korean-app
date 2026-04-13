import { createClient } from './supabase'
import type { FavoriteItemRow } from '@/types'

function normalizeFavoriteError(message?: string | null) {
  if (!message) return null

  if (
    message.includes('favorite_items') &&
    (message.includes('does not exist') ||
      message.includes('relation') ||
      message.includes('schema cache'))
  ) {
    return 'Favorites are not set up in the current Supabase project. Run supabase_schema_v8.sql on the same Supabase project used by Vercel.'
  }

  if (message.includes('permission denied') || message.includes('row-level security')) {
    return 'Favorites are blocked by Supabase permissions. Check the favorite_items policies.'
  }

  if (message.includes('JWT') || message.includes('auth') || message.includes('session')) {
    return 'Your login session expired. Log in again and try saving favorites.'
  }

  if (message.includes('fetch')) {
    return 'Could not reach Supabase. Check your connection and project settings.'
  }

  return 'Could not load or save favorites right now.'
}

export async function getUserFavorites(
  userId: string,
  itemType?: 'vocab' | 'grammar'
): Promise<{ data: FavoriteItemRow[]; error: string | null }> {
  const supabase = createClient()
  let query = supabase
    .from('favorite_items')
    .select('item_type, item_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (itemType) {
    query = query.eq('item_type', itemType)
  }

  const { data, error } = await query

  return {
    data: (data as FavoriteItemRow[] | null) ?? [],
    error: normalizeFavoriteError(error?.message),
  }
}

export async function setFavorite(
  userId: string,
  itemType: 'vocab' | 'grammar',
  itemId: number,
  isFavorite: boolean
) {
  const supabase = createClient()

  if (isFavorite) {
    const { error } = await supabase.from('favorite_items').upsert(
      {
        user_id: userId,
        item_type: itemType,
        item_id: itemId,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,item_type,item_id' }
    )

    return normalizeFavoriteError(error?.message)
  }

  const { error } = await supabase
    .from('favorite_items')
    .delete()
    .eq('user_id', userId)
    .eq('item_type', itemType)
    .eq('item_id', itemId)

  return normalizeFavoriteError(error?.message)
}
