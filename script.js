/* Sleepy Hallow Media — App (v6.1.4)
   Warm, whimsical-but-radical UX. Dynamic topic sections. Sticky share.
   Sleek Newsletters grid with compact mode for small result sets.
   FIX: Output real <a> and <img> elements everywhere (prevents raw URLs/text),
        which also removes the “stray article” on the homepage. */

'use strict';

/* ---------- Config ---------- */
const MANIFEST = 'newsletters/index.json';
const NEWS_DIR = 'newsletters/';
const DEFAULT_THUMB = 'thumbnails/placeholder.png';
const HOMEPAGE_LATEST_LIMIT = 12;
const SIDEBAR_LATEST_LIMIT = 8;

/* Topic library (rotates). Use tags you actually publish with. */
const FEATURED_TOPICS = [
  { tag: 'Politics',  head: 'Interested in politics?',  sub: 'Here are stories that will feed that hunger!' },
  { tag: 'Local',     head: 'What’s happening nearby?', sub: 'Local stories, close to home.' },
  { tag: 'Opinion',   head: 'Want strong takes?',       sub: 'Opinion pieces you might like.' },
  { tag: 'Culture',   head: 'Craving culture?',         sub: 'Arts, media, and more.' },
  { tag: 'Business',  head: 'Market mind on?',          sub: 'Business and the bottom line.' },
  { tag: 'Tech',      head: 'Feeling curious about tech?', sub: 'Gadgets, policy, and the future.' },
];

