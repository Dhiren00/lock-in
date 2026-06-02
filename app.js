(function initLockIn() {
  const els = {
    todayLabel: document.getElementById('todayLabel'),
    startedToday: document.getElementById('startedToday'),
    dailyProgress: document.getElementById('dailyProgress'),
    weekHistory: document.getElementById('weekHistory'),
    today8hBadge: document.getElementById('today8hBadge'),
    timerDisplay: document.getElementById('timerDisplay'),
    phaseLabel: document.getElementById('phaseLabel'),
    segmentProgress: document.getElementById('segmentProgress'),
    btnStart: document.getElementById('btnStart'),
    btnPause: document.getElementById('btnPause'),
    btnBreak: document.getElementById('btnBreak'),
    controlHint: document.getElementById('controlHint'),
    alarmBanner: document.getElementById('alarmBanner'),
    alarmMessage: document.getElementById('alarmMessage'),
    dismissAlarm: document.getElementById('dismissAlarm'),
    segmentTabs: document.getElementById('segmentTabs'),
    seg0tag: document.getElementById('seg0tag'),
    seg1tag: document.getElementById('seg1tag'),
    seg2tag: document.getElementById('seg2tag'),
  };

  let sessionActive = false;
  let wasRunningBefore = false;

  function renderDate() {
    const now = new Date();
    els.todayLabel.textContent = now.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  function renderDailyStatus() {
    const { record } = getTodayRecord();
    els.startedToday.textContent = record.started
      ? new Date(record.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      : 'Not yet';
    const done = record.completedSegments?.length ?? 0;
    els.dailyProgress.textContent = record.sessionComplete
      ? '8h complete'
      : `${done} / 3 segments`;

    if (els.today8hBadge) {
      if (record.sessionComplete) {
        els.today8hBadge.textContent = 'Today: 8 hours complete';
        els.today8hBadge.className = 'today-8h-badge complete';
      } else if (record.started) {
        const hrs = hoursLogged(record);
        els.today8hBadge.textContent = `Today: ${hrs}h / 8h logged — keep going`;
        els.today8hBadge.className = 'today-8h-badge partial';
      } else {
        els.today8hBadge.textContent = 'Today: 8 hours not yet started';
        els.today8hBadge.className = 'today-8h-badge none';
      }
    }

    const days = getLast7Days();
    els.weekHistory.innerHTML = days
      .map(
        (d) =>
          `<span class="day-pill ${d.complete ? 'complete' : d.started ? 'started' : ''}" title="${d.key}">${d.label}</span>`
      )
      .join('');

    [els.seg0tag, els.seg1tag, els.seg2tag].forEach((tag, i) => {
      if (record.sessionComplete || record.completedSegments?.includes(i)) {
        tag.textContent = 'done';
        tag.className = 'tag done';
      } else if (record.started && record.currentSegment === i && !record.onBreak) {
        tag.textContent = 'active';
        tag.className = 'tag active';
      } else if (record.onBreak && record.currentSegment === i) {
        tag.textContent = 'break';
        tag.className = 'tag break';
      } else {
        tag.textContent = 'pending';
        tag.className = 'tag';
      }
    });
  }

  function renderSegmentTabs() {
    const { record } = getTodayRecord();
    els.segmentTabs.innerHTML = LockInTimer.SEGMENTS.map((seg, i) => {
      const active = record.currentSegment === i && record.started;
      const done = record.completedSegments?.includes(i);
      return `<button type="button" class="seg-tab ${active ? 'active' : ''} ${done ? 'done' : ''}" data-i="${i}" disabled>${seg.short}</button>`;
    }).join('');
  }

  function updateUI(state) {
    const { segmentIndex, remainingMs, running, onBreak, segment } = state;
    els.timerDisplay.textContent = onBreak
      ? 'Break'
      : LockInTimer.formatMs(remainingMs);
    els.phaseLabel.textContent = onBreak
      ? 'Take a break — resume when ready'
      : segment.label;

    const total = segment.durationMs;
    const pct = onBreak ? 0 : ((total - remainingMs) / total) * 100;
    els.segmentProgress.style.width = `${Math.min(100, Math.max(0, pct))}%`;

    const { record } = getTodayRecord();
    const sessionDone = record.sessionComplete;

    els.btnStart.disabled = sessionDone;
    els.btnPause.disabled = !running;
    els.btnBreak.disabled = !sessionActive || onBreak || !running;

    if (sessionDone) {
      els.btnStart.textContent = 'Day complete';
      els.controlHint.textContent = 'You finished today\'s 8-hour lock-in. Come back tomorrow.';
    } else if (onBreak) {
      els.btnStart.textContent = 'Resume next segment';
      els.controlHint.textContent = 'Break time between segments. Hit resume when you\'re ready — siren will play.';
    } else if (running) {
      els.btnStart.textContent = 'Restart segment';
      els.controlHint.textContent = 'Restarting plays a siren. Stay seated — motion triggers an alarm.';
    } else if (sessionActive) {
      els.btnStart.textContent = 'Resume';
      els.controlHint.textContent = 'Session paused. Resume or restart the current segment.';
    } else {
      els.btnStart.textContent = 'Start lock-in';
      els.controlHint.textContent = 'Start your 8-hour lock-in. Camera activates for motion checks.';
    }

    persistTimerState(segmentIndex, remainingMs, onBreak, running);
    renderDailyStatus();
    renderSegmentTabs();
    MonthTracker.refresh();
  }

  async function beginSession(isRestart) {
    const { record } = getTodayRecord();
    if (record.sessionComplete) return;

    AudioAlerts.getCtx();

    if (isRestart) {
      AudioAlerts.playSiren();
      showAlarm('Segment restarted — siren alert');
    } else if (!record.started) {
      markStartedToday();
    }

    const camOk = await FocusCamera.start();
    if (camOk) {
      FocusCamera.beginMonitoring(() => {
        AudioAlerts.playMotionAlarm();
        showAlarm('Stay seated! Movement detected during focus time.');
      });
    }

    sessionActive = true;
    LockInTimer.start(isRestart);
    wasRunningBefore = true;
  }

  function pauseSession() {
    LockInTimer.pause();
    FocusCamera.endMonitoring();
  }

  function showAlarm(msg) {
    els.alarmMessage.textContent = msg;
    els.alarmBanner.classList.remove('hidden');
  }

  function hideAlarm() {
    els.alarmBanner.classList.add('hidden');
  }

  els.dismissAlarm.addEventListener('click', hideAlarm);

  els.btnStart.addEventListener('click', async () => {
    const state = LockInTimer.getState();
    const { record } = getTodayRecord();
    if (record.sessionComplete) return;

    if (state.onBreak) {
      AudioAlerts.playSiren();
      showAlarm('Resuming after break — stay focused');
      LockInTimer.skipToNextAfterBreak();
      await beginSession(false);
      return;
    }

    if (state.running) {
      LockInTimer.pause();
      FocusCamera.endMonitoring();
      LockInTimer.restartCurrentSegment();
      await beginSession(true);
      return;
    }

    if (sessionActive && state.remainingMs < LockInTimer.SEGMENTS[state.segmentIndex].durationMs) {
      await beginSession(false);
      LockInTimer.resume();
      return;
    }

    await beginSession(false);
  });

  els.btnPause.addEventListener('click', () => {
    pauseSession();
  });

  els.btnBreak.addEventListener('click', () => {
    const idx = LockInTimer.getState().segmentIndex;
    LockInTimer.pause();
    FocusCamera.endMonitoring();
    markSegmentComplete(idx);
    LockInTimer.endSegmentForBreak();
    AudioAlerts.playSegmentComplete();
    if (idx >= 2) {
      sessionActive = false;
      FocusCamera.stop();
    }
  });

  LockInTimer.subscribe((event, payload) => {
    if (event === 'tick' || event === 'start' || event === 'pause') {
      updateUI(payload);
    }
    if (event === 'segmentComplete') {
      markSegmentComplete(payload.segmentIndex);
      AudioAlerts.playSegmentComplete();
      if (payload.segmentIndex < 2) {
        LockInTimer.endSegmentForBreak();
        FocusCamera.endMonitoring();
        showAlarm('Segment complete — take your break');
      } else {
        sessionActive = false;
        FocusCamera.stop();
        showAlarm('8-hour lock-in complete for today!');
      }
      updateUI(LockInTimer.getState());
    }
    if (event === 'break') {
      updateUI(LockInTimer.getState());
    }
  });

  function bootstrap() {
    renderDate();
    MonthTracker.init();
    const { record } = getTodayRecord();
    LockInTimer.loadFromRecord(record);
    sessionActive = record.started && !record.sessionComplete;
    updateUI(LockInTimer.getState());
    renderSegmentTabs();
  }

  bootstrap();
})();
