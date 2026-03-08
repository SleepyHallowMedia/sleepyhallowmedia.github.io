/* Sleepy Hallow Media — App (v7.2 core)
   - No #latest-grid usage
   - Templates use real <a>/<img> (no raw text)
   - Defensive DOM guards (no errors if elements are absent)
   - Home: lead + top rail + trending + dynamic rows
   - Newsletters list page + Article page
*/
'use strict';

/* ---------- Config ---------- */
const MANIFEST = 'newsletters/index.json';
const NEWS_DIR = 'newsletters/';
const DEFAULT_THUMB = 'thumbnails/placeholder.png';
const TOP_RAIL_COUNT = 4;

/* Dynamic topics pool (only used if those tags exist in content) */
const FEATURED_TOPICS = [
  { tag:'Politics', head:'Interested in politics?', sub:'Here are stories that will feed that hunger!' },
  { tag:'Local',    head:'What’s happening nearby?', sub:'Local stories, close to home.' },
  { tag:'Opinion',  head:'Want strong takes?', sub:'Opinion pieces you might like.' },
  { tag:'Culture',  head:'Craving culture?', sub:'Arts, media, and more.' },
  { tag:'Business', head:'Market mind on?', sub:'Business and the bottom line.' },
  { tag:'Tech',     head:'Feeling curious about tech?', sub:'Gadgets, policy, and the future.' },
];

/* ---------- Theme ---------- */
const THEME_COOKIE = 'theme';
function getCookie(name){
  const esc=String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const m=document.cookie.match(new RegExp('(?:^|; )'+esc+'=([^;]*)'));
  return m?decodeURIComponent(m[1]):'';
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
  return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';
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
      try{ localStorage.setItem(THEME_COOKIE,next); }catch{}
      setCookie(THEME_COOKIE,next,365);
    });
  }
  // Respect system changes only if user hasn't chosen explicitly
  const explicit = getCookie(THEME_COOKIE) || (()=>{try{return localStorage.getItem(THEME_COOKIE)}catch{return null}})();
  if(!explicit && window.matchMedia){
    const mq=window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change',e=>applyTheme(e.matches?'dark':'light'));
  }
}

