/* Vice Sunset Cover Studio — original cover maker, written from scratch.
   One render function draws both the live preview and the exported PNG,
   so what you see is exactly what you download. Photos are read on the
   user's own machine and never uploaded anywhere. */
'use strict';

/* ------------------------------------------------------------------ state */

const SAMPLE_PHOTOS = [
  { id: 'boulevard', src: 'samples/boulevard.jpg', label: 'Boulevard' },
  { id: 'pier', src: 'samples/pier.jpg', label: 'Pier' },
  { id: 'neon', src: 'samples/neon.jpg', label: 'Neon street' },
];

const EXPORT_SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: '1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, label: '1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, label: '1920 × 1080' },
};

const THEMES = {
  sunset: { title: '#fff7e8', accent: '#ff9e4f', accent2: '#ff5e78', dark: '#1c0b22', sun: '#ffd166' },
  neon: { title: '#eafcff', accent: '#2ee6ff', accent2: '#ff3df0', dark: '#070a1c', sun: '#ff5ce1' },
  gold: { title: '#fff8e0', accent: '#ffc53d', accent2: '#ff8a3d', dark: '#241703', sun: '#ffe08a' },
  noir: { title: '#ffffff', accent: '#e8e8e8', accent2: '#9a9a9a', dark: '#000000', sun: '#f2f2f2' },
};

