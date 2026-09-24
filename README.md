# SkipCount

Attendance tracker for students: log each class as attended, skipped or excused, and see how many classes you can still skip before hitting the limit.

- Installable PWA: add it to the iPhone home screen and it runs full-screen and offline.
- No backend, no account. Data is stored in `localStorage` on the device; use **Settings → Export backup** to move it.
- Plain HTML/CSS/JS, no build step.
- Import your timetable from an `.ics` file (tested with the PJATK plan export): subjects, rooms and class counts are created automatically, and the home screen shows today's classes. A month calendar shows every class as a colored dot.

## Run locally

```bash
npm start
```

Opens on http://localhost:5173 and prints a LAN address you can open on your phone (same Wi-Fi). Offline mode only works on `localhost` or HTTPS, not on the LAN address.

## Deploy free on GitHub Pages

1. Create a public repository on GitHub, e.g. `SkipCount`.
2. Push this folder to it:
   ```bash
   git init
   git add .
   git commit -m "SkipCount"
   git branch -M main
   git remote add origin https://github.com/<user>/SkipCount.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
4. After about a minute the app is live at `https://<user>.github.io/SkipCount/`.

All paths are relative, so it works under the `/SkipCount/` subpath. Netlify or Cloudflare Pages work too: drag and drop the folder.

## Install on iPhone

1. Open the link in **Safari**.
2. Tap **Share → Add to Home Screen**.

## Updating

Push changes and the app picks them up on its next launch (the service worker serves the cached version first and then refreshes it in the background, so a change shows on the second open). If you add or rename files, add them to `ASSETS` in `sw.js` and bump `CACHE`.

## Files

| File | Purpose |
|---|---|
| `index.html` | Shell and the two dialogs (subject, class record) |
| `app.js` | State, stats, rendering, actions |
| `ics.js` | `.ics` parser and timetable classification |
| `styles.css` | Styles, light and dark themes |
| `sw.js` | Offline cache |
| `manifest.webmanifest` | PWA metadata and icons |
| `scripts/make-icons.ps1` | Regenerates PNG icons |
| `scripts/serve.mjs` | Local dev server |
