[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Hoppererin/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Hoppererin/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

# Vice Sunset — Cover Studio

A web app that turns your photos into GTA-style poster cover art and exports it as a PNG to share. 100% offline: every file it loads lives under `app/`, and your photos are read on your own machine — never uploaded.

## What it does

- **Any photo** — load photos from your machine (file picker or drag-and-drop) or start from the three built-in sample photos. Click a panel to select it, drag it to reposition the photo, scroll to zoom.
- **Multi-panel posters** — Solo (one full-bleed photo), Duo (two vertical panels), Trio (one big panel + two stacked), or Quad (2×2 grid). Each panel gets its own photo, zoom, position and colour grade.
- **Bold caption lettering** — a big outlined title with a gradient fill, a letterspaced tagline, top or bottom placement, and four colour themes (Sunset, Neon, Gold, Noir).
- **Original art, drawn by the app** — a retro striped sun, palm silhouettes and a skyline, all drawn with canvas paths. No logos, artwork or fonts from any game are used anywhere.
- **One-click looks** — Vice Sunset, Neon Nights, Golden Hour and Noir Drive presets set the layout, grade, theme and photos in one tap.
- **Fast export** — one click exports a PNG in 1080×1080, 1080×1350 or 1920×1080.

## Try it

Serve `app/` with any static HTTP server and open `index.html` in desktop Chrome:

```sh
cd app && python3 -m http.server 8080
```

No build step, no network requests at runtime.

## Files

- `app/index.html` — the editor page
- `app/style.css` — the studio theme
- `app/app.js` — the whole cover maker (one render path for preview and export)
- `app/samples/` — three sample photos, made with an image model for this app
- `screenshots/` — the app at work and covers it exported
- `main.ts` — the entry program: copies `app/` + `screenshots/` to `/output` and writes `dossier.json`
- `vendor/makefun-app.ts` — the kit's dossier library, unchanged

## License

MIT — see [LICENSE](LICENSE).

---

Entered on [make.fun](https://make.fun/r/dhj53q2r) — built for the gta6-cover-art-01 bounty.
