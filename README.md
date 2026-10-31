# Halcyon Wing

A Wing Commander–style space combat sim that runs in the browser (three.js, no build step).

## Play locally

Any static file server works — ES modules won't load from `file://`.

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to Render

This repo includes a Render Blueprint (`render.yaml`).

1. In the Render dashboard choose **New → Blueprint**.
2. Connect this repository and approve the `halcyon-wing` static site.
3. Render publishes it at `https://halcyon-wing.onrender.com` (or similar); every push to `main` redeploys.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/dj-qwik/HalcyonWing)

## Layout

| Path | What |
| --- | --- |
| `index.html` | Page, styles, menus, importmap (three.js 0.160 from jsDelivr) |
| `ui.js` | Screens, cutscene stages, hub rooms, options and rebinding |
| `core.js` | Engine: rendering, input bindings, audio, flight, AI, missions |
| `models.js`, `space.js`, `planets.js` | Ships, sky, procedural planets |
| `rooms.js`, `interior.js` | Halcyon interiors |
| `portraits.js`, `crew.js`, `cockpits.js` | Characters and cockpits |
| `story.js` | Campaign, cast and dialogue |
| `assets/` | Sound effects, music, character data (credits in `assets/sfx/CREDITS.txt` and `assets/music/CREDITS.txt`) |