/* ---------- Theme ---------- */
const THEME_COOKIE = 'theme';
function getCookie(name){
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const m = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
function setCookie(name,value,days=365){
  const maxAge=days*24*60*60;
  document.cookie=`${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}
function getStoredTheme(){
  const c=getCookie(THEME_COOKIE);
  if(c==='dark'||c==='light') return c;
  try{
    const s=localStorage.getItem(THEME_COOKIE);
    if(s==='dark'||s==='light') return s;
  }catch{}
  return (window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';
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
  const explicit=getCookie(THEME_COOKIE) || (()=>{try{return localStorage.getItem(THEME_COOKIE)}catch{return null}})();
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
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
function escapeAttr(str){ return escapeHtml(str).replace(/`/g,'`'); }
function sanitizeFilename(filename){
  if(!filename || typeof filename!=='string') return '';
  let f = filename.replace(/\\/g,'/').trim();
  if(f.startsWith('/')) f=f.slice(1);
  if(f.includes('..') || f.startsWith('http:') || f.startsWith('https:')) return '';
  return f;
}
function parseFrontmatter(text){
  let src=String(text??'').replace(/\r/g,'').replace(/^\uFEFF/,'').replace(/^\s+/, '');
  if(!src.startsWith('---\n')&&src!=='---'){ return {meta:{}, body:src.trim()}; }
  const lines=src.split('\n');
  const meta={}; let i=1;
  for(;i<lines.length;i++){
    const line=lines[i].trim();
    if(line==='---'){ i++; break; }
    if(!line) continue;
    const m=line.match(/^([^:]+)\s*:\s*(.*)$/);
    if(m) meta[m[1].trim()]=m[2].trim();
  }
  const body=lines.slice(i).join('\n').trim();
  return {meta, body};
}
async function loadManifest(){
  try{
    const res=await fetch(MANIFEST,{cache:'no-store'});
    if(!res.ok) throw new Error(`Manifest not found: ${MANIFEST}`);
    const data=await res.json();
    if(!Array.isArray(data)) return [];
    return data.map(sanitizeFilename).filter(Boolean);
  }catch(err){
    console.warn('Could not load manifest:',err);
    return [];
  }
}
async function loadNewsletter(filename){
  const f=sanitizeFilename(filename);
  if(!f) throw new Error('Invalid filename');
  const path=f.startsWith('newsletters/')?f:`${NEWS_DIR}${f}`;
  const res=await fetch(path,{cache:'no-store'});
  if(!res.ok) throw new Error(`Failed to fetch ${path}`);
  const text=await res.text();
  return parseFrontmatter(text);
}
function formatDate(dateStr){
  if(!dateStr) return '';
  const d=new Date(dateStr);
  if(Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
}
function resolveThumbPath(t){
  if(!t) return DEFAULT_THUMB;
  const s=String(t).trim();
  if(/^(https?:)?\/\//i.test(s) || s.startsWith('/') || s.startsWith('thumbnails/') || s.startsWith('newsletters/')) return s;
  return `thumbnails/${s}`;
}
function isTruthy(v){
  if(v===true) return true;
  if(typeof v==='string') return /^(true|yes|1)$/i.test(v.trim());
  if(typeof v==='number') return v!==0;
  return false;
}
function splitTags(value){
  if(!value) return [];
  return String(value).split(',').map(s=>s.trim()).filter(Boolean);
}
function renderMarkdownSafe(text){
  if(typeof window!=='undefined'&&window.marked&&window.DOMPurify){
    const raw=window.marked.parse(String(text??''));
    return window.DOMPurify.sanitize(raw,{ALLOWED_ATTR:['href','src','alt','title','class']});
  }
  return String(text??'').split(/\n\s*\n/).map(p=>`<p>${escapeHtml(p.trim())}</p>`).join('');
}

/* ---------- Nav / header ---------- */
function markCurrentNav(){
  const file=(location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const map={'index.html':'home','newsletters.html':'newsletters'};
  const key=map[file];
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
    if(!input || !input.value.trim()){
      e.preventDefault();
    }
  });
}

/* ---------- Data helpers ---------- */
async function loadVisibleSorted(){
  const manifest=await loadManifest();
  if(!manifest.length) return [];
  const items=(await Promise.all(manifest.map(async f=>{
    try{
      const {meta,body}=await loadNewsletter(f);
      meta._dateObj=meta.Date?new Date(meta.Date):null;
      meta._tags=splitTags(meta.Tags);
      return {file:f, meta, body};
    }catch{
      return null;
    }
  }))).filter(Boolean);
  const visible=items.filter(r=>!isTruthy(r.meta.Hidden));
  visible.sort((a,b)=>{
    const ad=a.meta._dateObj, bd=b.meta._dateObj;
    const aOk=ad&&!Number.isNaN(ad.getTime());
    const bOk=bd&&!Number.isNaN(bd.getTime());
    if(aOk&&bOk) return bd-ad;
    if(aOk) return -1;
    if(bOk) return 1;
    return b.file.localeCompare(a.file);
  });
  return visible;
}

/* ---------- Search ranking ---------- */
function normalize(str){ return String(str??'').toLowerCase(); }
function itemScore(item,q){
  const {meta,body}=item; const nQ=normalize(q); let score=0;
  const addIf=(c,w)=>{if(c)score+=w;};
  addIf(normalize(meta.Title).includes(nQ),8);
  addIf(normalize(meta.Subtitle).includes(nQ),5);
  addIf(normalize(meta.Author).includes(nQ),4);
  addIf(normalize(meta.Category).includes(nQ),4);
  addIf((meta._tags||[]).some(t=>normalize(t).includes(nQ)),3);
  addIf(normalize(body).slice(0,800).includes(nQ),1);
  return score;
}
function searchItems(items,query){
  const q=query?.trim(); if(!q) return items;
  const ranked=items
    .map(it=>({it,s:itemScore(it,q)}))
    .filter(x=>x.s>0)
    .sort((a,b)=> b.s - a.s || (b.it.meta._dateObj - a.it.meta._dateObj));
  return ranked.map(x=>x.it);
}

/* ---------- Prefetch + warm cache ---------- */
const PREFETCH_KEY_PREFIX='pre:';
function getPrefetchKey(file){ return PREFETCH_KEY_PREFIX + file; }
async function primeArticle(file){
  const f=sanitizeFilename(file); if(!f) return;
  const key=getPrefetchKey(f);
  if(sessionStorage.getItem(key)) return;
  try{
    const path=f.startsWith('newsletters/')?f:`${NEWS_DIR}${f}`;
    const res=await fetch(path,{cache:'force-cache'});
    if(!res.ok) return;
    const text=await res.text();
    sessionStorage.setItem(key, text);
  }catch{}
}
function hookHoverPrefetch(){
  document.addEventListener('mouseover', e=>{
    const a=e.target.closest('a[href*="article.html?"]'); if(!a) return;
    const u=new URL(a.href, location.href); const file=u.searchParams.get('article'); primeArticle(file);
  }, {passive:true});
  document.addEventListener('focusin', e=>{
    const a=e.target.closest('a[href*="article.html?"]'); if(!a) return;
    const u=new URL(a.href, location.href); const file=u.searchParams.get('article'); primeArticle(file);
  });
  const io=new IntersectionObserver((entries)=>{
    for(const entry of entries){
      if(entry.isIntersecting){
        const a=entry.target;
        try{
          const u=new URL(a.href, location.href); const file=u.searchParams.get('article'); primeArticle(file);
        }catch{}
        io.unobserve(a);
      }
    }
  },{rootMargin:'300px 0px'});
  document.querySelectorAll('a[href*="article.html?"]').forEach(a=>io.observe(a));
}

/* ---------- Image hints ---------- */
function enhanceImages(){
  document.querySelectorAll('.top-card img').forEach(img=>{
    img.loading='lazy'; img.decoding='async'; img.sizes='(max-width:980px) 92vw, 120px';
  });
  document.querySelectorAll('.cards-grid img').forEach(img=>{
    img.loading='lazy'; img.decoding='async';
    img.sizes='(max-width:600px) 92vw, (max-width:1200px) 33vw, 260px';
  });
  const hero=document.querySelector('.a-hero-bg');
  if(hero){ hero.decoding='async'; }
}

/* ---------- A11y helpers ---------- */
function ensureListRoles(){
  const top = document.getElementById('top-stories');
  const latest = document.getElementById('latest-grid');
  const right = document.getElementById('right-rail');
  const sideList = document.getElementById('sidebar-latest');
  if(top && !top.getAttribute('role')) top.setAttribute('role','list');
  if(latest && !latest.getAttribute('role')) latest.setAttribute('role','list');
  if(right && !right.getAttribute('role')) right.setAttribute('role','list');
  if(sideList && !sideList.getAttribute('role')) sideList.setAttribute('role','list');
}

/* ---------- Card builders (REAL TAGS) ---------- */
function leadCardHTML(item){
  const { file, meta } = item;
  const title = meta.Title || file;
  const cat = (meta.Category || '').trim();
  const date = formatDate(meta.Date);
  const author = meta.Author || 'Staff';
  const img = resolveThumbPath(meta.Thumbnail);
  const url = `article.html?article=${encodeURIComponent(file)}`;

  return `
    ${escapeAttr(url)}</a>
    ${escapeAttr(img)}
    <div class="lead-body">
      ${cat ? `<span class="kicker">${escapeHtml(cat)}</span>` : ''}
      <h2 class="lead-title">${escapeAttr(url)}${escapeHtml(title)}</a></h2>
      <div class="lead-meta">${escapeHtml(date)}${date ? ' • ' : ''}${escapeHtml(author)}</div>
    </div>
  `;
}
function topCardHTML(item){
  const { file, meta } = item;
  const title = meta.Title || file;
  const img = resolveThumbPath(meta.Thumbnail);
  const date = formatDate(meta.Date);
  const author = meta.Author || 'Staff';
  const url = `article.html?article=${encodeURIComponent(file)}`;

  return `
    ${escapeAttr(url)}
      ${escapeAttr(img)}
    </a>
    <div class="top-body">
      <h3 class="top-title">${escapeAttr(url)}${escapeHtml(title)}</a></h3>
      <div class="top-meta">${escapeHtml(date)}${date ? ' • ' : ''}${escapeHtml(author)}</div>
    </div>
  `;
}
function gridCard(item){
  const { file, meta } = item;
  const img = resolveThumbPath(meta.Thumbnail);
  const title = meta.Title || file;
  const date = formatDate(meta.Date);
  const author = meta.Author || 'Staff';
  const chip = meta.Category ? `<span class="chip" title="Category">${escapeHtml(meta.Category)}</span>` : '';
  const tags = (meta._tags || []).slice(0, 2).map(t => `<span class="chip" title="Tag">${escapeHtml(t)}</span>`).join('');
  const sub = meta.Subtitle ? `<p class="card-sub">${escapeHtml(meta.Subtitle)}</p>` : '';
  const url = `article.html?article=${encodeURIComponent(file)}`;

  const a = document.createElement('a');
  a.className = 'card';
  a.href = url;
  a.setAttribute('aria-label', title);
  a.setAttribute('role','listitem');
  a.innerHTML = `
    ${escapeAttr(img)}
    <div class="card-body">
      ${chip}${tags}
      <h3 class="card-title">${escapeHtml(title)}</h3>
      <div class="card-meta">${escapeHtml(date)}${date ? ' • ' : ''}${escapeHtml(author)}</div>
      ${sub}
    </div>`;
  return a;
}

/* ---------- Homepage render ---------- */
async function renderHome(){
  const leadEl=document.getElementById('lead-story');
  const topEl=document.getElementById('top-stories');
  const latest=document.getElementById('latest-grid');
  const sList=document.getElementById('sidebar-latest');
  const trend=document.getElementById('trend-topics');

  if(!leadEl && !topEl && !latest && !sList && !trend) return;

  if(leadEl){ leadEl.setAttribute('aria-busy','true'); }
  if(latest){ latest.setAttribute('aria-busy','true'); }

  const data=await loadVisibleSorted();

  // Empty state
  if(!data.length){
    if(leadEl){
      leadEl.innerHTML = `
        <div class="lead-body">
          <h2 class="lead-title">No articles yet</h2>
          <div class="lead-meta">Add .txt files to <code>newsletters/</code> and update <code>newsletters/index.json</code>.</div>
        </div>`;
      leadEl.removeAttribute('aria-busy');
    }
    if(topEl){ topEl.innerHTML = `<div class="muted" role="status">No top stories available.</div>`; }
    if(latest){ latest.innerHTML = `<div class="muted" role="status">No latest stories to show.</div>`; latest.removeAttribute('aria-busy'); }
    if(trend){ trend.innerHTML = `<span class="muted">No trending tags yet</span>`; }
    return;
  }

  // Lead
  if(leadEl){
    leadEl.innerHTML = leadCardHTML(data[0]);
    leadEl.removeAttribute('aria-busy');
  }

  // Top rail (next 4)
  if(topEl){
    topEl.innerHTML='';
    for(const item of data.slice(1,5)){
      const card=document.createElement('article');
      card.className='top-card';
      card.setAttribute('role','listitem');
      card.innerHTML=topCardHTML(item);
      topEl.appendChild(card);
    }
  }

  // Latest grid (next 12)
  if(latest){
    latest.innerHTML='';
    for(const item of data.slice(5, 5 + HOMEPAGE_LATEST_LIMIT)){
      latest.appendChild(gridCard(item));
    }
    latest.removeAttribute('aria-busy');
  }

  // Sidebar latest list (anchors)
  if(sList){
    sList.innerHTML='';
    for(const item of data.slice(5, 5 + SIDEBAR_LATEST_LIMIT)){
      const li=document.createElement('li');
      li.setAttribute('role','listitem');
      const date=formatDate(item.meta.Date);
      const url = `article.html?article=${encodeURIComponent(item.file)}`;
      li.innerHTML = `${escapeAttr(url)}${escapeHtml(item.meta.Title || item.file)}</a>
      <div class="muted" style="font-size:.85rem">${escapeHtml(date)}</div>`;
      sList.appendChild(li);
    }
    sList.removeAttribute('aria-busy');
  }

  // Trending tags (real anchors)
  if(trend){
    const counts=new Map();
    for(const it of data){
      for(const t of (it.meta._tags||[])){
        const key=t.trim(); if(!key) continue;
        counts.set(key,(counts.get(key)||0)+1);
      }
    }
    const topTags=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);
    trend.innerHTML = topTags.length
      ? topTags.map(([k])=>`newsletters.html?tag=${encodeURIComponent(k)}${escapeHtml(k)}</a>`).join('')
      : `<span class="muted">No trending tags yet</span>`;
  }

  // Dynamic topic sections + playful copy
  renderDynamicSections(data);

  enhanceImages();
  ensureListRoles();
  hookHoverPrefetch();
}

