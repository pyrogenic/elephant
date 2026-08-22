/**
 * Cloudflare Worker entry point. All the logic lives in core.mjs, shared with the local
 * Node relay so the guards in it cannot drift between the two.
 *
 * NOTE: a hosted relay pools every user into one per-IP Discogs rate-limit bucket, and
 * on Cloudflare that bucket is shared with unrelated traffic. Running the local relay
 * (`yarn elephant relay`) is the better default — see ../README.md.
 *
 * Do NOT add logging of request or response headers. `npx wrangler tail` streams live
 * requests — including Authorization — to whoever runs it.
 */
import { handleRequest } from './core.mjs'

export default {
  async fetch(request, env) {
    return handleRequest(request, env)
  },
}
