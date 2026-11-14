// Redline Syndicate: start-light loader, the live 3D car, the scroll story and the reaction game.
// Everything here is progressive: the page reads fully with no JavaScript, no WebGL or reduced motion.
import * as THREE from 'three';
import { createCar, studioEnvironment } from './car.js';

const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const motion = !!(gsap && ScrollTrigger) && !reduce;
if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
if (motion) root.classList.add('motion');

/* ------------------------------------------------------------------ */
/* Smooth scroll                                                        */
/* ------------------------------------------------------------------ */
let lenis = null;
if (motion && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 0.95 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains('skip')) return;
    const id = a.getAttribute('href');
    const target = id === '#top' ? document.body : $(id);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target === document.body ? 0 : target, { duration: 1.4 });
    history.replaceState(null, '', id);
    const focusTarget = target === document.body ? $('#main') : target;
    if (!focusTarget.hasAttribute('tabindex')) focusTarget.setAttribute('tabindex', '-1');
    focusTarget.focus({ preventScroll: true });
  });
}

/* ------------------------------------------------------------------ */
/* Nav and mobile menu                                                  */
/* ------------------------------------------------------------------ */
function initNav() {
  const nav = $('[data-nav]');
  const toggle = $('.nav__toggle', nav);
  const menu = $('#menu');
  let last = window.scrollY;
  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-solid', y > 40 || isOpen());
    if (Math.abs(y - last) < 6) return;
    if (y > last && y > 320 && !isOpen() && !nav.contains(document.activeElement)) nav.classList.add('is-hidden');
    else if (y < last) nav.classList.remove('is-hidden');
    last = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    nav.classList.toggle('is-solid', open || window.scrollY > 40);
    if (open) { nav.classList.remove('is-hidden'); lenis?.stop(); $('a', menu)?.focus(); }
    else lenis?.start();
  };
  toggle.addEventListener('click', () => setOpen(!isOpen()));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) { setOpen(false); toggle.focus(); } });
  window.matchMedia('(min-width: 60.0625rem)').addEventListener('change', (e) => { if (e.matches && isOpen()) setOpen(false); });
}

