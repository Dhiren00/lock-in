const STORAGE_KEY = 'lockin_daily_v1';

const SEGMENT_DURATIONS_MS = [
  2 * 60 * 60 * 1000,
  2 * 60 * 60 * 1000,
  4 * 60 * 60 * 1000,
];

function dateKeyFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayKey() {
  return dateKeyFromDate(new Date());
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const SEGMENT_HOURS = [2, 2, 4];

function workedFull8Hours(record) {
  return Boolean(record?.sessionComplete);
}

function hoursLogged(record) {
  if (!record?.completedSegments?.length) return 0;
  return record.completedSegments.reduce((sum, i) => sum + (SEGMENT_HOURS[i] ?? 0), 0);
}

/** complete | partial | missed | none | future */
function getDayStatus(key, record, referenceDate = new Date()) {
  const day = startOfDay(new Date(key + 'T12:00:00'));
  const today = startOfDay(referenceDate);

  if (day > today) return 'future';
  if (workedFull8Hours(record)) return 'complete';

  const started = Boolean(record?.started);
  const segments = record?.completedSegments?.length ?? 0;

  if (day.getTime() === today.getTime()) {
    if (started || segments > 0) return 'partial';
    return 'none';
  }

  if (started || segments > 0) return 'partial';
  return 'missed';
}

function getMonthCalendar(year, month, referenceDate = new Date()) {
  const data = loadAll();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const today = startOfDay(referenceDate);

  const cells = [];

  for (let i = 0; i < startPad; i++) {
    cells.push({ empty: true });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const key = dateKeyFromDate(d);
    const record = data.days[key] ?? null;
    const status = getDayStatus(key, record, referenceDate);
    cells.push({
      empty: false,
      key,
      day,
      status,
      isToday: startOfDay(d).getTime() === today.getTime(),
      started: Boolean(record?.started),
      hoursLogged: hoursLogged(record),
      full8h: workedFull8Hours(record),
      segmentsDone: record?.completedSegments?.length ?? 0,
      startedAt: record?.startedAt ?? null,
    });
  }

  return { year, month, cells, daysInMonth, monthLabel: first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
}

function getMonthSummary(year, month, referenceDate = new Date()) {
  const { cells } = getMonthCalendar(year, month, referenceDate);
  const today = startOfDay(referenceDate);

  let full8h = 0;
  let partial = 0;
  let missed = 0;
  let inProgressToday = 0;
  let elapsed = 0;

  cells.filter((c) => !c.empty).forEach((c) => {
    const day = startOfDay(new Date(c.key + 'T12:00:00'));
    if (day > today) return;
    elapsed += 1;
    if (c.status === 'complete') full8h += 1;
    else if (c.status === 'partial') {
      partial += 1;
      if (c.isToday) inProgressToday += 1;
    } else if (c.status === 'missed') missed += 1;
    else if (c.isToday) inProgressToday += 1;
  });

  const rate = elapsed > 0 ? Math.round((full8h / elapsed) * 100) : 0;

  return {
    year,
    month,
    full8h,
    partial,
    missed,
    inProgressToday,
    elapsed,
    remaining: Math.max(0, cells.filter((c) => !c.empty).length - elapsed),
    rate,
    goalMet: full8h >= elapsed && elapsed > 0,
  };
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { days: {} };
  } catch {
    return { days: {} };
  }
}

function saveAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getTodayRecord() {
  const data = loadAll();
  const key = todayKey();
  if (!data.days[key]) {
    data.days[key] = {
      started: false,
      startedAt: null,
      completedSegments: [],
      currentSegment: 0,
      segmentRemainingMs: SEGMENT_DURATIONS_MS[0],
      onBreak: false,
      sessionComplete: false,
    };
    saveAll(data);
  }
  return { data, key, record: data.days[key] };
}

function updateTodayRecord(mutator) {
  const { data, key, record } = getTodayRecord();
  mutator(record);
  data.days[key] = record;
  saveAll(data);
  return record;
}

function markStartedToday() {
  return updateTodayRecord((r) => {
    if (!r.started) {
      r.started = true;
      r.startedAt = new Date().toISOString();
    }
  });
}

function markSegmentComplete(segmentIndex) {
  return updateTodayRecord((r) => {
    if (!r.completedSegments.includes(segmentIndex)) {
      r.completedSegments.push(segmentIndex);
    }
    r.currentSegment = Math.min(segmentIndex + 1, 2);
    r.onBreak = segmentIndex < 2;
    if (segmentIndex >= 2) {
      r.sessionComplete = true;
      r.onBreak = false;
    } else {
      r.segmentRemainingMs = SEGMENT_DURATIONS_MS[r.currentSegment];
    }
  });
}

function persistTimerState(segmentIndex, remainingMs, onBreak, running) {
  return updateTodayRecord((r) => {
    r.currentSegment = segmentIndex;
    r.segmentRemainingMs = remainingMs;
    r.onBreak = onBreak;
    r.timerRunning = running;
  });
}

function getLast7Days() {
  const data = loadAll();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateKeyFromDate(d);
    const rec = data.days[key];
    days.push({
      key,
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      started: rec?.started ?? false,
      complete: workedFull8Hours(rec),
      segments: rec?.completedSegments?.length ?? 0,
    });
  }
  return days;
}
