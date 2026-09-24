// Small page transitions and edge-swipe navigation between tabs.

const TABS = ['#/', '#/calendar', '#/settings'];
const EDGE = 28; // a swipe must start this close to the screen edge
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Left-to-right order of screens: a subject page sits just "right" of Home.
function routeOrder(hash) {
  const h = hash && hash !== '#' ? hash : '#/';
  if (h.startsWith('#/s/')) return 0.5;
  const i = TABS.indexOf(h);
  return i < 0 ? 0 : i;
}

function restart(el, cls) {
  el.classList.remove('enter', 'enter-l', 'enter-r', 'fade-in');
  void el.offsetWidth; // reflow so the animation plays again
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

// New screen slides in from the side you are moving towards.
export function playEnter(el, fromHash, toHash) {
  if (!el || reduceMotion()) return;
  const d = routeOrder(toHash) - routeOrder(fromHash);
  restart(el, d > 0 ? 'enter-r' : d < 0 ? 'enter-l' : 'enter');
}

export function fadeIn(el) {
  if (el && !reduceMotion()) restart(el, 'fade-in');
}

// Month grid slides in from the side you navigated towards (dir 1: next, -1: previous).
export function slideIn(el, dir) {
  if (!el || reduceMotion()) return;
  const cls = dir < 0 ? 'slide-in-l' : 'slide-in-r';
  el.classList.remove('slide-in-l', 'slide-in-r');
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

// ---------- bottom sheets ----------

const closing = new WeakMap(); // dialog -> pending close promise

function clearDrag(dialog) {
  dialog.style.transform = '';
  dialog.style.transition = '';
  dialog.style.opacity = '';
}

// Animated dialog.close(): slides the sheet down and fades the backdrop.
// If the sheet was dragged (inline transform), it continues from where the finger left it.
export function closeSheet(dialog) {
  if (!dialog?.open) return Promise.resolve();
  if (closing.has(dialog)) return closing.get(dialog);
  if (reduceMotion()) {
    clearDrag(dialog);
    dialog.close();
    return Promise.resolve();
  }
  const dragged = Boolean(dialog.style.transform);
  const promise = new Promise((resolve) => {
    let timer;
    const finish = () => {
      clearTimeout(timer);
      dialog.removeEventListener(dragged ? 'transitionend' : 'animationend', onEnd);
      dialog.removeEventListener('close', finish);
      closing.delete(dialog);
      dialog.classList.remove('closing', 'dismissing');
      clearDrag(dialog);
      if (dialog.open) dialog.close();
      resolve();
    };
    const onEnd = (e) => { if (e.target === dialog) finish(); };
    dialog.addEventListener(dragged ? 'transitionend' : 'animationend', onEnd);
    dialog.addEventListener('close', finish); // closed by something else (e.g. navigation) meanwhile
    timer = setTimeout(finish, 320);
    if (dragged) {
      dialog.classList.add('dismissing');
      dialog.style.transition = 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease-in';
      dialog.style.transform = 'translateY(100%)';
      dialog.style.opacity = '0.6';
    } else {
      dialog.classList.add('closing');
    }
  });
  closing.set(dialog, promise);
  return promise;
}

// Swipe a sheet down to dismiss it: from the header, or from anywhere while it is scrolled to the top.
export function initSheetGestures(dialog) {
  let g = null;
  const FAR = 110;
  const FLICK = 60;
  const FLICK_MS = 250;

  const snapBack = () => {
    if (!dialog.style.transform) return clearDrag(dialog);
    dialog.style.transition = 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)';
    dialog.style.transform = '';
    const done = () => { if (!dialog.style.transform) dialog.style.transition = ''; };
    dialog.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 260);
  };

  dialog.addEventListener('touchstart', (e) => {
    g = null;
    if (e.touches.length !== 1 || closing.has(dialog)) return;
    if (e.target.closest('input, select, textarea, button')) return;
    const fromHead = Boolean(e.target.closest('.sheet-head'));
    if (!fromHead && dialog.scrollTop > 0) return;
    const t = e.touches[0];
    g = { x: t.clientX, y: t.clientY, at: Date.now(), dy: 0, dragging: false, fromHead };
  }, { passive: true });

  dialog.addEventListener('touchmove', (e) => {
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    if (!g.dragging) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      // Only a downward, mostly vertical move starts a drag; anything else is a scroll or a tap.
      if (dy <= 0 || Math.abs(dy) < Math.abs(dx) || (!g.fromHead && dialog.scrollTop > 0)) {
        g = null;
        return;
      }
      g.dragging = true;
      g.y = t.clientY; // start from here so the sheet doesn't jump by the threshold
    }
    g.dy = Math.max(0, t.clientY - g.y);
    dialog.style.transition = 'none';
    dialog.style.transform = g.dy ? `translateY(${g.dy}px)` : '';
  }, { passive: true });

  dialog.addEventListener('touchend', () => {
    if (!g) return;
    const { dragging, dy, at } = g;
    g = null;
    if (!dragging) return;
    if (dy > FAR || (dy > FLICK && Date.now() - at < FLICK_MS)) closeSheet(dialog);
    else snapBack();
  });

  dialog.addEventListener('touchcancel', () => {
    if (g?.dragging) snapBack();
    g = null;
  });

  dialog.addEventListener('close', () => {
    g = null;
    if (!closing.has(dialog)) clearDrag(dialog);
  });
}

