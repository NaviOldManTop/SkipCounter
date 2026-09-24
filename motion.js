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
