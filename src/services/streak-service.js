const STORAGE_KEY = 'doma_pustyni_streak_v1';

const DEFAULT = {
  currentStreak: 0,
  maxStreak:     0,
  lastWinDate:   null,
  weeklyWins:    0,
  weekKey:       null,
};

function _today() {
  return new Date().toISOString().slice(0, 10);
}

function _weekKey() {
  const d   = new Date();
  const jan = new Date(d.getFullYear(), 0, 1);
  const wn  = Math.ceil(((d - jan) / 86400000 + jan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(wn).padStart(2, '0')}`;
}

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT };
}

function _save(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function loadStreak() {
  const s  = _load();
  const wk = _weekKey();
  if (s.weekKey !== wk) { s.weeklyWins = 0; s.weekKey = wk; _save(s); }
  return s;
}

export function recordWin() {
  const s   = loadStreak();
  const tod = _today();
  const yes = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (s.lastWinDate === tod) {
    // already won today — streak stays, still add weekly win
  } else if (s.lastWinDate === yes) {
    s.currentStreak++;
  } else {
    s.currentStreak = 1;
  }
  s.lastWinDate = tod;
  s.maxStreak   = Math.max(s.maxStreak, s.currentStreak);
  s.weeklyWins  = (s.weeklyWins || 0) + 1;
  s.weekKey     = _weekKey();
  _save(s);
  return s;
}

export function recordLoss() {
  const s = _load();
  s.currentStreak = 0;
  _save(s);
  return s;
}

export function getStreakBonus(streak) {
  if (streak >= 5) return 3;
  if (streak >= 3) return 2;
  if (streak >= 2) return 1;
  return 0;
}
