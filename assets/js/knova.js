// KNOVA — shared client behavior
// Loader, nav scroll state, mobile nav, reveal-on-scroll, multi-step form.

// ── Contact form endpoint ─────────────────────────────────────────────
// When email + Calendly are ready, set FORM_ENDPOINT to a real URL
// (Web3Forms, Formspree, Resend webhook, etc.) and the submit handler
// will POST to it. While null, the form falls back to the original
// mailto: behavior so nothing is lost in the meantime.
const FORM_ENDPOINT = null; // e.g. 'https://api.web3forms.com/submit'
const FORM_ACCESS_KEY = null; // e.g. your Web3Forms access key

(function () {
  'use strict';

  // ── Loader ───────────────────────────────────────────────────────────
  // Show the intro loader once per browser. Returning visitors skip it.
  const loader = document.getElementById('loader');
  if (loader) {
    let seen = false;
    try { seen = localStorage.getItem('knovaSeen') === '1'; } catch (_) { /* private mode */ }
    if (seen) {
      loader.remove();
    } else {
      const fill = loader.querySelector('.ld-fill');
      requestAnimationFrame(() => { if (fill) fill.style.transform = 'scaleX(1)'; });
      window.addEventListener('load', () => {
        setTimeout(() => loader.classList.add('hidden'), 600);
        setTimeout(() => {
          loader.remove();
          try { localStorage.setItem('knovaSeen', '1'); } catch (_) {}
        }, 1600);
      });
    }
  }

  // ── Nav: scrolled state ──────────────────────────────────────────────
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ── Nav: mobile toggle (with focus trap, Esc, and inert on background) ──
  const navToggle = document.querySelector('.nav-toggle');
  const navMenu = document.querySelector('.nav-menu');
  const navEl = document.querySelector('.nav');
  if (navToggle && navMenu && navEl) {
    const inertTargets = () =>
      Array.from(document.body.children).filter(el =>
        el !== navEl && el.id !== 'loader' && el.tagName !== 'SCRIPT'
      );

    const openMenu = () => {
      navMenu.classList.add('open');
      navEl.classList.add('menu-open');
      navToggle.setAttribute('aria-expanded', 'true');
      navToggle.textContent = 'Close';
      inertTargets().forEach(el => el.setAttribute('inert', ''));
      const first = navMenu.querySelector('a');
      if (first) first.focus();
    };

    const closeMenu = (refocus) => {
      navMenu.classList.remove('open');
      navEl.classList.remove('menu-open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.textContent = 'Menu';
      inertTargets().forEach(el => el.removeAttribute('inert'));
      if (refocus) navToggle.focus();
    };

    navToggle.addEventListener('click', () => {
      if (navMenu.classList.contains('open')) closeMenu(true);
      else openMenu();
    });

    navMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => closeMenu(false));
    });

    // Esc closes and returns focus to toggle
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navMenu.classList.contains('open')) {
        e.preventDefault();
        closeMenu(true);
      }
    });

    // Focus trap: Tab cycles between toggle and menu links
    navEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !navMenu.classList.contains('open')) return;
      const links = Array.from(navMenu.querySelectorAll('a'));
      if (!links.length) return;
      const first = links[0];
      const last  = links[links.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === navToggle)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        navToggle.focus();
      } else if (!e.shiftKey && active === navToggle) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  // ── Reveal on scroll ─────────────────────────────────────────────────
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('in'));
  }

  // ── Multi-step form ──────────────────────────────────────────────────
  const form = document.querySelector('[data-multi-form]');
  if (form) {
    const steps = Array.from(form.querySelectorAll('.step'));
    const fill = form.querySelector('.form-progress-fill');
    const label = form.querySelector('[data-step-label]');
    const backBtn = form.querySelector('[data-back]');
    const nextBtn = form.querySelector('[data-next]');
    const submitBtn = form.querySelector('[data-submit]');
    const total = steps.length;
    let idx = 0;

    const render = () => {
      steps.forEach((s, i) => s.classList.toggle('active', i === idx));
      if (fill) fill.style.transform = `scaleX(${(idx + 1) / total})`;
      if (label) label.textContent = `Step ${idx + 1} of ${total}`;
      if (backBtn) backBtn.disabled = idx === 0;
      const isLast = idx === total - 1;
      if (nextBtn) nextBtn.style.display = isLast ? 'none' : '';
      if (submitBtn) submitBtn.style.display = isLast ? '' : 'none';
    };

    const clearErrors = (root) => {
      root.querySelectorAll('.field-error').forEach(n => n.remove());
      root.querySelectorAll('[aria-invalid="true"]').forEach(n => n.removeAttribute('aria-invalid'));
    };

    const showError = (anchor, message) => {
      const note = document.createElement('p');
      note.className = 'field-error';
      note.setAttribute('role', 'alert');
      note.textContent = message;
      anchor.insertAdjacentElement('afterend', note);
    };

    const validateStep = () => {
      const cur = steps[idx];
      clearErrors(cur);
      let firstError = null;

      // Radio groups: require a selection when any radio in the group is required.
      const radioNames = new Set();
      cur.querySelectorAll('input[type="radio"]').forEach(r => radioNames.add(r.name));
      for (const name of radioNames) {
        const group = Array.from(cur.querySelectorAll(`input[type="radio"][name="${name}"]`));
        const hasRequired = group.some(r => r.required);
        const checked = group.some(r => r.checked);
        if (hasRequired && !checked) {
          group.forEach(r => r.setAttribute('aria-invalid', 'true'));
          const list = cur.querySelector('.option-list');
          if (list) showError(list, 'Please pick one option to continue.');
          if (!firstError) firstError = group[0].closest('label') || group[0];
        }
      }

      // Required text / select / textarea fields.
      const required = cur.querySelectorAll('input[required], select[required], textarea[required]');
      for (const el of required) {
        if (el.type === 'radio') continue;
        const empty = !el.value;
        const invalidEmail = el.type === 'email' && el.value && !/.+@.+\..+/.test(el.value);
        if (empty || invalidEmail) {
          el.setAttribute('aria-invalid', 'true');
          const message = invalidEmail
            ? 'Please enter a valid email address.'
            : 'This field is required.';
          showError(el, message);
          if (!firstError) firstError = el;
        }
      }

      if (firstError) {
        firstError.focus({ preventScroll: false });
        return false;
      }
      return true;
    };

    if (nextBtn) nextBtn.addEventListener('click', () => {
      if (!validateStep()) return;
      if (idx < total - 1) { idx++; render(); window.scrollTo({ top: form.offsetTop - 80, behavior: 'smooth' }); }
    });
    if (backBtn) backBtn.addEventListener('click', () => {
      if (idx > 0) { idx--; render(); }
    });

    const showThanks = () => {
      const shell = form.querySelector('.form-inner');
      const thanks = form.querySelector('.thanks');
      if (shell && thanks) { shell.style.display = 'none'; thanks.style.display = 'block'; }
    };

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!validateStep()) return;

      // Collect answers
      const data = new FormData(form);
      const summary = {};
      data.forEach((v, k) => { summary[k] = v; });

      // Branch 1: real endpoint is configured.
      if (FORM_ENDPOINT) {
        try {
          const payload = { ...summary };
          if (FORM_ACCESS_KEY) payload.access_key = FORM_ACCESS_KEY;
          const res = await fetch(FORM_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.ok) { showThanks(); return; }
          // fall through to mailto on failure
        } catch (_) { /* fall through */ }
      }

      // Branch 2: fallback — open a pre-filled mail.
      const body = Object.entries(summary)
        .map(([k, v]) => `${k}: ${v}`).join('\n');
      const mailto = `mailto:hello@knova.studio?subject=${encodeURIComponent('Knova enquiry')}&body=${encodeURIComponent(body)}`;
      window.location.href = mailto;
      showThanks();
    });

    render();
  }

  // ── Year stamp ───────────────────────────────────────────────────────
  document.querySelectorAll('[data-year]').forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  // ── Sparkles canvas (vanilla, from Aceternity sparkles reinterpretation)
  // Sparse gold particles. Slow drift. Pauses when off-screen.
  // Disabled under prefers-reduced-motion.
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('canvas.hero-sparkles').forEach((canvas) => {
    if (prefersReduced) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const COUNT = parseInt(canvas.dataset.count, 10) || 90;
    const COLOR = canvas.dataset.color || '#C9A84C';
    let particles = [];
    let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let w = 0, h = 0;
    let running = true;
    let rafId = null;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const seed = () => {
      particles = Array.from({ length: COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.6,
        a: 0.18 + Math.random() * 0.55,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        tw: Math.random() * Math.PI * 2,
      }));
    };

    const tick = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = COLOR;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.tw += 0.025;
        if (p.x < -2) p.x = w + 2;
        if (p.x > w + 2) p.x = -2;
        if (p.y < -2) p.y = h + 2;
        if (p.y > h + 2) p.y = -2;
        const twinkle = 0.55 + 0.45 * Math.sin(p.tw);
        // soft halo
        ctx.globalAlpha = p.a * twinkle * 0.32;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2.6, 0, Math.PI * 2);
        ctx.fill();
        // core
        ctx.globalAlpha = Math.min(1, p.a * twinkle * 1.6);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      rafId = requestAnimationFrame(tick);
    };

    const start = () => { if (!rafId) { running = true; rafId = requestAnimationFrame(tick); } };
    const stop = () => { running = false; if (rafId) { cancelAnimationFrame(rafId); rafId = null; } };

    resize();
    start();

    // Pause when scrolled out of view.
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) e.isIntersecting ? start() : stop();
      }, { threshold: 0 });
      io.observe(canvas);
    }
    // Pause when the tab is hidden.
    document.addEventListener('visibilitychange', () => {
      document.hidden ? stop() : start();
    });
    // Resize debounced.
    let rt = null;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(resize, 120);
    }, { passive: true });
  });

  // ── Glowy waves canvas (hero atmosphere) ─────────────────────────────
  // 5 layered sine-waves with shadowBlur glow, gradient background, mouse-tracked
  // influence. Ported from 21st.dev/moumensoliman/glowy-waves-hero-shadcnui, retuned
  // for the Knova gold + ink palette.
  document.querySelectorAll('canvas.hero-waves').forEach((canvas) => {
    if (prefersReduced) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let w = 0, h = 0;
    let time = 0;
    let raf = null;
    let running = true;
    const mouse  = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };

    const palette = [
      { offset: 0,             amplitude: 70, frequency: 0.0030, color: 'rgba(201,168,76,0.85)', opacity: 0.45 },
      { offset: Math.PI / 2,   amplitude: 90, frequency: 0.0026, color: 'rgba(122,106,58,0.75)', opacity: 0.35 },
      { offset: Math.PI,       amplitude: 60, frequency: 0.0034, color: 'rgba(240,236,228,0.55)', opacity: 0.30 },
      { offset: Math.PI * 1.5, amplitude: 80, frequency: 0.0022, color: 'rgba(154,149,140,0.40)', opacity: 0.25 },
      { offset: Math.PI * 2,   amplitude: 55, frequency: 0.0040, color: 'rgba(201,168,76,0.30)', opacity: 0.20 },
    ];

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width  = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mouse.x = target.x = w / 2;
      mouse.y = target.y = h / 2;
    };

    const drawWave = (wave) => {
      ctx.save();
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const dx = x - mouse.x;
        const dy = h / 2 - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const influence = Math.max(0, 1 - dist / 320);
        const mouseEffect = influence * 70 * Math.sin(time * 0.001 + x * 0.01 + wave.offset);
        const y = h / 2
          + Math.sin(x * wave.frequency + time * 0.002 + wave.offset) * wave.amplitude
          + Math.sin(x * wave.frequency * 0.4 + time * 0.003) * (wave.amplitude * 0.45)
          + mouseEffect;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = wave.color;
      ctx.globalAlpha = wave.opacity;
      ctx.shadowBlur = 35;
      ctx.shadowColor = wave.color;
      ctx.stroke();
      ctx.restore();
    };

    const tick = () => {
      if (!running) return;
      time += 1;
      mouse.x += (target.x - mouse.x) * 0.1;
      mouse.y += (target.y - mouse.y) * 0.1;

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0a0a0a');
      grad.addColorStop(1, '#111110');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      palette.forEach(drawWave);

      raf = requestAnimationFrame(tick);
    };

    const start = () => { if (!raf) { running = true; raf = requestAnimationFrame(tick); } };
    const stop  = () => { running = false; if (raf) { cancelAnimationFrame(raf); raf = null; } };

    resize();
    start();

    // Mouse tracking on the parent hero (canvas is pointer-events: none).
    const host = canvas.parentElement || document;
    host.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      target.x = e.clientX - r.left;
      target.y = e.clientY - r.top;
    });
    host.addEventListener('mouseleave', () => { target.x = w / 2; target.y = h / 2; });

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) e.isIntersecting ? start() : stop();
      }, { threshold: 0 });
      io.observe(canvas);
    }
    document.addEventListener('visibilitychange', () => {
      document.hidden ? stop() : start();
    });

    let rt = null;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(resize, 120);
    }, { passive: true });
  });
})();