const GRADES = {
  sunset: { filter: 'saturate(1.18) contrast(1.06)', overlay: ['rgba(255,122,26,0.16)', 'rgba(255,45,120,0.20)'], mode: 'overlay' },
  neon: { filter: 'saturate(1.38) contrast(1.09)', overlay: ['rgba(255,61,240,0.20)', 'rgba(46,230,255,0.20)'], mode: 'overlay' },
  golden: { filter: 'sepia(0.28) saturate(1.22) contrast(1.04)', overlay: ['rgba(255,196,66,0.14)', 'rgba(255,140,40,0.16)'], mode: 'soft-light' },
  noir: { filter: 'grayscale(1) contrast(1.16) brightness(1.06)', overlay: ['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.22)'], mode: 'multiply' },
  vivid: { filter: 'saturate(1.5) contrast(1.07)', overlay: ['rgba(255,255,255,0.00)', 'rgba(0,0,0,0.06)'], mode: 'overlay' },
  none: { filter: 'none', overlay: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'], mode: 'source-over' },
};

const PRESETS = {
  'vice-sunset': { layout: 'trio', theme: 'sunset', grade: 'sunset', title: 'VICE SUNSET', tagline: 'TWO SUNSETS · ONE LAST RIDE', photos: ['boulevard', 'pier', 'neon'] },
  'neon-nights': { layout: 'quad', theme: 'neon', grade: 'neon', title: 'NEON NIGHTS', tagline: 'THE CITY NEVER SLEEPS', photos: ['neon', 'pier', 'boulevard', 'neon'] },
  'golden-hour': { layout: 'solo', theme: 'gold', grade: 'golden', title: 'GOLDEN HOUR', tagline: 'CHASE THE LIGHT', photos: ['pier'] },
  'noir-drive': { layout: 'duo', theme: 'noir', grade: 'noir', title: 'NOIR DRIVE', tagline: 'EVERY STREET HAS A STORY', photos: ['neon', 'boulevard'] },
};

const LAYOUT_PANEL_COUNT = { solo: 1, duo: 2, trio: 3, quad: 4 };

function defaultPanel(photoIndex, grade) {
  return { photo: photoIndex, zoom: 1, ox: 0, oy: 0, grade: grade || 'sunset' };
}

const state = {
  photos: [], // { id, label, img, src }
  layout: 'trio',
  theme: 'sunset',
  title: 'VICE SUNSET',
  tagline: 'TWO SUNSETS · ONE LAST RIDE',
  titlePos: 'bottom',
  titleScale: 1,
  decorations: true,
  size: '1080x1080',
  selectedPanel: 0,
  panels: [defaultPanel(0, 'sunset'), defaultPanel(1, 'sunset'), defaultPanel(2, 'sunset')],
  preset: 'vice-sunset',
};

/* ------------------------------------------------------------- dom helpers */

const $ = (id) => document.getElementById(id);
const canvas = $('previewCanvas');
const ctx = canvas.getContext('2d');

function showStatus(text, ok) {
  const el = $('exportStatus');
  el.textContent = text;
  el.classList.toggle('ok', !!ok);
}

/* ------------------------------------------------------- layout geometry */

function layoutPanels(layout, W, H) {
  const g = Math.max(4, Math.round(W * 0.008));
  const half = (W - g) / 2;
  const third = (H - g) / 2;
  if (layout === 'solo') return [{ x: 0, y: 0, w: W, h: H }];
  if (layout === 'duo') {
    return [
      { x: 0, y: 0, w: half, h: H },
      { x: half + g, y: 0, w: half, h: H },
    ];
  }
  if (layout === 'trio') {
    const left = Math.round(W * 0.62);
    return [
      { x: 0, y: 0, w: left, h: H },
      { x: left + g, y: 0, w: W - left - g, h: third },
      { x: left + g, y: third + g, w: W - left - g, h: third },
    ];
  }
  return [
    { x: 0, y: 0, w: half, h: third },
    { x: half + g, y: 0, w: half, h: third },
    { x: 0, y: third + g, w: half, h: third },
    { x: half + g, y: third + g, w: half, h: third },
  ];
}

function fitPanelsToLayout() {
  const count = LAYOUT_PANEL_COUNT[state.layout];
  const keep = state.panels.slice(0, count);
  while (keep.length < count) {
    keep.push(defaultPanel(keep.length % Math.max(1, state.photos.length), state.panels[0] ? state.panels[0].grade : 'sunset'));
  }
  state.panels = keep;
  state.selectedPanel = Math.min(state.selectedPanel, count - 1);
}

/* ------------------------------------------------------- photo drawing */

function drawPhotoCover(c, img, rect, panel) {
  const s = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * panel.zoom;
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  const dx = rect.x + (rect.w - dw) / 2 + panel.ox * rect.w * 0.5;
  const dy = rect.y + (rect.h - dh) / 2 + panel.oy * rect.h * 0.5;
  c.save();
  c.beginPath();
  c.rect(rect.x, rect.y, rect.w, rect.h);
  c.clip();
  const grade = GRADES[panel.grade] || GRADES.none;
  c.filter = grade.filter;
  c.drawImage(img, dx, dy, dw, dh);
  c.filter = 'none';
  const grad = c.createLinearGradient(rect.x, rect.y, rect.x + rect.w * 0.25, rect.y + rect.h);
  grad.addColorStop(0, grade.overlay[0]);
  grad.addColorStop(1, grade.overlay[1]);
  c.globalCompositeOperation = grade.mode;
  c.fillStyle = grad;
  c.fillRect(rect.x, rect.y, rect.w, rect.h);
  c.globalCompositeOperation = 'source-over';
  c.restore();
}

function drawPanelFrame(c, rect, W) {
  c.save();
  c.strokeStyle = 'rgba(255,255,255,0.55)';
  c.lineWidth = Math.max(1.5, W * 0.0015);
  c.strokeRect(rect.x + c.lineWidth / 2, rect.y + c.lineWidth / 2, rect.w - c.lineWidth, rect.h - c.lineWidth);
  c.restore();
}

/* ------------------------------------------------------------ decorations */

/* A retro striped sun, drawn with canvas paths — entirely original art. */
function drawRetroSun(c, cx, cy, r, color) {
  c.save();
  const glow = c.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.7);
  glow.addColorStop(0, color);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalAlpha = 0.35;
  c.fillStyle = glow;
  c.beginPath();
  c.arc(cx, cy, r * 1.7, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
  const body = c.createLinearGradient(cx, cy - r, cx, cy + r);
  body.addColorStop(0, '#ffe9a8');
  body.addColorStop(0.45, color);
  body.addColorStop(1, '#ff5e78');
  c.fillStyle = body;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
  /* Horizontal slats across the lower half of the sun (opaque dark bands). */
  c.fillStyle = 'rgba(12,6,20,0.92)';
  let y = cy + r * 0.08;
  let h = r * 0.05;
  while (y < cy + r) {
    c.fillRect(cx - r, y, r * 2, h);
    y += h + r * 0.14;
    h *= 1.5;
  }
  c.restore();
}

/* One stylised palm silhouette, drawn from filled curved fronds. */
function drawPalm(c, x, y, s, color, lean) {
  c.save();
  c.translate(x, y);
  c.scale(lean, 1);
  c.fillStyle = color;
  /* Trunk: a gently curving filled shape. */
  c.beginPath();
  c.moveTo(-0.045 * s, 0);
  c.quadraticCurveTo(-0.02 * s, -0.55 * s, 0.03 * s, -0.95 * s);
  c.lineTo(0.09 * s, -0.93 * s);
  c.quadraticCurveTo(0.05 * s, -0.5 * s, 0.06 * s, 0);
  c.closePath();
  c.fill();
  /* Fronds: six drooping leaves fanning from the crown. */
  const crownX = 0.06 * s;
  const crownY = -0.95 * s;
  for (let i = 0; i < 6; i++) {
    const a = (-160 + i * 52) * (Math.PI / 180);
    const len = s * (0.42 + (i % 2) * 0.08);
    const tipX = crownX + Math.cos(a) * len;
    const tipY = crownY + Math.sin(a) * len * 0.55 + len * 0.22;
    const midX = crownX + Math.cos(a) * len * 0.55;
    const midY = crownY + Math.sin(a) * len * 0.28 - len * 0.12;
    c.beginPath();
    c.moveTo(crownX, crownY);
    c.quadraticCurveTo(midX, midY, tipX, tipY);
    c.quadraticCurveTo(midX + len * 0.08, midY + len * 0.16, crownX, crownY);
    c.closePath();
    c.fill();
  }
  c.restore();
}

function drawSkyline(c, W, H, color) {
  const base = H * 0.985;
  const top = H * 0.9;
  c.save();
  c.fillStyle = color;
  c.globalAlpha = 0.85;
  let x = -W * 0.02;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  while (x < W * 1.02) {
    const bw = W * (0.03 + rnd() * 0.05);
    const bh = (base - top) * (0.35 + rnd() * 0.65);
    c.fillRect(x, base - bh, bw, bh);
    if (rnd() > 0.55) c.fillRect(x + bw * 0.3, base - bh - H * 0.02, bw * 0.12, H * 0.02);
    x += bw + W * 0.006;
  }
  c.restore();
}

/* ---------------------------------------------------------------- title */

function drawTitleBlock(c, W, H, theme) {
  const title = (state.title || 'VICE SUNSET').toUpperCase();
  const tagline = (state.tagline || '').toUpperCase();
  const atTop = state.titlePos === 'top';
  const bandH = H * 0.34;
  const bandY = atTop ? 0 : H - bandH;
  /* Scrim so the lettering reads over any photo. */
  const scrim = c.createLinearGradient(0, bandY, 0, bandY + bandH);
  if (atTop) {
    scrim.addColorStop(0, 'rgba(8,4,16,0.88)');
    scrim.addColorStop(1, 'rgba(8,4,16,0)');
  } else {
    scrim.addColorStop(0, 'rgba(8,4,16,0)');
    scrim.addColorStop(1, 'rgba(8,4,16,0.88)');
  }
  c.save();
  c.fillStyle = scrim;
  c.fillRect(0, bandY, W, bandH);
  const pad = W * 0.045;
  const textY = atTop ? bandY + H * 0.075 : H - H * 0.075;
  const maxW = W - pad * 2;
  /* Title: shrink until it fits the width, then draw with outline + shadow. */
  let size = H * 0.115 * state.titleScale;
  c.textBaseline = 'alphabetic';
  const setFont = (s) => { c.font = `900 ${s}px "Arial Black", "Helvetica Neue", Arial, sans-serif`; };
  setFont(size);
  try { c.letterSpacing = `${Math.round(size * 0.02)}px`; } catch (e) { /* older canvas: no letterSpacing */ }
  while (c.measureText(title).width > maxW && size > H * 0.03) {
    size *= 0.94;
    setFont(size);
  }
  const titleY = atTop ? textY + size : textY;
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.65)';
  c.shadowBlur = size * 0.12;
  c.shadowOffsetY = size * 0.03;
  c.lineJoin = 'round';
  c.strokeStyle = theme.dark;
  c.lineWidth = Math.max(2, size * 0.09);
  c.strokeText(title, pad, titleY);
  const titleGrad = c.createLinearGradient(0, titleY - size, 0, titleY);
  titleGrad.addColorStop(0, '#ffffff');
  titleGrad.addColorStop(0.55, theme.title);
  titleGrad.addColorStop(1, theme.accent);
  c.fillStyle = titleGrad;
  c.fillText(title, pad, titleY);
  c.restore();
  /* Accent rule + tagline under (or above) the title. */
  const ruleY = atTop ? titleY + size * 0.28 : titleY - size * 1.28;
  c.save();
  c.fillStyle = theme.accent;
  c.fillRect(pad, ruleY, W * 0.16, Math.max(3, size * 0.045));
  const tagSize = Math.max(H * 0.018, size * 0.19);
  c.font = `700 ${tagSize}px "Helvetica Neue", Arial, sans-serif`;
  try { c.letterSpacing = `${Math.round(tagSize * 0.22)}px`; } catch (e) { /* no-op */ }
  c.fillStyle = 'rgba(255,255,255,0.92)';
  const tagY = atTop ? ruleY + tagSize * 1.9 : ruleY + tagSize * 1.15;
  c.fillText(tagline, pad, tagY);
  c.restore();
  try { c.letterSpacing = '0px'; } catch (e) { /* no-op */ }
  c.restore();
}