/* ------------------------------------------------------------------ */
/* The start-light reaction game                                        */
/* ------------------------------------------------------------------ */
function initRace() {
  const section = $('#race');
  const btn = $('[data-launch]', section);
  const lights = $$('.gantry__light', section);
  const status = $('.race__status', section);
  const timeEl = $('[data-time]', section);
  const bestEl = $('[data-best]', section);
  const car = $('.track__car', section);
  const line = $('.track__line', section);
  const KEY = 'rs-best-reaction-ms';
  const fmt = (ms) => (ms / 1000).toFixed(3) + ' s';
  let best = null;
  try { const v = parseFloat(localStorage.getItem(KEY)); if (v > 0) best = v; } catch { /* storage blocked */ }
  if (best) bestEl.textContent = fmt(best);

  let state = 'idle';
  let timers = [];
  let outAt = 0;
  let inView = false;
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const setLights = (n) => lights.forEach((l, i) => l.classList.toggle('is-on', i < n));
  const say = (msg, isError = false) => { status.textContent = msg; status.classList.toggle('is-error', isError); };
  const resetCar = () => { car.getAnimations?.().forEach((a) => a.cancel()); car.style.transform = ''; };

  function start() {
    clearTimers(); resetCar(); setLights(0);
    state = 'lights';
    btn.textContent = 'Launch';
    say('Lights coming on. Launch the moment all five go out.');
    for (let i = 1; i <= 5; i++) timers.push(setTimeout(() => setLights(i), i * 800));
    const hold = 5 * 800 + 300 + Math.random() * 2400;
    timers.push(setTimeout(() => { setLights(0); state = 'go'; outAt = performance.now(); }, hold));
  }
  function jump() {
    clearTimers(); setLights(0);
    state = 'idle';
    timeEl.textContent = 'Jump start';
    btn.textContent = 'Start the lights';
    say('Jump start. The lights were still on, so that run does not count. Try again.', true);
  }
  function react() {
    const ms = performance.now() - outAt;
    state = 'done';
    timeEl.textContent = fmt(ms);
    let msg = `Reaction ${fmt(ms)}.`;
    if (!best || ms < best) {
      best = ms; bestEl.textContent = fmt(best); msg += ' That is your best so far.';
      try { localStorage.setItem(KEY, String(Math.round(ms))); } catch { /* storage blocked */ }
    }
    say(`${msg} Press again for another start.`);
    btn.textContent = 'Go again';
    const dist = Math.max(0, line.clientWidth - car.offsetWidth);
    if (reduce || !car.animate) car.style.transform = `translateX(${dist}px)`;
    else car.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dist}px)` }], { duration: 1050, easing: 'cubic-bezier(.55,0,.2,1)', fill: 'forwards' });
  }
  const press = () => {
    if (state === 'idle' || state === 'done') start();
    else if (state === 'lights') jump();
    else if (state === 'go') react();
  };

  // Pointer-down and key-down for honest reaction times; click covers assistive tech.
  let handled = false;
  btn.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; handled = true; press(); });
  btn.addEventListener('keydown', (e) => {
    if ((e.code === 'Space' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); handled = true; press(); }
  });
  btn.addEventListener('keyup', (e) => { if (e.code === 'Space') e.preventDefault(); });
  btn.addEventListener('click', () => { if (handled) { handled = false; return; } press(); });

  new IntersectionObserver(([en]) => { inView = en.isIntersecting; }, { threshold: 0.35 }).observe(section);
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || !inView) return;
    const t = e.target;
    if (t === btn || t.closest?.('a, button, input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    press();
  });
}

/* ------------------------------------------------------------------ */
/* Loader: the five start lights fill as the page loads                 */
/* ------------------------------------------------------------------ */
function createLoader() {
  const el = $('.loader');
  const lights = el ? $$('.loader__light', el) : [];
  const num = el ? $('.loader__num', el) : null;
  let target = 0;
  let shown = 0;
  const t0 = performance.now();
  return {
    set(v) { target = Math.max(target, clamp(v, 0, 1)); },
    finish() {
      return new Promise((resolve) => {
        if (!el) return resolve();
        target = 1;
        const minMs = reduce ? 0 : 1500;
        const tick = () => {
          const timeCap = reduce ? 1 : clamp((performance.now() - t0) / minMs, 0, 1);
          shown += (Math.min(target, timeCap) - shown) * (reduce ? 1 : 0.14);
          if (shown > 0.997) shown = 1;
          lights.forEach((l, i) => l.classList.toggle('is-on', shown >= (i + 1) / 5 - 0.001));
          if (num) num.textContent = String(Math.round(shown * 100));
          if (shown < 1) return requestAnimationFrame(tick);
          // All five lit. Hold, then lights out.
          setTimeout(() => { lights.forEach((l) => l.classList.remove('is-on')); setTimeout(resolve, reduce ? 0 : 160); }, reduce ? 0 : 520);
        };
        tick();
      });
    },
    progressTick() {
      // Called while assets load so the lights track real progress.
      if (!el) return;
      const timeCap = clamp((performance.now() - t0) / 1500, 0, 1);
      shown += (Math.min(target, timeCap) * 0.92 - shown) * 0.12;
      lights.forEach((l, i) => l.classList.toggle('is-on', shown >= (i + 1) / 5 - 0.001));
      if (num) num.textContent = String(Math.round(shown * 100));
    },
    remove() {
      if (!el) return Promise.resolve();
      return new Promise((resolve) => {
        if (!gsap || reduce) { el.remove(); return resolve(); }
        gsap.set(el, { clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' });
        gsap.to(el, { clipPath: 'polygon(0% 0%, 100% 0%, 100% -28%, 0% 0%)', duration: 0.95, ease: 'expo.inOut', onComplete: () => { el.remove(); resolve(); } });
        setTimeout(resolve, 380); // start the hero while the sheet is still wiping away
      });
    },
  };
}

/* ------------------------------------------------------------------ */
/* The 3D stage                                                         */
/* ------------------------------------------------------------------ */
async function initStage(onProgress) {
  const canvas = $('.stage');
  if (!canvas) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch { return null; }
  if (!renderer.getContext()) return null;

  const view = { w: window.innerWidth, h: window.innerHeight };
  const small = Math.min(view.w, view.h) < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 2 : 1.75));
  renderer.setSize(view.w, view.h, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.environment = await studioEnvironment(renderer);
  scene.environmentIntensity = 0.9;
  onProgress(0.35);

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(8, 26, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 });
  key.shadow.radius = 6;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const car = await createCar({ logoSrc: 'assets/logo-mark-sticker.svg' });
  scene.add(car.group);
  onProgress(0.75);

  const cam = new THREE.PerspectiveCamera(30, view.w / view.h, 0.5, 3000);
  const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  const UP = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3(), right = new THREE.Vector3(), camUp = new THREE.Vector3();
  const center = new THREE.Vector3(), corner = new THREE.Vector3(), tmp = new THREE.Vector3();

  // Point the camera along (az, el) and pull back until the car's box fills `rect` (viewport px).
  function frame(rect, az, el, e, lift, pad = 1) {
    const W = view.w, H = view.h;
    const x0 = lerp(-11.4, -20.8, e), x1 = lerp(10.8, 16.6, e);
    const y0 = lerp(0, -3.1, e) + lift, y1 = lerp(5.9, 10.5, e) + lift;
    const zz = lerp(3.4, 6.7, e);
    center.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
    dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    right.crossVectors(UP, dir).normalize();
    camUp.crossVectors(dir, right);
    const sx = Math.max(0.08, rect.w / W) * 0.94 * pad, sy = Math.max(0.08, rect.h / H) * 0.94 * pad;
    const aspect = W / H;
    let D = 1;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? zz : -zz).sub(center);
      const xr = Math.abs(corner.dot(right)), yu = Math.abs(corner.dot(camUp)), zt = corner.dot(dir);
      D = Math.max(D, zt + xr / (sx * tanH * aspect), zt + yu / (sy * tanH));
    }
    cam.position.copy(center).addScaledVector(dir, D);
    cam.lookAt(center);
    cam.setViewOffset(W, H, W / 2 - (rect.x + rect.w / 2), H / 2 - (rect.y + rect.h / 2), W, H);
  }

  renderer.compile(scene, cam);
  onProgress(0.95);

  const hero = $('.hero');
  const heroCopy = $('.hero__copy');
  const heroTitle = $('.hero__title');
  const manifesto = $('#manifesto');
  const machine = $('#machine');
  const slot = $('.machine__slot');
  const gutterOf = (el) => parseFloat(getComputedStyle(el).paddingLeft) || 16;

  const S = { drive: motion ? -46 : 0, reveal: motion ? 0 : 1, pin: null, active: 0, scrolly: false, px: 0, py: 0, tx: 0, ty: 0 };
  let heroVisible = true, machineVisible = false;
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.target === hero) heroVisible = en.isIntersecting;
      if (en.target === machine) machineVisible = en.isIntersecting;
    }
    canvas.classList.toggle('is-visible', heroVisible || machineVisible);
    calloutWrap.hidden = !machineVisible;
  });

  // Callouts: one tag per assembly, projected from the car each frame.
  const calloutWrap = $('.callouts');
  document.body.append(calloutWrap);
  const parts = $$('.part');
  const callouts = parts.map((li) => {
    const el = document.createElement('div');
    el.className = 'callout';
    const code = $('.part__code', li).textContent.trim();
    const name = $('h3', li).textContent.trim();
    el.innerHTML = '<span class="callout__dot"></span><span class="callout__line"></span><span class="callout__tag"><b></b> </span>';
    el.querySelector('b').textContent = code;
    el.querySelector('.callout__tag').append(name);
    calloutWrap.append(el);
    return { key: li.dataset.part, el, li };
  });
  const setActive = (i) => {
    if (i === S.active) return;
    S.active = i;
    callouts.forEach((c, k) => { c.li.classList.toggle('is-active', k === i); c.el.classList.toggle('is-on', k === i); });
  };
  S.active = -1; setActive(0);
  parts.forEach((li, i) => li.addEventListener('pointerenter', () => { if (!S.scrolly) setActive(i); }));

  if (!reduce) window.addEventListener('pointermove', (e) => {
    S.tx = (e.clientX / view.w) * 2 - 1;
    S.ty = (e.clientY / view.h) * 2 - 1;
  }, { passive: true });

  const onResize = () => {
    view.w = window.innerWidth; view.h = window.innerHeight;
    renderer.setSize(view.w, view.h, false);
    cam.aspect = view.w / view.h;
    cam.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; root.classList.remove('has-webgl'); });

  let lastT = performance.now();
  let lastDrive = 0;
  function render() {
    if (lost || !(heroVisible || machineVisible)) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const W = view.w, H = view.h;
    const narrow = W < 700;

    // Hero slot: between the nav and the headline, inside the container.
    const hr = hero.getBoundingClientRect();
    const cr = heroCopy.getBoundingClientRect();
    const g = gutterOf(heroCopy);
    const tTop = heroTitle.getBoundingClientRect().top;
    const hTop = hr.top + (narrow ? 84 : 92);
    const inner = cr.width - 2 * g;
    const wide = W >= 960 && W / H > 1.15;
    const heroRect = wide
      ? { x: cr.left + g + inner * 0.3, y: hTop, w: inner * 0.7, h: Math.max(200, Math.min(hr.bottom, hr.top + H) - 84 - hTop) }
      : { x: cr.left + g, y: hTop, w: inner, h: Math.max(140, tTop - (narrow ? 14 : 30) - hTop) };

    // Machine slot: the empty middle row of the pinned layout.
    const sr = slot.getBoundingClientRect();
    const machineRect = { x: sr.left, y: sr.top, w: sr.width, h: Math.max(120, sr.height) };

    // m: hero pose to machine pose while the red manifesto sheet covers the stage.
    const mr = manifesto.getBoundingClientRect();
    let m = clamp((H * 0.7 - mr.top) / (mr.height + H * 0.4), 0, 1);
    m = reduce ? (m > 0.5 ? 1 : 0) : smooth(0, 1, m);
    const heroP = clamp(-hr.top / Math.max(1, hr.height), 0, 1);
    const pinP = S.pin ? S.pin.progress : 1;
    const e = S.scrolly ? smooth(0.02, 0.36, pinP) : 1;
    if (S.scrolly) setActive(clamp(Math.floor(((pinP - 0.3) / 0.68) * 6), 0, 5));

    // Pointer parallax, eased.
    S.px += (S.tx - S.px) * Math.min(1, dt * 3);
    S.py += (S.ty - S.py) * Math.min(1, dt * 3);
    const sway = reduce ? 0 : Math.sin(now / 2600) * 0.045;
    const rad = THREE.MathUtils.degToRad;
    const heroAz = rad(narrow ? 50 : 40) + sway + S.px * rad(5) + heroP * rad(26);
    const heroEl = rad(11) + S.py * rad(-2.5) + heroP * rad(8);
    const machAz = S.scrolly ? lerp(rad(32), rad(-24), smooth(0.05, 1, pinP)) : rad(24);
    const machEl = rad(21) + S.py * rad(-2);

    const rect = {
      x: lerp(heroRect.x, machineRect.x, m), y: lerp(heroRect.y, machineRect.y, m),
      w: lerp(heroRect.w, machineRect.w, m), h: lerp(heroRect.h, machineRect.h, m),
    };
    const ee = e * m;
    const lift = 3.2 * ee;
    // The bounding box is generous for the exploded layout, so let it fill the slot a little more.
    frame(rect, lerp(heroAz, machAz, m), lerp(heroEl, machEl, m), ee, lift, lerp(1, 1.16, ee));

    car.setExplode(ee);
    car.group.position.set(S.drive, lift, 0);
    car.spinWheels((S.drive - lastDrive) / 1.4);
    lastDrive = S.drive;
    car.setReveal(S.reveal);
    floor.material.opacity = lerp(0.2, 0.05, ee);

    renderer.render(scene, cam);

    if (machineVisible) {
      for (let k = 0; k < callouts.length; k++) {
        const c = callouts[k];
        if (k !== S.active) continue;
        car.anchorWorld(c.key, tmp);
        tmp.project(cam);
        const x = (tmp.x + 1) / 2 * W, y = (1 - tmp.y) / 2 * H;
        // The tag stands above its part; it drops below when it would run under the nav.
        const below = y < 190;
        c.el.classList.toggle('is-below', below);
        c.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, ${below ? '-7px' : 'calc(-100% + 7px)'})`;
      }
    }
  }

  return {
    S, render, renderer,
    start() { io.observe(hero); io.observe(machine); canvas.classList.add('is-visible'); root.classList.add('has-webgl'); },
    enableScrolly(pinTrigger) { S.scrolly = true; S.pin = pinTrigger; machine.classList.add('is-scrolly'); },
  };
}

