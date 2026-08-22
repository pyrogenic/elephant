# Elephant

A collection management tool for Discogs. It runs 100% in-browser — you don't need to give anyone else access to your account. [Try it out](https://pyrogenic.github.io/elephant/)!

Elephant uses [my fork](https://github.com/pyrogenic/discojs) of [DiscoJS](https://github.com/aknorw/discojs) to talk to Discogs. It stores information about your collection in your browser's database. It can create marketplace listings from items in your collection with just a few clicks, too.

![Screen Shot](https://user-images.githubusercontent.com/4270301/164992153-605e72c4-d0c9-4d58-bae8-64d022f42d91.png)

## The relay (optional, but you want it)

Discogs allows 60 API requests a minute, but a browser can't see how many it has left:
the API sends the `X-Discogs-Ratelimit` headers without the CORS header that would let
JavaScript read them. So Elephant has to guess, and it guesses low. Two things make that
worse than it sounds — a rate-limited response arrives with no CORS headers at all, so
it's indistinguishable from the network dropping, and browsers send a preflight before
every request, which *also* spends from the same 60.

Running a small relay on your own machine fixes all three. It forwards to Discogs, adds
the missing header, and answers preflights itself, so requests cost one slot instead of
two:

```sh
yarn elephant relay              # the relay alone, on :8787
yarn elephant start-with-relay   # relay + dev server together
```

Elephant works fine without it — if it isn't running, the app notices at startup, talks
to Discogs directly, and says so. You can also point it elsewhere, or turn it off, from
the Relay field on the Auth tab.

**Run it locally rather than hosting it.** Discogs buckets rate limits by IP address
even for authenticated requests, so a shared, hosted relay would put every user of it
into one 60-requests-a-minute budget. Locally you get your own, and your Discogs token
never leaves your machine — which is what keeps the "100% in-browser" promise above
true. [`worker/README.md`](worker/README.md) has the measurements and the details.

## Prerequisites

- [ ] Access to [sym](https://github.com/pyrogenic/sym)
