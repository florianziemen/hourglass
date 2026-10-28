let ctx: AudioContext | null = null;

/** Must be called from a user gesture once, otherwise iOS keeps audio muted. */
export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch (e) {
    console.warn("Audio unavailable", e);
    ctx = null;
  }
}

/** Three short beeps. Silent if audio was never unlocked. */
export function beep(): void {
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const t0 = ctx.currentTime + 0.05;
  for (let i = 0; i < 3; i++) {
    const t = t0 + i * 0.3;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}