/* ------------------------------------------------------------------ */
/* Scroll story                                                         */
/* ------------------------------------------------------------------ */
function splitWords(el) {
  const text = el.textContent.trim();
  el.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'visually-hidden';
  sr.textContent = text;
  el.append(sr);
  const words = text.split(/\s+/).map((w) => {
    const s = document.createElement('span');
    s.className = 'w';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = w;
    return s;
  });
  words.forEach((s, i) => { el.append(s); if (i < words.length - 1) el.append(' '); });
  return words;
}

function initScrollStory(stage) {
  if (!motion) return;

  // Hero drifts apart as it leaves: the word slower than the copy.
  gsap.to('.hero__word', { yPercent: 38, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__copy', { y: -90, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // Red and ink sheets go on with a diagonal squeegee pass, like vinyl.
  $$('.field').forEach((f) => {
    if (f.classList.contains('footer')) return;
    gsap.fromTo(f,
      { clipPath: 'polygon(0% 0%, 0% 0%, -22% 100%, 0% 100%)' },
      { clipPath: 'polygon(0% 0%, 122% 0%, 100% 100%, 0% 100%)', ease: 'none', scrollTrigger: { trigger: f, start: 'top bottom', end: 'top 25%', scrub: 0.5 } });
  });

  // Manifesto: words fill in as you read down.
  const words = splitWords($('[data-words]'));
  gsap.fromTo(words, { opacity: 0.18 }, { opacity: 1, ease: 'none', stagger: 0.12, scrollTrigger: { trigger: '.manifesto__title', start: 'top 82%', end: 'bottom 48%', scrub: true } });
  gsap.from('.manifesto__sticker', { rotation: -24, scale: 0.7, opacity: 0, duration: 1.1, ease: 'back.out(1.6)', scrollTrigger: { trigger: '.manifesto__sticker', start: 'top 85%' } });

  // The machine: pinned while the car comes apart.
  if (stage) {
    const pin = ScrollTrigger.create({
      trigger: '.machine__pin', start: 'top top', end: () => '+=' + Math.round(window.innerHeight * 2.6),
      pin: true, pinSpacing: true, anticipatePin: 1, invalidateOnRefresh: true,
    });
    stage.enableScrolly(pin);
  }

  // Crew decals are stuck down one after another.
  gsap.from('.decal', {
    y: 90, rotation: -8, opacity: 0, duration: 1.05, ease: 'expo.out', stagger: 0.09, clearProps: 'transform,opacity',
    scrollTrigger: { trigger: '.crew__grid', start: 'top 82%' },
  });

  // Season rail fills with the scroll.
  gsap.fromTo('.season__fill', { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.season__steps', start: 'top 88%', end: 'bottom 60%', scrub: true } });
  gsap.from('.season__steps li', { y: 36, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08, clearProps: 'transform,opacity', scrollTrigger: { trigger: '.season__steps', start: 'top 85%' } });

  // Partner car slides in, then its slots start marching.
  gsap.from('.slots__car', { xPercent: 30, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: '.slots', start: 'top 80%' } });
}

function playIntro(stage) {
  if (!motion) { if (stage) stage.S.reveal = 1; return; }
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.from('.hero__word span', { xPercent: 14, opacity: 0, duration: 1.6, ease: 'expo.out', clearProps: 'transform,opacity' }, 0)
    .from('.hero__title .line > span', { yPercent: 112, duration: 1.05, stagger: 0.12, clearProps: 'transform' }, 0.2)
    .from(['.hero__lead', '.hero__actions'], { y: 26, opacity: 0, duration: 0.85, stagger: 0.1, clearProps: 'transform,opacity' }, 0.5)
    .from('.nav__inner', { y: -30, opacity: 0, duration: 0.8, clearProps: 'transform,opacity' }, 0.35)
    .from('.hero__cue', { opacity: 0, duration: 0.6 }, 1.2);
  if (stage) {
    tl.to(stage.S, { drive: 0, duration: 1.7, ease: 'expo.out' }, 0)
      .to(stage.S, { reveal: 1, duration: 1.7, ease: 'power2.inOut' }, 0.75);
  }
}

/* ------------------------------------------------------------------ */
/* Boot                                                                 */
/* ------------------------------------------------------------------ */
initNav();
initRace();

const loader = createLoader();
lenis?.stop();
let loading = true;
(function pump() { if (!loading) return; loader.progressTick(); requestAnimationFrame(pump); })();

const fontsReady = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => loader.set(0.2));
let stage = null;
try {
  stage = await Promise.race([
    initStage((p) => loader.set(p)),
    new Promise((resolve) => setTimeout(() => resolve(null), 9000)),
  ]);
} catch (err) {
  console.warn('3D stage unavailable, showing still renders instead.', err);
  stage = null;
}
await Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2500))]);

if (stage) {
  stage.start();
  if (gsap) gsap.ticker.add(stage.render);
  else (function loop() { stage.render(); requestAnimationFrame(loop); })();
}
loading = false;
await loader.finish();
const removed = loader.remove();
initScrollStory(stage);
await removed;
playIntro(stage);
lenis?.start();
if (ScrollTrigger) ScrollTrigger.refresh();
