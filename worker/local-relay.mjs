#!/usr/bin/env node
/**
 * The relay, on your own machine.
 *
 * This is the recommended way to run it. Discogs buckets rate limits by source IP even
 * for authenticated requests (measured — see README), so a *hosted* relay pools all its
 * users into one 60/min bucket. Running it locally means your own IP, your own 60/min,
 * and your Discogs token never leaves the machine.
 *
 * Zero dependencies, and it runs on the repo's pinned Node 20 — no wrangler, which
 * requires Node >= 22 and therefore cannot run under this repo's .nvmrc.
 *
 *   yarn elephant relay              # this alone
 *   yarn elephant start-with-relay   # this + the dev server
 */
import { createServer } from "node:http";
import { handleRequest } from "./src/core.mjs";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";

const env = {
    // Empty means "allow any origin" — reasonable for a relay bound to loopback, where
    // the only callers are pages you already have open. The hosted worker sets this.
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "",
    UPSTREAM_USER_AGENT:
        process.env.UPSTREAM_USER_AGENT || "Elephant/0.1.0 +https://pyrogenic.github.io/elephant",
};

/** node:http request -> web Request. */
async function toWebRequest(req) {
    const url = `http://${req.headers.host ?? `${HOST}:${PORT}`}${req.url}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
        if (Array.isArray(v)) { v.forEach((one) => headers.append(k, one)); }
        else if (v !== undefined) { headers.set(k, v); }
    }
    let body;
    if (req.method !== "GET" && req.method !== "HEAD") {
        const chunks = [];
        for await (const chunk of req) { chunks.push(chunk); }
        body = Buffer.concat(chunks);
    }
    return new Request(url, { method: req.method, headers, body });
}

const server = createServer(async (req, res) => {
    try {
        const response = await handleRequest(await toWebRequest(req), env);
        const headers = {};
        response.headers.forEach((value, key) => { headers[key] = value; });
        res.writeHead(response.status, headers);
        res.end(Buffer.from(await response.arrayBuffer()));
    } catch (e) {
        // Never leak header contents into logs; the message alone is enough to debug.
        console.error(`Relay error: ${req.method} ${req.url}:`, e);
        // CORS headers on the error too, or the browser reports a bare CORS failure and
        // hides the real message — which is exactly how the 204 bug above presented.
        const headers = { "Content-Type": "text/plain" };
        if (req.headers.origin) {
            headers["Access-Control-Allow-Origin"] = req.headers.origin;
            headers["Vary"] = "Origin";
        }
        res.writeHead(500, headers);
        res.end(`Relay error: ${e.message}\n`);
    }
});

server.listen(PORT, HOST, () => {
    console.log(`Elephant relay -> https://api.discogs.com`);
    console.log(`  http://${HOST}:${PORT}`);
    console.log(`  health: http://${HOST}:${PORT}/__health`);
    console.log(`Set this as the Relay on Elephant's Auth tab (dev builds default to it).`);
});
