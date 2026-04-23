const STORAGE_KEY = 'margav_notification_sound';
const LEGACY_STORAGE_KEY = 'margav_admin_alert_sound';

export function getAdminAlertSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
  return v !== 'false';
}

export function setAdminAlertSoundEnabled(on: boolean): void {
  const s = on ? 'true' : 'false';
  localStorage.setItem(STORAGE_KEY, s);
  localStorage.setItem(LEGACY_STORAGE_KEY, s);
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioContext) return audioContext;
  const AC =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  audioContext = new AC();
  return audioContext;
}

/** Call after a user gesture so the browser allows playback. */
export function resumeAdminAlertAudio(): void {
  const ctx = getAudioContext();
  if (ctx?.state === 'suspended') {
    void ctx.resume();
  }
}

/** Short two-tone chime when operational alert counts increase. */
export function playAdminAlertTone(): void {
  if (!getAdminAlertSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(880, t0);
  osc.frequency.linearRampToValueAtTime(660, t0 + 0.12);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.055, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.035, t0 + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
  osc.start(t0);
  osc.stop(t0 + 0.34);
}
