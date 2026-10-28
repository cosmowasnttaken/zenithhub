import express from 'express'
import fetch from 'node-fetch'
import cors from 'cors'
import compression from 'compression'
import path from 'path'
import { fileURLToPath } from 'url'
import { LRUCache } from 'lru-cache'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

/* ── LRU response cache (max 50 pages, 5min TTL) ── */
const cache = new LRUCache({
  max: 50,
  ttl: 1000 * 60 * 5,
})

app.use(cors({ origin: '*' }))
app.use(compression())

/* ── Headers that cause browser-level iframe rejection or body mismatch ── */
const STRIP = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  'permissions-policy',
  'strict-transport-security',
  'x-content-type-options',
  'referrer-policy',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'upgrade-insecure-requests',
  // node-fetch already decompresses; never forward these or the browser
  // will try to gunzip/inflate plain text → Content Encoding Error
  'content-encoding',
  'content-length',
])

/* ── Rotate UA strings to avoid bot detection ── */
const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
]
const ua = () => UAS[Math.floor(Math.random() * UAS.length)]

/* ── URL helpers ── */
function toAbs(base, rel) {
  if (!rel) return null
  if (rel.startsWith('data:') || rel.startsWith('javascript:') || rel.startsWith('mailto:') || rel.startsWith('blob:')) return rel
  if (rel.startsWith('//')) return 'https:' + rel
  try { return new URL(rel, base).href } catch { return null }
}

const px = url => `/proxy?url=${encodeURIComponent(url)}`

