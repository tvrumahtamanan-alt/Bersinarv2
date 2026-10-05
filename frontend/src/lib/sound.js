let ctx = null;

export function beep(freq = 1200, ms = 90, times = 1) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + i * (ms / 1000 + 0.08);
      g.gain.setValueAtTime(0.25, t);
      o.start(t);
      o.stop(t + ms / 1000);
    }
  } catch {
    /* audio unsupported */
  }
}

export const beepOk = () => beep(1500, 70);
export const beepErr = () => beep(300, 220);
export const orderAlert = () => beep(900, 180, 3);