/* ------------------------------------------------------------ the render */

/* The single render path: preview and export both call drawCover. */
function drawCover(c, W, H) {
  const theme = THEMES[state.theme] || THEMES.sunset;
  c.save();
  c.fillStyle = '#0a0612';
  c.fillRect(0, 0, W, H);
  const rects = layoutPanels(state.layout, W, H);
  rects.forEach((rect, i) => {
    const panel = state.panels[i] || defaultPanel(0, 'sunset');
    const photo = state.photos[panel.photo];
    if (photo && photo.img && photo.img.complete && photo.img.naturalWidth > 0) {
      drawPhotoCover(c, photo.img, rect, panel);
    } else {
      const g = c.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
      g.addColorStop(0, '#2a1740');
      g.addColorStop(1, '#12081d');
      c.fillStyle = g;
      c.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    drawPanelFrame(c, rect, W);
  });
  /* Decorations: skyline along the bottom, retro sun, palm silhouettes. */
  if (state.decorations) {
    drawSkyline(c, W, H, 'rgba(10,5,18,0.9)');
    const sunR = W * 0.085;
    const sunX = W * 0.82;
    const sunY = state.titlePos === 'top' ? H * 0.24 : H * 0.16;
    drawRetroSun(c, sunX, sunY, sunR, theme.sun);
    drawPalm(c, W * 0.02, H * 0.995, H * 0.30, 'rgba(8,4,14,0.92)', 1);
    drawPalm(c, W * 0.99, H * 0.995, H * 0.24, 'rgba(8,4,14,0.92)', -1);
  }
  drawTitleBlock(c, W, H, theme);
  /* Whole-cover vignette + outer frame. */
  const vig = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.28)');
  c.fillStyle = vig;
  c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(0,0,0,0.85)';
  c.lineWidth = Math.max(6, W * 0.008);
  c.strokeRect(c.lineWidth / 2, c.lineWidth / 2, W - c.lineWidth, H - c.lineWidth);
  c.strokeStyle = theme.accent;
  c.lineWidth = Math.max(1.5, W * 0.0016);
  c.strokeRect(W * 0.012, H * 0.012, W * 0.976, H * 0.976);
  c.restore();
}

