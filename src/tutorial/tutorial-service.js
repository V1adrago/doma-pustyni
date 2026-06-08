const TUTORIAL_STORAGE_KEY = 'dp-tutorial-progress-v1';

function _default() {
  return { menuTourDone: false, completedLessons: [], lastOpenedLesson: null, showHints: true };
}

export function loadTutorialProgress() {
  try {
    const raw = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!raw) return _default();
    return { ..._default(), ...JSON.parse(raw) };
  } catch {
    return _default();
  }
}

export function saveTutorialProgress(progress) {
  localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(progress));
}

export function markMenuTourDone() {
  const p = loadTutorialProgress();
  p.menuTourDone = true;
  saveTutorialProgress(p);
}

export function markLessonDone(lessonId) {
  const p = loadTutorialProgress();
  if (!p.completedLessons.includes(lessonId)) p.completedLessons.push(lessonId);
  p.lastOpenedLesson = lessonId;
  saveTutorialProgress(p);
}

export function isLessonDone(lessonId) {
  return loadTutorialProgress().completedLessons.includes(lessonId);
}

export function isMenuTourDone() {
  return loadTutorialProgress().menuTourDone;
}

export function resetTutorialProgress() {
  localStorage.removeItem(TUTORIAL_STORAGE_KEY);
}
