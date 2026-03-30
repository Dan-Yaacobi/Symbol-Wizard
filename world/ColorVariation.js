function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  const normalized = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl({ r, g, b }) {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l: lightness };

  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;
  if (max === nr) hue = ((ng - nb) / delta) + (ng < nb ? 6 : 0);
  else if (max === ng) hue = ((nb - nr) / delta) + 2;
  else hue = ((nr - ng) / delta) + 4;
  hue /= 6;

  return { h: hue, s: saturation, l: lightness };
}

function hueToRgb(p, q, t) {
  let value = t;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + ((q - p) * 6 * value);
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + ((q - p) * ((2 / 3) - value) * 6);
  return p;
}

function hslToRgb({ h, s, l }) {
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - (l * s);
  const p = (2 * l) - q;
  return {
    r: hueToRgb(p, q, h + (1 / 3)) * 255,
    g: hueToRgb(p, q, h) * 255,
    b: hueToRgb(p, q, h - (1 / 3)) * 255,
  };
}

function seededNoise(seedValue) {
  const value = Math.sin(seedValue * 12.9898) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

export function biomeToneBias(biomeType = 'forest') {
  if (biomeType === 'forest') return { hueShift: 0.015, lightnessShift: 0.02, saturationScale: 0.96 };
  if (biomeType === 'cave' || biomeType === 'mountain') return { hueShift: -0.01, lightnessShift: -0.02, saturationScale: 0.92 };
  if (biomeType === 'river') return { hueShift: -0.015, lightnessShift: -0.01, saturationScale: 0.93 };
  return { hueShift: 0, lightnessShift: 0, saturationScale: 0.95 };
}

export function colorVariation(baseColor, variance = {}, seed = 0, toneBias = biomeToneBias()) {
  const rgb = hexToRgb(baseColor);
  if (!rgb) return baseColor;

  const hsl = rgbToHsl(rgb);
  const hueVariance = Math.abs(Number(variance.hue ?? 0.05));
  const lightnessVariance = Math.abs(Number(variance.lightness ?? variance.brightness ?? 0.1));
  const saturationVariance = Math.abs(Number(variance.saturation ?? 0.04));

  const hueNoise = seededNoise(seed + 17.31);
  const lightNoise = seededNoise(seed + 49.97);
  const satNoise = seededNoise(seed + 93.11);

  const nextHue = (hsl.h + toneBias.hueShift + (hueNoise * hueVariance)) % 1;
  const loweredSaturation = hsl.s * toneBias.saturationScale;
  const saturationShift = satNoise * saturationVariance;
  const nextSaturation = clamp(Math.min(hsl.s, loweredSaturation + saturationShift), 0.04, hsl.s);
  const nextLightness = clamp(hsl.l + toneBias.lightnessShift + (lightNoise * lightnessVariance), 0.04, 0.94);

  return rgbToHex(hslToRgb({
    h: nextHue < 0 ? nextHue + 1 : nextHue,
    s: nextSaturation,
    l: nextLightness,
  }));
}