/* ---------- Utils ---------- */
function escapeHtml(s){
  if(s==null) return '';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
function escapeAttr(s){ return escapeHtml(String(s)); }

function sanitizeFilename(filename){
  if(!filename || typeof filename!=='string') return '';
  let f = filename.replace(/\\/g,'/').trim();
  if(f.startsWith('/')) f=f.slice(1);
  if(f.includes('..') || /^https?:/i.test(f)) return '';
  return f;
}
function parseFrontmatter(text){
  let src=String(text??'').replace(/\r/g,'').replace(/^\uFEFF/,'').replace(/^\s+/, '');
  if(!src.startsWith('---\n') && src!=='---'){ return {meta:{}, body:src.trim()}; }
  const lines=src.split('\n'); const meta={}; let i=1;
  for(;i<lines.length;i++){
    const line=lines[i].trim();
    if(line==='---'){ i++; break; }
    if(!line) continue;
    const m=line.match(/^([^:]+)\s*:\s*(.*)$/);
    if(m) meta[m[1].trim()] = m[2].trim();
  }
  const body=lines.slice(i).join('\n').trim();
  return {meta, body};
}
async function loadManifest(){
  try{
    const res=await fetch(MANIFEST,{cache:'no-store'});
    if(!res.ok) throw new Error('manifest not found');
    const data=await res.json();
    return Array.isArray(data) ? data.map(sanitizeFilename).filter(Boolean) : [];
  }catch(e){
    console.warn('Manifest load error:', e);
    return [];
  }
}
async function loadNewsletter(filename){
  const f=sanitizeFilename(filename); if(!f) throw new Error('invalid filename');
  const path=f.startsWith('newsletters/')?f:`${NEWS_DIR}${f}`;
  const res=await fetch(path,{cache:'no-store'});
  if(!res.ok) throw new Error('failed to fetch '+path);
  const text=await res.text();
  return parseFrontmatter(text);
}
function formatDate(s){ if(!s) return ''; const d=new Date(s); return Number.isNaN(d.getTime())?'':d.toLocaleDateString(); }
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
function splitTags(v){ if(!v) return []; return String(v).split(',').map(s=>s.trim()).filter(Boolean); }

/* ---------- Header / nav / search ---------- */
function markCurrentNav(){
  const file=(location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const key = (file==='newsletters.html') ? 'newsletters' : 'home';
  document.querySelectorAll(`[data-nav="${key}"]`).forEach(a=>a.setAttribute('aria-current','page'));
}
function initMobile(){
  const btn=document.querySelector('.nav-toggle');
  const menu=document.getElementById('mobile-menu');
  if(btn && menu){
    btn.addEventListener('click',()=>{
      const open=menu.classList.toggle('active');
      btn.setAttribute('aria-expanded', open?'true':'false');
    });
  }
}
function hijackHeaderSearch(){
  const form=document.getElementById('site-search'); if(!form) return;
  form.addEventListener('submit',(e)=>{
    const q=form.querySelector('input[name="q"]');
    if(!q || !q.value.trim()) e.preventDefault();
  });
}

/* ---------- Data helpers ---------- */
async function loadVisibleSorted(){
  const manifest=await loadManifest(); if(!manifest.length) return [];
  const items=(await Promise.all(manifest.map(async f=>{
    try{
      const {meta,body}=await loadNewsletter(f);
      meta._dateObj=meta.Date?new Date(meta.Date):null;
      meta._tags=splitTags(meta.Tags);
      return {file:f, meta, body};
    }catch{return null;}
  }))).filter(Boolean);
  const visible=items.filter(r=>!isTruthy(r.meta.Hidden));
  visible.sort((a,b)=>{
    const ad=a.meta._dateObj, bd=b.meta._dateObj;
    const aOk=ad && !Number.isNaN(ad.getTime());
    const bOk=bd && !Number.isNaN(bd.getTime());
    if(aOk && bOk) return bd - ad;
    if(aOk) return -1;
    if(bOk) return 1;
    return b.file.localeCompare(a.file);
  });
  return visible;
}

/* ---------- Prefetch ---------- */
async function primeArticle(file){
  const f=sanitizeFilename(file); if(!f) return;
  const key='pre:'+f; if(sessionStorage.getItem(key)) return;
  try{
    const path=f.startsWith('newsletters/')?f:`${NEWS_DIR}${f}`;
    const res=await fetch(path,{cache:'force-cache'}); if(!res.ok) return;
    sessionStorage.setItem(key, await res.text());
  }catch{}
}
function hookHoverPrefetch(){
  document.addEventListener('mouseover', e=>{
    const a=e.target.closest('a[href*="article.html?"]'); if(!a) return;
    const u=new URL(a.href, location.href);
    primeArticle(u.searchParams.get('article'));
  }, {passive:true});
  document.addEventListener('focusin', e=>{
    const a=e.target.closest('a[href*="article.html?"]'); if(!a) return;
    const u=new URL(a.href, location.href);
    primeArticle(u.searchParams.get('article'));
  });
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
  const hero=document.querySelector('.a-hero-bg'); if(hero) hero.decoding='async';
}

/* ---------- A11y helpers ---------- */
function ensureListRoles(){
  const ids=['top-stories','right-rail','sidebar-latest'];
  ids.forEach(id=>{
    const el=document.getElementById(id);
    if(el && !el.getAttribute('role')) el.setAttribute('role','list');
  });
}

/* ============================
   Templates — REAL TAGS
   ============================ */
function leadCardHTML(item){
  const { file, meta } = item;
  const title  = meta.Title || file;
  const cat    = (meta.Category || '').trim();
  const date   = formatDate(meta.Date);
  const author = meta.Author || 'Staff';
  const img    = resolveThumbPath(meta.Thumbnail);
  const url    = `article.html?article=${encodeURIComponent(file)}`;
  const dek    = meta.Subtitle ? `<p class="hero-dek">${escapeHtml(meta.Subtitle)}</p>` : '';

  // NOTE: We include a hidden lead image only to mirror into hero-art on the right panel if present.
  return `
    ${escapeAttr(img)}
    ${cat ? `<span class="kicker">${escapeHtml(cat)}</span>` : ''}
    <h2 class="lead-title">${escapeAttr(url)}${escapeHtml(title)}</a></h2>
    <div class="lead-meta">${escapeHtml(date)}${date ? ' • ' : ''}${escapeHtml(author)}</div>
    ${dek}
  `;
}
function topCardHTML(item){
  const { file, meta } = item;
  const title  = meta.Title || file;
  const img    = resolveThumbPath(meta.Thumbnail);
  const date   = formatDate(meta.Date);
  const author = meta.Author || 'Staff';
  const url    = `article.html?article=${encodeURIComponent(file)}`;

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
  const img    = resolveThumbPath(meta.Thumbnail);
  const title  = meta.Title || file;
  const date   = formatDate(meta.Date);
  const author = meta.Author || 'Staff';
  const chip   = meta.Category ? `<span class="chip" title="Category">${escapeHtml(meta.Category)}</span>` : '';
  const tags   = (meta._tags || []).slice(0,2).map(t=>`<span class="chip" title="Tag">${escapeHtml(t)}</span>`).join('');
  const sub    = meta.Subtitle ? `<p class="card-sub" style="margin:0;color:var(--muted)">${escapeHtml(meta.Subtitle)}</p>` : '';
  const url    = `article.html?article=${encodeURIComponent(file)}`;

  const a=document.createElement('a');
  a.className='card';
  a.href=url;
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

/* ---------- Homepage render (no #latest-grid) ---------- */
async function renderHome(){
  const leadEl = document.getElementById('lead-story');
  const topEl  = document.getElementById('top-stories');
  const trend  = document.getElementById('trend-topics');

  if(!leadEl && !topEl && !trend) return;
  if(leadEl) leadEl.setAttribute('aria-busy','true');

  const data=await loadVisibleSorted();
  if(!data.length){
    if(leadEl){
      leadEl.innerHTML = `
        <h2 class="lead-title">No articles yet</h2>
        <div class="lead-meta">Add .txt files to <code>newsletters/</code> and update <code>newsletters/index.json</code>.</div>
      `;
      leadEl.removeAttribute('aria-busy');
    }
    if(topEl) topEl.innerHTML = `<div class="muted" role="status">No top stories available.</div>`;
    if(trend) trend.innerHTML = `<span class="muted">No trending tags yet</span>`;
    return;
  }

  // Lead (left)
  if(leadEl){
    leadEl.innerHTML = leadCardHTML(data[0]);
    leadEl.removeAttribute('aria-busy');

    // Mirror the lead (hidden) image into the right hero art if that element exists
    try{
      const hiddenImg=leadEl.querySelector('.lead-bg');
      const art=document.getElementById('hero-art');
      if(hiddenImg && art && hiddenImg.getAttribute('src')) art.src = hiddenImg.getAttribute('src');
    }catch{}
  }

  // Top rail
  if(topEl){
    topEl.innerHTML='';
    for(const item of data.slice(1, 1+TOP_RAIL_COUNT)){
      const node=document.createElement('article');
      node.className='top-card';
      node.setAttribute('role','listitem');
      node.innerHTML=topCardHTML(item);
      topEl.appendChild(node);
    }
  }

  // Trending
  if(trend){
    const counts=new Map();
    for(const it of data){
      for(const t of (it.meta._tags||[])){ const k=t.trim(); if(k) counts.set(k,(counts.get(k)||0)+1); }
    }
    const topTags=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);
    trend.innerHTML = topTags.length
      ? topTags.map(([k])=>`newsletters.html?tag=${encodeURIComponent(k)}${escapeHtml(k)}</a>`).join('')
      : `<span class="muted">No trending tags yet</span>`;
  }

  renderDynamicSections(data);
  enhanceImages();
  ensureListRoles();
  hookHoverPrefetch();
}

/* ---------- Dynamic sections ---------- */
function seededRand(seed){ let x=Math.sin(seed)*10000; return ()=>{ x=(x*9301+49297)%233280; return x/233280; }; }
function chooseTopics(allItems){
  const dayKey = Number(new Date().toISOString().slice(0,10).replace(/-/g,''));
  const rand = seededRand(dayKey);
  const present=new Set();
  for(const it of allItems){ for(const t of (it.meta._tags||[])) present.add(t.toLowerCase()); }
  const pool=FEATURED_TOPICS.filter(t=>present.has(t.tag.toLowerCase()));
  if(pool.length===0) return [];
  const count = Math.min(pool.length, (rand()>0.5 ? 3 : 2));
  const picked=[]; const used=new Set();
  while(picked.length<count && used.size<pool.length){
    const idx=Math.floor(rand()*pool.length);
    if(!used.has(idx)){ used.add(idx); picked.push(pool[idx]); }
  }
  return picked;
}
function renderDynamicSections(allItems){
  const mount=document.getElementById('dynamic-sections'); if(!mount) return;
  mount.innerHTML='';
  const topics=chooseTopics(allItems); if(!topics.length) return;

  for(const topic of topics){
    const section=document.createElement('section');
    section.className='topic-row';
    section.innerHTML=`
      <div class="topic-head" style="display:flex;align-items:baseline;gap:.6rem">
        <h3 class="h-section">${escapeHtml(topic.head)}</h3>
        <p class="topic-sub" style="margin:0;color:var(--muted)">${escapeHtml(topic.sub)}</p>
      </div>
      <div class="cards-grid" role="list"></div>`;
    const list=section.querySelector('.cards-grid');
    const matches=allItems
      .filter(i => (i.meta._tags||[]).map(s=>s.toLowerCase()).includes(topic.tag.toLowerCase()))
      .slice(0,6);
    for(const m of matches){ list.appendChild(gridCard(m)); }
    if(matches.length) mount.appendChild(section);
  }
}

/* ---------- Newsletters list page ---------- */
function parseTagsParam(v){ if(!v) return []; return v.split(',').map(s=>s.trim()).filter(Boolean); }
function normalize(s){ return String(s??'').toLowerCase(); }
function itemScore(item,q){
  const {meta,body}=item; const n=normalize(q); let score=0;
  const add=(c,w)=>{ if(c) score+=w; };
  add(normalize(meta.Title).includes(n),8);
  add(normalize(meta.Subtitle).includes(n),5);
  add(normalize(meta.Author).includes(n),4);
  add(normalize(meta.Category).includes(n),4);
  add((meta._tags||[]).some(t=>normalize(t).includes(n)),3);
  add(normalize(body).slice(0,800).includes(n),1);
  return score;
}
function searchItems(items,query){
  const q=query?.trim(); if(!q) return items;
  return items.map(it=>({it,s:itemScore(it,q)}))
    .filter(x=>x.s>0)
    .sort((a,b)=> b.s - a.s || (b.it.meta._dateObj - a.it.meta._dateObj))
    .map(x=>x.it);
}
async function renderListPage(){
  const container=document.getElementById('news-list'); if(!container) return;
  container.setAttribute('aria-busy','true');

  const params=new URLSearchParams(location.search);
  const q=params.get('q')?.trim();
  const activeCat=params.get('category')?.trim();
  const tagParam=params.get('tag')?.trim();
  const activeTags=parseTagsParam(tagParam).map(t=>t.toLowerCase());

  const data=await loadVisibleSorted();

  const chipWrap=document.getElementById('category-chips');
  if(chipWrap){
    const cats=[...new Set(data.map(i=>(i.meta.Category||'').trim()).filter(Boolean))].sort();
    chipWrap.innerHTML = cats.map(c=>`newsletters.html?category=${encodeURIComponent(c)}${escapeHtml(c)}</a>`).join('');
  }

  const tagWrap=document.getElementById('tag-cloud');
  if(tagWrap){
    const counts=new Map();
    for(const i of data){ for(const t of (i.meta._tags||[])){ const k=t.trim(); if(k) counts.set(k,(counts.get(k)||0)+1); } }
    const list=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20);
    tagWrap.innerHTML = list.length ? list.map(([t])=>{
      const isOn=activeTags.includes(t.toLowerCase());
      const url=new URL(location.href);
      const current=(url.searchParams.get('tag')||'').split(',').map(s=>s.trim()).filter(Boolean).map(x=>x.toLowerCase());
      const next=isOn?current.filter(x=>x!==t.toLowerCase()):[...new Set([...current,t.toLowerCase()])];
      if(next.length) url.searchParams.set('tag', next.join(',')); else url.searchParams.delete('tag');
      return `${escapeAttr(url.pathname + url.search)}${escapeHtml(t)}</a>`;
    }).join('') : '<span class="muted">No tags yet</span>';
  }

  let filtered = activeCat
    ? data.filter(i=>(i.meta.Category||'').trim().toLowerCase()===activeCat.toLowerCase())
    : data;

  if(activeTags.length){
    filtered = filtered.filter(i=>{
      const tags=(i.meta._tags||[]).map(t=>t.toLowerCase());
      return activeTags.some(t=>tags.includes(t));
    });
  }
  if(q) filtered = searchItems(filtered,q);

  const info=document.getElementById('active-filter');
  if(info){
    const parts=[];
    if(q) parts.push(`“${escapeHtml(q)}”`);
    if(activeCat) parts.push(`Category: ${escapeHtml(activeCat)}`);
    if(activeTags.length) parts.push(`Tags: ${escapeHtml(activeTags.join(', '))}`);
    info.textContent = parts.length ? `${filtered.length} result(s) — ${parts.join(' • ')}` : '';
  }

  container.innerHTML='';
  if(!filtered.length){
    container.innerHTML = `<p class="muted">No items found${q?` for “${escapeHtml(q)}”`:''}${activeCat?` in ${escapeHtml(activeCat)}`:''}${activeTags.length?` with tags: ${escapeHtml(activeTags.join(', '))}`:''}.</p>`;
    container.removeAttribute('aria-busy');
    return;
  }
  for(const item of filtered){ container.appendChild(gridCard(item)); }
  container.removeAttribute('aria-busy');

  enhanceImages();
  ensureListRoles();
  hookHoverPrefetch();
}

/* ---------- OG/Twitter & Canonical helpers (article) ---------- */
function applyOpenGraph(meta, file){
  const title=(meta.Title||file||'Article').trim();
  const desc =(meta.Subtitle||'').trim();
  const img  =resolveThumbPath(meta.Thumbnail)||DEFAULT_THUMB;
  const url  =location.href;
  const set=(id,val)=>{ const el=document.getElementById(id); if(el && (!el.content || el.content==='')) el.content=val; };
  set('og-title',title); set('og-description',desc); set('og-image',img); set('og-url',url);
  set('tw-title',title); set('tw-description',desc); set('tw-image',img);
  const canon=document.getElementById('canonical'); if(canon){ try{ canon.href=url; }catch{} }
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
  if(subEl) subEl.textContent=meta.Subtitle||'';
  if(metaEl) metaEl.textContent=`${date}${date?' • ':''}${author}`;
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
  if(email)  email.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;
  if(reddit) reddit.href= `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
  if(x)      x.href    = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  if(copy){
    copy.addEventListener('click', async ()=>{
      try{ await navigator.clipboard.writeText(url); if(fb){ fb.textContent='Link copied!'; setTimeout(()=>fb.textContent='',1400);} }
      catch{ if(fb){ fb.textContent='Copy failed.'; setTimeout(()=>fb.textContent='',1400);} }
    });
  }
}
function renderArticle(container, filename, meta, body){
  populateArticleHero(meta);
  applyOpenGraph(meta, filename);

  const reading=readingTimeFromText(body,200);
  const rt=document.getElementById('article-reading-time'); if(rt) rt.textContent=` • ${reading}`;

  // Tags
  const tags=(meta.Tags?splitTags(meta.Tags):[]);
  const bylineWrap=document.querySelector('.a-hero .a-hero-inner') || document.querySelector('.a-hero-inner') || document.querySelector('.a-hero');
  if(tags.length && bylineWrap){
    const tagDiv=document.createElement('div');
    tagDiv.className='a-tags';
    tagDiv.innerHTML = tags.map(t=>`newsletters.html?tag=${encodeURIComponent(t)}${escapeHtml(t)}</a>`).join('');
    bylineWrap.appendChild(tagDiv);
  }

  // Body (safe)
  const toHtml = (txt)=>{
    if(typeof window!=='undefined' && window.marked && window.DOMPurify){
      return window.DOMPurify.sanitize(window.marked.parse(String(txt??'')));
    }
    return String(txt??'').split(/\n\s*\n/).map(p=>`<p>${escapeHtml(p.trim())}</p>`).join('');
  };

  const date=formatDate(meta.Date);
  const author=meta.Author||'Staff';
  const metaLine=`${date}${date?' • ':''}${author}`;

  container.innerHTML = `
    ${meta.Subtitle?`<p class="muted" style="margin:.2rem 0 1rem 0">${escapeHtml(meta.Subtitle)}</p>`:''}
    <p class="muted" style="margin:.2rem 0 1rem 0">${escapeHtml(metaLine)} • ${escapeHtml(reading)}</p>
    <div>${toHtml(body)}</div>`;
  container.removeAttribute('aria-busy');

  document.title=`${meta.Title||filename} — Sleepy Hallow Media`;
}
async function initArticlePage(){
  const content=document.getElementById('article-content'); if(!content) return;
  content.setAttribute('aria-busy','true');
  content.innerHTML = `<p class="muted">Loading article…</p>`;

  const params=new URLSearchParams(window.location.search);
  const raw=params.get('article'); const file=sanitizeFilename(raw);
  if(!file){
    content.innerHTML=`<p class="muted">Missing or invalid article parameter.</p>`;
    content.removeAttribute('aria-busy');
    return;
  }

  const warmed=sessionStorage.getItem('pre:'+file);
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

/* ---------- Small extras (safe) ---------- */
function initTicker(){
  const t=document.getElementById('edition-time'); if(!t) return;
  const fmt=d=>d.toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  const tick=()=>{ try{ t.textContent=fmt(new Date()); }catch{} };
  tick(); setInterval(tick, 30000);
}
function initHeroParallax(){
  const art=document.getElementById('hero-art');
  if(!art || !window.matchMedia('(pointer:fine)').matches) return;
  const onMove=(e)=>{
    const r=art.getBoundingClientRect();
    const dx=((e.clientX - r.left)/r.width - .5)*6;
    const dy=((e.clientY - r.top )/r.height - .5)*6;
    art.style.transform=`scale(1.03) rotateX(${-dy}deg) rotateY(${dx}deg)`;
  };
  const reset=()=>{ art.style.transform='scale(1)'; };
  art.addEventListener('mousemove', onMove);
  art.addEventListener('mouseleave', reset);
}

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  console.log('script.js v7.2 (core) loaded');
  initTheme();
  initMobile();
  markCurrentNav();
  hijackHeaderSearch();
  initTicker();
  renderHome();
  renderListPage();
  initArticlePage();
  initHeroParallax();
});