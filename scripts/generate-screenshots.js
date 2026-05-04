const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const W = 1080;
const H = 1920;
const OUT = path.join(__dirname, '..', 'screenshots');

// Brand colors
const C = {
  primary: '#4A90D9',
  primaryDark: '#2E6AB0',
  indigo: '#6366F1',
  indigoDark: '#4F46E5',
  amber: '#F59E0B',
  purple: '#8B5CF6',
  green: '#10B981',
  red: '#EF4444',
  bg: '#0F1219',
  surface: '#1A1F2E',
  surface2: '#222840',
  text: '#F0F2F5',
  textSec: '#A0AABB',
  border: '#2D3548',
  white: '#FFFFFF',
};

function hex(h) { return h; }

// ── helpers ──────────────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function card(ctx, x, y, w, h, r = 20, fill = C.surface) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function gradientBg(ctx, color1, color2) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, color1);
  g.addColorStop(1, color2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function text(ctx, str, x, y, opts = {}) {
  const { size = 32, weight = 'normal', color = C.text, align = 'left', font = 'sans-serif' } = opts;
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function pill(ctx, x, y, w, h, fill, label, labelColor = C.white, fontSize = 22) {
  ctx.save();
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  text(ctx, label, x + w / 2, y + h / 2 + fontSize * 0.36, { size: fontSize, weight: '600', color: labelColor, align: 'center' });
  ctx.restore();
}

function circle(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function progressArc(ctx, cx, cy, r, pct, color, bg = C.border, thickness = 14) {
  const start = -Math.PI / 2;
  // bg track
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = bg;
  ctx.lineWidth = thickness;
  ctx.stroke();
  // progress
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, start + Math.PI * 2 * pct);
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function logoMark(ctx, cx, cy, size = 52) {
  const r = size / 2;
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, C.indigo);
  g.addColorStop(1, C.primary);
  ctx.save();
  roundRect(ctx, cx - r, cy - r, size, size, 14);
  ctx.fillStyle = g;
  ctx.fill();
  // bulb icon (simplified circle + lines)
  ctx.fillStyle = C.white;
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - 5, cy + 8, 10, 4);
  ctx.fillRect(cx - 4, cy + 13, 8, 3);
  ctx.restore();
}

function topBar(ctx, title, time = '9:41') {
  // status bar bg
  ctx.save();
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, 90);
  text(ctx, time, 60, 58, { size: 28, weight: '600', color: C.text });
  text(ctx, '▲ ▲▲▲ WiFi', W - 60, 58, { size: 22, color: C.textSec, align: 'right' });
  // nav bar
  ctx.fillStyle = C.surface;
  ctx.fillRect(0, 90, W, 88);
  logoMark(ctx, 60, 134, 48);
  text(ctx, title, 124, 144, { size: 34, weight: '700', color: C.text });
  ctx.restore();
}

function bottomTabBar(ctx, active = 0) {
  const tabs = ['My Day', 'Tasks', '', 'Notes', 'Dashboard'];
  const icons = ['☀️', '✓', '⊕', '📝', '📊'];
  card(ctx, 0, H - 120, W, 120, 0, C.surface);
  ctx.save();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H - 120);
  ctx.lineTo(W, H - 120);
  ctx.stroke();
  ctx.restore();

  tabs.forEach((label, i) => {
    const x = (W / 5) * i + W / 10;
    if (i === 2) {
      // center FAB
      const g = ctx.createLinearGradient(x - 38, H - 95, x + 38, H - 20);
      g.addColorStop(0, C.indigo);
      g.addColorStop(1, C.primary);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, H - 60, 38, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.shadowColor = C.indigo;
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.restore();
      text(ctx, '+', x, H - 45, { size: 44, weight: '300', color: C.white, align: 'center' });
      return;
    }
    const color = i === active ? C.indigo : C.textSec;
    text(ctx, label, x, H - 22, { size: 22, color, align: 'center' });
    if (i === active) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, H - 108, 4, 0, Math.PI * 2);
      ctx.fillStyle = C.indigo;
      ctx.fill();
      ctx.restore();
    }
  });
}

