/* Sleepy Hallow Media — effects.js (v2.0)
 Surreal, tactile interactions layered over script.js. No deps. 
*/
(function(){
  'use strict';
  const doc = document;
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Utilities ---------- */
  function raf(fn){ return requestAnimationFrame(fn); }
  function idle(fn){ (window.requestIdleCallback || raf)(fn); }
  function $(sel, root=doc){ return root.querySelector(sel); }
  function $all(sel, root=doc){ return Array.from(root.querySelectorAll(sel)); }

  /* ---------- Lead spotlight pointer ---------- */
  function spotlightLead(){
    const layer = $('.lead-card .lead-body');
    if(!layer || prefersReduced) return;
    let ticking = false, x=0, y=0;
    function apply(){ ticking=false; layer.style.setProperty('--spot-x', x+'px'); layer.style.setProperty('--spot-y', y+'px'); }
    layer.addEventListener('mousemove', (e)=>{
      const r = layer.getBoundingClientRect();
      x = Math.max(0, Math.min(e.clientX - r.left, r.width));
      y = Math.max(0, Math.min(e.clientY - r.top, r.height));
      if(!ticking) { ticking=true; raf(apply); }
    }, {passive:true});
    layer.addEventListener('mouseleave', ()=>{
      layer.style.removeProperty('--spot-x');
      layer.style.removeProperty('--spot-y');
    }, {passive:true});
  }

  /* ---------- Reveal on scroll ---------- */
  function revealOnScroll(){
    const items = $all('.cards-grid .card, .top-card');
    if(!items.length) return;
    items.forEach(n=>n.classList.add('reveal'));
    const io = new IntersectionObserver((entries)=>{
      for(const it of entries){
        if(it.isIntersecting){
          it.target.classList.add('is-revealed');
          io.unobserve(it.target);
        }
      }
    }, {rootMargin:'80px 0px'});
    items.forEach(n=>io.observe(n));
  }

  /* ---------- Scroll progress bar ---------- */
  function progressBar(){
    if(prefersReduced) return;
    let bar = $('#progress-bar');
    if(!bar){
      bar = doc.createElement('div');
      bar.id = 'progress-bar';
      doc.body.appendChild(bar);
    }
    function update(){
      const h = doc.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? (h.scrollTop / max)*100 : 0;
      bar.style.width = pct.toFixed(2)+'%';
    }
    update();
    doc.addEventListener('scroll', ()=>raf(update), {passive:true});
  }

  /* ---------- Cursor halo ---------- */
  function cursorHalo(){
    if(prefersReduced) return;
    let halo = $('.cursor-halo');
    if(!halo){
      halo = doc.createElement('div');
      halo.className = 'cursor-halo';
      doc.body.appendChild(halo);
    }
    let active = false, ticking = false, x=0, y=0;
    function place(){ ticking=false; halo.style.left=x+'px'; halo.style.top=y+'px'; }
    doc.addEventListener('mousemove', (e)=>{
      x=e.clientX; y=e.clientY;
      if(!active){ active=true; halo.classList.add('on'); }
      if(!ticking){ ticking=true; raf(place); }
    }, {passive:true});
    doc.addEventListener('mouseleave', ()=>{ active=false; halo.classList.remove('on'); }, {passive:true});
  }

  /* ---------- Boot (after script.js populates) ---------- */
  function initHome(){
    const host = $('#lead-story');
    if(!host) return; // not the home page
    if(host.children.length){
      injectPriceSticker(); spotlightLead(); revealOnScroll();
      return;
    }
    const mo = new MutationObserver(()=>{
      if(host.children.length){
        mo.disconnect();
        injectPriceSticker(); spotlightLead(); revealOnScroll();
      }
    });
    mo.observe(host, {childList:true});
    setTimeout(()=>{ try{mo.disconnect()}catch{} }, 4000);
  }

  doc.addEventListener('DOMContentLoaded', ()=>{
    idle(initHome);
    idle(progressBar);
    idle(cursorHalo);
  });

  /* ---------- NEW: Price sticker (reads <html data-*> ) ---------- */
  // Uses existing CSS in styles.css (.price-sticker, .ps-*) to render a compact issue/season/price stamp.
  function injectPriceSticker(){
    const root = document.documentElement;
    const lead = doc.querySelector('.lead-card');
    if(!lead) return;                         // no lead on this page
    if(lead.querySelector('.price-sticker')) return; // already injected

    const issue  = (root.dataset.issue  || '').trim();
    const season = (root.dataset.season || '').trim();
    const price  = (root.dataset.price  || '').trim();
    if(!issue && !season && !price) return; // nothing to show

    const box = doc.createElement('aside');
    box.className = 'price-sticker';
    box.setAttribute('role','note');
    box.innerHTML = `
      <div class="ps-line1">${issue || ''}</div>
      <div class="ps-line1">${season || ''}</div>
      <div class="ps-price">${price || ''}</div>
      <div class="ps-barcode" aria-hidden="true"></div>
    `;
    lead.appendChild(box);
  }

  /* ---------- NEW: Image polish used by script.js ---------- */
  // script.js calls enhanceImages() after rendering home/list/article; provide it.
  // Adds a gentle tone and frames inline article images (but respects full-bleed).
  window.enhanceImages = function enhanceImages(root = document){
    // Tone thumbnails & hero gently
    root.querySelectorAll('.card-img, .top-thumb, .a-hero-bg').forEach(img=>{
      img.classList.add('nocturne');
    });

    // Wrap stand-alone images in article body for a subtle frame
    root.querySelectorAll('.article-body img:not([data-enhanced])').forEach(img=>{
      img.setAttribute('data-enhanced','1');
      if(img.closest('.a-hero')) return;            // skip hero
      if(img.closest('.figure-bleed')) return;      // keep your full-bleed pattern
      const fig = doc.createElement('figure');
      fig.className = 'figure-framed';
      img.replaceWith(fig);
      fig.appendChild(img);
    });
  };
})();