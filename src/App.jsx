import { useState, useEffect, useRef, useCallback } from 'react'

/* ═══════════════════════════════════════════
   ENGINES
═══════════════════════════════════════════ */
const ENGINES = [
  { id:'ddg',       label:'DuckDuckGo', url:q=>`https://duckduckgo.com/?q=${encodeURIComponent(q)}&kae=d&k1=-1`             },
  { id:'brave',     label:'Brave',      url:q=>`https://search.brave.com/search?q=${encodeURIComponent(q)}`                 },
  { id:'startpage', label:'Startpage',  url:q=>`https://www.startpage.com/sp/search?q=${encodeURIComponent(q)}`            },
  { id:'google',    label:'Google',     url:q=>`https://www.google.com/search?q=${encodeURIComponent(q)}`                  },
  { id:'bing',      label:'Bing',       url:q=>`https://www.bing.com/search?q=${encodeURIComponent(q)}`                    },
  { id:'wiki',      label:'Wikipedia',  url:q=>`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}`      },
  { id:'reddit',    label:'Reddit',     url:q=>`https://www.reddit.com/search/?q=${encodeURIComponent(q)}`                 },
  { id:'github',    label:'GitHub',     url:q=>`https://github.com/search?q=${encodeURIComponent(q)}&type=repositories`   },
  { id:'youtube',   label:'YouTube',    url:q=>`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`     },
  { id:'x',         label:'X / Twitter',url:q=>`https://x.com/search?q=${encodeURIComponent(q)}&src=typed_query`          },
]

const SHORTCUTS = [
  { label:'DuckDuckGo', id:'ddg',    icon:'🦆', color:'#de5833' },
  { label:'Reddit',     id:'reddit', icon:'🟠', color:'#ff4500' },
  { label:'Wikipedia',  id:'wiki',   icon:'📖', color:'#a0a0a0' },
  { label:'GitHub',     id:'github', icon:'⚫', color:'#333'    },
  { label:'YouTube',    id:'youtube',icon:'▶️',  color:'#ff0000' },
  { label:'Discord',    url:'https://discord.com/app', icon:'💬', color:'#5865f2' },
]

function isURL(s) {
  try { const u = new URL(s.startsWith('http') ? s : 'https://' + s); return u.hostname.includes('.') && !s.includes(' ') }
  catch { return false }
}
function toTarget(q, eng) {
  const t = q.trim()
  if (!t) return eng.url('search')
  if (isURL(t)) return t.startsWith('http') ? t : 'https://' + t
  return eng.url(t)
}
function px(url) { return `/proxy?url=${encodeURIComponent(url)}` }

