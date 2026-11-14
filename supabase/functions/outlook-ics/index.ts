// Supabase Edge Function: fetches a published Outlook calendar (.ics) for a
// signed-in Daybook user. Browsers can't read Outlook's link directly (CORS),
// so the app asks this function instead.
//
// Deploy: Supabase dashboard → Edge Functions → Deploy a new function → Via Editor,
// name it "outlook-ics", paste this file, and turn OFF "Verify JWT" in the
// function's settings (this code checks the user itself).

const ALLOWED_HOSTS = new Set(['outlook.live.com', 'outlook.office365.com', 'outlook.office.com'])
const MAX_BYTES = 8 * 1024 * 1024

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  // 1. Only signed-in users of this project may use it.
  const auth = req.headers.get('Authorization') || ''
  const apikey = req.headers.get('apikey') || ''
  const who = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: { Authorization: auth, apikey },
  })
  if (!who.ok) return json({ error: 'Please sign in again.' }, 401)

  // 2. Only fetch published Outlook calendar links.
  let url: URL
  try {
    const body = await req.json()
    url = new URL(String(body.url || '').trim().replace(/^webcals?:\/\//i, 'https://'))
  } catch {
    return json({ error: 'That doesn’t look like a calendar link.' }, 400)
  }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    return json({ error: 'Only published Outlook calendar links (outlook.live.com / outlook.office365.com) are supported.' }, 400)
  }

  // 3. Fetch it.
  const res = await fetch(url, { redirect: 'follow', headers: { Accept: 'text/calendar' } })
  if (!ALLOWED_HOSTS.has(new URL(res.url).hostname)) return json({ error: 'Unexpected redirect.' }, 502)
  if (!res.ok) return json({ error: `Outlook returned ${res.status}. Is the calendar still published?` }, 502)
  const text = await res.text()
  if (text.length > MAX_BYTES) return json({ error: 'Calendar is too large.' }, 502)
  if (!text.includes('BEGIN:VCALENDAR')) return json({ error: 'That link didn’t return a calendar. Use the ICS link, not the HTML one.' }, 502)
  return json({ ics: text })
})