function sectionLabel(ctx, label, x, y) {
  text(ctx, label.toUpperCase(), x, y, { size: 22, weight: '600', color: C.textSec });
}

// ── SCREEN 1: My Day ─────────────────────────────────────────────────────────
function drawScreen1(ctx) {
  gradientBg(ctx, '#0A0E17', '#0F1219');
  topBar(ctx, 'My Day');

  // Greeting
  text(ctx, 'Good morning, Alex 👋', 54, 240, { size: 38, weight: '700', color: C.text });
  text(ctx, 'Tuesday, 29 April 2026', 54, 288, { size: 28, color: C.textSec });

  // Progress summary card
  card(ctx, 40, 320, W - 80, 160, 20, C.surface);
  const pg = ctx.createLinearGradient(40, 320, W - 40, 480);
  pg.addColorStop(0, C.indigo + '33');
  pg.addColorStop(1, C.primary + '11');
  ctx.save();
  roundRect(ctx, 40, 320, W - 80, 160, 20);
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.restore();

  text(ctx, '5 of 8 tasks done', 80, 390, { size: 30, weight: '600', color: C.text });
  text(ctx, 'Keep it up! You\'re 62% through today.', 80, 428, { size: 24, color: C.textSec });
  progressArc(ctx, W - 120, 400, 48, 0.62, C.indigo, C.border, 10);
  text(ctx, '62%', W - 120, 408, { size: 22, weight: '700', color: C.indigo, align: 'center' });

  // Tasks list
  sectionLabel(ctx, 'Today\'s Tasks', 54, 526);

  const tasks = [
    { label: 'Review project proposal', done: true, color: C.green },
    { label: 'Team standup at 10 AM', done: true, color: C.primary },
    { label: 'Write weekly report', done: false, color: C.amber },
    { label: 'Update Figma designs', done: false, color: C.purple },
    { label: 'Respond to client emails', done: false, color: C.red },
  ];

  tasks.forEach((t, i) => {
    const ty = 556 + i * 110;
    card(ctx, 40, ty, W - 80, 92, 16, t.done ? C.surface : C.surface2);

    // checkbox
    ctx.save();
    ctx.beginPath();
    ctx.arc(86, ty + 46, 18, 0, Math.PI * 2);
    ctx.strokeStyle = t.done ? C.green : C.border;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (t.done) {
      ctx.fillStyle = C.green;
      ctx.beginPath();
      ctx.arc(86, ty + 46, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.white;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(76, ty + 46);
      ctx.lineTo(83, ty + 53);
      ctx.lineTo(96, ty + 38);
      ctx.stroke();
    }
    ctx.restore();

    // left color bar
    ctx.save();
    roundRect(ctx, 114, ty + 26, 4, 40, 2);
    ctx.fillStyle = t.color;
    ctx.fill();
    ctx.restore();

    text(ctx, t.label, 132, ty + 52, {
      size: 28,
      weight: '500',
      color: t.done ? C.textSec : C.text,
    });
  });

  // Tagline banner
  const bannerY = H - 300;
  const bg2 = ctx.createLinearGradient(40, bannerY, W - 40, bannerY + 100);
  bg2.addColorStop(0, C.indigo);
  bg2.addColorStop(1, C.primary);
  ctx.save();
  roundRect(ctx, 40, bannerY, W - 80, 90, 20);
  ctx.fillStyle = bg2;
  ctx.fill();
  ctx.restore();
  text(ctx, 'Plan Your Day. Own Your Life.', W / 2, bannerY + 56, { size: 30, weight: '700', color: C.white, align: 'center' });

  bottomTabBar(ctx, 0);

  // Marketing overlay
  drawMarketingBadge(ctx, 'Plan Your Day', 'Stay focused with smart daily planning');
}

// ── SCREEN 2: Task Manager ───────────────────────────────────────────────────
function drawScreen2(ctx) {
  gradientBg(ctx, '#080C14', '#0F1219');
  topBar(ctx, 'Tasks');

  // Stats row
  const stats = [
    { label: 'Total', val: '24', color: C.primary },
    { label: 'Done', val: '16', color: C.green },
    { label: 'Pending', val: '8', color: C.amber },
  ];
  stats.forEach((s, i) => {
    const sx = 40 + i * ((W - 80) / 3);
    const sw = (W - 80) / 3 - 16;
    card(ctx, sx, 230, sw, 110, 16, C.surface);
    text(ctx, s.val, sx + sw / 2, 296, { size: 44, weight: '700', color: s.color, align: 'center' });
    text(ctx, s.label, sx + sw / 2, 328, { size: 22, color: C.textSec, align: 'center' });
  });

  // Priority filter pills
  const filters = ['All', 'High', 'Medium', 'Low'];
  const filterColors = [C.indigo, C.red, C.amber, C.green];
  filters.forEach((f, i) => {
    const active = i === 0;
    pill(ctx, 40 + i * 180, 376, 160, 52, active ? C.indigo : C.surface2, f, active ? C.white : C.textSec, 24);
  });

  // Task cards with priority
  sectionLabel(ctx, 'High Priority', 54, 480);

  const tasks = [
    { label: 'Launch app update v1.3', sub: 'Work · Due today', priority: 'High', color: C.red, pct: 0.75 },
    { label: 'Design new onboarding', sub: 'Personal · Due tomorrow', priority: 'Medium', color: C.amber, pct: 0.4 },
    { label: 'Fix login bug', sub: 'Work · Overdue', priority: 'High', color: C.red, pct: 0.9 },
    { label: 'Write unit tests', sub: 'Work · Due Friday', priority: 'Low', color: C.green, pct: 0.2 },
    { label: 'Grocery shopping', sub: 'Personal · Today', priority: 'Medium', color: C.amber, pct: 0.0 },
  ];

  tasks.forEach((t, i) => {
    const ty = 510 + i * 120;
    card(ctx, 40, ty, W - 80, 104, 16, C.surface);

    // priority dot
    circle(ctx, 80, ty + 42, 10, t.color);

    text(ctx, t.label, 106, ty + 38, { size: 28, weight: '600', color: C.text });
    text(ctx, t.sub, 106, ty + 70, { size: 22, color: C.textSec });

    // progress bar
    ctx.save();
    roundRect(ctx, 106, ty + 82, W - 220, 6, 3);
    ctx.fillStyle = C.border;
    ctx.fill();
    roundRect(ctx, 106, ty + 82, (W - 220) * t.pct, 6, 3);
    ctx.fillStyle = t.color;
    ctx.fill();
    ctx.restore();

    // priority badge
    pill(ctx, W - 180, ty + 30, 118, 38, t.color + '33', t.priority, t.color, 20);
  });

  // Tagline
  const bg2 = ctx.createLinearGradient(40, H - 295, W - 40, H - 200);
  bg2.addColorStop(0, C.amber + 'CC');
  bg2.addColorStop(1, C.red + 'CC');
  ctx.save();
  roundRect(ctx, 40, H - 295, W - 80, 86, 20);
  ctx.fillStyle = bg2;
  ctx.fill();
  ctx.restore();
  text(ctx, 'Achieve More. Every Single Day.', W / 2, H - 245, { size: 30, weight: '700', color: C.white, align: 'center' });

  bottomTabBar(ctx, 1);
  drawMarketingBadge(ctx, 'Smart Task Manager', 'Prioritize tasks and crush your goals');
}

// ── SCREEN 3: Notes ───────────────────────────────────────────────────────────
function drawScreen3(ctx) {
  gradientBg(ctx, '#08101A', '#0F1219');
  topBar(ctx, 'Notes');

  // Search bar
  card(ctx, 40, 232, W - 80, 72, 36, C.surface);
  text(ctx, '🔍  Search your notes...', 80, 278, { size: 26, color: C.textSec });

  // Categories
  const cats = [
    { label: 'All', color: C.indigo, count: 28 },
    { label: 'Work', color: C.primary, count: 12 },
    { label: 'Personal', color: C.purple, count: 9 },
    { label: 'Ideas', color: C.amber, count: 7 },
  ];
  cats.forEach((c, i) => {
    const cx = 40 + i * 188;
    const active = i === 0;
    card(ctx, cx, 330, 172, 72, 36, active ? c.color : C.surface);
    text(ctx, c.label, cx + 86, 374, { size: 24, weight: '600', color: active ? C.white : C.textSec, align: 'center' });
  });

  // Note cards grid (2 col)
  const notes = [
    { title: 'Q2 Strategy', body: 'Focus on user growth and feature launches...', tag: 'Work', color: C.primary, icon: '📋' },
    { title: 'App Ideas', body: 'Dark mode toggle, widget support, shortcuts...', tag: 'Ideas', color: C.amber, icon: '💡' },
    { title: 'Meeting Notes', body: 'Discussed roadmap for v1.4 release cycle...', tag: 'Work', color: C.green, icon: '📝' },
    { title: 'Travel Plans', body: 'Tokyo trip · April 2026 · Hotels booked...', tag: 'Personal', color: C.purple, icon: '✈️' },
    { title: 'Reading List', body: 'Atomic Habits, Deep Work, The Lean Startup...', tag: 'Personal', color: C.red, icon: '📚' },
    { title: 'Daily Journal', body: 'Reflecting on today\'s wins and challenges...', tag: 'Personal', color: C.indigo, icon: '🌙' },
  ];

  sectionLabel(ctx, 'Recent Notes', 54, 450);

  notes.forEach((n, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const nx = 40 + col * (W / 2 - 20);
    const ny = 480 + row * 270;
    const nw = W / 2 - 60;

    card(ctx, nx, ny, nw, 248, 18, C.surface);

    // color top strip
    ctx.save();
    roundRect(ctx, nx, ny, nw, 8, 4);
    ctx.fillStyle = n.color;
    ctx.fill();
    ctx.restore();

    text(ctx, n.icon, nx + 20, ny + 56, { size: 34 });
    text(ctx, n.title, nx + 18, ny + 104, { size: 26, weight: '700', color: C.text });
    text(ctx, n.body, nx + 18, ny + 138, { size: 20, color: C.textSec });

    // tag pill
    pill(ctx, nx + 18, ny + 196, 100, 36, n.color + '33', n.tag, n.color, 18);
  });

  // Tagline
  const bg2 = ctx.createLinearGradient(40, H - 295, W - 40, H - 200);
  bg2.addColorStop(0, C.purple);
  bg2.addColorStop(1, C.indigo);
  ctx.save();
  roundRect(ctx, 40, H - 295, W - 80, 86, 20);
  ctx.fillStyle = bg2;
  ctx.fill();
  ctx.restore();
  text(ctx, 'Capture Every Thought. Never Forget.', W / 2, H - 245, { size: 29, weight: '700', color: C.white, align: 'center' });

  bottomTabBar(ctx, 3);
  drawMarketingBadge(ctx, 'Rich Notes', 'Write, organize & search your ideas instantly');
}

// ── SCREEN 4: Dashboard ───────────────────────────────────────────────────────
function drawScreen4(ctx) {
  gradientBg(ctx, '#060A12', '#0F1219');
  topBar(ctx, 'Dashboard');

  // Streak card
  const sg = ctx.createLinearGradient(40, 230, W - 40, 370);
  sg.addColorStop(0, C.amber);
  sg.addColorStop(1, '#F97316');
  ctx.save();
  roundRect(ctx, 40, 230, W - 80, 148, 20);
  ctx.fillStyle = sg;
  ctx.shadowColor = C.amber;
  ctx.shadowBlur = 30;
  ctx.fill();
  ctx.restore();

  text(ctx, '🔥', 80, 300, { size: 52 });
  text(ctx, '21-Day Streak!', 152, 294, { size: 38, weight: '700', color: C.white });
  text(ctx, 'Best: 34 days  ·  Keep going!', 152, 334, { size: 24, color: C.white + 'CC' });

  // Weekly activity chart
  sectionLabel(ctx, 'Weekly Activity', 54, 432);
  card(ctx, 40, 460, W - 80, 240, 18, C.surface);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const vals = [0.6, 0.85, 0.5, 1.0, 0.7, 0.4, 0.3];
  const barW = 80;
  const chartLeft = 90;
  const chartBottom = 660;
  const chartH = 160;

  days.forEach((d, i) => {
    const bx = chartLeft + i * ((W - 80 - chartLeft * 2 + 40) / 7);
    const bh = vals[i] * chartH;
    const by = chartBottom - bh;
    const isToday = i === 3;

    ctx.save();
    roundRect(ctx, bx, by, barW, bh, 8);
    if (isToday) {
      const bg2 = ctx.createLinearGradient(bx, by, bx, chartBottom);
      bg2.addColorStop(0, C.indigo);
      bg2.addColorStop(1, C.primary);
      ctx.fillStyle = bg2;
    } else {
      ctx.fillStyle = C.border;
    }
    ctx.fill();
    ctx.restore();

    text(ctx, d, bx + barW / 2, chartBottom + 28, { size: 20, color: isToday ? C.indigo : C.textSec, align: 'center' });
  });

  // Habit trackers
  sectionLabel(ctx, 'Habits Today', 54, 754);

  const habits = [
    { name: 'Morning Workout', pct: 1.0, color: C.green, icon: '💪' },
    { name: 'Read 30 mins', pct: 0.5, color: C.primary, icon: '📖' },
    { name: 'Meditate', pct: 0.0, color: C.purple, icon: '🧘' },
    { name: 'Drink 8 glasses', pct: 0.75, color: C.amber, icon: '💧' },
  ];

  habits.forEach((h, i) => {
    const hy = 784 + i * 100;
    card(ctx, 40, hy, W - 80, 84, 14, C.surface);

    text(ctx, h.icon, 74, hy + 50, { size: 30 });
    text(ctx, h.name, 120, hy + 46, { size: 26, weight: '500', color: C.text });

    const barX = 120;
    const barW2 = W - 320;
    ctx.save();
    roundRect(ctx, barX, hy + 60, barW2, 8, 4);
    ctx.fillStyle = C.border;
    ctx.fill();
    if (h.pct > 0) {
      roundRect(ctx, barX, hy + 60, barW2 * h.pct, 8, 4);
      ctx.fillStyle = h.color;
      ctx.fill();
    }
    ctx.restore();

    const pctLabel = h.pct === 1.0 ? '✓ Done' : `${Math.round(h.pct * 100)}%`;
    text(ctx, pctLabel, W - 80, hy + 46, { size: 24, weight: '600', color: h.pct === 1.0 ? C.green : h.color, align: 'right' });
  });

  // Tagline
  const bg2 = ctx.createLinearGradient(40, H - 295, W - 40, H - 200);
  bg2.addColorStop(0, C.green);
  bg2.addColorStop(1, C.primary);
  ctx.save();
  roundRect(ctx, 40, H - 295, W - 80, 86, 20);
  ctx.fillStyle = bg2;
  ctx.fill();
  ctx.restore();
  text(ctx, 'Build Habits. Track Progress. Win.', W / 2, H - 245, { size: 30, weight: '700', color: C.white, align: 'center' });

  bottomTabBar(ctx, 4);
  drawMarketingBadge(ctx, 'Progress Dashboard', 'Streaks, habits & weekly insights at a glance');
}

// ── Marketing badge (top overlay) ────────────────────────────────────────────
function drawMarketingBadge(ctx, title, subtitle) {
  // Top pill badge
  const bw = 700;
  const bh = 88;
  const bx = (W - bw) / 2;
  const by = H - 240;

  // App logo row at very top
  logoMark(ctx, W / 2 - 200, 54, 52);
  text(ctx, 'Thinkora', W / 2 - 134, 70, { size: 34, weight: '700', color: C.white });
  pill(ctx, W / 2 + 80, 38, 140, 44, C.indigo + 'BB', 'FREE', C.white, 22);
}

// ── Main ─────────────────────────────────────────────────────────────────────
const screens = [
  { name: 'screenshot_1_my_day', fn: drawScreen1 },
  { name: 'screenshot_2_tasks', fn: drawScreen2 },
  { name: 'screenshot_3_notes', fn: drawScreen3 },
  { name: 'screenshot_4_dashboard', fn: drawScreen4 },
];

screens.forEach(({ name, fn }) => {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  fn(ctx);
  const out = path.join(OUT, `${name}.png`);
  fs.writeFileSync(out, canvas.toBuffer('image/png'));
  console.log(`✓ ${out}`);
});

console.log('\nAll 4 screenshots saved to ./screenshots/');
