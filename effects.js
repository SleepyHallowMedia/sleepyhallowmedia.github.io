/* Sleepy Hallow Media — effects.js (Fixed v1.0)
   Surreal, tactile interactions layered over script.js. No dependencies.

   Fixes & Improvements:
   - Removed obsolete price sticker injection calls
   - Removed references to undefined functions
   - Minor safety guards added (null-checks, feature detection)
   - No functional regressions
*/

(function () {
  'use strict';

  const doc = document;
  const prefersReduced =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Utilities ---------- */
  const raf = (fn) => requestAnimationFrame(fn);
  const idle =
    window.requestIdleCallback
      ? (fn) => window.requestIdleCallback(fn)
      : (fn) => raf(fn);

  const $ = (sel, root = doc) => root.querySelector(sel);
  const $all = (sel, root = doc) =>
    Array.from(root.querySelectorAll(sel));

  /* ---------- Lead spotlight pointer ---------- */
  function spotlightLead() {
    const layer = $('.lead-card .lead-body');
    if (!layer || prefersReduced) return;

    let ticking = false;
    let x = 0;
    let y = 0;

    function apply() {
      ticking = false;
      layer.style.setProperty('--spot-x', x + 'px');
      layer.style.setProperty('--spot-y', y + 'px');
    }

    layer.addEventListener(
      'mousemove',
      (e) => {
        const r = layer.getBoundingClientRect();
        x = Math.max(0, Math.min(e.clientX - r.left, r.width));
        y = Math.max(0, Math.min(e.clientY - r.top, r.height));
        if (!ticking) {
          ticking = true;
          raf(apply);
        }
      },
      { passive: true }
    );

    layer.addEventListener(
      'mouseleave',
      () => {
        layer.style.removeProperty('--spot-x');
        layer.style.removeProperty('--spot-y');
      },
      { passive: true }
    );
  }

  /* ---------- Reveal on scroll ---------- */
  function revealOnScroll() {
    const items = $all('.cards-grid .card, .top-card');
    if (!items.length) return;

    items.forEach((n) => n.classList.add('reveal'));

    const io = new IntersectionObserver(
      (entries) => {
        for (const it of entries) {
          if (it.isIntersecting) {
            it.target.classList.add('is-revealed');
            io.unobserve(it.target);
          }
        }
      },
      { rootMargin: '80px 0px' }
    );

    items.forEach((n) => io.observe(n));
  }

  /* ---------- Scroll progress bar ---------- */
  function progressBar() {
    if (prefersReduced) return;

    let bar = $('#progress-bar');
    if (!bar) {
      bar = doc.createElement('div');
      bar.id = 'progress-bar';
      doc.body.appendChild(bar);
    }

    function update() {
      const h = doc.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
      bar.style.width = pct.toFixed(2) + '%';
    }

    update();
    doc.addEventListener(
      'scroll',
      () => raf(update),
      { passive: true }
    );
  }

  /* ---------- Cursor halo ---------- */
  function cursorHalo() {
    if (prefersReduced) return;

    let halo = $('.cursor-halo');
    if (!halo) {
      halo = doc.createElement('div');
      halo.className = 'cursor-halo';
      doc.body.appendChild(halo);
    }

    let active = false;
    let ticking = false;
    let x = 0;
    let y = 0;

    function place() {
      ticking = false;
      halo.style.left = x + 'px';
      halo.style.top = y + 'px';
    }

    doc.addEventListener(
      'mousemove',
      (e) => {
        x = e.clientX;
        y = e.clientY;
        if (!active) {
          active = true;
          halo.classList.add('on');
        }
        if (!ticking) {
          ticking = true;
          raf(place);
        }
      },
      { passive: true }
    );

    doc.addEventListener(
      'mouseleave',
      () => {
        active = false;
        halo.classList.remove('on');
      },
      { passive: true }
    );
  }

  /* ---------- Initialize homepage interactions ---------- */
  function initHome() {
    const host = $('#lead-story');
    if (!host) return; // not homepage

    // Wait for script.js to populate DOM
    if (host.children.length) {
      spotlightLead();
      revealOnScroll();
      return;
    }

    const mo = new MutationObserver(() => {
      if (host.children.length) {
        mo.disconnect();
        spotlightLead();
        revealOnScroll();
      }
    });

    mo.observe(host, { childList: true });
    setTimeout(() => {
      try {
        mo.disconnect();
      } catch {}
    }, 4000); // hard stop failsafe
  }

  /* ---------- Bootstrap ---------- */
  doc.addEventListener('DOMContentLoaded', () => {
    idle(initHome);
    idle(progressBar);
    idle(cursorHalo);
  });
})();