let context: AudioContext | undefined;
export function playSound(kind: 'correct' | 'wrong' | 'level', enabled: boolean) {
  if (!enabled) return;
  try {
    const Audio = window.AudioContext ?? (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
    if (!Audio) return;
    context ??= new Audio();
    void context.resume().catch(()=>{});
    const notes = kind === 'wrong' ? [180,130] : kind === 'level' ? [523,659,784,1047] : [523,659,880];
    notes.forEach((frequency,i) => {
      const osc = context!.createOscillator(), gain = context!.createGain(), start = context!.currentTime + i * .065;
      osc.type = 'sine'; osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0,start); gain.gain.linearRampToValueAtTime(.07,start+.008); gain.gain.exponentialRampToValueAtTime(.001,start+.14);
      osc.connect(gain); gain.connect(context!.destination); osc.start(start); osc.stop(start+.15);
    });
  } catch { /* Audio is decorative: unsupported browsers never block answers. */ }
}
