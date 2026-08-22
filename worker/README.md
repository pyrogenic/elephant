# elephant relay

A stateless relay for Elephant's Discogs API calls, so the browser can actually see the
rate limit. Two entry points, one shared implementation (`src/core.mjs`):

| | run it | Discogs rate-limit bucket | your token |
| --- | --- | --- | --- |
| **local** (recommended) | `yarn elephant relay` | **your own IP's 60/min** | never leaves your machine |
| hosted (Cloudflare) | `npx wrangler@4 deploy` | shared with every other user of it | transits the worker |

**Prefer the local one.** Discogs buckets rate limits by source IP even for correctly
authenticated requests, so a hosted relay pools all of its users into a single 60/min
budget — see "Which bucket you land in" below. The local relay uses your own IP, so it
is strictly better than talking to Discogs directly: same budget, but the rate-limit
headers become readable and each request costs one slot instead of two.

```sh
yarn elephant relay              # relay only, on :8787
yarn elephant start-with-relay   # relay + dev server together
```

Dev builds default to `http://127.0.0.1:8787` (`.env.development`). If the relay isn't
running, Elephant's startup probe fails, it falls back to a direct connection and says
so — so `yarn elephant start` works either way.

The local relay is plain Node with no dependencies and runs on the repo's pinned Node 20.
Only the *hosted* one needs wrangler, and therefore Node >= 22.

## Node version — only matters for the hosted worker

The local relay runs on Node 20, the repo's pinned version. Skip this section unless you
are deploying to Cloudflare.

**Wrangler 4 requires Node >= 22. The repo's `.nvmrc` pins Node 20.** These cannot be
reconciled: the pin exists because `packages/discojs` fails to build above Node 21
(`browserslist-generator` uses the `assert { type: 'json' }` syntax removed in 22), and
wrangler refuses to start below 22.

So run every wrangler command on a *different* Node than the rest of the monorepo:

```sh
fnm use system      # or `fnm install 22 && fnm use 22`
npx wrangler@4 dev --port 8787
```

Symptom if you forget:

```
Wrangler requires at least Node.js v22.0.0. You are using v20.20.2.
```

Nothing else in this directory cares about the Node version — there is no build step
and no dependency tree.

## Why there is a package.json here

Only so wrangler treats this directory as the project root. Without it, wrangler walks
up to the nearest `package.json` (`packages/elephant`), resolves `wrangler.toml`
relative to *that*, finds nothing, and fails with the thoroughly misleading
`Missing entry-point to Worker script`.

It is deliberately dependency-free. The root `package.json` globs `packages/*` (one
level), so `packages/elephant/worker` is **not** a yarn workspace member and nothing
here is touched by the root `resolutions` pinning `typescript ~4.6.4` and `jest 27`.
Keep it that way — always `npx wrangler@4`, never a declared dependency.

## Run it

```sh
fnm use system
npx wrangler@4 dev --port 8787     # local, no Cloudflare account needed
npx wrangler@4 deploy              # needs `npx wrangler@4 login` first
```

## What it does

Discogs sends `Access-Control-Allow-Origin: *` but no `Access-Control-Expose-Headers`,
so `x-discogs-ratelimit{,-used,-remaining}` are invisible to browser JS. This worker
forwards the request and adds the missing header.

Two less obvious wins:

- **A Discogs 429 has no CORS headers at all and no `Retry-After`.** In a browser it
  arrives as a bare `TypeError: Failed to fetch`, indistinguishable from the network
  dropping. Relayed, it becomes a readable 429 with a synthesized `Retry-After: 60`.
- **Preflights consume the Discogs rate limit** (verified: three `OPTIONS` moved `used`
  0 -> 3). discojs sets `Authorization` and `Content-Type` on every call including
  bodyless GETs, so every direct Elephant request costs *two* slots. This worker
  answers preflights locally and its own upstream call is never preflighted, so relayed
  traffic costs one — roughly doubling effective throughput on its own.

## Guard rails

- **`Authorization` is mandatory**, checked before any subrequest. Unauthenticated
  requests are bucketed per *IP*, and an unauthenticated request forwarded from here
  would land in a 25/min bucket keyed on a Cloudflare egress IP shared with the whole
  platform. The check also rejects `Discogs token=` with an empty value, which is what
  discojs sends before the user has pasted anything.

  **Which bucket you land in — measured.** Discogs buckets by source **IP**, not by
  token, even for correctly authenticated requests. One real token, one moment:

  | request | `X-Discogs-Ratelimit-Used` |
  | --- | --- |
  | real token, direct | 1 |
  | real token, via a *hosted* relay | 50 |
  | *different, invalid* token, via that same hosted relay | 51 |

  Same token down two paths gives two unrelated counters; two different tokens down one
  path give consecutive ones. The bucket follows the IP.

  Repeating it against the **local** relay gives 3 -> 4 -> 5: direct and locally-relayed
  share one counter, because they share your IP. That is the whole argument for local —
  you keep the budget you already had.

  The corollary is the guard above. An unauthenticated request gets a 25/min per-IP
  bucket; forwarding one from a hosted relay spends from a pool shared by everyone.

- **The upstream target is built from the path and query only**, always concatenated
  onto a hardcoded `https://api.discogs.com`. Never accept a caller-supplied URL — that
  one rule is what stops this being an SSRF gadget and an open proxy.
- Origin allowlist is browser hygiene, not a boundary (curl ignores CORS).

## Privacy

Stateless: stores nothing, logs nothing. But the caller's Discogs credential passes
through it in transit, which is why Elephant ships with the relay **off by default**
and exposes an on/off setting.

`npx wrangler tail` streams live requests — including `Authorization` — to whoever runs
it. Treat running `tail` against production as a disclosure event.