/* --------------------------------------------------------------- preview */

function renderPreview() {
  const size = EXPORT_SIZES[state.size];
  const maxDim = 720;
  const scale = Math.min(1, maxDim / Math.max(size.w, size.h));
  const pw = Math.round(size.w * scale);
  const ph = Math.round(size.h * scale);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  drawCover(ctx, pw, ph);
  $('previewSizeLabel').textContent = size.label;
  $('panelLabel').textContent = `Panel ${state.selectedPanel + 1} of ${state.panels.length} selected`;
  $('photoCountLabel').textContent = `${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} loaded`;
}

let previewQueued = false;
function requestPreview() {
  if (previewQueued) return;
  previewQueued = true;
  requestAnimationFrame(() => { previewQueued = false; renderPreview(); });
}

/* ------------------------------------------------------------ photo load */

function addPhoto(id, label, src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      state.photos.push({ id, label, img, src });
      refreshPhotoStrip();
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

function loadSample(id) {
  const sample = SAMPLE_PHOTOS.find((s) => s.id === id);
  if (!sample) return Promise.resolve(false);
  const existing = state.photos.findIndex((p) => p.id === sample.id);
  if (existing >= 0) return Promise.resolve(true);
  return addPhoto(sample.id, sample.label, sample.src);
}

function refreshPhotoStrip() {
  const strip = $('photoStrip');
  strip.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'photo-chip';
    btn.title = photo.label;
    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = photo.label;
    btn.appendChild(img);
    btn.addEventListener('click', () => {
      state.panels[state.selectedPanel].photo = i;
      syncPanelControls();
      requestPreview();
    });
    strip.appendChild(btn);
  });
  syncPanelControls();
}