/* ---------- Dynamic sections after About ---------- */
function seededRand(seed){
  // simple LCG-ish
  let x = Math.sin(seed) * 10000;
  return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
}
function chooseTopics(allItems){
  // Pick 2–3 topics that actually exist in content, rotate daily
  const dayKey = Number(new Date().toISOString().slice(0,10).replace(/-/g,''));
  const rand = seededRand(dayKey);
  const present = new Set();
  for(const it of allItems){ for(const t of (it.meta._tags||[])) present.add(t.toLowerCase()); }
  const pool = FEATURED_TOPICS.filter(t => present.has(t.tag.toLowerCase()));
  if(pool.length === 0) return [];
  const count = Math.min(pool.length, (rand() > 0.5 ? 3 : 2));
  const picked = [];
  const usedIdx = new Set();
  while(picked.length < count && usedIdx.size < pool.length){
    const idx = Math.floor(rand()*pool.length);
    if(!usedIdx.has(idx)){ usedIdx.add(idx); picked.push(pool[idx]); }
  }
  return picked;
}
function renderDynamicSections(allItems){
  const mount = document.getElementById('dynamic-sections');
  if(!mount) return;
  mount.innerHTML = '';

  const topics = chooseTopics(allItems);
  if(!topics.length) return;

  for(const topic of topics){
    const section = document.createElement('section');
    section.className = 'topic-row';
    const headHTML = `
      <div class="topic-head">
        <h3 class="h-section">${escapeHtml(topic.head)}</h3>
        <p class="topic-sub">${escapeHtml(topic.sub)}</p>
      </div>
      <div class="cards-grid" role="list"></div>`;
    section.innerHTML = headHTML;

    // Fill cards by tag (up to 6)
    const list = section.querySelector('.cards-grid');
    const matches = allItems.filter(i => (i.meta._tags||[]).map(s=>s.toLowerCase()).includes(topic.tag.toLowerCase())).slice(0,6);
    if(matches.length){
      for(const m of matches){
        list.appendChild(gridCard(m));
      }
      mount.appendChild(section);
    }
  }
}