// ---------- tab bar ----------

let indicatorPlaced = false;
let indicatorShown = false;

// Soft pill behind the active tab; slides between tabs, fades out when no tab is active.
export function moveTabIndicator(instant = false) {
  const pill = document.querySelector('.tabbar .tab-indicator');
  if (!pill) return;
  const active = document.querySelector('.tabbar a.active');
  if (!active || !active.offsetWidth) {
    pill.style.opacity = '0'; // keep its position so it can fade back in place
    indicatorShown = false;
    return;
  }
  // First placement, resize, or coming back from a hidden state: jump there, no slide from x=0.
  const jump = instant || !indicatorPlaced || !indicatorShown;
  if (jump) pill.style.transition = indicatorPlaced ? 'opacity 0.2s ease' : 'none';
  pill.style.top = `${active.offsetTop}px`;
  pill.style.height = `${active.offsetHeight}px`;
  pill.style.width = `${active.offsetWidth}px`;
  pill.style.transform = `translateX(${active.offsetLeft}px)`;
  pill.style.opacity = '1';
  if (jump) {
    void pill.offsetWidth; // commit the position before transitions come back
    pill.style.transition = '';
  }
  indicatorPlaced = true;
  indicatorShown = true;
}

export function initSwipeNav(app) {
  let swipe = null;

  const drag = (dx) => {
    app.style.transition = 'none';
    app.style.transform = dx ? `translateX(${dx * 0.22}px)` : '';
  };
  const release = () => {
    swipe = null;
    app.style.transition = 'transform 0.2s ease';
    app.style.transform = '';
  };

  const go = (dir) => {
    const hash = location.hash || '#/';
    if (hash.startsWith('#/s/')) {
      if (dir === 1) location.hash = '#/'; // like iOS "back"
      return;
    }
    const next = TABS.indexOf(TABS.includes(hash) ? hash : '#/') - dir;
    if (next >= 0 && next < TABS.length) location.hash = TABS[next];
  };

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || document.querySelector('dialog[open]')) return;
    if (e.target.closest('input, select, textarea, .filters')) return;
    const t = e.touches[0];
    const fromLeft = t.clientX <= EDGE;
    const fromRight = t.clientX >= window.innerWidth - EDGE;
    if (!fromLeft && !fromRight) return;
    // dir 1: from the left edge moving right (go back); -1: from the right edge moving left.
    swipe = { x: t.clientX, y: t.clientY, at: Date.now(), dir: fromLeft ? 1 : -1, dx: 0, horizontal: false };
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!swipe) return;
    const t = e.touches[0];
    const dx = t.clientX - swipe.x;
    const dy = t.clientY - swipe.y;
    if (!swipe.horizontal) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        release(); // it's a scroll
        return;
      }
      if (Math.abs(dx) > 10) swipe.horizontal = true;
    }
    swipe.dx = Math.sign(dx) === swipe.dir ? dx : 0;
    if (!reduceMotion()) drag(swipe.dx);
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!swipe) return;
    const { dx, dir, at, horizontal } = swipe;
    const quick = Date.now() - at < 400;
    const far = Math.abs(dx) > 80 || (quick && Math.abs(dx) > 45);
    release();
    if (horizontal && far) go(dir);
  });

  document.addEventListener('touchcancel', () => swipe && release());
}
