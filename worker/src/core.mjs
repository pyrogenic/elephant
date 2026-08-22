/**
 * The relay, as one function.
 *
 * Shared verbatim by the Cloudflare Worker (`index.js`) and the local Node relay
 * (`../local-relay.mjs`). Deliberately one implementation: the guards below are the
 * only thing standing between this and an open proxy, and two copies of them would
 * eventually disagree.
 *
 * Written against the web platform (Request/Response/Headers/fetch), which Node has had
 * globally since 18, so it runs unmodified in both.
 *
 * WHY THIS EXISTS
 *
 * api.discogs.com sends `Access-Control-Allow-Origin: *` but no
 * `Access-Control-Expose-Headers`, so `X-Discogs-Ratelimit`, `-Used` and `-Remaining`
 * are invisible to browser JS and Elephant has to guess its budget.
 *
 * Two things it fixes that are easy to miss:
 *
 *  1. A Discogs 429 carries NO CORS headers and no `Retry-After`, so in a browser it
 *     arrives as a bare `TypeError` — indistinguishable from the network dropping.
 *     Through here it is a readable 429 with a synthesized `Retry-After`.
 *
 *  2. CORS preflights consume the Discogs rate limit (measured: three OPTIONS moved
 *     `used` 0 -> 3). discojs sets `Authorization` and `Content-Type` on every call
 *     including bodyless GETs, so every direct request costs TWO slots. Preflights are
 *     answered here locally and server-to-server calls are never preflighted, so relayed
 *     traffic costs one. That alone roughly doubles throughput.
 *
 * WHICH RATE-LIMIT BUCKET YOU LAND IN — measured, and the reason to prefer local.
 *
 * Discogs buckets by source IP, NOT by token, even for correctly authenticated requests.
 * Measured with one real token: `used` was 1 when sent directly and 50 through a hosted
 * relay, and a *different* (invalid) token through that same relay read 51 — one shared
 * counter. So a hosted relay pools every user of it into a single 60/min bucket, and on
 * Cloudflare that bucket is shared with unrelated traffic besides.
 *
 * Running this on your own machine avoids all of that: your own IP, your own 60/min, and
 * your Discogs credential never leaves the machine. That is the recommended setup.
 */

const UPSTREAM = 'https://api.discogs.com'

/** Headers forwarded upstream. Everything else is dropped. */
const FORWARD_REQUEST_HEADERS = ['authorization', 'accept', 'content-type']

/** The whole point. Retry-After and Location matter for 429s and CSV redirects. */
const EXPOSE = [
  'X-Discogs-Ratelimit',
  'X-Discogs-Ratelimit-Used',
  'X-Discogs-Ratelimit-Remaining',
  'Retry-After',
  'Location',
  'X-Elephant-Proxy',
].join(', ')

/** Discogs' window is a rolling 60s and it never sends Retry-After, so 60 is the only safe value. */
const FALLBACK_RETRY_AFTER = '60'

function corsHeaders(origin) {
  const h = new Headers()
  if (origin) h.set('Access-Control-Allow-Origin', origin)
  // Origin is echoed rather than wildcarded, so a shared cache must vary on it.
  h.set('Vary', 'Origin')
  h.set('X-Elephant-Proxy', '1')
  return h
}

function fail(status, message, origin) {
  const h = corsHeaders(origin)
  h.set('Content-Type', 'text/plain; charset=utf-8')
  return new Response(message + '\n', { status, headers: h })
}

/**
 * discojs sends `Discogs token=` (empty) before the user has pasted anything, because
 * its `isAuthenticatedWithToken` guard accepts "". Such a request would reach Discogs
 * unauthenticated — see the guard in handleRequest for why that must never happen.
 */
function hasRealCredential(authorization) {
  if (!authorization) return false
  const value = authorization.trim()

  const token = value.match(/^Discogs\s+token=(.*)$/i)
  if (token) return token[1].trim().length > 0

  if (/^OAuth\s+\S/i.test(value)) return true
  if (/^Discogs\s+key=\S/i.test(value)) return true

  return false
}