/* ── Rewrite HTML ── */
function rewriteHTML(html, base) {
  const origin = (() => { try { return new URL(base).origin } catch { return '' } })()

  /* absolute + proxy all src/href/action/data-src */
  html = html.replace(
    /(<(?:img|script|link|iframe|source|video|audio|track|embed|object|input|form|a)\b[^>]*?\s)(src|href|action|data-src|data-href|poster)\s*=\s*(["'])([\s\S]*?)\3/gi,
    (m, pre, attr, q, val) => {
      const v = val.trim()
      if (!v || v.startsWith('#') || v.startsWith('javascript:') || v.startsWith('data:') || v.startsWith('blob:')) return m
      const abs = toAbs(base, v)
      if (!abs || !abs.startsWith('http')) return m
      /* links navigate inside app; assets proxy directly */
      return `${pre}${attr}=${q}${px(abs)}${q}`
    }
  )

  /* srcset */
  html = html.replace(/srcset\s*=\s*(["'])([\s\S]*?)\1/gi, (m, q, val) => {
    const rw = val.split(',').map(part => {
      const [u, ...rest] = part.trim().split(/\s+/)
      if (!u) return part
      const abs = toAbs(base, u)
      return abs && abs.startsWith('http') ? [px(abs), ...rest].join(' ') : part
    }).join(', ')
    return `srcset=${q}${rw}${q}`
  })

  /* inline CSS url() */
  html = html.replace(/url\(\s*(["']?)((?!data:|blob:)[^)"']+)\1\s*\)/gi, (m, q, u) => {
    const abs = toAbs(base, u)
    return abs && abs.startsWith('http') ? `url(${q}${px(abs)}${q})` : m
  })

  /* @import in style tags */
  html = html.replace(/@import\s+(?:url\()?["']?([^"');]+)["']?\)?/gi, (m, u) => {
    const abs = toAbs(base, u)
    return abs && abs.startsWith('http') ? `@import url("${px(abs)}")` : m
  })

  /* inject nav interceptor */
  const inject = `
<script data-zh="1">
(function(){
  var BASE='${base.replace(/'/g,"\\'")}';
  function nav(url){
    try{
      var abs=url.match(/^https?:/)?url:new URL(url,BASE).href;
      window.parent.postMessage({type:'ZH_NAV',url:abs},'*');
    }catch(e){}
  }
  document.addEventListener('click',function(e){
    var a=e.target.closest('a[href]');
    if(!a)return;
    var h=a.getAttribute('href')||'';
    if(!h||h.startsWith('#')||h.startsWith('javascript:'))return;
    e.preventDefault();e.stopPropagation();
    if(h.startsWith('/proxy?url=')){
      nav(decodeURIComponent(h.slice(11)));
    }else{
      nav(h);
    }
  },true);
  document.addEventListener('submit',function(e){
    var f=e.target;
    if((f.method||'get').toLowerCase()==='get'){
      e.preventDefault();
      var p=new URLSearchParams(new FormData(f)).toString();
      nav((f.action||BASE)+(p?'?'+p:''));
    }
  },true);
  /* keep address bar in sync */
  var _push=history.pushState.bind(history);
  history.pushState=function(a,b,url){
    _push(a,b,url);
    if(url)try{nav(new URL(url,BASE).href)}catch(e){}
  };
})();
<\/script>`

  if (/<head[\s>]/i.test(html)) {
    html = html.replace(/(<head[\s>][^>]*>)/i, '$1' + inject)
  } else {
    html = inject + html
  }

  return html
}

/* ── Rewrite CSS ── */
function rewriteCSS(css, base) {
  css = css.replace(/url\(\s*(["']?)((?!data:|blob:)[^)"']+)\1\s*\)/gi, (m, q, u) => {
    const abs = toAbs(base, u)
    return abs && abs.startsWith('http') ? `url(${q}${px(abs)}${q})` : m
  })
  css = css.replace(/@import\s+(?:url\()?["']?([^"');]+)["']?\)?/gi, (m, u) => {
    const abs = toAbs(base, u)
    return abs && abs.startsWith('http') ? `@import url("${px(abs)}")` : m
  })
  return css
}

/* ════════════════════════════════════════
   MAIN PROXY ENDPOINT
════════════════════════════════════════ */
app.get('/proxy', async (req, res) => {
  const raw = req.query.url
  if (!raw) return res.status(400).send('Missing url')

  let parsed
  try { parsed = new URL(raw) } catch { return res.status(400).send('Invalid URL') }

  /* block private IPs */
  const h = parsed.hostname
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h.endsWith('.local'))
    return res.status(403).send('Private network blocked')

  /* check cache */
  const ckey = raw
  const cached = cache.get(ckey)
  if (cached) {
    res.setHeader('Content-Type', cached.ct)
    res.setHeader('X-ZH-Cache', 'HIT')
    res.setHeader('X-Frame-Options', 'ALLOWALL')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.send(cached.body)
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 14000)

    const upstream = await fetch(raw, {
      headers: {
        'User-Agent': ua(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Referer': parsed.origin + '/',
        'Origin': parsed.origin,
      },
      redirect: 'follow',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    const ct = upstream.headers.get('content-type') || 'text/html'
    const finalURL = upstream.url || raw

    /* build clean response headers */
    upstream.headers.forEach((v, k) => {
      if (STRIP.has(k.toLowerCase())) return
      try { res.setHeader(k, v) } catch {}
    })
    res.setHeader('X-Frame-Options', 'ALLOWALL')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none')
    res.setHeader('X-ZH-Cache', 'MISS')
    res.status(upstream.status)

    if (ct.includes('text/html')) {
      let html = await upstream.text()
      html = rewriteHTML(html, finalURL)
      const body = Buffer.from(html, 'utf-8')
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      /* cache successful pages */
      if (upstream.status === 200) cache.set(ckey, { ct: 'text/html; charset=utf-8', body })
      return res.send(body)
    }

    if (ct.includes('text/css')) {
      let css = await upstream.text()
      css = rewriteCSS(css, finalURL)
      const body = Buffer.from(css, 'utf-8')
      if (upstream.status === 200) cache.set(ckey, { ct: 'text/css', body })
      return res.send(body)
    }

    /* binary passthrough — images, fonts, js, etc */
    const buf = Buffer.from(await upstream.arrayBuffer())
    if (upstream.status === 200 && buf.length < 5 * 1024 * 1024) {
      cache.set(ckey, { ct, body: buf })
    }
    return res.send(buf)

  } catch (err) {
    console.error('[proxy]', raw, err.message)
    const errHTML = `<!DOCTYPE html><html><head><meta charset=utf-8>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:#07050f;color:#ede9ff;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:1.2rem;padding:2rem;text-align:center}
  .ico{width:56px;height:56px;border-radius:16px;background:rgba(255,80,80,.08);border:1px solid rgba(255,80,80,.2);display:flex;align-items:center;justify-content:center;margin:0 auto}
  h2{font-size:1.2rem;font-weight:600;color:#fff}
  p{color:#8b7fb8;font-size:.85rem;max-width:360px;line-height:1.65}
  code{color:#c4b5fd;font-family:monospace;font-size:.78rem;background:rgba(196,181,253,.08);padding:.1rem .3rem;border-radius:4px}
  .btn{display:inline-flex;align-items:center;gap:.4rem;margin-top:.5rem;padding:.55rem 1.2rem;background:#7c3aed;border:none;border-radius:9px;color:#fff;font-size:.85rem;font-weight:600;cursor:pointer;text-decoration:none}
  .btn:hover{background:#8b5cf6}
</style></head><body>
  <div class="ico"><svg width=26 height=26 viewBox="0 0 24 24" fill=none stroke="#f87171" stroke-width=1.8><circle cx=12 cy=12 r=10/><line x1=4.93 y1=4.93 x2=19.07 y2=19.07/></svg></div>
  <h2>Couldn't reach this page</h2>
  <p>The server couldn't fetch <code>${raw.slice(0, 60)}${raw.length > 60 ? '…' : ''}</code><br><br>${err.message}</p>
  <a class="btn" href="${raw}" target="_blank" rel="noopener">Open directly ↗</a>
  <button class="btn" style="background:#1e1730" onclick="window.parent.postMessage({type:'ZH_ERROR'},'*')">← Go back</button>
</body></html>`
    return res.status(502).send(errHTML)
  }
})

/* ── serve built frontend in prod ── */
const dist = path.join(__dirname, '..', 'dist')
app.use(express.static(dist))
app.get('*', (req, res) =>
  res.sendFile(path.join(dist, 'index.html'), e => {
    if (e) res.status(404).send('Not found')
  })
)

app.listen(PORT, () => console.log(`\n  ✦ ZenithHub running → http://localhost:${PORT}\n`))