function loadUserPhotos(files) {
  const list = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
  if (list.length === 0) return;
  let pending = list.length;
  list.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      addPhoto(`user-${Date.now()}-${Math.round(Math.random() * 1e6)}`, file.name, String(reader.result))
        .then(() => {
          pending -= 1;
          if (pending === 0) {
            const last = state.photos.length - 1;
            state.panels[state.selectedPanel].photo = last;
            syncPanelControls();
            requestPreview();
            showStatus(`${list.length} photo${list.length === 1 ? '' : 's'} loaded.`, true);
          }
        });
    };
    reader.readAsDataURL(file);
  });
}

/* ------------------------------------------------------------ ui wiring */

function syncSegButtons() {
  document.querySelectorAll('[data-layout]').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('.size-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === state.size);
  });
  document.querySelectorAll('[data-preset]').forEach((b) => {
    b.classList.toggle('active', b.dataset.preset === state.preset);
  });
}

function syncPanelControls() {
  const panel = state.panels[state.selectedPanel];
  const select = $('panelPhoto');
  select.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${i + 1} · ${photo.label}`;
    select.appendChild(opt);
  });
  if (state.photos.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No photo yet';
    select.appendChild(opt);
  }
  select.value = String(panel.photo);
  $('panelGrade').value = panel.grade;
  $('zoomRange').value = String(panel.zoom);
  $('panXRange').value = String(panel.ox);
  $('panYRange').value = String(panel.oy);
  $('zoomVal').textContent = `${panel.zoom.toFixed(2)}×`;
  $('panXVal').textContent = String(Math.round(panel.ox * 100));
  $('panYVal').textContent = String(Math.round(panel.oy * 100));
}

function applyPreset(name) {
  const preset = PRESETS[name];
  if (!preset) return;
  state.preset = name;
  state.layout = preset.layout;
  state.theme = preset.theme;
  state.title = preset.title;
  state.tagline = preset.tagline;
  $('titleInput').value = preset.title;
  $('taglineInput').value = preset.tagline;
  $('themeSelect').value = preset.theme;
  fitPanelsToLayout();
  state.panels.forEach((panel, i) => {
    const sampleId = preset.photos[i % preset.photos.length];
    const idx = state.photos.findIndex((p) => p.id === sampleId);
    panel.photo = idx >= 0 ? idx : 0;
    panel.grade = preset.grade;
    panel.zoom = 1;
    panel.ox = 0;
    panel.oy = 0;
  });
  syncSegButtons();
  syncPanelControls();
  requestPreview();
}

function wireControls() {
  $('photoInput').addEventListener('change', (e) => {
    loadUserPhotos(e.target.files);
    e.target.value = '';
  });

  const wrap = $('canvasWrap');
  ['dragenter', 'dragover'].forEach((ev) => wrap.addEventListener(ev, (e) => {
    e.preventDefault();
    $('dropHint').classList.add('show');
  }));
  ['dragleave', 'drop'].forEach((ev) => wrap.addEventListener(ev, (e) => {
    e.preventDefault();
    $('dropHint').classList.remove('show');
  }));
  wrap.addEventListener('drop', (e) => loadUserPhotos(e.dataTransfer.files));

  document.querySelectorAll('.sample-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      loadSample(btn.dataset.sample).then(() => {
        const idx = state.photos.findIndex((p) => p.id === btn.dataset.sample);
        if (idx >= 0) {
          state.panels[state.selectedPanel].photo = idx;
          syncPanelControls();
          requestPreview();
        }
      });
    });
  });

  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });

  document.querySelectorAll('[data-layout]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.layout = btn.dataset.layout;
      state.preset = '';
      fitPanelsToLayout();
      syncSegButtons();
      syncPanelControls();
      requestPreview();
    });
  });

  document.querySelectorAll('.size-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.size = btn.dataset.size;
      syncSegButtons();
      requestPreview();
    });
  });

  $('themeSelect').addEventListener('change', (e) => {
    state.theme = e.target.value;
    state.preset = '';
    syncSegButtons();
    requestPreview();
  });

  $('sunToggle').addEventListener('change', (e) => {
    state.decorations = e.target.checked;
    requestPreview();
  });

  $('panelPhoto').addEventListener('change', (e) => {
    state.panels[state.selectedPanel].photo = Number(e.target.value);
    requestPreview();
  });

  $('panelGrade').addEventListener('change', (e) => {
    state.panels[state.selectedPanel].grade = e.target.value;
    requestPreview();
  });

  $('zoomRange').addEventListener('input', (e) => {
    state.panels[state.selectedPanel].zoom = Number(e.target.value);
    syncPanelControls();
    requestPreview();
  });
  $('panXRange').addEventListener('input', (e) => {
    state.panels[state.selectedPanel].ox = Number(e.target.value);
    syncPanelControls();
    requestPreview();
  });
  $('panYRange').addEventListener('input', (e) => {
    state.panels[state.selectedPanel].oy = Number(e.target.value);
    syncPanelControls();
    requestPreview();
  });

  $('titleInput').addEventListener('input', (e) => { state.title = e.target.value; requestPreview(); });
  $('taglineInput').addEventListener('input', (e) => { state.tagline = e.target.value; requestPreview(); });
  $('titlePos').addEventListener('change', (e) => { state.titlePos = e.target.value; requestPreview(); });
  $('titleSizeRange').addEventListener('input', (e) => {
    state.titleScale = Number(e.target.value);
    $('titleSizeVal').textContent = `${Math.round(state.titleScale * 100)}%`;
    requestPreview();
  });

  $('exportBtn').addEventListener('click', exportCover);
}

/* ------------------------------------------------------- canvas pointer */

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}

function wireCanvas() {
  let dragging = false;
  let last = null;
  canvas.addEventListener('pointerdown', (e) => {
    const p = canvasPoint(e);
    const rects = layoutPanels(state.layout, canvas.width, canvas.height);
    const hit = rects.findIndex((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
    if (hit >= 0) {
      state.selectedPanel = hit;
      syncPanelControls();
      requestPreview();
    }
    dragging = true;
    last = p;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || !last) return;
    const p = canvasPoint(e);
    const panel = state.panels[state.selectedPanel];
    const rects = layoutPanels(state.layout, canvas.width, canvas.height);
    const rect = rects[state.selectedPanel];
    if (panel && rect) {
      panel.ox = Math.max(-0.5, Math.min(0.5, panel.ox + ((p.x - last.x) / rect.w) * 2));
      panel.oy = Math.max(-0.5, Math.min(0.5, panel.oy + ((p.y - last.y) / rect.h) * 2));
      syncPanelControls();
      requestPreview();
    }
    last = p;
  });
  const stop = () => { dragging = false; last = null; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const panel = state.panels[state.selectedPanel];
    panel.zoom = Math.max(1, Math.min(3, panel.zoom - e.deltaY * 0.0015));
    syncPanelControls();
    requestPreview();
  }, { passive: false });
}

/* ---------------------------------------------------------------- export */

function exportCover() {
  const btn = $('exportBtn');
  btn.disabled = true;
  showStatus('Rendering your cover…', false);
  const size = EXPORT_SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  const c = off.getContext('2d');
  drawCover(c, size.w, size.h);
  off.toBlob((blob) => {
    btn.disabled = false;
    if (!blob) {
      showStatus('Export failed in this browser. Try loading a photo first.', false);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vice-sunset-cover-${state.size}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.__lastExport = { width: size.w, height: size.h, bytes: blob.size, name: a.download };
    showStatus(`Exported ${size.label} PNG (${Math.round(blob.size / 1024)} KB).`, true);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
}

/* ------------------------------------------------------------------ init */

function init() {
  wireControls();
  wireCanvas();
  syncSegButtons();
  /* Load the built-in samples so the first paint already shows a cover. */
  Promise.all(SAMPLE_PHOTOS.map((s) => loadSample(s.id))).then(() => {
    applyPreset('vice-sunset');
    renderPreview();
  });
  renderPreview();
}

init();
