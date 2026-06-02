const FocusCamera = (() => {
  const video = () => document.getElementById('cameraFeed');
  const canvas = () => document.getElementById('motionCanvas');
  const overlay = () => document.getElementById('cameraOverlay');
  const motionText = () => document.getElementById('motionText');
  const motionDot = () => document.querySelector('.motion-dot');

  let stream = null;
  let rafId = null;
  let lastFrame = null;
  let onMotion = null;
  let active = false;
  let cooldownUntil = 0;
  const COOLDOWN_MS = 4000;

  function getSensitivity() {
    const el = document.getElementById('motionSensitivity');
    return Number(el?.value ?? 5);
  }

  function threshold() {
    const s = getSensitivity();
    return 18 - s * 1.2;
  }

  async function start() {
    if (stream) return true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false,
      });
      const v = video();
      v.srcObject = stream;
      overlay().classList.add('hidden');
      setStatus('watching', 'Monitoring — stay seated');
      return true;
    } catch (err) {
      setStatus('error', 'Camera blocked — enable to use motion alerts');
      overlay().classList.remove('hidden');
      overlay().querySelector('span').textContent = 'Camera unavailable';
      return false;
    }
  }

  function stop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    const v = video();
    v.srcObject = null;
    lastFrame = null;
    overlay().classList.remove('hidden');
    overlay().querySelector('span').textContent = 'Camera off';
    setStatus('idle', 'Waiting for session');
  }

  function setStatus(kind, text) {
    const dot = motionDot();
    dot.className = 'motion-dot ' + kind;
    motionText().textContent = text;
  }

  function detectLoop() {
    if (!active || !stream) return;
    const v = video();
    const c = canvas();
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (v.readyState < 2) {
      rafId = requestAnimationFrame(detectLoop);
      return;
    }

    c.width = 160;
    c.height = 120;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;

    if (lastFrame) {
      let diff = 0;
      const step = 4;
      for (let i = 0; i < data.length; i += step * 4) {
        const dr = Math.abs(data[i] - lastFrame[i]);
        const dg = Math.abs(data[i + 1] - lastFrame[i + 1]);
        const db = Math.abs(data[i + 2] - lastFrame[i + 2]);
        diff += dr + dg + db;
      }
      const avg = diff / (data.length / (step * 4)) / 3;
      if (avg > threshold() && Date.now() > cooldownUntil) {
        cooldownUntil = Date.now() + COOLDOWN_MS;
        setStatus('alert', 'Movement detected!');
        if (onMotion) onMotion(avg);
      }
    }
    lastFrame = new Uint8ClampedArray(data);
    rafId = requestAnimationFrame(detectLoop);
  }

  function beginMonitoring(motionCallback) {
    onMotion = motionCallback;
    active = true;
    detectLoop();
  }

  function endMonitoring() {
    active = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastFrame = null;
    if (stream) setStatus('watching', 'Camera on — session paused');
  }

  return { start, stop, beginMonitoring, endMonitoring };
})();