/* ---------- Newsletters list page ---------- */

/* Compact mode toggler: keep small result sets from stretching cards */
function setCompactGrid(container, itemCount){
  if(itemCount <= 3){
    container.classList.add('is-compact');
  }else{
    container.classList.remove('is-compact');
  }
}

function parseTagsParam(value){ if(!value) return []; return value.split(',').map(s=>s.trim()).filter(Boolean); }
async function renderListPage(){
  const container=document.getElementById('news-list');
  if(!container) return;
  container.setAttribute('aria-busy','true');

  const params=new URLSearchParams(location.search);
  const q=params.get('q')?.trim();
  const activeCat=params.get('category')?.trim();
  const tagParam=params.get('tag')?.trim();
  const activeTags=parseTagsParam(tagParam).map(t=>t.toLowerCase());

  const data=await loadVisibleSorted();

  // Category chips (real anchors)
  const chipWrap=document.getElementById('category-chips');
  if(chipWrap){
    const cats=[...new Set(data.map(i=>(i.meta.Category||'').trim()).filter(Boolean))].sort();
    chipWrap.innerHTML=cats.map(c=>`newsletters.html?category=${encodeURIComponent(c)}${escapeHtml(c)}</a>`).join('');
  }

  // Tag cloud (toggle behavior) (real anchors)
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
    tagWrap.innerHTML = list.length
      ? list.map(([t])=>{
          const isOn=activeTags.includes(t.toLowerCase());
          const url=new URL(location.href);
          const current=parseTagsParam(url.searchParams.get('tag')||'').map(x=>x.toLowerCase());
          const next=isOn?current.filter(x=>x!==t.toLowerCase()):[...new Set([...current,t.toLowerCase()])];
          if(next.length) url.searchParams.set('tag', next.join(',')); else url.searchParams.delete('tag');
          return `${escapeAttr(url.pathname + url.search)}${escapeHtml(t)}</a>`;
        }).join('')
      : '<span class="muted">No tags yet</span>';
  }

  // Filtered set
  let filtered=activeCat
    ? data.filter(i=>(i.meta.Category||'').trim().toLowerCase()===activeCat.toLowerCase())
    : data;
  if(activeTags.length){
    filtered=filtered.filter(i=>{
      const tags=(i.meta._tags||[]).map(t=>t.toLowerCase());
      return activeTags.some(t=>tags.includes(t));
    });
  }
  if(q) filtered=searchItems(filtered,q);

  // Active filter banner
  const info=document.getElementById('active-filter');
  if(info){
    const parts=[];
    if(q) parts.push(`“${escapeHtml(q)}”`);
    if(activeCat) parts.push(`Category: ${escapeHtml(activeCat)}`);
    if(activeTags.length) parts.push(`Tags: ${escapeHtml(activeTags.join(', '))}`);
    info.textContent = parts.length ? `${filtered.length} result(s) — ${parts.join(' • ')}` : '';
  }

  // Render or empty state
  container.innerHTML='';
  if(!filtered.length){
    container.innerHTML=`<p class="muted">No items found${q?` for “${escapeHtml(q)}”`:''}${activeCat?` in ${escapeHtml(activeCat)}`:''}${activeTags.length?` with tags: ${escapeHtml(activeTags.join(', '))}`:''}.</p>`;
    setCompactGrid(container, 0);
    container.removeAttribute('aria-busy');
    return;
  }
  for(const item of filtered){
    container.appendChild(gridCard(item));
  }

  // Toggle compact mode for 1–3 results (prevents blown-up cards)
  setCompactGrid(container, filtered.length);

  container.removeAttribute('aria-busy');

  enhanceImages();
  ensureListRoles();
  hookHoverPrefetch();
}

