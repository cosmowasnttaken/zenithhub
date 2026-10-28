# ZenithHub v4.1

Fast purple web proxy. Pages are fetched server-side, blocking headers stripped, stays inside the app.

## The Content Encoding Error (fixed)

Previous builds forwarded `Content-Encoding: gzip/br` while `node-fetch` had already decompressed the body. Browser then tried to decompress plain text → "Content Encoding Error".

Fixed by always stripping `content-encoding` and `content-length` after the body is read/rewritten. Compression middleware still re-compresses cleanly for the client when wanted.

## Local dev

```bash
npm install
npm run dev
# frontend → http://localhost:5173
# proxy   → http://localhost:3001
```

## Run from GitHub (recommended path)

GitHub Pages is **static only** — it cannot run the Node proxy. You still push the repo to GitHub, then connect a free Node host.

### Railway (easiest free tier)

1. Create a new GitHub repo and push this whole folder
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Pick the repo. Railway detects Node.
4. Settings → Deploy:
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
5. Deploy. You get a public `*.up.railway.app` URL. Open it. Done.

### Render (also free)

1. Push to GitHub
2. https://render.com → New → Web Service → connect the repo
3. Build: `npm install && npm run build`
4. Start: `npm start`
5. Instance type: Free
6. Create Web Service

### Pure static frontend on GitHub Pages + remote proxy

If you only want the UI on GitHub Pages:

1. Host the server somewhere (Railway/Render) and note its URL, e.g. `https://your-app.up.railway.app`
2. In `vite.config.js` change the proxy target (or remove the proxy and hardcode the full proxy URL in the frontend)
3. Build: `npm run build`
4. Push the `dist/` folder to a `gh-pages` branch or use the GitHub Pages action

Most people just put the whole thing on Railway — one URL, no CORS/proxy config needed.

## VPS

```bash
git clone <your-repo>
cd zenithhub
npm install
npm run build
npm start   # listens on PORT or 3001
```

Point nginx/caddy at it for 80/443.

## What works

- DuckDuckGo, Startpage, Brave Search
- Wikipedia, Reddit, most docs/forums
- GitHub, news sites, anything without heavy bot walls

Caveats:

- Google / Bing often CAPTCHA server IPs → use DuckDuckGo or Startpage
- YouTube video is DRM-blocked
- Some Cloudflare sites block datacenter IPs
