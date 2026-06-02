const AudioAlerts = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  function beep(freq, duration, type = 'sine', gain = 0.15) {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(ac.destination);
    const t = ac.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration);
  }

  function playMotionAlarm() {
    const ac = getCtx();
    const t = ac.currentTime;
    for (let i = 0; i < 6; i++) {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      g.gain.value = 0.12;
      osc.connect(g);
      g.connect(ac.destination);
      const start = t + i * 0.35;
      osc.start(start);
      osc.stop(start + 0.2);
    }
  }

  function playSiren(duration = 2.5) {
    const ac = getCtx();
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sawtooth';
    g.gain.value = 0.18;
    osc.connect(g);
    g.connect(ac.destination);

    osc.frequency.setValueAtTime(400, t);
    osc.frequency.linearRampToValueAtTime(1200, t + 0.4);
    osc.frequency.linearRampToValueAtTime(400, t + 0.8);
    osc.frequency.linearRampToValueAtTime(1200, t + 1.2);
    osc.frequency.linearRampToValueAtTime(400, t + 1.6);
    osc.frequency.linearRampToValueAtTime(1200, t + 2.0);

    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration);
  }

  function playSegmentComplete() {
    beep(523, 0.15);
    setTimeout(() => beep(659, 0.15), 160);
    setTimeout(() => beep(784, 0.25), 320);
  }

  return { playMotionAlarm, playSiren, playSegmentComplete, getCtx };
})();
