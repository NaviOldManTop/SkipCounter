// Service worker registration + "new version available" banner.
// sw.js calls skipWaiting() and clients.claim(), so a new deploy takes over
// this page right away and fires 'controllerchange'.

export function initUpdates() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const sw = navigator.serviceWorker;
  // No controller yet means first install: being claimed then is not an update.
  let controlled = Boolean(sw.controller);
  let shown = false;

  sw.addEventListener('controllerchange', () => {
    if (controlled && !shown) {
      shown = true;
      showBanner();
    }
    controlled = true;
  });

  sw.register('sw.js')
    .then((registration) => {
      const check = () => registration.update().catch((err) => console.warn('SW update check failed', err));
      // iOS keeps the PWA alive in the background, so check again when it comes back.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      if (document.readyState === 'complete') check();
      else window.addEventListener('load', check, { once: true });
    })
    .catch((err) => console.warn('SW registration failed', err));
}

function showBanner() {
  if (document.getElementById('update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.textContent = 'New version available';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Reload';
  button.addEventListener('click', () => location.reload());
  banner.append(text, button);
  document.body.append(banner);
}
