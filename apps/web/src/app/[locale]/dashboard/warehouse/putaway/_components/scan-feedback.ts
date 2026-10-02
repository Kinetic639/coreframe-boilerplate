/**
 * Scan feedback: a short beep + vibration so the user knows a code "went
 * in" (or was refused) without looking. Audio needs a user gesture on iOS,
 * so the context is created/resumed from the first tap (`unlockScanSound`).
 * Vibration is ignored where unsupported (iOS Safari/Chrome).
 */

let audio: AudioContext | null = null;

export function unlockScanSound() {
  try {
    if (!audio) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      audio = new Ctor();
    }
    if (audio.state === "suspended") void audio.resume();
  } catch {
    /* no audio */
  }
}

function tone(frequency: number, startOffset: number, duration: number) {
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "square";
  osc.frequency.value = frequency;
  const start = audio.currentTime + startOffset;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.15, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}

/** Code accepted: one high beep, one short buzz. */
export function scanSuccessFeedback() {
  try {
    tone(1650, 0, 0.09);
  } catch {
    /* no audio */
  }
  vibrate(40);
}

/** Code refused: two low beeps, a double buzz. */
export function scanErrorFeedback() {
  try {
    tone(330, 0, 0.12);
    tone(330, 0.18, 0.12);
  } catch {
    /* no audio */
  }
  vibrate([80, 60, 80]);
}
