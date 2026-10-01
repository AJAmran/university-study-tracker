import confetti from 'canvas-confetti';

export function fireConfetti() {
  try {
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.8 },
      colors: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'],
    });
  } catch {
    // Ignore in non-browser or SSR
  }
}
