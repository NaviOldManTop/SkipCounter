// Course rules for a subject: assessments with points, pass threshold and grade scale.
// Pure helpers only — rendering lives in app.js.

const num = (v, max = 1000) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n * 10) / 10)) : null;
};
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isoDate = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function emptyCourse() {
  return { notes: '', passPoints: null, bonusMax: null, items: [], scale: [] };
}

export function normalizeCourse(c) {
  if (!c || typeof c !== 'object') return null;
  const items = (Array.isArray(c.items) ? c.items : [])
    .filter((it) => it && str(it.title, 60))
    .slice(0, 30)
    .map((it) => ({
      id: String(it.id || newId()),
      title: str(it.title, 60),
      max: num(it.max),
      min: num(it.min),
      classNo: num(it.classNo, 99) || null,
      date: isoDate(it.date),
      score: num(it.score),
      note: str(it.note, 300),
    }));
  const scale = (Array.isArray(c.scale) ? c.scale : [])
    .filter((s) => s && num(s.from) != null && str(String(s.grade ?? ''), 12))
    .slice(0, 12)
    .map((s) => ({ from: num(s.from), grade: str(String(s.grade), 12) }))
    .sort((a, b) => a.from - b.from);
  const course = {
    notes: str(c.notes, 4000),
    passPoints: num(c.passPoints),
    bonusMax: num(c.bonusMax),
    items,
    scale,
  };
  return isEmpty(course) ? null : course;
}

export const isEmpty = (c) => !c || (!c.notes && c.passPoints == null && c.bonusMax == null && !c.items.length && !c.scale.length);

// When an assessment is "in the 10th class", take the date of that class from the timetable.
export function itemDate(item, classDates) {
  if (item.classNo && classDates[item.classNo - 1]) return classDates[item.classNo - 1];
  return item.date;
}

export function courseStatus(course, classDates = []) {
  const items = course.items.map((it) => ({ ...it, when: itemDate(it, classDates) }));
  const scored = items.filter((it) => it.score != null);
  const total = Math.round(scored.reduce((sum, it) => sum + it.score, 0) * 10) / 10;
  const max = items.reduce((sum, it) => sum + (it.max ?? 0), 0) || null;
  const belowMin = items.filter((it) => it.min != null && it.score != null && it.score < it.min);
  const pass = course.passPoints;
  const needed = pass != null ? Math.max(0, Math.round((pass - total) * 10) / 10) : null;
  // Highest band the current total reaches; only meaningful once something is scored.
  const band = scored.length ? [...course.scale].reverse().find((s) => total >= s.from) : null;
  const passed = pass != null && total >= pass && !belowMin.length && items.every((it) => it.min == null || it.score != null);
  return { items, total, max, needed, passed, belowMin, grade: band?.grade ?? null, scored: scored.length };
}

// Import file written from the course rules PDFs:
// { "skipcount": "course-info", "courses": [{ "code": "PPY", "type": "Exercises", ...course }] }
export function parseCourseImport(data) {
  if (!data || data.skipcount !== 'course-info' || !Array.isArray(data.courses)) {
    throw new Error('This file is not a SkipCount course-info file.');
  }
  return data.courses
    .filter((c) => c && str(c.code, 12))
    .map((c) => ({ code: str(c.code, 12).toUpperCase(), type: str(c.type, 30), course: normalizeCourse(c) }))
    .filter((c) => c.course);
}

// Keep scores the user already typed when fresh rules for the same assessment arrive.
export function mergeScores(next, prev) {
  if (!prev) return next;
  const byTitle = new Map(prev.items.map((it) => [it.title.toLowerCase(), it]));
  return {
    ...next,
    items: next.items.map((it) => {
      const old = byTitle.get(it.title.toLowerCase());
      return old ? { ...it, id: old.id, score: it.score ?? old.score } : it;
    }),
  };
}