/* ═══════════════════════════════════════════
   STAR / NEBULA CANVAS
═══════════════════════════════════════════ */
function Nebula() {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current, ctx = c.getContext('2d')
    let W, H, raf, stars = [], lines = [], shots = [], shotT = 0

    const resize = () => {
      W = c.width = innerWidth
      H = c.height = innerHeight
      build()
    }

    const build = () => {
      stars = []; lines = []
      const n = Math.floor(W * H / 6500)
      for (let i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * W, y: Math.random() * H,
          r: .25 + Math.random() * 1.6,
          a: .12 + Math.random() * .7,
          tw: Math.random() * Math.PI * 2,
          ts: .004 + Math.random() * .014,
          hue: Math.random() < .3 ? 270 : 260, // purple-tinted stars
        })
      }
      for (let i = 0; i < stars.length; i++) {
        let ct = 0
        for (let j = i + 1; j < stars.length; j++) {
          if (ct >= 2) break
          const dx = stars[i].x - stars[j].x, dy = stars[i].y - stars[j].y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < 140 && Math.random() < .28) { lines.push({ a: i, b: j, d }); ct++ }
        }
      }
    }

    const draw = t => {
      ctx.clearRect(0, 0, W, H)

      /* nebula glow blobs */
      const nb = [
        { x: W * .25, y: H * .35, r: W * .32, c: 'rgba(109,40,217,.055)' },
        { x: W * .75, y: H * .6,  r: W * .28, c: 'rgba(139,92,246,.045)' },
        { x: W * .5,  y: H * .15, r: W * .22, c: 'rgba(167,139,250,.035)' },
      ]
      nb.forEach(b => {
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
        g.addColorStop(0, b.c); g.addColorStop(1, 'transparent')
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill()
      })

      /* constellation lines */
      lines.forEach(l => {
        const sa = stars[l.a], sb = stars[l.b]
        const alpha = .025 + .018 * Math.sin(t * .00025 + l.a)
        ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y)
        ctx.strokeStyle = `rgba(167,139,250,${alpha})`; ctx.lineWidth = .55; ctx.stroke()
      })

      /* stars */
      stars.forEach(s => {
        s.tw += s.ts
        const a = s.a * (.7 + .3 * Math.sin(s.tw))
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${s.hue},60%,85%,${a})`; ctx.fill()
        /* tiny glow on brighter stars */
        if (s.a > .55 && s.r > 1) {
          const g2 = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4)
          g2.addColorStop(0, `hsla(${s.hue},70%,80%,${a * .25})`); g2.addColorStop(1, 'transparent')
          ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2); ctx.fill()
        }
      })

      /* shooting stars */
      shotT += 16
      if (shotT > 4000 + Math.random() * 6000) {
        shots.push({ x: Math.random() * W * 1.3, y: Math.random() * H * .4, vx: -5 - Math.random() * 4, vy: 1.8 + Math.random() * 2.5, life: 1, len: 100 + Math.random() * 130 })
        shotT = 0
      }
      shots = shots.filter(s => s.life > 0)
      shots.forEach(s => {
        s.x += s.vx; s.y += s.vy; s.life -= .018
        const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * s.len / 3, s.y - s.vy * s.len / 3)
        g.addColorStop(0, `rgba(220,200,255,${s.life * .9})`); g.addColorStop(1, 'transparent')
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * s.len / 3, s.y - s.vy * s.len / 3)
        ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.stroke()
      })

      raf = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={ref} style={{
    position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
    background: 'radial-gradient(ellipse at 30% 20%, #120a28 0%, #07050f 50%, #050308 100%)'
  }} />
}

/* ═══════════════════════════════════════════
   CSS — full purple design system
═══════════════════════════════════════════ */
const CSS = `
:root {
  --bg: #07050f;
  --s:  #0d0b1a;
  --s2: #110e22;
  --bd: #1e1535;
  --bd2:#2a1f4a;
  --ac: #8b5cf6;
  --ac2:#a78bfa;
  --ac3:#c4b5fd;
  --acd:#6d28d9;
  --tx: #ede9ff;
  --sub:#9d8fd1;
  --mu: #4a3f72;
  --gold:#f0c060;
  --red:#f87171;
  --glow:rgba(139,92,246,.18);
  --glow2:rgba(139,92,246,.08);
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Sora',sans-serif;color:var(--tx);overflow:hidden;height:100vh}

@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes prog{0%{left:-60%}100%{left:110%}}
@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes glowPulse{0%,100%{box-shadow:0 0 20px rgba(139,92,246,.2),0 0 60px rgba(139,92,246,.06)}50%{box-shadow:0 0 30px rgba(139,92,246,.35),0 0 80px rgba(139,92,246,.12)}}

/* ─── LANDING ─── */
.L {
  position:relative;z-index:1;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  height:100vh;
  transition:opacity .5s cubic-bezier(.4,0,.2,1),transform .5s cubic-bezier(.4,0,.2,1);
}
.L.out{opacity:0;transform:translateY(-28px);pointer-events:none;position:absolute;width:100%}

/* logo */
.logo-wrap{display:flex;flex-direction:column;align-items:center;gap:.6rem;margin-bottom:2.4rem;animation:fadeUp .9s cubic-bezier(.4,0,.2,1) both}
.logo-gem{
  width:72px;height:72px;border-radius:22px;
  background:linear-gradient(135deg,#4c1d95,#7c3aed,#8b5cf6);
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 0 0 1px rgba(167,139,250,.25),0 8px 32px rgba(109,40,217,.4),0 0 60px rgba(109,40,217,.15);
  animation:glowPulse 3s ease-in-out infinite,float 4s ease-in-out infinite;
  flex-shrink:0;
}
.logo-gem svg{width:38px;height:38px}
.wm{
  font-size:clamp(2.6rem,7vw,5.2rem);font-weight:800;
  letter-spacing:-.04em;line-height:1;
  background:linear-gradient(135deg,#c4b5fd 0%,#a78bfa 35%,#7c3aed 70%,#f0c060 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
.tg{font-size:.72rem;font-weight:400;letter-spacing:.22em;text-transform:uppercase;color:var(--mu);margin-top:.2rem}

/* search */
.sw{
  position:relative;width:min(620px,88vw);
  margin-bottom:1.4rem;
  animation:fadeUp .9s .12s cubic-bezier(.4,0,.2,1) both;
}
.si{
  width:100%;padding:1rem 3.8rem 1rem 1.4rem;
  background:rgba(13,11,26,.9);
  border:1.5px solid var(--bd2);
  border-radius:14px;
  color:var(--tx);
  font-family:'Sora',sans-serif;font-size:.95rem;font-weight:400;
  outline:none;
  backdrop-filter:blur(16px);
  transition:border-color .2s,box-shadow .2s;
  box-shadow:0 4px 40px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.04);
}
.si::placeholder{color:var(--mu)}
.si:focus{border-color:var(--ac);box-shadow:0 0 0 3px var(--glow),0 4px 40px rgba(0,0,0,.5)}
.sbtn{
  position:absolute;right:.55rem;top:50%;transform:translateY(-50%);
  width:2.5rem;height:2.5rem;border-radius:10px;
  background:linear-gradient(135deg,var(--ac),var(--acd));
  border:none;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 2px 16px rgba(109,40,217,.4);
  transition:opacity .15s,transform .15s;
}
.sbtn:hover{opacity:.85;transform:translateY(-50%) scale(1.06)}
.sbtn svg{width:17px;height:17px;fill:none;stroke:#fff;stroke-width:2.4;stroke-linecap:round}

/* engine pills */
.er{
  display:flex;align-items:center;gap:.38rem;flex-wrap:wrap;
  justify-content:center;max-width:620px;padding:0 1rem;
  margin-bottom:2.2rem;
  animation:fadeUp .9s .2s cubic-bezier(.4,0,.2,1) both;
}
.el{font-size:.68rem;color:var(--mu);letter-spacing:.1em;text-transform:uppercase;flex-shrink:0}
.ep{
  padding:.25rem .75rem;border-radius:999px;
  border:1px solid var(--bd2);
  background:rgba(13,11,26,.7);
  color:var(--sub);
  font-family:'Sora',sans-serif;font-size:.72rem;font-weight:500;
  cursor:pointer;backdrop-filter:blur(8px);transition:all .15s;
}
.ep:hover{border-color:var(--ac);color:var(--ac3)}
.ep.on{border-color:var(--ac);color:var(--ac2);background:var(--glow2);box-shadow:0 0 14px var(--glow)}

/* shortcuts */
.scs{
  display:flex;gap:.9rem;flex-wrap:wrap;justify-content:center;max-width:540px;
  animation:fadeUp .9s .28s cubic-bezier(.4,0,.2,1) both;
}
.sc{display:flex;flex-direction:column;align-items:center;gap:.42rem;cursor:pointer;transition:transform .2s}
.sc:hover{transform:translateY(-4px)}
.sci{
  width:52px;height:52px;border-radius:16px;
  background:rgba(13,11,26,.85);
  border:1px solid var(--bd2);
  display:flex;align-items:center;justify-content:center;
  font-size:1.4rem;backdrop-filter:blur(10px);
  transition:border-color .15s,box-shadow .15s;
}
.sc:hover .sci{border-color:var(--ac);box-shadow:0 4px 20px rgba(109,40,217,.3)}
.scl{font-size:.64rem;color:var(--mu);font-weight:500}

/* ─── BROWSER ─── */
.B{display:none;flex-direction:column;height:100vh;position:relative;z-index:1}
.B.vis{display:flex}

/* topbar */
.tb{
  display:flex;align-items:center;gap:.5rem;
  padding:.5rem .75rem;
  background:rgba(7,5,15,.96);
  border-bottom:1px solid var(--bd);
  backdrop-filter:blur(24px);
  flex-shrink:0;
  box-shadow:0 1px 0 rgba(139,92,246,.08),0 4px 28px rgba(0,0,0,.6);
}
.nb{
  background:none;border:1px solid transparent;
  cursor:pointer;color:var(--sub);
  width:2rem;height:2rem;border-radius:8px;
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;transition:all .14s;
}
.nb:hover{background:var(--s2);border-color:var(--bd2);color:var(--tx)}
.nb svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.tbrand{
  font-size:.95rem;font-weight:700;letter-spacing:-.02em;
  background:linear-gradient(90deg,var(--ac2),var(--gold));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  flex-shrink:0;cursor:pointer;white-space:nowrap;
}

/* address bar */
.aw{
  flex:1;min-width:0;
  display:flex;align-items:center;
  background:rgba(13,11,26,.8);
  border:1px solid var(--bd2);
  border-radius:9px;padding:0 .65rem;gap:.38rem;
  transition:border-color .2s,box-shadow .2s;
  backdrop-filter:blur(12px);
}
.aw:focus-within{border-color:var(--ac);box-shadow:0 0 0 2px var(--glow)}
.aico{width:13px;height:13px;stroke:var(--mu);fill:none;stroke-width:2;flex-shrink:0;stroke-linecap:round}
.ai{
  flex:1;min-width:0;background:none;border:none;
  color:var(--tx);
  font-family:'JetBrains Mono',monospace;font-size:.72rem;
  outline:none;padding:.46rem 0;
}
.ai::placeholder{color:var(--mu);font-family:'Sora',sans-serif;font-size:.8rem}

/* engine tabs */
.tps{display:flex;gap:.28rem;flex-shrink:0}
.tp{
  padding:.22rem .56rem;border-radius:999px;
  border:1px solid var(--bd);background:transparent;
  color:var(--mu);font-size:.65rem;font-weight:500;
  cursor:pointer;font-family:'Sora',sans-serif;
  transition:all .13s;white-space:nowrap;
}
.tp:hover,.tp.on{border-color:var(--ac);color:var(--ac2);background:var(--glow2)}

.gb{
  padding:.42rem .9rem;
  background:linear-gradient(135deg,var(--ac),var(--acd));
  border:none;border-radius:8px;
  color:#fff;font-family:'Sora',sans-serif;font-size:.78rem;font-weight:600;
  cursor:pointer;flex-shrink:0;
  transition:opacity .15s;
  box-shadow:0 2px 14px rgba(109,40,217,.3);
}
.gb:hover{opacity:.85}

/* frame */
.fw{flex:1;position:relative;overflow:hidden;background:var(--bg)}
.pf{width:100%;height:100%;border:none;display:block;background:#fff}

/* LOADING — progress bar style */
.lo{
  position:absolute;inset:0;
  background:var(--bg);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.6rem;
  z-index:10;transition:opacity .35s;
}
.lo.out{opacity:0;pointer-events:none}
.lo-gem{
  width:56px;height:56px;border-radius:18px;
  background:linear-gradient(135deg,#4c1d95,#7c3aed);
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 0 30px rgba(109,40,217,.5);
  animation:glowPulse 1.5s ease-in-out infinite;
}
.lo-gem svg{width:28px;height:28px}
.lo-label{font-family:'JetBrains Mono',monospace;font-size:.74rem;color:var(--sub);max-width:340px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lo-bar{width:240px;height:3px;background:var(--bd2);border-radius:999px;overflow:hidden;position:relative}
.lo-bar::after{content:'';position:absolute;top:0;left:-60%;width:60%;height:100%;background:linear-gradient(90deg,transparent,var(--ac2),var(--ac));border-radius:999px;animation:prog 1.6s ease-in-out infinite}

/* STATUS BAR */
.stbar{
  height:22px;background:rgba(7,5,15,.92);border-top:1px solid var(--bd);
  display:flex;align-items:center;padding:0 .75rem;gap:.5rem;
  flex-shrink:0;font-family:'JetBrains Mono',monospace;font-size:.63rem;color:var(--mu);
}
.dot{width:6px;height:6px;border-radius:50%;background:var(--mu);flex-shrink:0;transition:background .3s}
.dot.loading{background:var(--gold);animation:pulse .9s ease-in-out infinite}
.dot.loaded{background:#4ade80}.dot.error{background:var(--red)}
.sturl{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}

@media(max-width:700px){.tps,.tbrand{display:none}}
`

let cssInjected = false
function injectCSS() {
  if (cssInjected) return; cssInjected = true
  const s = document.createElement('style')
  s.textContent = CSS
  document.head.appendChild(s)
}

/* ═══════════════════════════════════════════
   APP
═══════════════════════════════════════════ */
export default function App() {
  injectCSS()

  const [view,    setView]    = useState('landing')
  const [query,   setQuery]   = useState('')
  const [addrQ,   setAddrQ]   = useState('')
  const [dispURL, setDispURL] = useState('')
  const [engine,  setEngine]  = useState(ENGINES[0])
  const [fs,      setFs]      = useState('idle')   // idle | loading | loaded | error
  const [errURL,  setErrURL]  = useState('#')
  const [lbl,     setLbl]     = useState('')

  const frameRef = useRef(null)
  const timerRef = useRef(null)
  const engRef   = useRef(ENGINES[0])

  useEffect(() => { engRef.current = engine }, [engine])

  /* ── postMessage nav from proxied page ── */
  useEffect(() => {
    const h = e => {
      if (!e.data) return
      if (e.data.type === 'ZH_NAV') {
        const u = e.data.url
        setAddrQ(u); setDispURL(u)
        loadURL(u, engRef.current, false)
      }
      if (e.data.type === 'ZH_ERROR') {
        goHome()
      }
    }
    window.addEventListener('message', h)
    return () => window.removeEventListener('message', h)
  }, [])

  const loadURL = useCallback((q, eng, updateAddr = true) => {
    const target = toTarget(q, eng)
    const proxied = px(target)
    if (updateAddr) { setAddrQ(q); setDispURL(target) }
    setErrURL(target)
    setFs('loading')
    setLbl(target.length > 58 ? target.slice(0, 55) + '…' : target)
    clearTimeout(timerRef.current)
    if (frameRef.current) {
      frameRef.current.src = 'about:blank'
      /* small tick so browser registers the src change before new load */
      setTimeout(() => {
        if (frameRef.current) frameRef.current.src = proxied
      }, 30)
    }
    timerRef.current = setTimeout(() => setFs(p => p === 'loading' ? 'error' : p), 16000)
  }, [])

  const go = useCallback(() => {
    const q = query.trim(); if (!q) return
    setView('browser'); loadURL(q, engine)
  }, [query, engine, loadURL])

  const goAddr = useCallback(() => {
    const q = addrQ.trim(); if (!q) return
    loadURL(q, engine)
  }, [addrQ, engine, loadURL])

  const goHome = useCallback(() => {
    setView('landing'); setFs('idle')
    clearTimeout(timerRef.current)
    if (frameRef.current) frameRef.current.src = 'about:blank'
  }, [])

  const swEng = useCallback(e => {
    setEngine(e); engRef.current = e
    if (view === 'browser' && addrQ) loadURL(addrQ, e)
  }, [view, addrQ, loadURL])

  const shortGo = useCallback(sc => {
    const eng = sc.id ? ENGINES.find(e => e.id === sc.id) : engine
    if (eng) { setEngine(eng); engRef.current = eng }
    const q = sc.url || (eng ? eng.url('') : '')
    setView('browser'); loadURL(q, eng || engine)
  }, [engine, loadURL])

  const frameLoad = useCallback(() => {
    clearTimeout(timerRef.current)
    setTimeout(() => setFs('loaded'), 150)
  }, [])
  const frameErr = useCallback(() => {
    clearTimeout(timerRef.current); setFs('error')
  }, [])

  const reload = useCallback(() => {
    if (!frameRef.current) return
    setFs('loading'); clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setFs(p => p === 'loading' ? 'error' : p), 16000)
    const s = frameRef.current.src
    frameRef.current.src = 'about:blank'
    setTimeout(() => { if (frameRef.current) frameRef.current.src = s }, 60)
  }, [])

  const back = useCallback(() => { try { frameRef.current.contentWindow.history.back() } catch {} }, [])

  useEffect(() => {
    const h = e => { if (e.key === 'Enter') { if (view === 'landing') go(); else goAddr() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [view, go, goAddr])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const dotCls = { idle: '', loading: 'loading', loaded: 'loaded', error: 'error' }[fs] || ''

  /* ── diamond SVG for logo ── */
  const Diamond = ({ size = 38, color = '#fff' }) => (
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none">
      <polygon points="19,3 35,14 19,35 3,14" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
      <polygon points="19,3 35,14 19,20 3,14" fill="rgba(255,255,255,0.15)" stroke={color} strokeWidth="1.2" strokeLinejoin="round"/>
      <line x1="3" y1="14" x2="35" y2="14" stroke={color} strokeWidth="1.2"/>
    </svg>
  )

  return (
    <>
      <Nebula />

      {/* ─── LANDING ─── */}
      <div className={`L${view === 'browser' ? ' out' : ''}`}>
        <div className="logo-wrap">
          <div className="logo-gem"><Diamond /></div>
          <div className="wm">ZenithHub</div>
          <div className="tg">the web, without walls</div>
        </div>

        <div className="sw">
          <input
            className="si"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && go()}
            placeholder="search or paste any URL…"
            autoFocus autoComplete="off" spellCheck={false}
          />
          <button className="sbtn" onClick={go}>
            <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>

        <div className="er">
          <span className="el">search via</span>
          {ENGINES.map(e => (
            <button key={e.id} className={`ep${engine.id === e.id ? ' on' : ''}`}
              onClick={() => { setEngine(e); engRef.current = e }}>
              {e.label}
            </button>
          ))}
        </div>

        <div className="scs">
          {SHORTCUTS.map(sc => (
            <div key={sc.label} className="sc" onClick={() => shortGo(sc)}>
              <div className="sci">{sc.icon}</div>
              <span className="scl">{sc.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── BROWSER ─── */}
      <div className={`B${view === 'browser' ? ' vis' : ''}`}>
        <div className="tb">
          <button className="nb" onClick={goHome} title="Home">
            <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </button>
          <button className="nb" onClick={back} title="Back">
            <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button className="nb" onClick={reload} title="Reload">
            <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>

          <span className="tbrand" onClick={goHome}>ZenithHub</span>

          <div className="aw">
            <svg className="aico" viewBox="0 0 24 24">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              className="ai"
              value={addrQ}
              onChange={e => setAddrQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && goAddr()}
              placeholder="search or paste URL…"
              autoComplete="off" spellCheck={false}
            />
          </div>

          <div className="tps">
            {ENGINES.map(e => (
              <button key={e.id} className={`tp${engine.id === e.id ? ' on' : ''}`} onClick={() => swEng(e)}>
                {e.label}
              </button>
            ))}
          </div>

          <button className="gb" onClick={goAddr}>Go</button>
        </div>

        <div className="fw">
          {/* loading */}
          <div className={`lo${fs !== 'loading' ? ' out' : ''}`}>
            <div className="lo-gem">
              <Diamond size={28} color="#e9d5ff" />
            </div>
            <div className="lo-label">{lbl}</div>
            <div className="lo-bar" />
          </div>

          <iframe
            ref={frameRef}
            className="pf"
            title="ZenithHub"
            onLoad={frameLoad}
            onError={frameErr}
            style={{ display: fs === 'error' ? 'none' : 'block' }}
          />
        </div>

        <div className="stbar">
          <div className={`dot ${dotCls}`} />
          <span className="sturl">{dispURL || 'about:blank'}</span>
          <span style={{ color: 'var(--mu)', marginLeft: 'auto', flexShrink: 0 }}>ZenithHub Proxy</span>
        </div>
      </div>
    </>
  )
}