/* ---------- OG/Twitter & Canonical helpers ---------- */
function applyOpenGraph(meta, file){
  const title = (meta.Title || file || 'Article').trim();
  const desc = (meta.Subtitle || '').trim();
  const img = resolveThumbPath(meta.Thumbnail) || DEFAULT_THUMB;
  const url = location.href;
  const ogT = document.getElementById('og-title');
  const ogD = document.getElementById('og-description');
  const ogI = document.getElementById('og-image');
  const ogU = document.getElementById('og-url');
  if (ogT && !ogT.content) ogT.content = title;
  if (ogD && !ogD.content && desc) ogD.content = desc;
  if (ogI && (!ogI.content || ogI.content === '')) ogI.content = img;
  if (ogU && (!ogU.content || ogU.content === '')) ogU.content = url;
  const twT = document.getElementById('tw-title');
  const twD = document.getElementById('tw-description');
  const twI = document.getElementById('tw-image');
  if (twT && !twT.content) twT.content = title;
  if (twD && !twD.content && desc) twD.content = desc;
  if (twI && (!twI.content || twI.content === '')) twI.content = img;

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
  if(subEl) subEl.textContent = meta.Subtitle||'';
  if(metaEl) metaEl.textContent = `${date}${date?' • ':''}${author}`;
  if(catEl){ if(cat){ catEl.hidden=false; catEl.textContent=cat; } else { catEl.hidden=true; } }

  const img=resolveThumbPath(meta.Thumbnail);
  if(bg){ bg.src=encodeURI(img); bg.loading='eager'; bg.decoding='async'; bg.alt=''; }
}
function buildShareLinks(title){
  const url=location.href;
  const email=document.querySelector('[data-share="email"]');
  const reddit=document.querySelector('[data-share="reddit"]');
  const x=document.querySelector('[data-share="x"]');
  const copy=document.querySelector('[data-share="copy"]');
  const fb=document.getElementById('share-feedback');
  if(email) email.href=`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;
  if(reddit) reddit.href=`https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
  if(x) x.href =`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
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

  const tags=(meta.Tags?splitTags(meta.Tags):[]);
  const bylineWrap=document.querySelector('.a-hero .a-hero-inner');
  if(tags.length && bylineWrap){
    const tagDiv=document.createElement('div');
    tagDiv.className='a-tags';
    tagDiv.innerHTML = tags.map(t=>`newsletters.html?tag=${encodeURIComponent(t)}${escapeHtml(t)}</a>`).join('');
    bylineWrap.appendChild(tagDiv);
  }

  const bodyHtml=renderMarkdownSafe(body);
  const date=formatDate(meta.Date);
  const author=meta.Author||'Staff';
  const metaLine=`${date}${date?' • ':''}${author}`;

  container.innerHTML = `
    ${meta.Subtitle?`<p class="muted" style="margin:.2rem 0 1rem 0">${escapeHtml(meta.Subtitle)}</p>`:''}
    <p class="muted" style="margin:.2rem 0 1rem 0">${escapeHtml(metaLine)} • ${escapeHtml(reading)}</p>
    <div>${bodyHtml}</div>
  `;
  container.removeAttribute('aria-busy');
  document.title=`${meta.Title||filename} — Sleepy Hallow Media`;
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
    content.innerHTML=`<p class="muted">Missing or invalid article parameter.</p>`;
    content.removeAttribute('aria-busy');
    return;
  }

  const warmKey='pre:'+file;
  const warmed=sessionStorage.getItem(warmKey);
  if(warmed){
    try{
      const parsed=parseFrontmatter(warmed);
      renderArticle(content, file, parsed.meta, parsed.body);
      buildShareLinks(parsed.meta.Title||file);
      return;
    }catch{}
  }

  try{
    const parsed=await loadNewsletter(file);
    renderArticle(content, file, parsed.meta, parsed.body);
    buildShareLinks(parsed.meta.Title||file);
  }catch(e){
    console.error(e);
    content.innerHTML=`<p class="muted">Could not load this article.</p>`;
    content.removeAttribute('aria-busy');
  }
}

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  initTheme();
  initMobile();
  markCurrentNav();
  hijackHeaderSearch();
  renderHome();
  renderListPage();
  initArticlePage();
});