import { getAudioContext, initAudio } from './ai';

function getContext(): AudioContext | null {
  let ctx = getAudioContext();
  if (!ctx) {
    initAudio();
    ctx = getAudioContext();
  }
  // If the browser suspended the context, we should try to resume, 
  // but it usually only works following a user interaction.
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/**
 * Plays a light, mystical "click" or "chime" for buttons.
 */
export function playClickSound() {
  const ctx = getContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  // High frequency, slightly detuned from a perfect pitch
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);

  // Quick decay
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

/**
 * Plays a magical sweeping sound when a card is drawn.
 */
export function playDrawCardSound() {
  const ctx = getContext();
  if (!ctx) return;

  // We play a chord of sine waves spreading out
  const baseFreq = 440;
  const ratios = [1, 1.25, 1.5, 2]; // Major 7th chord-ish

  ratios.forEach((ratio, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq * ratio, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * ratio * 1.5, ctx.currentTime + 1.0);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15 / ratios.length, ctx.currentTime + 0.1 + (i * 0.05));
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 1.5);
  });
}

/**
 * Plays an ambient, pulsing hum for loading states. Returns a function to stop the sound.
 */
export function playLoadingSound(): () => void {
  const ctx = getContext();
  if (!ctx) return () => {};

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();

  // Deep, bass-heavy drone
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, ctx.currentTime); // Low A

  // Pulsing LFO
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(2, ctx.currentTime); // 2 pulses per second
  
  lfoGain.gain.value = 5;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);

  // Envelope
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  lfo.start();

  let stopped = false;
  
  return () => {
    if (stopped || !ctx) return;
    stopped = true;
    
    // Fade out smoothly
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1);
    
    osc.stop(now + 1);
    lfo.stop(now + 1);
  };
}
