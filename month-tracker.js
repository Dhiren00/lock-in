const MonthTracker = (() => {
  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth();
  let onRender = null;

  const STATUS_LABELS = {
    complete: '8h complete',
    partial: 'In progress',
    missed: 'No 8h',
    none: 'Not started',
    future: 'Upcoming',
  };

  function setView(year, month) {
    viewYear = year;
    viewMonth = month;
    render();
  }

  function shiftMonth(delta) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    render();
  }

  function goToToday() {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    render();
  }

  function bind(root) {
    root.addEventListener('click', (e) => {
      const prev = e.target.closest('[data-month-prev]');
      const next = e.target.closest('[data-month-next]');
      const todayBtn = e.target.closest('[data-month-today]');
      if (prev) shiftMonth(-1);
      if (next) shiftMonth(1);
      if (todayBtn) goToToday();
    });
  }

  function dayDetailHTML(cell) {
    if (cell.empty) return '';
    const lines = [];
    if (cell.full8h) {
      lines.push('You completed the full 8-hour lock-in.');
    } else if (cell.hoursLogged > 0) {
      lines.push(`${cell.hoursLogged}h logged (${cell.segmentsDone}/3 segments).`);
    } else if (cell.status === 'missed') {
      lines.push('No 8-hour session recorded for this day.');
    } else if (cell.status === 'future') {
      lines.push('This day has not arrived yet.');
    } else {
      lines.push('Session not started yet today.');
    }
    if (cell.startedAt) {
      lines.push(`Started at ${new Date(cell.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}.`);
    }
    return lines.join(' ');
  }

  function render() {
    const root = document.getElementById('monthTracker');
    if (!root) return;

    const cal = getMonthCalendar(viewYear, viewMonth);
    const summary = getMonthSummary(viewYear, viewMonth);
    const now = new Date();
    const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

    const weekdayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      .map((w) => `<span class="cal-weekday">${w}</span>`)
      .join('');

    const dayCells = cal.cells
      .map((cell) => {
        if (cell.empty) return '<span class="cal-cell cal-cell--empty" aria-hidden="true"></span>';
        const title = `${cell.key}: ${STATUS_LABELS[cell.status]}${cell.hoursLogged ? ` · ${cell.hoursLogged}h` : ''}`;
        return `<button type="button" class="cal-cell cal-cell--${cell.status} ${cell.isToday ? 'cal-cell--today' : ''}" data-day-key="${cell.key}" title="${title}" aria-label="${cell.day}, ${STATUS_LABELS[cell.status]}">
          <span class="cal-day-num">${cell.day}</span>
          <span class="cal-day-mark" aria-hidden="true">${cell.full8h ? '✓' : cell.hoursLogged ? '·' : ''}</span>
        </button>`;
      })
      .join('');

    root.innerHTML = `
      <div class="month-header">
        <div class="month-nav">
          <button type="button" class="btn-icon" data-month-prev aria-label="Previous month">‹</button>
          <h3 class="month-title">${cal.monthLabel}</h3>
          <button type="button" class="btn-icon" data-month-next aria-label="Next month">›</button>
        </div>
        ${!isCurrentMonth ? '<button type="button" class="btn-text" data-month-today>Jump to today</button>' : ''}
      </div>

      <div class="month-stats">
        <div class="stat-box stat-box--success">
          <span class="stat-num">${summary.full8h}</span>
          <span class="stat-label">Days at 8h</span>
        </div>
        <div class="stat-box stat-box--warn">
          <span class="stat-num">${summary.partial}</span>
          <span class="stat-label">Partial days</span>
        </div>
        <div class="stat-box stat-box--danger">
          <span class="stat-num">${summary.missed}</span>
          <span class="stat-label">Missed days</span>
        </div>
        <div class="stat-box stat-box--accent">
          <span class="stat-num">${summary.rate}%</span>
          <span class="stat-label">8h rate (month)</span>
        </div>
      </div>

      <p class="month-summary-text" id="monthSummaryText">
        ${summary.elapsed} day${summary.elapsed === 1 ? '' : 's'} tracked so far —
        <strong>${summary.full8h}</strong> hit full 8 hours,
        <strong>${summary.missed}</strong> missed.
        ${summary.remaining > 0 ? `${summary.remaining} day${summary.remaining === 1 ? '' : 's'} left this month.` : ''}
      </p>

      <div class="cal-legend" aria-hidden="true">
        <span><i class="leg leg--complete"></i> 8h done</span>
        <span><i class="leg leg--partial"></i> Started / partial</span>
        <span><i class="leg leg--missed"></i> Missed</span>
        <span><i class="leg leg--none"></i> Today (not started)</span>
      </div>

      <div class="cal-grid" role="grid" aria-label="Monthly 8-hour tracking">
        ${weekdayHeaders}
        ${dayCells}
      </div>

      <p class="cal-detail" id="calDayDetail">Click a day for details.</p>
    `;

    const detailEl = document.getElementById('calDayDetail');
    root.querySelectorAll('[data-day-key]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.dayKey;
        const cell = cal.cells.find((c) => c.key === key);
        if (!cell || !detailEl) return;
        root.querySelectorAll('.cal-cell--selected').forEach((el) => el.classList.remove('cal-cell--selected'));
        btn.classList.add('cal-cell--selected');
        detailEl.textContent = `${new Date(key + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} — ${dayDetailHTML(cell)}`;
      });
    });

    const todayCell = cal.cells.find((c) => c.isToday);
    if (todayCell && detailEl) {
      detailEl.textContent = `Today — ${dayDetailHTML(todayCell)}`;
    }

    if (onRender) onRender(summary);
  }

  function init(callback) {
    onRender = callback;
    const root = document.getElementById('monthTracker');
    if (root) bind(root);
    render();
  }

  function refresh() {
    render();
  }

  return { init, refresh, setView, goToToday };
})();
