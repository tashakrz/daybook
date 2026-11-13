// Supabase project settings.
// Find these in Supabase: Project Settings → API (or "Connect").
// The anon / publishable key is safe to publish: Row Level Security keeps each
// person's data private.
export const SUPABASE_URL = 'YOUR_SUPABASE_URL'
export const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'

export const isConfigured = !SUPABASE_URL.startsWith('YOUR_') && !SUPABASE_ANON_KEY.startsWith('YOUR_')