export async function handleRequest(request, env) {
  const url = new URL(request.url)
  const origin = request.headers.get('Origin')
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)

  // Browser hygiene, not a boundary — curl ignores CORS. A request with no Origin
  // (curl, a health check) passes; one claiming an origin we don't serve does not.
  if (origin && allowed.length && !allowed.includes(origin)) {
    return fail(403, 'Origin not allowed.', null)
  }

  // Liveness probe for Elephant's startup check: no auth, no subrequest, and no Discogs
  // rate-limit cost — so "is the relay up?" is free to ask.
  if (url.pathname === '/__health') {
    const h = corsHeaders(origin)
    h.set('Content-Type', 'application/json')
    h.set('Cache-Control', 'no-store')
    return new Response(JSON.stringify({ ok: true, upstream: UPSTREAM }), { headers: h })
  }

  // Answer preflights here. Never forward them: upstream OPTIONS spend Discogs rate
  // limit, and the browser's preflight is about this relay anyway.
  if (request.method === 'OPTIONS') {
    const h = corsHeaders(origin)
    h.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    h.set(
      'Access-Control-Allow-Headers',
      request.headers.get('Access-Control-Request-Headers') || 'Authorization, Content-Type, Accept',
    )
    h.set('Access-Control-Max-Age', '86400')
    // No Access-Control-Allow-Credentials: Elephant sends no cookies, and
    // echoed-origin + credentials is the combination to avoid.
    h.append('Vary', 'Access-Control-Request-Headers')
    return new Response(null, { status: 204, headers: h })
  }

  const authorization = request.headers.get('Authorization')

  // Unauthenticated requests are bucketed per IP with a limit of 25. Forwarding one
  // would spend from this machine's shared pool for no benefit, and on a hosted relay
  // that pool belongs to everyone. Reject locally, without a subrequest.
  if (!hasRealCredential(authorization)) {
    return fail(401, 'Elephant relay requires a Discogs credential.', origin)
  }

  // Build the upstream URL from path and query ONLY, always onto a hardcoded origin.
  // Never accept a caller-supplied target. This single rule is what stops this being an
  // SSRF gadget and an open proxy.
  const upstreamUrl = UPSTREAM + url.pathname + url.search

  const upstreamHeaders = new Headers()
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name)
    if (value) upstreamHeaders.set(name, value)
  }
  // Discogs requires an identifying User-Agent. Browsers forbid setting one (which is
  // why Elephant passes `allowUnsafeHeaders: false`), so this is the only place it can
  // be added.
  upstreamHeaders.set('User-Agent', env.UPSTREAM_USER_AGENT || 'Elephant')
  // Cookie, Origin, Referer and cf-* are simply never copied.

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'

  let upstream
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body: hasBody ? await request.arrayBuffer() : undefined,
      // The inventory CSV export 302s to signed storage; follow it and stream the result
      // through rather than making the browser chase a Location it cannot read.
      redirect: 'follow',
    })
  } catch (e) {
    return fail(502, 'Upstream request failed: ' + e.message, origin)
  }

  const headers = new Headers(upstream.headers)
  // Drop Discogs' __cf_bm cookie; meaningless here and third-party besides.
  headers.delete('Set-Cookie')
  // Node's fetch decompresses transparently; leaving the original encoding header on
  // would describe a body that no longer exists.
  headers.delete('Content-Encoding')
  headers.delete('Content-Length')

  if (origin) headers.set('Access-Control-Allow-Origin', origin)
  headers.set('Vary', 'Origin')
  headers.set('X-Elephant-Proxy', '1')
  headers.set('Access-Control-Expose-Headers', EXPOSE)

  // Discogs' 429 has no Retry-After. Give the client something honest to wait on.
  if (upstream.status === 429 && !headers.has('Retry-After')) {
    headers.set('Retry-After', FALLBACK_RETRY_AFTER)
  }

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  })
}
