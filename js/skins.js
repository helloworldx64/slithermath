// Skins with unlock levels. Each skin has: name (Hebrew), body color, pattern,
// and an `unlock` level requirement. drawSegment renders a single body circle.
const SKINS = [
  { name: 'תולעת ירוקה',  body: '#2ecc71', pat: 'solid',  unlock: 1 },
  { name: 'כחול',         body: '#3498db', pat: 'solid',  unlock: 1 },
  { name: 'אדום',         body: '#e74c3c', pat: 'solid',  unlock: 1 },
  { name: 'סגול',         body: '#9b59b6', pat: 'solid',  unlock: 1 },
  { name: 'כתום',         body: '#e67e22', pat: 'solid',  unlock: 1 },
  { name: 'צהוב',         body: '#f1c40f', pat: 'solid',  unlock: 1 },
  { name: 'טורקיז',       body: '#1abc9c', pat: 'solid',  unlock: 1 },
  { name: 'ורוד',         body: '#ff5fbf', pat: 'solid',  unlock: 1 },
  { name: 'לבן',          body: '#ecf0f1', pat: 'solid',  unlock: 1 },
  { name: 'שחור',         body: '#2c3e50', pat: 'solid',  unlock: 1 },
  { name: 'נמר',          body: '#f39c12', pat: 'stripe', accent: '#2c3e50', unlock: 2 },
  { name: 'זברה',         body: '#ecf0f1', pat: 'stripe', accent: '#2c3e50', unlock: 2 },
  { name: 'סוכריה',       body: '#ff5fbf', pat: 'stripe', accent: '#ffffff', unlock: 3 },
  { name: 'קשת',          body: 'rainbow', pat: 'rainbow', unlock: 4 },
  { name: 'גלקסיה',       body: '#2c0147', pat: 'spots',  accent: '#ff5fbf', unlock: 5 },
  { name: 'הסוואה',       body: '#4b5320', pat: 'spots',  accent: '#3b2a14', unlock: 5 },
  { name: 'זהב',          body: '#ffd700', pat: 'glow',    unlock: 6 },
  { name: 'ניאון ירוק',   body: '#39ff14', pat: 'glow',    unlock: 6 },
  { name: 'ניאון כחול',   body: '#00f0ff', pat: 'glow',    unlock: 7 },
  { name: 'ניאון ורוד',   body: '#ff10f0', pat: 'glow',    unlock: 7 },
  { name: 'לבה',          body: '#ff4500', pat: 'gradient', accent: '#8b0000', unlock: 8 },
  { name: 'קרח',          body: '#a5f3ff', pat: 'gradient', accent: '#0077b6', unlock: 8 },
  { name: 'ענבים',       body: '#6c5ce7', pat: 'gradient', accent: '#3417a0', unlock: 9 },
  { name: 'רעיל',         body: '#aaff00', pat: 'ring',   accent: '#003a1f', unlock: 9 },
  { name: 'שקיעה',        body: '#ff6e7f', pat: 'gradient', accent: '#ffb199', unlock: 10 },
  { name: 'אוקיינוס',     body: '#2e86de', pat: 'gradient', accent: '#74b9ff', unlock: 10 },
  { name: 'יער',          body: '#0d6b3b', pat: 'spots',  accent: '#145a32', unlock: 11 },
  { name: 'מדבר',         body: '#d4a373', pat: 'stripe', accent: '#7f4f24', unlock: 11 },
  { name: 'פלזמה',       body: '#7d3cf8', pat: 'rainbow', unlock: 12 },
  { name: 'רוח רפאים',   body: '#cfd8dc', pat: 'glow',    unlock: 13 },
  { name: 'שד',           body: '#8b0000', pat: 'glow',    unlock: 14 },
  { name: 'מלאך',         body: '#ffffff', pat: 'glow',    unlock: 15 },
  { name: 'תופת',         body: '#ff2200', pat: 'gradient', accent: '#ffcc00', unlock: 16 },
  { name: 'מנטה',         body: '#00d68f', pat: 'ring',   accent: '#003d2b', unlock: 17 },
  { name: 'אלמוג',        body: '#ff7f50', pat: 'ring',   accent: '#ff3d00', unlock: 18 },
  { name: 'פלדה',         body: '#95a5a6', pat: 'gradient', accent: '#34495e', unlock: 19 },
  { name: 'מלכותי',       body: '#3498db', pat: 'ring',   accent: '#f1c40f', unlock: 20 },
  { name: 'אש תולעת',     body: '#ff5722', pat: 'spots',  accent: '#ffd180', unlock: 22 },
  { name: 'מים',          body: '#00ffff', pat: 'glow',    unlock: 24 },
  { name: 'ארד',          body: '#cd7f32', pat: 'gradient', accent: '#5e2d00', unlock: 26 },
  { name: 'חצות',         body: '#0a0a23', pat: 'spots',  accent: '#7c5cff', unlock: 28 },
  { name: 'דרקון',        body: '#0b6623', pat: 'ring',   accent: '#f5d042', unlock: 30 },
  { name: 'פנטום',        body: '#4b0082', pat: 'gradient', accent: '#9370db', unlock: 35 },
  { name: 'זהב מלכותי',   body: '#ffd700', pat: 'glow',    accent: '#fff', unlock: 40 },
  { name: 'קוסמי',        body: 'rainbow', pat: 'rainbow', unlock: 45 },
  { name: 'אגדה',         body: '#ff00ff', pat: 'glow',    accent: '#00ffff', unlock: 50 },
];

function skinColor(skin, t, i) {
  if (skin.body === 'rainbow') {
    const h = (t * 0.06 + i * 18) % 360;
    return `hsl(${h.toFixed(0)} 95% 55%)`;
  }
  return skin.body;
}

// Draw a single body segment (circle) with the skin's pattern.
function drawSegment(ctx, skin, x, y, r, t, i) {
  const base = skinColor(skin, t, i);
  ctx.save();
  switch (skin.pat) {
    case 'solid':
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      break;
    case 'glow': {
      const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.5);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, base); g.addColorStop(1, base);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 1.25, 0, TAU); ctx.fill();
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      break;
    }
    case 'stripe': {
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = skin.accent;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.arc(x, y, r * 0.62, 0, TAU, true); ctx.fill();
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, TAU); ctx.fill();
      break;
    }
    case 'ring': {
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = skin.accent;
      ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, TAU); ctx.fill();
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.arc(x, y, r * 0.22, 0, TAU); ctx.fill();
      break;
    }
    case 'gradient': {
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, base); g.addColorStop(1, skin.accent || '#000');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      break;
    }
    case 'spots': {
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = skin.accent;
      ctx.beginPath();
      ctx.arc(x - r * 0.35, y - r * 0.3, r * 0.26, 0, TAU);
      ctx.arc(x + r * 0.35, y + r * 0.3, r * 0.26, 0, TAU);
      ctx.arc(x + r * 0.3, y - r * 0.35, r * 0.2, 0, TAU);
      ctx.fill();
      break;
    }
    case 'rainbow': {
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, TAU); ctx.fill();
      break;
    }
  }
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.restore();
}