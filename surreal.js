/* surreal.js — minimal bridge for the folio layout */

(function(){
  'use strict';

  function qs(s, r=document){ return r.querySelector(s); }
  function el(tag, cls){ const n = document.createElement(tag); if(cls) n.className = cls; return n; }
  function fmtDate(d){ try { return new Date(d).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); } catch { return d || ''; } }

  /* ----- Fill the cover stamp from <html data-*> ----- */
  function fillStamp(){
    const root = document.documentElement;
    const issue  = (root.dataset.issue  || '').trim();
    const season = (root.dataset.season || '').trim();
    const price  = (root.dataset.price  || '').trim();
    const wrap = qs('.folio-stamp');
    if(!wrap) return;
    qs('.stamp-issue', wrap).textContent  = issue || '';
    qs('.stamp-season', wrap).textContent = season || '';
    qs('.stamp-price', wrap).textContent  = price || '';
  }

  /* ----- Home: oblique stream & cover art ----- */
  async function renderFolio(){
    const stream = qs('#stream');
    const coverImg = qs('#cover-img');
    if(!stream && !coverImg) return;

    const items = await (window.loadVisibleSorted ? window.loadVisibleSorted() : Promise.resolve([]));
    if(!items.length){ if(stream){ stream.innerHTML = '<li class="muted">No stories yet.</li>'; stream.removeAttribute('aria-busy'); } return; }

    // Use first item’s thumb as cover art
    try{
      const img = (items[0].meta && items[0].meta.Thumbnail) ? items[0].meta.Thumbnail : null;
      if(coverImg && img){
        const src = /^https?:\/\//i.test(img) ? img : ('thumbnails/' + img);
        coverImg.src = src;
      }
    }catch{}

    if(stream){
      stream.innerHTML = '';
      items.slice(0, 16).forEach(it => {
        const li = el('li');
        const a = el('a','oblique-item');
        a.href = 'article.html?article=' + encodeURIComponent(it.file);
        a.setAttribute('aria-label', (it.meta.Title || it.file));
        const thumb = el('img');
        thumb.src = it.meta.Thumbnail ? (/^https?:\/\//i.test(it.meta.Thumbnail) ? it.meta.Thumbnail : ('thumbnails/' + it.meta.Thumbnail)) : 'thumbnails/placeholder.png';
        thumb.alt = '';
        const body = el('div');
        const h = el('h3','oblique-title'); h.textContent = it.meta.Title || it.file;
        const sub = el('p','oblique-sub'); sub.textContent = it.meta.Subtitle || '';
        const meta = el('div','oblique-meta'); meta.textContent = [fmtDate(it.meta.Date), it.meta.Author || 'Staff'].filter(Boolean).join(' • ');
        body.appendChild(h); if(sub.textContent) body.appendChild(sub); body.appendChild(meta);
        a.appendChild(thumb); a.appendChild(body);
        li.appendChild(a);
        stream.appendChild(li);
      });
      stream.removeAttribute('aria-busy');
    }
  }

  /* ----- Catalogue: tag atlas + timeline ----- */
  async function renderCatalogue(){
    const atlas = qs('#tag-atlas');
    const timeline = qs('#timeline');
    if(!atlas && !timeline) return;

    const items = await (window.loadVisibleSorted ? window.loadVisibleSorted() : Promise.resolve([]));
    if(atlas){
      const counts = new Map();
      for(const it of items){ (it.meta._tags || []).forEach(t => { const k = t.trim(); if(!k) return; counts.set(k, (counts.get(k)||0)+1); }); }
      const list = [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,40);
      atlas.innerHTML = list.map(([t,c]) => {
        const url = new URL(location.href); const cur = (url.searchParams.get('tag')||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
        const next = cur.includes(t.toLowerCase()) ? cur.filter(x=>x!==t.toLowerCase()) : [...new Set([...cur, t.toLowerCase()])];
        if(next.length) url.searchParams.set('tag', next.join(',')); else url.searchParams.delete('tag');
        return `<a href="${url.pathname + url.search}" title="${c}">${t}</a>`;
      }).join('') || '<span class="muted">No tags yet</span>';
      atlas.removeAttribute('aria-busy');
    }
    if(timeline){
      timeline.innerHTML = '';
      items.forEach(it => {
        const li = el('li');
        const a = el('a'); a.href = 'article.html?article=' + encodeURIComponent(it.file); a.textContent = it.meta.Title || it.file;
        const meta = el('div','oblique-meta'); meta.textContent = [fmtDate(it.meta.Date), it.meta.Category, it.meta.Author || 'Staff'].filter(Boolean).join(' • ');
        li.appendChild(a); li.appendChild(meta); timeline.appendChild(li);
      });
      timeline.removeAttribute('aria-busy');
    }
  }

  /* ----- Article: reuse your existing functions; no extra render needed ----- */

  document.addEventListener('DOMContentLoaded', ()=>{
    fillStamp();
    renderFolio();
    renderCatalogue();
  });
})();