// Misma curva de color y luces utilizada por las p?ginas del portal.
const ANCLAS_COLOR = [
  { h: 0,  top: '#080d18', bot: '#101a2c' },
  { h: 5,  top: '#0c1424', bot: '#2a2438' },
  { h: 7,  top: '#3a3248', bot: '#c97a4a' },
  { h: 9,  top: '#4a6a8a', bot: '#d9b98a' },
  { h: 13, top: '#3f6d92', bot: '#a9c4d6' },
  { h: 17, top: '#3a3450', bot: '#c97a4a' },
  { h: 19, top: '#161226', bot: '#5a3a3a' },
  { h: 21, top: '#0a0e1c', bot: '#161f30' },
  { h: 24, top: '#080d18', bot: '#101a2c' }
];

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixHex(c1, c2, t) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  return `rgb(${Math.round(lerp(a[0], b[0], t))}, ${Math.round(lerp(a[1], b[1], t))}, ${Math.round(lerp(a[2], b[2], t))})`;
}

export function obtenerCieloParaHora(h) {
  for (let i = 0; i < ANCLAS_COLOR.length - 1; i++) {
    const a = ANCLAS_COLOR[i], b = ANCLAS_COLOR[i + 1];
    if (h >= a.h && h <= b.h) {
      const t = (h - a.h) / (b.h - a.h);
      return { top: mixHex(a.top, b.top, t), bot: mixHex(a.bot, b.bot, t) };
    }
  }
  return { top: ANCLAS_COLOR[0].top, bot: ANCLAS_COLOR[0].bot };
}

export function obtenerProporcionLuces(h) {
  if (h >= 6.5 && h <= 17.5) return 0.02; // Día: ventanales apagados
  let p;
  if (h > 17.5 && h <= 21) {
    p = (h - 17.5) / 3.5;
  } else if (h > 21 || h < 1.5) {
    p = 1.0;
  } else {
    const hNorm = h < 1.5 ? h + 24 : h;
    p = Math.max(0, (6.5 - hNorm) / 5);
  }
  return 0.03 + p * 0.58;
}

