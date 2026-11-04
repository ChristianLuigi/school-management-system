export function luminance(hex: string) {
  const channels = [1, 3, 5].map(offset => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(first: string, second: string) {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function colorForeground(color: string) {
  return contrastRatio(color, '#000000') >= contrastRatio(color, '#ffffff') ? '#000000' : '#ffffff';
}

function mix(first: string, second: string, amount: number) {
  return '#' + [1, 3, 5].map(offset => Math.round(parseInt(first.slice(offset, offset + 2), 16) * (1 - amount) + parseInt(second.slice(offset, offset + 2), 16) * amount).toString(16).padStart(2, '0')).join('');
}

/** Preserve brand hue where possible, but never let branding override legibility. */
export function accessibleBrandColors(primary: string, accent: string, dark: boolean) {
  const surfaces = dark ? ['#0b1120', '#111a2d', '#162137', '#1a263c'] : ['#f6f8fb', '#ffffff', '#eef2f7'];
  const endpoint = dark ? '#ffffff' : '#000000';
  function accessible(value: string, fallback: string) {
    const original = /^#[\da-f]{6}$/i.test(value) ? value : fallback;
    for (let step = 0; step <= 100; step++) {
      const candidate = mix(original, endpoint, step / 100);
      if (surfaces.every(surface => contrastRatio(candidate, surface) >= 4.5)) return candidate;
    }
    return endpoint;
  }
  const p = accessible(primary, '#1d4ed8'), a = accessible(accent, '#0f766e');
  const foreground = colorForeground(p);
  const hover = mix(p, dark ? '#ffffff' : '#000000', 0.1);
  return {
    '--primary': p, '--primary-foreground': foreground,
    '--primary-hover': contrastRatio(hover, foreground) >= 4.5 ? hover : p,
    '--accent': a, '--accent-foreground': colorForeground(a), '--ring': p,
  };
}
