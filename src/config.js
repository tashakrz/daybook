// Supabase project settings.
// Find these in Supabase: Project Settings → API (or "Connect").
// The anon / publishable key is safe to publish: Row Level Security keeps each
// person's data private.
export const SUPABASE_URL = 'https://ktrmybtcntmlxqmdzrri.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_wPL8sVfVCfsysfAbviW-OA_DunFjcpD'

export const isConfigured = !SUPABASE_URL.startsWith('YOUR_') && !SUPABASE_ANON_KEY.startsWith('YOUR_')
