const LockInTimer = (() => {
  const SEGMENTS = [
    { label: 'Segment 1 · 2 hours', durationMs: 2 * 60 * 60 * 1000, short: '2h' },
    { label: 'Segment 2 · 2 hours', durationMs: 2 * 60 * 60 * 1000, short: '2h' },
    { label: 'Segment 3 · 4 hours', durationMs: 4 * 60 * 60 * 1000, short: '4h' },
  ];

  let segmentIndex = 0;
  let remainingMs = SEGMENTS[0].durationMs;
  let running = false;
  let onBreak = false;
  let intervalId = null;
  let lastTick = 0;
  let listeners = [];

  function emit(event, payload) {
    listeners.forEach((fn) => fn(event, payload));
  }

  function subscribe(fn) {
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  }

  function formatMs(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
  }

  function tick() {
    const now = performance.now();
    const delta = now - lastTick;
    lastTick = now;
    if (!running || onBreak) return;

    remainingMs -= delta;
    emit('tick', { segmentIndex, remainingMs, running, onBreak });

    if (remainingMs <= 0) {
      remainingMs = 0;
      running = false;
      clearInterval(intervalId);
      intervalId = null;
      emit('segmentComplete', { segmentIndex });
    }
  }

  function loadFromRecord(record) {
    segmentIndex = record.currentSegment ?? 0;
    remainingMs = record.segmentRemainingMs ?? SEGMENTS[segmentIndex].durationMs;
    onBreak = record.onBreak ?? false;
    running = false;
    if (record.sessionComplete) {
      segmentIndex = 2;
      remainingMs = 0;
    }
  }

  function start(isRestart) {
    if (onBreak) {
      onBreak = false;
      remainingMs = SEGMENTS[segmentIndex].durationMs;
    }
    running = true;
    lastTick = performance.now();
    if (!intervalId) {
      intervalId = setInterval(tick, 250);
    }
    emit('start', { segmentIndex, isRestart, remainingMs, running, onBreak });
  }

  function pause() {
    running = false;
    emit('pause', { segmentIndex, remainingMs, running, onBreak });
  }

  function resume() {
    if (remainingMs <= 0 || onBreak) return;
    start(true);
  }

  function endSegmentForBreak() {
    if (onBreak) return;
    running = false;
    emit('break', { segmentIndex });
    if (segmentIndex < 2) {
      onBreak = true;
      segmentIndex += 1;
      remainingMs = SEGMENTS[segmentIndex].durationMs;
      emit('tick', { segmentIndex, remainingMs, running: false, onBreak: true });
    }
  }

  function skipToNextAfterBreak() {
    onBreak = false;
    remainingMs = SEGMENTS[segmentIndex].durationMs;
    emit('tick', { segmentIndex, remainingMs, running: false, onBreak: false });
  }

  function restartCurrentSegment() {
    remainingMs = SEGMENTS[segmentIndex].durationMs;
    running = false;
    onBreak = false;
    emit('tick', { segmentIndex, remainingMs, running: false, onBreak: false });
  }

  function getState() {
    return { segmentIndex, remainingMs, running, onBreak, segment: SEGMENTS[segmentIndex] };
  }

  function isSessionDone() {
    return segmentIndex === 2 && remainingMs <= 0 && !onBreak && !running;
  }

  return {
    SEGMENTS,
    subscribe,
    formatMs,
    loadFromRecord,
    start,
    pause,
    resume,
    endSegmentForBreak,
    skipToNextAfterBreak,
    restartCurrentSegment,
    getState,
    isSessionDone,
  };
})();
