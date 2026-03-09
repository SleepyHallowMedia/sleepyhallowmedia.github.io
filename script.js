/* Sleepy Hallow Media — App Script (v7.0)
   Big update: immersive hero, asymmetric mosaic, single topics ribbon.
   Removed all barcode/price/issue bits. No extra category bars.
   Keeps: manifest-driven rendering, search, a11y, OG/Twitter, warm-cache prefetch.
*/
'use strict';

/* ---------- Config ---------- */
const MANIFEST = 'newsletters/index.json';
const NEWS_DIR = 'newsletters/';
const DEFAULT_THUMB = 'thumbnails/placeholder.png';
const MOSAIC_LIMIT = 18;     // how many items to render under the hero
const TOPICS_MAX = 10;       // number of chips in the single topics ribbon

/* ---------- Theme ---------- */
const THEME_COOKIE = 'theme';
function getCookie(name){
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
function setCookie(name,value,days=365){
  const maxAge=days*24*60*60;
  document.cookie=`${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}
function getStoredTheme(){
  const c=getCookie(THEME_COOKIE);
  if (c==='dark' || c==='light') return c;
  try{ const s=localStorage.getItem(THEME_COOKIE); if (s==='dark' || s==='light') return s; }catch{}
  return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
}
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  const btn=document.getElementById('theme-toggle');
  if(btn){
    btn.setAttribute('aria-pressed', theme==='dark'?'true':'false');
    const icon=btn.querySelector('.theme-icon');
    if(icon) icon.textContent = theme==='dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', theme==='dark'?'Switch to light mode':'Switch to dark mode');
  }
}
function initTheme(){
  applyTheme(getStoredTheme());
  const btn=document.getElementById('theme-toggle');
  if(btn){
    btn.addEventListener('click',()=>{
      const next=(document.documentElement.getAttribute('data-theme')==='dark')?'light':'dark';
      applyTheme(next);
      try{ localStorage.setItem(THEME_COOKIE,next);}catch{}
      setCookie(THEME_COOKIE,next,365);
    });
  }
  const explicit=getCookie(THEME_COOKIE) || (()=>{ try{return localStorage.getItem(THEME_COOKIE)}catch{return null} })();
  if(!explicit && window.matchMedia){
    const mq=window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change',e=>applyTheme(e.matches?'dark':'light'));
  }
}

/* ---------- Utils ---------- */
function escapeHtml(str){
  if(str==null) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/\"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
function escapeAttr(str){ return escapeHtml(str).replace(/`/g,'\\`'); }
function sanitizeFilename(filename){
  if(!filename || typeof filename!=='string') return '';
  let f = filename.replace(/\\/g,'/').trim();
  if(f.startsWith('/')) f=f.slice(1);
  if(f.includes('..') || f.startsWith('http:') || f.startsWith('https:')) return '';
  return f;
}
function splitTags(tags){
  if(!tags) return [];
  return String(tags).split(',').map(s=>s.trim()).filter(Boolean);
}
function formatDate(input){
  if(!input) return '';
  const d=new Date(input);
  if(Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
}

/* ---------- Data loaders ---------- */
async function loadManifest(){
  const res=await fetch(MANIFEST, {cache:'no-cache'});
  if(!res.ok) return [];
  try{ return await res.json(); }catch{ return []; }
}
async function loadNewsletter(file){
  const f = file.startsWith('newsletters/') ? file : `${NEWS_DIR}${file}`;
  const res=await fetch(f, {cache:'no-cache'});
  if(!res.ok) throw new Error('fetch failed');
  const text=await res.text();
  return parseFrontmatter(text);
}
function parseFrontmatter(text){
  const src=String(text??'').replace(/\r/g,'').replace(/^\uFEFF/, '').replace(/^\s+/, '');
  if(!src.startsWith('---\n') && src!=='---'){
    return {meta:{}, body:src.trim()};
  }
  const lines=src.split('\n');
  const meta={};
  let i=1;
  for(; i<lines.length; i++){
    const line=lines[i].trim();
    if(line==='---'){ i++; break; }
    if(!line) continue;
    const m=line.match(/^(.*?):\s*(.*)$/);
    if(m) meta[m[1].trim()]=m[2].trim();
  }
  const body=lines.slice(i).join('\n').trim();
  return {meta, body};
}

/* ---------- Search helpers ---------- */
function normalize(str){ return String(str??'').toLowerCase(); }
function itemScore(item,q){
  const {meta,body}=item; const nQ=normalize(q); let score=0; const addIf=(c,w)=>{if(c)score+=w;};
  addIf(normalize(meta.Title).includes(nQ),8);
  addIf(normalize(meta.Subtitle).includes(nQ),5);
  addIf(normalize(meta.Author).includes(nQ),4);
  addIf(normalize(meta.Category).includes(nQ),4);
  addIf((item.meta._tags||[]).some(t=>normalize(t).includes(nQ)),3);
  addIf(normalize(body).slice(0,800).includes(nQ),1);
  return score;
}
function searchItems(items,query){
  const q=query?.trim(); if(!q) return items;
  const ranked=items.map(it=>({it,s:itemScore(it,q)})).filter(x=>x.s>0)
    .sort((a,b)=> b.s - a.s || ((b.it.meta._dateObj||0) - (a.it.meta._dateObj||0)));
  return ranked.map(x=>x.it);
}

/* ---------- Prefetch ---------- */
const PREFETCH_KEY_PREFIX='pre:';
function getPrefetchKey(file){ return PREFETCH_KEY_PREFIX + file; }
async function primeArticle(file){
  const f=sanitizeFilename(file); if(!f) return;
  const key=getPrefetchKey(f);
  if(sessionStorage.getItem(key)) return;
  try{
    const path=f.startsWith('newsletters/')?f:`${NEWS_DIR}${f}`;
    const res=await fetch(path,{cache:'force-cache'});
    if(!res.ok) return; const text=await res.text();
    sessionStorage.setItem(key, text);
  }catch{}
}
function hookHoverPrefetch(){
  document.addEventListener('mouseover', e=>{
    const a=e.target.closest('a[href*="article.html?"]'); if(!a) return;
    const u=new URL(a.href, location.href); const file=u.searchParams.get('article');
    primeArticle(file);
  }, {passive:true});
  document.addEventListener('focusin', e=>{
    const a=e.target.closest('a[href*="article.html?"]'); if(!a) return;
    const u=new URL(a.href, location.href); const file=u.searchParams.get('article');
    primeArticle(file);
  });
}

/* ---------- Image handling ---------- */
function resolveThumbPath(input){
  let f = (input||'').trim();
  if(!f) return DEFAULT_THUMB;
  if(/^https?:\/\//i.test(f)) return f;            // absolute URL allowed (referrer-free load below)
  if(f.startsWith('./')) f = f.slice(2);
  if(f.startsWith('/'))  return f;                 // root-relative
  if(/^thumbnails\//i.test(f)) return f;           // already in thumbnails/
  return `thumbnails/${f}`;
}
function attachImageFallbacks(root = document) {
  const placeholder = DEFAULT_THUMB;
  root.querySelectorAll('img[data-fallback]').forEach(img => {
    if (img.__fallbackAttached) return;
    img.__fallbackAttached = true;
    img.addEventListener('error', () => {
      if (!img.src.endsWith(placeholder)) img.src = placeholder;
    }, { once: true });
  });
}
function imgTag({src, cls, eager=false}){
  const attrs = [];
  if (cls) attrs.push(`class="${escapeAttr(cls)}"`);
  const s = escapeAttr(src || DEFAULT_THUMB);
  attrs.push(`src="${s}"`);
  attrs.push('alt=""');
  attrs.push('referrerpolicy="no-referrer"');
  attrs.push('data-fallback="1"');
  attrs.push('decoding="async"');
  attrs.push(eager ? 'loading="eager"' : 'loading="lazy"');
  return `<img ${attrs.join(' ')} />`;
}

/* ---------- A11y helpers ---------- */
function ensureListRoles(){
  const latest = document.getElementById('mosaic-grid');
  if(latest && !latest.getAttribute('role')) latest.setAttribute('role','list');
}

/* ---------- Link helper ---------- */
function articleUrl(file){ return `article.html?article=${encodeURIComponent(file)}`; }

/* ---------- HERO ---------- */
function heroHTML(item){
  const {file, meta} = item;
  const title = meta.Title || file;
  const sub = meta.Subtitle ? `<p class="hero-sub">${escapeHtml(meta.Subtitle)}</p>` : '';
  const date = formatDate(meta.Date);
  const author = meta.Author || 'Staff';
  const img = resolveThumbPath(meta.Thumbnail);
  const url = articleUrl(file);
  const metaLine = `${escapeHtml(date)}${date ? ' • ' : ''}${escapeHtml(author)}`;
  return `
    <a class="hero-overlay" href="${escapeAttr(url)}" aria-label="${escapeAttr(title)}"></a>
    ${imgTag({src: img, cls:'hero-bg', eager:true})}
    <div class="hero-body">
      <h2 class="hero-kicker">${escapeHtml(meta.Category || '')}</h2>
      <h1 class="hero-title"><a href="${escapeAttr(url)}">${escapeHtml(title)}</a></h1>
      ${sub}
      <p class="hero-meta">${metaLine}</p>
    </div>`;
}

/* ---------- MOSAIC (asymmetric) ---------- */
const MOSAIC_PATTERN = [
  'lg','tall','wide','sm','sm','wide','sm','tall','sm','sm','wide','sm','sm','tall','sm','wide','sm','sm'
];
function mosaicTile(item, size){
  const { file, meta } = item;
  const title = meta.Title || file;
  const img = resolveThumbPath(meta.Thumbnail);
  const date = formatDate(meta.Date);
  const author = meta.Author || 'Staff';
  const sub = meta.Subtitle ? `<p class="tile-sub">${escapeHtml(meta.Subtitle)}</p>` : '';
  const url = articleUrl(file);

  const a = document.createElement('a');
  a.className = `tile tile-${size}`;
  a.href = url;
  a.setAttribute('aria-label', title);
  a.setAttribute('role','listitem');
  a.innerHTML = `
    ${imgTag({src: img, cls:'tile-img'})}
    <div class="tile-body">
      ${meta.Category ? `<span class="chip">${escapeHtml(meta.Category)}</span>` : ''}
      <h3 class="tile-title">${escapeHtml(title)}</h3>
      <div class="tile-meta">${escapeHtml(date)}${date ? ' • ' : ''}${escapeHtml(author)}</div>
      ${sub}
    </div>`;
  return a;
}

/* ---------- TOPICS RIBBON (single, compact) ---------- */
function topicsHTML(data){
  const counts=new Map();
  for(const it of data){
    for(const t of (it.meta._tags||[])){
      const k=t.trim(); if(!k) continue;
      counts.set(k,(counts.get(k)||0)+1);
    }
  }
  const list=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,TOPICS_MAX);
  if(!list.length) return 'No topics yet';
  return list.map(([k])=>`<a href="newsletters.html?tag=${encodeURIComponent(k)}">${escapeHtml(k)}</a>`).join('');
}

/* ---------- Visible items ---------- */
function truthy(v){
  if(typeof v==='boolean') return v;
  if(typeof v==='number') return v!==0;
  if(typeof v==='string') return /^(true|yes|1)$/i.test(v.trim());
  return false;
}
async function loadVisibleSorted(){
  const manifest=await loadManifest(); if(!manifest.length) return [];
  const items=(await Promise.all(manifest.map(async f=>{
    try{
      const {meta,body}=await loadNewsletter(f);
      meta._dateObj=meta.Date?new Date(meta.Date):null;
      meta._tags=splitTags(meta.Tags);
      return {file:f, meta, body};
    }catch{ return null; }
  }))).filter(Boolean);
  const visible=items.filter(r=>!truthy(r.meta.Hidden));
  visible.sort((a,b)=>{
    const ad=a.meta._dateObj, bd=b.meta._dateObj;
    const aOk=ad&&!Number.isNaN(ad?.getTime?.());
    const bOk=bd&&!Number.isNaN(bd?.getTime?.());
    if(aOk&&bOk) return bd-ad;
    if(aOk) return -1;
    if(bOk) return 1;
    return b.file.localeCompare(a.file);
  });
  return visible;
}

/* ---------- Render Home (hero + mosaic + topics) ---------- */
async function renderHome(){
  const heroEl = document.getElementById('lead-story');
  const mosaic = document.getElementById('mosaic-grid');
  const topics = document.getElementById('topics-ribbon');

  // If none of the home pieces exist, bail out.
  if(!heroEl && !mosaic && !topics) return;

  const data=await loadVisibleSorted();
  if(!data.length){
    if(heroEl){
      heroEl.innerHTML = `<div class="hero-body"><h1 class="hero-title">No stories yet</h1><p class="hero-meta">Add .txt files under <code>newsletters/</code></p></div>`;
      heroEl.removeAttribute('aria-busy');
    }
    if(mosaic){ mosaic.innerHTML = ''; mosaic.removeAttribute('aria-busy'); }
    if(topics){ topics.innerHTML = 'No topics yet'; }
    return;
  }

  // HERO
  if(heroEl){
    heroEl.style.position = heroEl.style.position || 'relative';
    heroEl.innerHTML = heroHTML(data[0]);
    heroEl.removeAttribute('aria-busy');
  }

  // MOSAIC
  if(mosaic){
    mosaic.innerHTML='';
    const list = data.slice(1, 1 + MOSAIC_LIMIT);
    const pattern = MOSAIC_PATTERN;
    for(let i=0;i<list.length;i++){
      const size = pattern[i % pattern.length];
      mosaic.appendChild(mosaicTile(list[i], size));
    }
    mosaic.removeAttribute('aria-busy');
  }

  // TOPICS (single ribbon)
  if(topics){
    topics.innerHTML = topicsHTML(data);
  }

  attachImageFallbacks();
  ensureListRoles();
  hookHoverPrefetch();
}

/* ---------- List page (unchanged behavior; renders into #news-list) ---------- */
function parseTagsParam(value){ if(!value) return []; return value.split(',').map(s=>s.trim()).filter(Boolean); }
async function renderListPage(){
  const container=document.getElementById('news-list'); if(!container) return;
  container.setAttribute('aria-busy','true');

  const params=new URLSearchParams(location.search);
  const q=params.get('q')?.trim();
  const activeCat=params.get('category')?.trim();
  const tagParam=params.get('tag')?.trim();
  const activeTags=parseTagsParam(tagParam).map(t=>t.toLowerCase());

  const data=await loadVisibleSorted();

  // Category chips
  const chipWrap=document.getElementById('category-chips');
  if(chipWrap){
    const cats=[...new Set(data.map(i=>(i.meta.Category||'').trim()).filter(Boolean))].sort();
    chipWrap.innerHTML=cats.map(c=>`<a href="newsletters.html?category=${encodeURIComponent(c)}">${escapeHtml(c)}</a>`).join('');
  }

  // Tag cloud (toggle anchors)
  const tagWrap=document.getElementById('tag-cloud');
  if(tagWrap){
    const counts=new Map();
    for(const i of data){
      for(const t of (i.meta._tags||[])){
        const key=t.trim(); if(!key) continue;
        counts.set(key,(counts.get(key)||0)+1);
      }
    }
    const list=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20);
    tagWrap.innerHTML = list.length ? list.map(([t])=>{
      const url=new URL(location.href);
      const current=(url.searchParams.get('tag')||'').split(',').map(s=>s.trim()).filter(Boolean).map(x=>x.toLowerCase());
      const isOn=current.includes(t.toLowerCase());
      const next=isOn ? current.filter(x=>x!==t.toLowerCase()) : [...new Set([...current,t.toLowerCase()])];
      if(next.length) url.searchParams.set('tag', next.join(',')); else url.searchParams.delete('tag');
      return `<a href="${escapeAttr(url.pathname + url.search)}">${escapeHtml(t)}</a>`;
    }).join('') : 'No tags yet';
  }

  // Filters
  let filtered=activeCat ? data.filter(i=>(i.meta.Category||'').trim().toLowerCase()===activeCat.toLowerCase()) : data;
  if(activeTags.length){
    filtered=filtered.filter(i=>{
      const tags=(i.meta._tags||[]).map(t=>t.toLowerCase());
      return activeTags.some(t=>tags.includes(t));
    });
  }
  if(q) filtered=searchItems(filtered,q);

  // Info line
  const info=document.getElementById('active-filter');
  if(info){
    const parts=[];
    if(q) parts.push(`“${escapeHtml(q)}”`);
    if(activeCat) parts.push(`Category: ${escapeHtml(activeCat)}`);
    if(activeTags.length) parts.push(`Tags: ${escapeHtml(activeTags.join(', '))}`);
    info.textContent = parts.length ? `${filtered.length} result(s) — ${parts.join(' • ')}` : '';
  }

  // Render list grid (reuse mosaic tile visuals for consistency)
  container.innerHTML='';
  if(!filtered.length){
    container.innerHTML=`<div class="muted">No items found${q?` for “${escapeHtml(q)}”`:''}${activeCat?` in ${escapeHtml(activeCat)}`:''}${activeTags.length?` with tags: ${escapeHtml(activeTags.join(', '))}`:''}.</div>`;
    container.removeAttribute('aria-busy');
    return;
  }
  // Use a simple pattern for list view (visually lighter)
  const listPattern = ['wide','sm','sm','tall','sm','sm'];
  filtered.forEach((it,i)=> container.appendChild(mosaicTile(it, listPattern[i % listPattern.length])));
  container.removeAttribute('aria-busy');

  attachImageFallbacks(container);
  ensureListRoles();
  hookHoverPrefetch();
}

/* ---------- Markdown safe render ---------- */
function renderMarkdownSafe(text){
  if(typeof window!=='undefined'&&window.marked&&window.DOMPurify){
    const raw=window.marked.parse(String(text??''));
    return window.DOMPurify.sanitize(raw,{ALLOWED_ATTR:['href','src','alt','title','class']});
  }
  return String(text??'').split(/\n\s*\n/).map(p=>`<p>${escapeHtml(p.trim())}</p>`).join('');
}

/* ---------- OG/Twitter & Canonical ---------- */
function applyOpenGraph(meta, file){
  const title = (meta.Title || file || 'Article').trim();
  const desc = (meta.Subtitle || '').trim();
  const img = resolveThumbPath(meta.Thumbnail) || DEFAULT_THUMB;
  const url = location.href;

  const set=(id,val)=>{ const el=document.getElementById(id); if(el && (!el.content || el.content==='')) el.content=val; };
  set('og-title', title); set('og-description', desc); set('og-image', img); set('og-url', url);
  set('tw-title', title); set('tw-description', desc); set('tw-image', img);

  const canon = document.getElementById('canonical');
  if (canon) { try { canon.href = url; } catch {} }
}

/* ---------- Article page ---------- */
function readingTimeFromText(text,wpm=200){
  const words=String(text??'').trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1,Math.round(words/wpm))} min read`;
}
function populateArticleHero(meta){
  const bg=document.querySelector('.a-hero-bg');
  const titleEl=document.getElementById('article-title');
  const subEl=document.getElementById('article-subtitle');
  const metaEl=document.getElementById('article-meta');
  const catEl=document.getElementById('article-category');

  const title=meta.Title||'Untitled';
  const date=formatDate(meta.Date);
  const author=meta.Author||'Staff';
  const cat=(meta.Category||'').trim();

  if(titleEl) titleEl.textContent=title;
  if(subEl)   subEl.textContent = meta.Subtitle||'';
  if(metaEl)  metaEl.textContent = `${date}${date?' • ':''}${author}`;
  if(catEl){ if(cat){ catEl.hidden=false; catEl.textContent=cat; } else { catEl.hidden=true; } }

  const img=resolveThumbPath(meta.Thumbnail);
  if(bg){
    bg.src = encodeURI(img);
    bg.setAttribute('alt','');
    bg.setAttribute('referrerpolicy','no-referrer');
    bg.setAttribute('data-fallback','1');
    bg.loading='eager';
    bg.decoding='async';
  }
}
function buildShareLinks(title){
  const url=location.href;
  const email=document.querySelector('[data-share="email"]');
  const reddit=document.querySelector('[data-share="reddit"]');
  const x=document.querySelector('[data-share="x"]');
  const copy=document.querySelector('[data-share="copy"]');
  const fb=document.getElementById('share-feedback');

  if(email)  email.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;
  if(reddit) reddit.href= `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
  if(x)      x.href     = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  if(copy){
    copy.addEventListener('click', async ()=>{
      try{ await navigator.clipboard.writeText(url); if(fb){ fb.textContent='Link copied!'; setTimeout(()=>fb.textContent='',1400); } }
      catch{ if(fb){ fb.textContent='Copy failed.'; setTimeout(()=>fb.textContent='',1400); } }
    });
  }
}
function renderArticle(container, filename, meta, body){
  populateArticleHero(meta);
  applyOpenGraph(meta, filename);

  const reading=readingTimeFromText(body,200);
  const rt=document.getElementById('article-reading-time');
  if(rt) rt.textContent=` • ${reading}`;

  // Tags beneath hero
  const tags=(meta.Tags?splitTags(meta.Tags):[]);
  const bylineWrap=document.querySelector('.a-hero .a-hero-inner');
  if(tags.length && bylineWrap){
    const tagDiv=document.createElement('div');
    tagDiv.className='a-tags';
    tagDiv.innerHTML = tags.map(t=>`<a href="newsletters.html?tag=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`).join('');
    bylineWrap.appendChild(tagDiv);
  }

  const bodyHtml = renderMarkdownSafe(body);
  const date=formatDate(meta.Date);
  const author=meta.Author||'Staff';
  const metaLine=`${date}${date?' • ':''}${author}`;

  container.innerHTML = `
    ${meta.Subtitle?`<p class="muted">${escapeHtml(meta.Subtitle)}</p>`:''}
    <p class="muted">${escapeHtml(metaLine)} • ${escapeHtml(reading)}</p>
    ${bodyHtml}`;
  container.removeAttribute('aria-busy');

  attachImageFallbacks(container);
  document.title=`${meta.Title||filename} — Sleepy Hallow Media`;

  buildShareLinks(meta.Title || filename);
}
async function initArticlePage(){
  const content=document.getElementById('article-content');
  if(!content) return;

  content.setAttribute('aria-busy','true');
  content.innerHTML = `<p class="muted">Loading article…</p>`;

  const params=new URLSearchParams(window.location.search);
  const raw=params.get('article');
  const file=sanitizeFilename(raw);
  if(!file){
    content.innerHTML=`<div class="muted">Missing or invalid article parameter.</div>`;
    content.removeAttribute('aria-busy'); return;
  }

  const warmKey='pre:'+file;
  const warmed=sessionStorage.getItem(warmKey);
  if(warmed){
    try{
      const parsed=parseFrontmatter(warmed);
      renderArticle(content, file, parsed.meta, parsed.body);
      return;
    }catch{}
  }

  try{
    const parsed=await loadNewsletter(file);
    renderArticle(content, file, parsed.meta, parsed.body);
  }catch(e){
    console.error(e);
    content.innerHTML=`<div class="muted">Could not load this article.</div>`;
    content.removeAttribute('aria-busy');
  }
}

/* ---------- Nav / header ---------- */
function markCurrentNav(){
  const file=(location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const map={'index.html':'home','newsletters.html':'newsletters'};
  const key=map[file]; if(!key) return;
  document.querySelectorAll(`[data-nav="${key}"]`).forEach(a=>a.setAttribute('aria-current','page'));
}
function initMobile(){
  const btn=document.querySelector('.nav-toggle');
  const menu=document.getElementById('mobile-menu');
  if(btn&&menu){
    btn.addEventListener('click',()=>{
      const open=menu.classList.toggle('active');
      btn.setAttribute('aria-expanded', open?'true':'false');
    });
  }
}
function hijackHeaderSearch(){
  const form=document.getElementById('site-search');
  if(!form) return;
  form.addEventListener('submit',(e)=>{
    const input=form.querySelector('input[name="q"]');
    if(!input || !input.value.trim()){ e.preventDefault(); }
  });
}

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  initTheme(); initMobile(); markCurrentNav(); hijackHeaderSearch();
  renderHome(); renderListPage(); initArticlePage();
});
