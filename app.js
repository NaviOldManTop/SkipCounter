// SkipCount — attendance tracker. All data lives in localStorage on the device.
import { parseICS, classifyEvent } from './ics.js';
import { initUpdates } from './update.js';
import { emptyCourse, normalizeCourse, courseStatus, itemDate, parseCourseImport, mergeScores } from './course.js';
import { playEnter, fadeIn, initSwipeNav, closeSheet, initSheetGestures, slideIn, moveTabIndicator } from './motion.js';

const STORAGE_KEY = 'skipcount:v1';
const APP_VERSION = '1.5.0';
const COLORS = [
  '#5b5fef', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#1f9d63', '#84cc16', '#d99a00',
  '#f97316', '#e5484d', '#ec4899', '#c026d3', '#8b5cf6', '#a0703c', '#64748b',
];
const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const DEFAULT_LIMITS = { limitType: 'count', limitValue: 4, excusedLimit: 4, total: null };
const STATUS = {
  present: { label: 'Attended', verb: 'Attended' },
  absent: { label: 'Skipped', verb: 'Skipped' },
  excused: { label: 'Excused', verb: 'Excused' },
};
const LEVEL_TEXT = {
  ok: 'Safe',
  warn: 'Careful',
  zero: 'No skips left',
  over: 'Over the limit',
  none: 'No limit set',
};

const icons = {
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  skip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l9 7-9 7z"/><path d="M19 5v14"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
  upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8a2 2 0 0 1 2 2v14l-6-3-6 3V6a2 2 0 0 1 2-2z"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19"/></svg>',
};
const logo = '<svg class="logo" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="120" fill="var(--accent)"/><g fill="#fff" stroke="#fff" stroke-width="28" stroke-linejoin="round" stroke-linecap="round"><path d="M132 170v172l108-86z"/><path d="M240 170v172l108-86z"/><path d="M380 170v172" stroke-width="34"/></g></svg>';

// ---------- helpers ----------

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const plural = (n, one, many) => (Math.abs(n) === 1 ? one : many);

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && value !== '' && value !== null ? Math.min(max, Math.max(min, n)) : fallback;
}

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const todayISO = () => toISO(new Date());

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === todayISO()) return 'Today';
  if (iso === toISO(yesterday)) return 'Yesterday';
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (y !== new Date().getFullYear()) opts.year = 'numeric';
  return date.toLocaleDateString('en-GB', opts);
}

const longDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
};
const hm = (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const weekday = (ms) => new Date(ms).toLocaleDateString('en-GB', { weekday: 'short' });

// ---------- state ----------

function emptyState() {
  return { version: 1, subjects: [], records: [], events: [], tasks: [], settings: { theme: 'auto' } };
}

const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

// Validates and cleans data from storage or an imported backup.
function normalize(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.subjects) || !Array.isArray(data.records)) {
    throw new Error('This file is not a SkipCount backup.');
  }
  const subjects = data.subjects
    .filter((s) => s && s.id && typeof s.name === 'string' && s.name.trim())
    .map((s) => {
      const limitType = s.limitType === 'percent' ? 'percent' : 'count';
      return {
        id: String(s.id),
        name: s.name.trim().slice(0, 60),
        color: isHex(s.color) ? s.color.toLowerCase() : COLORS[0],
        limitType,
        limitValue: clampInt(s.limitValue, 0, limitType === 'percent' ? 100 : 999, 0),
        excusedLimit: clampInt(s.excusedLimit, 0, 999, null),
        total: clampInt(s.total, 1, 999, null),
        tracked: s.tracked !== false,
        code: text(s.code, 12),
        icsKey: text(s.icsKey, 80),
        course: normalizeCourse(s.course),
        createdAt: Number(s.createdAt) || Date.now(),
      };
    });
  const ids = new Set(subjects.map((s) => s.id));
  const records = data.records
    .filter((r) => r && ids.has(String(r.subjectId)) && STATUS[r.status] && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
    .map((r) => ({
      id: String(r.id || uid()),
      subjectId: String(r.subjectId),
      date: r.date,
      status: r.status,
      note: text(r.note, 200),
      at: Number(r.at) || Date.now(),
      ...(r.eventUid ? { eventUid: String(r.eventUid) } : {}),
    }));
  const events = (Array.isArray(data.events) ? data.events : [])
    .filter((e) => e && e.uid && Number.isFinite(e.start) && Number.isFinite(e.end))
    .filter((e) => e.exam || ids.has(String(e.subjectId)))
    .map((e) => ({
      uid: String(e.uid),
      subjectId: e.exam ? null : String(e.subjectId),
      code: text(e.code, 40),
      typeLabel: text(e.typeLabel, 30),
      room: text(e.room, 60),
      teacher: text(e.teacher, 80),
      exam: !!e.exam,
      start: e.start,
      end: e.end,
      date: toISO(new Date(e.start)),
    }));
  // To-dos for a class (homework, things to bring…), or for a subject with an optional date.
  const tasks = (Array.isArray(data.tasks) ? data.tasks : [])
    .filter((t) => t && ids.has(String(t.subjectId)) && typeof t.text === 'string' && t.text.trim())
    .map((t) => ({
      id: String(t.id || uid()),
      subjectId: String(t.subjectId),
      eventUid: t.eventUid ? String(t.eventUid) : null,
      due: /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : null,
      text: t.text.trim().slice(0, 500),
      optional: !!t.optional,
      done: !!t.done,
      createdAt: Number(t.createdAt) || Date.now(),
    }));
  const theme = ['auto', 'light', 'dark'].includes(data.settings?.theme) ? data.settings.theme : 'auto';
  return { version: 1, subjects, records, events, tasks, settings: { theme } };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (err) {
    console.error('Failed to load data', err);
  }
  return emptyState();
}

let state = load();

function save() {
  statsCache.clear();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error(err);
    toast("Couldn't save — storage is unavailable");
  }
}

const getSubject = (id) => state.subjects.find((s) => s.id === id);

function levelFor(left, allowed) {
  if (left == null) return 'none';
  const warnAt = Math.max(1, Math.round(allowed * 0.25));
  return left < 0 ? 'over' : left === 0 ? 'zero' : left <= warnAt ? 'warn' : 'ok';
}

// Timetable classes that already ended without a mark count as attended:
// you only log skips and excused absences.
const isAutoAttended = ({ ev, rec }, now = Date.now()) => !!ev && !rec && !ev.exam && ev.end <= now;

function autoAttendedCount(subjectId) {
  const now = Date.now();
  const dates = new Set(state.events.filter((e) => e.subjectId === subjectId && e.end <= now).map((e) => e.date));
  let n = 0;
  for (const d of dates) n += dayEntries(d, subjectId).filter((x) => isAutoAttended(x, now)).length;
  return n;
}

const hasSchedule = (subjectId) => state.events.some((e) => e.subjectId === subjectId);

// Cleared on every save and render; stats() is called many times per render.
const statsCache = new Map();

function stats(subject) {
  if (statsCache.has(subject.id)) return statsCache.get(subject.id);
  const today = todayISO();
  let present = 0, absent = 0, excused = 0;
  const todays = [];
  for (const r of state.records) {
    if (r.subjectId !== subject.id) continue;
    if (r.status === 'present') present++;
    else if (r.status === 'absent') absent++;
    else excused++;
    if (r.date === today) todays.push(r);
  }
  const autoAttended = autoAttendedCount(subject.id);
  present += autoAttended;
  const logged = present + absent + excused;
  let allowed = subject.limitType === 'count'
    ? subject.limitValue
    : subject.total ? Math.floor(subject.total * (100 - subject.limitValue) / 100) : null;
  if (!subject.tracked) allowed = null; // e.g. lectures: attendance isn't checked
  const left = allowed == null ? null : allowed - absent;
  const excusedAllowed = subject.tracked ? subject.excusedLimit ?? null : null;
  const excusedLeft = excusedAllowed == null ? null : excusedAllowed - excused;
  const remaining = subject.total ? Math.max(subject.total - logged, 0) : null;
  const attendance = logged ? Math.round(((present + excused) / logged) * 100) : null;
  todays.sort((a, b) => a.at - b.at);
  const result = {
    present, absent, excused, logged, allowed, left, remaining, attendance, todays, autoAttended,
    excusedAllowed, excusedLeft,
    level: levelFor(left, allowed),
    excusedLevel: levelFor(excusedLeft, excusedAllowed),
  };
  statsCache.set(subject.id, result);
  return result;
}

// ---------- schedule ----------

// Pairs each scheduled class of a day with the record that logs it.
// Records logged by hand (no eventUid) fill the subject's unlogged classes in time order.
function dayEntries(iso, subjectFilter = null) {
  const events = state.events
    .filter((e) => e.date === iso && (!subjectFilter || e.subjectId === subjectFilter))
    .sort((a, b) => a.start - b.start);
  const records = state.records
    .filter((r) => r.date === iso && (!subjectFilter || r.subjectId === subjectFilter))
    .sort((a, b) => a.at - b.at);
  const eventUids = new Set(events.map((e) => e.uid));
  const used = new Set();
  const entries = events.map((ev) => {
    const rec = records.find((r) => r.eventUid === ev.uid);
    if (rec) used.add(rec.id);
    return { ev, rec };
  });
  for (const entry of entries) {
    if (entry.rec || entry.ev.exam) continue;
    const loose = records.find((r) => !used.has(r.id) && r.subjectId === entry.ev.subjectId && !eventUids.has(r.eventUid));
    if (loose) {
      entry.rec = loose;
      used.add(loose.id);
    }
  }
  for (const rec of records) if (!used.has(rec.id)) entries.push({ ev: null, rec });
  return entries;
}

// "Mon 08:30" style weekly slots, most frequent first.
function weeklySlots(subjectId) {
  const counts = new Map();
  for (const e of state.events) {
    if (e.subjectId !== subjectId) continue;
    const key = `${weekday(e.start)} ${hm(e.start)}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts].filter(([, n]) => n > 1 || counts.size <= 2).sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

const upcomingEvents = (filter) => state.events.filter((e) => e.end > Date.now() && filter(e)).sort((a, b) => a.start - b.start);

// ---------- course rules & tasks ----------

// Dates of a subject's classes in order, so "10th class" can be turned into a date.
const classDates = (subjectId) => state.events
  .filter((e) => e.subjectId === subjectId)
  .sort((a, b) => a.start - b.start)
  .map((e) => e.date);

// Tests / projects that fall on a given date, e.g. to tag that day's class.
function assessmentsOn(iso) {
  const out = [];
  for (const s of state.subjects) {
    if (!s.course) continue;
    const dates = classDates(s.id);
    for (const it of s.course.items) if (itemDate(it, dates) === iso) out.push({ subject: s, item: it });
  }
  return out;
}

function upcomingAssessments() {
  const today = todayISO();
  return state.subjects.flatMap((s) => {
    if (!s.course) return [];
    const dates = classDates(s.id);
    return s.course.items
      .map((it) => ({ subject: s, item: it, date: itemDate(it, dates) }))
      .filter((x) => x.date && x.date >= today);
  });
}

const eventByUid = (uid) => state.events.find((e) => e.uid === uid);

// When a task is due: its class (date + time) or its own date.
function taskDue(task) {
  const ev = task.eventUid ? eventByUid(task.eventUid) : null;
  if (ev) return { date: ev.date, sort: ev.start, label: `${formatDate(ev.date)}, ${hm(ev.start)}` };
  if (task.due) return { date: task.due, sort: new Date(task.due).getTime(), label: formatDate(task.due) };
  return { date: null, sort: Infinity, label: 'No date' };
}

const sortedTasks = (list) => [...list].sort((a, b) => taskDue(a).sort - taskDue(b).sort || a.createdAt - b.createdAt);

// ---------- rendering ----------

function pipsOrBar(used, allowed) {
  // Small limits read better as one pip per class; big ones as a bar.
  if (allowed <= 15 && Math.max(allowed, used) <= 20) {
    const count = Math.max(allowed, used);
    if (count === 0) return '<div class="pips"><span class="pip over"></span></div>';
    let pips = '';
    for (let i = 0; i < count; i++) {
      const cls = i >= allowed ? 'pip over' : i < used ? 'pip used' : 'pip';
      pips += `<span class="${cls}"></span>`;
    }
    return `<div class="pips" aria-hidden="true">${pips}</div>`;
  }
  const pct = allowed ? Math.min(100, (used / allowed) * 100) : 100;
  return `<div class="bar" aria-hidden="true"><span style="width:${pct}%"></span></div>`;
}

function meterRow(kind, used, allowed, level) {
  if (allowed == null) return '';
  const label = kind === 'skip' ? 'Skips' : 'Excused';
  return `
    <div class="meter-row kind-${kind} lvl-${level}">
      <span class="meter-label">${label}</span>
      ${pipsOrBar(used, allowed)}
      <span class="meter-value">${used}/${allowed}</span>
    </div>`;
}

function meters(st) {
  return `<div class="meters">
    ${meterRow('skip', st.absent, st.allowed, st.level)}
    ${meterRow('excused', st.excused, st.excusedAllowed, st.excusedLevel)}
  </div>`;
}

function bigNumber(left, noun) {
  if (left == null) return { num: '—', label: 'no limit' };
  if (left < 0) return { num: `+${-left}`, label: 'over limit' };
  return { num: String(left), label: `${noun} left` };
}

function limitText(subject, st) {
  if (!subject.tracked) return 'Attendance not checked — skips don\'t count';
  let text;
  if (subject.limitType === 'count') text = `Max ${subject.limitValue} ${plural(subject.limitValue, 'skip', 'skips')}`;
  else if (!subject.total) text = `Min ${subject.limitValue}% attendance`;
  else text = `Min ${subject.limitValue}% of ${subject.total} → ${st.allowed} ${plural(st.allowed, 'skip', 'skips')}`;
  if (st.excusedAllowed != null) text += ` + ${st.excusedAllowed} excused`;
  return text;
}

// Timetable subjects show their code (RBD), hand-made ones their first letter.
function avatar(subject, extra = '') {
  const label = subject.code ? subject.code.slice(0, 4) : (Array.from(subject.name.trim())[0] || '?').toUpperCase();
  const size = label.length > 3 ? 'xs' : label.length > 1 ? 'sm' : '';
  return `<span class="avatar ${size} ${extra}" style="--c:${subject.color}" aria-hidden="true">${esc(label)}</span>`;
}

// One class in the Today widget / calendar day list.
function entryRow({ ev, rec }, marker = '') {
  const subject = getSubject(ev?.subjectId ?? rec?.subjectId);
  const today = todayISO();
  const time = ev ? `<span class="entry-time">${hm(ev.start)}<small>${hm(ev.end)}</small></span>` : '<span class="entry-time"><small>logged</small></span>';
  const title = ev?.exam ? `${esc(ev.code)} exam` : esc(subject?.name ?? ev?.code ?? '');
  const details = [
    ev?.room ? `${icons.pin}${esc(ev.room)}` : '',
    ev?.teacher ? esc(ev.teacher) : '',
  ].filter(Boolean).join('<span class="sep">·</span>');

  let right = '';
  let auto = '';
  // "+ task" for any timetable class of a subject.
  const taskBtn = ev && subject
    ? `<button class="mini task" data-action="add-task" data-id="${esc(subject.id)}" data-event="${esc(ev.uid)}" aria-label="Add a task for this class">${icons.note}</button>`
    : '';
  if (ev?.exam) {
    right = '<span class="chip exam">Exam</span>';
  } else if (rec) {
    right = `<div class="mini-group">${taskBtn}<button class="chip status-${rec.status}" data-action="edit-record" data-id="${esc(rec.id)}">${STATUS[rec.status].label}</button></div>`;
  } else if (subject) {
    // Unmarked = attended by default, so only skip / excused need a tap (also ahead of time).
    const btn = (status, icon, label) => `<button class="mini ${status}" data-action="log" data-id="${esc(subject.id)}" data-status="${status}" data-event="${esc(ev.uid)}" data-date="${ev.date}" aria-label="${label}">${icon}</button>`;
    right = `<div class="mini-group">${taskBtn}${btn('absent', icons.skip, 'Mark skipped')}${subject.tracked ? btn('excused', icons.shield, 'Mark excused') : ''}</div>`;
    if (subject.tracked && isAutoAttended({ ev, rec })) auto = `<span class="entry-auto">${icons.check}Attended</span>`;
  }

  const tags = ev && subject
    ? assessmentsOn(ev.date).filter((a) => a.subject.id === subject.id)
      .map((a) => `<span class="entry-tag">${esc(a.item.title)}${a.item.max != null ? ` · ${a.item.max} pts` : ''}</span>`).join('')
    : '';
  const tasks = ev ? sortedTasks(state.tasks.filter((t) => t.eventUid === ev.uid)) : [];

  let hint = '';
  if (subject && !subject.tracked) {
    hint = '<span class="entry-free">not checked</span>';
  } else if (subject && !ev?.exam && !rec && !auto) {
    hint = skipAdvice(stats(subject));
  }

  const color = ev?.exam ? 'var(--accent)' : subject?.color ?? 'var(--muted)';
  return `
    <li class="entry ${marker ? `is-${marker}` : ''} ${rec ? 'is-logged' : ''} ${rec && rec.id === flash?.recordId ? 'just-logged' : ''} ${subject && !subject.tracked ? 'is-free' : ''}" style="--c:${color}">
      <div class="entry-row">
        ${time}
        <div class="entry-body">
          <div class="entry-title">${marker ? `<span class="entry-marker">${marker === 'now' ? 'Now' : 'Next'}</span>` : ''}<span class="entry-name">${title}</span>${tags}</div>
          <div class="entry-meta">${[auto, details, hint].filter(Boolean).join('<span class="sep">·</span>')}</div>
        </div>
        ${right}
      </div>
      ${tasks.length ? `<ul class="task-lines">${tasks.map(taskLine).join('')}</ul>` : ''}
    </li>`;
}

// A to-do with a tick box; `meta` adds the subject and due date (for lists outside a class row).
function taskLine(task, meta = false) {
  let info = '';
  if (meta) {
    const subject = getSubject(task.subjectId);
    const due = taskDue(task);
    const late = !task.done && due.date && due.date < todayISO();
    info = `<span class="task-meta"><span class="dot" style="--c:${subject?.color ?? 'var(--muted)'}"></span>${esc(subject?.name ?? '')}<span class="sep">·</span><span class="${late ? 'late' : ''}">${esc(due.label)}</span></span>`;
  }
  return `
    <li class="task-line ${task.done ? 'is-done' : ''} ${task.id === flash?.taskId ? 'just-logged' : ''}">
      <button class="task-check" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${task.done ? 'Mark as not done' : 'Mark as done'}">${task.done ? icons.check : ''}</button>
      <button class="task-text" data-action="edit-task" data-id="${esc(task.id)}">
        <span>${esc(task.text)}${task.optional ? '<em class="task-optional">optional</em>' : ''}</span>
        ${info}
      </button>
    </li>`;
}

// "Can I skip this one?" for a class that hasn't happened yet.
function skipAdvice(st) {
  if (st.left == null) return '';
  if (st.left > 1) return `<span class="advice ok">Safe to skip · ${st.left} left</span>`;
  if (st.left === 1) return '<span class="advice warn">Last skip left</span>';
  if (st.left === 0) return '<span class="advice bad">No skips left</span>';
  return `<span class="advice bad">Over by ${-st.left} — don't skip</span>`;
}

const DAY_MS = 864e5;
const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  return toISO(new Date(y, m - 1, d + n));
};
const mondayOf = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return addDays(iso, -((date.getDay() + 6) % 7));
};

// Selected day in the home week strip (null = today).
const week = { day: null };

function weekStrip(selected, today) {
  const start = mondayOf(selected);
  let days = '';
  for (let i = 0; i < 7; i++) {
    const iso = addDays(start, i);
    const entries = dayEntries(iso).filter((x) => x.ev);
    const [y, m, d] = iso.split('-').map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'narrow' });
    const marks = entries.slice(0, 4).map((x) => {
      if (x.rec) return `status-${x.rec.status}`;
      if (x.ev.exam) return 'exam';
      return 'planned';
    });
    days += `
      <button class="wk-day ${iso === selected ? 'is-selected' : ''} ${iso === today ? 'is-today' : ''} ${entries.length ? '' : 'is-empty'}" data-action="week-day" data-date="${iso}">
        <span class="wk-label">${label}</span>
        <span class="wk-num">${d}</span>
        <span class="dots">${marks.map((c) => `<i class="d ${c}"></i>`).join('')}</span>
      </button>`;
  }
  return `
    <div class="wk">
      <button class="wk-nav" data-action="week-shift" data-delta="-7" aria-label="Previous week">${icons.prev}</button>
      <div class="wk-days">${days}</div>
      <button class="wk-nav" data-action="week-shift" data-delta="7" aria-label="Next week">${icons.next}</button>
    </div>`;
}

function todayWidget() {
  if (!state.events.length) {
    return `
      <section class="today today-empty">
        <div>
          <h2>Today's classes</h2>
          <p>Import your timetable (.ics) to see today's classes and log them in one tap.</p>
        </div>
        <button class="btn primary" data-action="import-ics">${icons.upload}Import</button>
      </section>`;
  }
  const today = todayISO();
  const iso = week.day ?? today;
  const isToday = iso === today;
  const entries = dayEntries(iso);
  const now = Date.now();
  const classes = entries.filter((x) => x.ev);
  const current = isToday ? classes.find((x) => x.ev.start <= now && x.ev.end > now) : null;
  const next = isToday && !current ? classes.find((x) => x.ev.start > now) : null;

  let body;
  if (!entries.length) {
    const upcoming = upcomingEvents((e) => e.date > iso || (isToday && e.date === iso))[0];
    const nextDay = upcoming ? `Next: <b>${esc(formatDate(upcoming.date))}</b>, ${hm(upcoming.start)} · ${dayEntries(upcoming.date).filter((x) => x.ev).length} classes` : 'No more classes in your timetable.';
    body = `<p class="today-free">${isToday ? 'No classes today' : 'No classes'}</p><p class="today-next">${nextDay}</p>`;
  } else {
    body = `<ul class="entries">${entries.map((x) => entryRow(x, x === current ? 'now' : x === next ? 'next' : '')).join('')}</ul>`;
  }

  return `
    <section class="today">
      <header class="today-head">
        <h2>${isToday ? 'Today' : esc(longDate(iso))}</h2>
        ${isToday ? '' : '<button class="link-btn" data-action="week-today">Today</button>'}
      </header>
      ${weekStrip(iso, today)}
      <div class="today-body">${body}</div>
      ${classes.length ? '<p class="today-tip">Classes count as attended — tap only if you skip.</p>' : ''}
    </section>`;
}

// Timetable classes split into terms wherever there's a gap of 4+ weeks.
function semesterInfo() {
  const classes = state.events.filter((e) => !e.exam).sort((a, b) => a.start - b.start);
  if (!classes.length) return null;
  const terms = [[classes[0]]];
  for (let i = 1; i < classes.length; i++) {
    if (classes[i].start - classes[i - 1].start > 28 * DAY_MS) terms.push([]);
    terms.at(-1).push(classes[i]);
  }
  const now = Date.now();
  const term = terms.find((t) => t.at(-1).end >= now) ?? terms.at(-1);
  const firstDay = mondayOf(term[0].date);
  const lastDay = mondayOf(term.at(-1).date);
  const weeksBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / (7 * DAY_MS));
  const totalWeeks = weeksBetween(firstDay, lastDay) + 1;
  const done = term.filter((e) => e.end <= now).length;
  return {
    totalWeeks,
    week: Math.min(totalWeeks, weeksBetween(firstDay, mondayOf(todayISO())) + 1),
    done,
    total: term.length,
    pct: Math.round((done / term.length) * 100),
    notStarted: now < term[0].start ? term[0] : null,
    finished: now > term.at(-1).end,
  };
}

function semesterBar() {
  const s = semesterInfo();
  if (!s) return '';
  let label;
  if (s.notStarted) label = `Semester starts ${esc(formatDate(s.notStarted.date))}`;
  else if (s.finished) label = 'Semester finished';
  else label = `Week ${s.week} of ${s.totalWeeks}`;
  return `
    <div class="term">
      <div class="term-top"><span>${label}</span><span>${s.done}/${s.total} classes · ${s.pct}%</span></div>
      <div class="term-bar"><span style="width:${s.pct}%"></span></div>
    </div>`;
}

// Open to-dos across all subjects, soonest first.
const home = { showAllTasks: false };

function todoCard() {
  const open = sortedTasks(state.tasks.filter((t) => !t.done));
  if (!open.length) return '';
  const shown = home.showAllTasks ? open : open.slice(0, 5);
  return `
    <section>
      <h2 class="section-title">To do <span class="title-note">· ${open.length}</span></h2>
      <ul class="task-card">${shown.map((t) => taskLine(t, true)).join('')}</ul>
      ${open.length > 5 ? `<button class="btn ghost add-more" data-action="toggle-all-tasks">${home.showAllTasks ? 'Show less' : `Show all ${open.length}`}</button>` : ''}
    </section>`;
}

// Exams from the timetable plus tests/projects from the subjects' course rules.
function examsCard() {
  const today = todayISO();
  const fromTimetable = upcomingEvents((e) => e.exam).map((ev) => ({
    date: ev.date,
    sort: ev.start,
    time: hm(ev.start),
    title: `${ev.code} exam`,
    meta: [ev.room && `${icons.pin}${esc(ev.room)}`, esc(ev.teacher)],
    href: null,
  }));
  const fromRules = upcomingAssessments().map(({ subject, item, date }) => {
    const cls = item.classNo ? state.events.filter((e) => e.subjectId === subject.id).sort((a, b) => a.start - b.start)[item.classNo - 1] : null;
    return {
      date,
      sort: cls ? cls.start : new Date(date).getTime() + DAY_MS - 1,
      time: cls ? hm(cls.start) : '',
      title: `${subject.name} · ${item.title}`,
      meta: [item.max != null && `${item.max} pts${item.min != null ? ` (min ${item.min})` : ''}`, cls?.room && `${icons.pin}${esc(cls.room)}`],
      href: `#/s/${encodeURIComponent(subject.id)}`,
    };
  });
  const list = [...fromTimetable, ...fromRules].filter((x) => x.date >= today).sort((a, b) => a.sort - b.sort).slice(0, 4);
  if (!list.length) return '';
  const inDays = (date) => {
    const days = Math.round((new Date(date) - new Date(today)) / DAY_MS);
    return days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  };
  return `
    <section class="exams">
      <h2 class="section-title">Tests & exams</h2>
      <ul class="exam-list">
        ${list.map((x) => `
          <li>
            <${x.href ? `a href="${x.href}"` : 'div'} class="exam-item">
              <span class="exam-when"><b>${inDays(x.date)}</b><small>${esc(formatDate(x.date))}${x.time ? `, ${x.time}` : ''}</small></span>
              <span class="exam-body">
                <span class="exam-title">${esc(x.title)}</span>
                <span class="exam-meta">${x.meta.filter(Boolean).join('<span class="sep">·</span>')}</span>
              </span>
            </${x.href ? 'a' : 'div'}>
          </li>`).join('')}
      </ul>
    </section>`;
}

function subjectCard(subject) {
  const st = stats(subject);
  const big = bigNumber(st.left, plural(st.left ?? 0, 'skip', 'skips'));
  const att = st.attendance == null ? 'Nothing logged yet' : `${st.attendance}% attendance`;
  const last = st.todays.at(-1);
  const todayChip = last
    ? `<span class="chip status-${last.status}">Today: ${STATUS[last.status].label}${st.todays.length > 1 ? ` ×${st.todays.length}` : ''}</span>`
    : '';
  const id = esc(subject.id);
  return `
    <article class="card level-${st.level}" style="--c:${subject.color}">
      <a class="card-main" href="#/s/${encodeURIComponent(subject.id)}">
        <div class="card-top">
          ${avatar(subject)}
          <div class="card-title">
            <h2>${esc(subject.name)}</h2>
            <p class="meta">${att}${todayChip}</p>
          </div>
          <div class="count">
            <span class="count-num ${flash?.subjectId === subject.id ? 'bump' : ''}">${big.num}</span>
            <span class="count-label">${big.label}</span>
          </div>
        </div>
        ${meters(st)}
      </a>
      <div class="card-actions ${hasSchedule(subject.id) ? 'two' : ''}">
        ${hasSchedule(subject.id) ? '' : `<button class="btn soft present" data-action="log" data-id="${id}" data-status="present">${icons.check}Attended</button>`}
        <button class="btn soft skip" data-action="log" data-id="${id}" data-status="absent">${icons.skip}Skipped</button>
        <button class="btn soft excused" data-action="log" data-id="${id}" data-status="excused">${icons.shield}Excused</button>
      </div>
    </article>`;
}

// Compact row for subjects whose attendance isn't checked (lectures).
function freeRow(subject) {
  const st = stats(subject);
  return `
    <li>
      <a class="free-row" href="#/s/${encodeURIComponent(subject.id)}">
        ${avatar(subject, 'small')}
        <span class="free-name">${esc(subject.name)}</span>
        <span class="free-count">${st.absent ? `${st.absent} ${plural(st.absent, 'skip', 'skips')}` : ''}</span>
        ${icons.next}
      </a>
    </li>`;
}

function viewHome() {
  const header = `
    <header class="topbar">
      <h1 class="brand">${logo}SkipCount</h1>
    </header>`;

  if (!state.subjects.length) {
    return `${header}
      <section class="empty">
        <div class="empty-art">${logo}</div>
        <h2>Know exactly how many classes you can skip</h2>
        <p>Import your timetable or add subjects by hand, then tap <b>Attended</b>, <b>Skipped</b> or <b>Excused</b> after each class.</p>
        <button class="btn primary big" data-action="import-ics">${icons.upload}Import timetable (.ics)</button>
        <button class="btn ghost" data-action="add-subject">${icons.plus}Add a subject manually</button>
        <p class="empty-foot">Your data stays on this device. No account needed.</p>
      </section>`;
  }

  const tracked = state.subjects.filter((s) => s.tracked);
  const free = state.subjects.filter((s) => !s.tracked);
  const all = tracked.map((s) => ({ s, st: stats(s) }));
  const names = (test) => all.filter((x) => test(x.st)).map((x) => x.s.name);
  const list = (arr) => esc(arr.length > 2 ? `${arr.slice(0, 2).join(', ')} +${arr.length - 2}` : arr.join(' and '));
  const over = names((st) => st.level === 'over');
  const excusedOver = names((st) => st.excusedLevel === 'over');
  const zero = names((st) => st.level === 'zero');
  const warn = names((st) => st.level === 'warn');
  let headline;
  if (over.length) headline = { level: 'over', text: `Over the limit in ${list(over)}` };
  else if (excusedOver.length) headline = { level: 'over', text: `Too many excused in ${list(excusedOver)}` };
  else if (zero.length) headline = { level: 'zero', text: `No skips left in ${list(zero)}` };
  else if (warn.length) headline = { level: 'warn', text: `Running low in ${list(warn)}` };
  else headline = { level: 'ok', text: "You're safe in every subject" };

  const totals = all.reduce((acc, { st }) => {
    acc.absent += st.absent;
    acc.excused += st.excused;
    acc.attended += st.present + st.excused;
    acc.logged += st.logged;
    return acc;
  }, { absent: 0, excused: 0, attended: 0, logged: 0 });
  const overall = totals.logged ? `${Math.round((totals.attended / totals.logged) * 100)}%` : '—';
  const dateLine = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return `${header}
    <section class="summary level-${headline.level}">
      <p class="summary-date">${esc(dateLine)}</p>
      <p class="summary-headline">${headline.text}</p>
      <div class="tiles">
        <div class="tile t-skip ${totals.absent ? 'has' : ''}"><span class="tile-num">${totals.absent}</span><span class="tile-label">${plural(totals.absent, 'skip', 'skips')}</span></div>
        <div class="tile t-excused ${totals.excused ? 'has' : ''}"><span class="tile-num">${totals.excused}</span><span class="tile-label">excused</span></div>
        <div class="tile t-present"><span class="tile-num">${overall}</span><span class="tile-label">attendance</span></div>
      </div>
      ${semesterBar()}
    </section>
    ${todayWidget()}
    ${examsCard()}
    ${todoCard()}
    ${tracked.length ? `<h2 class="section-title">Subjects</h2>
    <section class="list">${tracked.map(subjectCard).join('')}</section>` : ''}
    ${free.length ? `<h2 class="section-title">Not checked <span class="title-note">· skips don't count</span></h2>
    <ul class="free-list">${free.map(freeRow).join('')}</ul>` : ''}
    <button class="btn ghost add-more" data-action="add-subject">${icons.plus}Add subject</button>`;
}

// Course rules card: points so far, what's needed to pass, assessments with dates, grade scale, notes.
const openScales = new Set(); // subjects whose grade table is expanded

function courseInfo(subject) {
  const c = subject.course;
  const id = esc(subject.id);
  if (!c) {
    return `
      <section>
        <h2 class="section-title">Course rules</h2>
        <button class="course-empty" data-action="edit-course" data-id="${id}">
          ${icons.book}
          <span><b>Add how this course is graded</b><small>Tests, points to pass, grade scale, notes — so you don't have to open the PDF.</small></span>
        </button>
      </section>`;
  }
  const s = courseStatus(c, classDates(subject.id));
  let headline = '';
  if (c.passPoints != null || s.max) {
    const of = c.passPoints != null ? `pass at ${c.passPoints}` : `of ${s.max}`;
    const state = !s.scored ? 'Nothing scored yet'
      : s.belowMin.length ? `Below the minimum in ${s.belowMin.map((it) => it.title).join(', ')}`
      : s.passed ? `Passing${s.grade ? ` · grade ${s.grade}` : ''}`
      : s.needed ? `${s.needed} more to pass${s.grade ? ` · now ${s.grade}` : ''}` : '';
    headline = `
      <div class="course-head ${s.passed ? 'is-ok' : s.belowMin.length ? 'is-bad' : ''}">
        <span class="course-total"><b>${s.total}</b>${s.max ? ` / ${s.max}` : ''} pts</span>
        <span class="course-state">${esc(state)}<small>${esc(of)}${c.bonusMax ? ` · up to +${c.bonusMax} bonus` : ''}</small></span>
      </div>
      ${c.passPoints ? `<div class="term-bar course-bar"><span style="width:${Math.min(100, (s.total / (s.max || c.passPoints)) * 100)}%"></span><i style="left:${Math.min(100, (c.passPoints / (s.max || c.passPoints)) * 100)}%"></i></div>` : ''}`;
  }
  const items = s.items.map((it) => {
    const when = it.when ? `${it.classNo ? `Class ${it.classNo} · ` : ''}${formatDate(it.when)}` : it.classNo ? `Class ${it.classNo}` : '';
    const low = it.min != null && it.score != null && it.score < it.min;
    return `
      <li class="course-item">
        <div class="course-item-main">
          <span class="course-item-title">${esc(it.title)}</span>
          <span class="course-item-meta">${[when && esc(when), it.min != null && `min ${it.min}`].filter(Boolean).join('<span class="sep">·</span>')}</span>
          ${it.note ? `<span class="course-item-note">${esc(it.note)}</span>` : ''}
        </div>
        <label class="score ${low ? 'is-low' : ''}">
          <input type="number" inputmode="decimal" step="0.5" min="0" value="${it.score ?? ''}" placeholder="–" data-score="${esc(it.id)}" data-subject="${id}" aria-label="Your points for ${esc(it.title)}">
          ${it.max != null ? `<span>/ ${it.max}</span>` : ''}
        </label>
      </li>`;
  }).join('');
  const scaleOpen = openScales.has(subject.id);
  const scale = c.scale.length ? `
    <button class="course-scale-toggle" data-action="toggle-scale" data-id="${id}">Grade scale ${scaleOpen ? icons.up : icons.down}</button>
    ${scaleOpen ? `<table class="course-scale"><tbody>${c.scale.map((b, i) => `
      <tr class="${s.scored && s.grade === b.grade ? 'is-now' : ''}"><td>${b.from}${c.scale[i + 1] ? `–${c.scale[i + 1].from}` : '+'} pts</td><td>${esc(b.grade)}</td></tr>`).join('')}
    </tbody></table>` : ''}` : '';
  return `
    <section>
      <h2 class="section-title section-with-action">Course rules <button class="link-btn" data-action="edit-course" data-id="${id}">Edit</button></h2>
      <div class="course">
        ${headline}
        ${items ? `<ul class="course-items">${items}</ul>` : ''}
        ${scale}
        ${c.notes ? `<p class="course-notes">${esc(c.notes)}</p>` : ''}
      </div>
    </section>`;
}

function subjectTasks(subject) {
  const list = sortedTasks(state.tasks.filter((t) => t.subjectId === subject.id));
  const open = list.filter((t) => !t.done);
  const done = list.filter((t) => t.done);
  return `
    <section>
      <h2 class="section-title section-with-action">Tasks <button class="link-btn" data-action="add-task" data-id="${esc(subject.id)}">${icons.plus}Add</button></h2>
      ${open.length || done.length
        ? `<ul class="task-card">${[...open, ...done.slice(0, 5)].map((t) => taskLine(t, true)).join('')}</ul>`
        : '<p class="day-empty">Homework, things to bring, optional stuff — add it here or with the bookmark button on a class.</p>'}
    </section>`;
}

function scheduleInfo(subject) {
  const events = state.events.filter((e) => e.subjectId === subject.id);
  if (!events.length) return '';
  const next = upcomingEvents((e) => e.subjectId === subject.id)[0];
  const rooms = [...new Set(events.map((e) => e.room).filter(Boolean))].slice(0, 3);
  const exam = upcomingEvents((e) => e.exam && e.code === subject.code)[0];
  const row = (icon, label, value) => `<li><span class="sched-icon">${icon}</span><span class="sched-label">${label}</span><span class="sched-value">${value}</span></li>`;
  return `
    <section>
      <h2 class="section-title">Schedule</h2>
      <ul class="sched">
        ${row(icons.clock, 'Weekly', esc(weeklySlots(subject.id).join(', ') || '—'))}
        ${rooms.length ? row(icons.pin, 'Room', esc(rooms.join(', '))) : ''}
        ${row(icons.calendar, 'Next', next ? `${esc(formatDate(next.date))}, ${hm(next.start)}` : 'No more classes')}
        ${exam ? row(icons.shield, 'Exam', `${esc(formatDate(exam.date))}, ${hm(exam.start)}${exam.room ? ` · ${esc(exam.room)}` : ''}`) : ''}
      </ul>
      <button class="btn ghost sched-cal" data-action="subject-calendar" data-id="${esc(subject.id)}">${icons.calendar}Open in calendar</button>
    </section>`;
}

function viewSubject(subject) {
  const st = stats(subject);
  const skipBig = bigNumber(st.left, plural(st.left ?? 0, 'skip', 'skips'));
  const excusedBig = bigNumber(st.excusedLeft, 'excused');
  const records = state.records
    .filter((r) => r.subjectId === subject.id)
    .sort((a, b) => (a.date === b.date ? b.at - a.at : a.date < b.date ? 1 : -1));

  let advice;
  if (!subject.tracked) advice = "Attendance isn't checked here — skips are only for your own record and don't count anywhere.";
  else if (st.level === 'none') advice = 'Set a limit to see how many classes you can skip.';
  else if (st.level === 'over') advice = `You've skipped ${-st.left} more than allowed. Talk to your teacher about making it up.`;
  else if (st.level === 'zero') advice = 'Next skip puts you over the limit.';
  else if (st.level === 'warn') advice = `Only ${st.left} left — save ${plural(st.left, 'it', 'them')} for when you really need ${plural(st.left, 'it', 'them')}.`;
  else advice = `You can still skip ${st.left} ${plural(st.left, 'class', 'classes')}.`;
  if (st.excusedLevel === 'over') advice += ` Excused limit exceeded by ${-st.excusedLeft}.`;

  const cell = (num, label, cls = '') => `<div class="stat ${cls}"><span class="stat-num">${num}</span><span class="stat-label">${label}</span></div>`;
  const id = esc(subject.id);
  const scheduled = hasSchedule(subject.id);
  const logBtn = (status, cls, icon) => `<button class="btn soft ${cls}" data-action="log" data-id="${id}" data-status="${status}">${icon}${STATUS[status].label}</button>`;
  // Timetable classes are attended by default; untracked subjects only keep optional skips.
  const logButtons = [
    !scheduled && subject.tracked ? logBtn('present', 'present', icons.check) : '',
    logBtn('absent', 'skip', icons.skip),
    subject.tracked ? logBtn('excused', 'excused', icons.shield) : '',
  ].filter(Boolean);
  const big = subject.tracked ? skipBig : { num: String(st.absent), label: plural(st.absent, 'skip', 'skips') };

  const history = records.length
    ? records.map((r) => `
        <li>
          <button class="history-row" data-action="edit-record" data-id="${esc(r.id)}">
            <span class="history-mark status-${r.status}"></span>
            <span class="history-date">${esc(formatDate(r.date))}</span>
            <span class="history-note">${esc(r.note)}</span>
            <span class="chip status-${r.status}">${STATUS[r.status].label}</span>
          </button>
        </li>`).join('')
    : '<li class="history-empty">No classes logged yet.</li>';

  const heroCount = (big, kind, level) => `
    <div class="hero-count lvl-${level} kind-${kind}">
      <span class="hero-num ${flash?.subjectId === subject.id ? 'bump' : ''}">${big.num}</span>
      <span class="hero-label">${big.label}</span>
    </div>`;

  return `
    <header class="topbar">
      <a class="icon-btn" href="#/" aria-label="Back">${icons.back}</a>
      <h1 class="topbar-title"><span class="dot" style="--c:${subject.color}"></span>${esc(subject.name)}</h1>
      <button class="icon-btn" data-action="edit-subject" data-id="${id}" aria-label="Edit subject">${icons.edit}</button>
    </header>

    <section class="hero level-${st.level}" style="--c:${subject.color}">
      <div class="hero-counts ${st.excusedAllowed != null ? 'two' : ''}">
        ${heroCount(big, 'skip', st.level)}
        ${st.excusedAllowed != null ? heroCount(excusedBig, 'excused', st.excusedLevel) : ''}
      </div>
      <p class="badge level-${st.level}">${subject.tracked ? LEVEL_TEXT[st.level] : 'Not checked'}</p>
      ${meters(st)}
      <p class="hero-advice">${advice}</p>
    </section>

    <section class="stats">
      ${cell(st.present, 'attended')}
      ${cell(st.absent, 'skipped', st.absent ? 's-skip has' : '')}
      ${cell(st.excused, 'excused', st.excused ? 's-excused has' : '')}
      ${cell(st.attendance == null ? '—' : `${st.attendance}%`, 'attendance')}
      ${cell(st.remaining == null ? '—' : st.remaining, 'classes left')}
      ${cell(st.logged, 'logged')}
    </section>
    <p class="limit-line">${icons.shield}${esc(limitText(subject, st))}</p>

    ${courseInfo(subject)}

    ${subjectTasks(subject)}

    ${scheduleInfo(subject)}

    <section class="log-today">
      <h2 class="section-title">Log today</h2>
      <div class="log-buttons n-${logButtons.length}">${logButtons.join('')}</div>
      ${scheduled && subject.tracked ? '<p class="log-tip">Timetable classes count as attended unless you mark them.</p>' : ''}
      <button class="btn ghost" data-action="add-record" data-id="${id}">${icons.calendar}Log another date</button>
    </section>

    <section>
      <h2 class="section-title">History</h2>
      <ul class="history">${history}</ul>
    </section>`;
}

function viewSettings() {
  const theme = state.settings.theme;
  const opt = (value, label) => `<label><input type="radio" name="theme" value="${value}" ${theme === value ? 'checked' : ''} data-action="theme"><span>${label}</span></label>`;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return `
    <header class="topbar">
      <h1 class="brand">Settings</h1>
    </header>

    <section class="panel">
      <h2 class="section-title">Timetable</h2>
      <p class="panel-text">${state.events.length
        ? `${state.events.length} classes imported. Import again anytime to update — existing subjects are matched by code and type, and your logged classes stay.`
        : 'Import an .ics calendar (e.g. from your university plan) to create subjects and see your classes.'}</p>
      <div class="panel-buttons">
        <button class="btn soft" data-action="import-ics">${icons.upload}Import .ics</button>
        ${state.events.length ? '<button class="btn ghost danger" data-action="clear-schedule">Remove timetable</button>' : ''}
      </div>
    </section>

    <section class="panel">
      <h2 class="section-title">Appearance</h2>
      <div class="segmented three">${opt('auto', 'Auto')}${opt('light', 'Light')}${opt('dark', 'Dark')}</div>
    </section>

    ${state.subjects.length ? `
    <section class="panel">
      <h2 class="section-title">Course rules</h2>
      <p class="panel-text">Add rules by hand on each subject page, or import a prepared course-rules file (.json) to fill several subjects at once. Your points are kept.</p>
      <div class="panel-buttons">
        <button class="btn soft" data-action="import-course">${icons.book}Import course rules</button>
      </div>
    </section>` : ''}

    <section class="panel">
      <h2 class="section-title">Backup</h2>
      <p class="panel-text">Data is stored only on this device. Export a backup before switching phones or clearing Safari data.</p>
      <div class="panel-buttons">
        <button class="btn soft" data-action="export">Export backup</button>
        <button class="btn soft" data-action="import">Import backup</button>
      </div>
    </section>

    <section class="panel">
      <h2 class="section-title">New semester</h2>
      <p class="panel-text">Clear all logged classes but keep your subjects and limits.</p>
      <div class="panel-buttons">
        <button class="btn soft" data-action="clear-records">Clear history</button>
        <button class="btn ghost danger" data-action="reset">Delete everything</button>
      </div>
    </section>

    ${standalone ? '' : `
    <section class="panel">
      <h2 class="section-title">Install on iPhone</h2>
      <ol class="steps">
        <li>Open this page in <b>Safari</b>.</li>
        <li>Tap the <b>Share</b> button.</li>
        <li>Choose <b>Add to Home Screen</b>.</li>
      </ol>
      <p class="panel-text">It opens full-screen like a normal app and works offline.</p>
    </section>`}

    <p class="about">SkipCount ${APP_VERSION} · works offline · no account</p>`;
}

// ---------- calendar ----------

const cal = { month: null, day: null, filter: null };

function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return toISO(d).slice(0, 7);
}

const isTracked = (subjectId) => getSubject(subjectId)?.tracked !== false;

function dayDots(entries) {
  const dots = entries.map((x) => {
    if (x.rec) return `status-${x.rec.status}`;
    if (x.ev.exam) return 'exam';
    if (isTracked(x.ev.subjectId) && isAutoAttended(x)) return 'status-present auto';
    return 'planned';
  });
  // One row of at most 4 marks; skips, excused and exams go first so they never get hidden.
  const rank = (cls) => ['status-absent', 'status-excused', 'exam'].findIndex((c) => cls.startsWith(c)) >>> 0;
  dots.sort((a, b) => rank(a) - rank(b));
  const fits = dots.length <= 4;
  const shown = dots.slice(0, fits ? 4 : 3).map((cls) => `<i class="d ${cls}"></i>`).join('');
  return shown + (fits ? '' : '<i class="d more"></i>');
}

function viewCalendar() {
  const today = todayISO();
  if (cal.filter && !getSubject(cal.filter)) cal.filter = null;
  cal.day ??= today;
  cal.month ??= cal.day.slice(0, 7);
  const [y, m] = cal.month.split('-').map(Number);
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(y, m, 0).getDate();

  const counts = { present: 0, absent: 0, excused: 0 };
  let cells = '<span class="cal-cell pad"></span>'.repeat(offset);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${cal.month}-${String(d).padStart(2, '0')}`;
    const entries = dayEntries(iso, cal.filter);
    for (const x of entries) {
      if (!isTracked(x.ev?.subjectId ?? x.rec?.subjectId)) continue; // lectures etc. don't count
      if (x.rec) counts[x.rec.status]++;
      else if (isAutoAttended(x)) counts.present++;
    }
    const cls = [
      'cal-cell',
      iso === today ? 'is-today' : '',
      iso === cal.day ? 'is-selected' : '',
      iso > today ? 'is-future' : '',
    ].join(' ');
    cells += `<button class="${cls}" data-action="cal-day" data-date="${iso}">
        <span class="cal-num">${d}</span><span class="dots">${dayDots(entries)}</span>
      </button>`;
  }

  const chip = (id, label, color) => `<button class="filter-chip ${cal.filter === id ? 'active' : ''}" data-action="cal-filter" data-id="${id ?? ''}" style="--c:${color}">${label}</button>`;
  const filters = state.subjects.length > 1
    ? `<div class="filters">${chip(null, 'All', 'var(--accent)')}${state.subjects.map((s) => chip(s.id, esc(s.name), s.color)).join('')}</div>`
    : '';

  const dayList = dayEntries(cal.day, cal.filter);
  const summaryItem = (n, label, cls) => `<span class="cal-stat ${cls} ${n ? 'has' : ''}"><b>${n}</b> ${label}</span>`;

  return `
    <header class="topbar">
      <h1 class="brand">Calendar</h1>
      ${cal.month !== today.slice(0, 7) || cal.day !== today ? '<button class="btn ghost slim" data-action="cal-today">Today</button>' : ''}
    </header>
    ${filters}
    <section class="cal">
      <div class="cal-head">
        <button class="icon-btn" data-action="cal-month" data-delta="-1" aria-label="Previous month">${icons.prev}</button>
        <h2>${monthLabel(cal.month)}</h2>
        <button class="icon-btn" data-action="cal-month" data-delta="1" aria-label="Next month">${icons.next}</button>
      </div>
      <div class="cal-grid cal-weekdays">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="cal-grid cal-days">${cells}</div>
      <div class="cal-summary">
        ${summaryItem(counts.present, 'attended', 'status-present')}
        ${summaryItem(counts.absent, 'skipped', 'status-absent')}
        ${summaryItem(counts.excused, 'excused', 'status-excused')}
      </div>
    </section>

    <section class="day-list">
      <h2 class="section-title">${esc(longDate(cal.day))}</h2>
      ${dayList.length
        ? `<ul class="entries boxed">${dayList.map((x) => entryRow(x)).join('')}</ul>`
        : '<p class="day-empty">No classes on this day.</p>'}
      ${state.subjects.length ? `<button class="btn ghost day-add" data-action="add-record" data-date="${cal.day}" data-id="${esc(cal.filter ?? '')}">${icons.plus}Log a class on this day</button>` : ''}
    </section>`;
}

function render() {
  statsCache.clear(); // time moves on: classes that just ended become attended
  const app = $('#app');
  const hash = location.hash.slice(1) || '/';
  const subjectMatch = hash.match(/^\/s\/(.+)$/);
  let tab = 'home';
  if (subjectMatch) {
    const subject = getSubject(decodeURIComponent(subjectMatch[1]));
    if (!subject) {
      location.replace('#/');
      return;
    }
    app.innerHTML = viewSubject(subject);
  } else if (hash === '/settings') {
    tab = 'settings';
    app.innerHTML = viewSettings();
  } else if (hash === '/calendar') {
    tab = 'calendar';
    app.innerHTML = viewCalendar();
  } else {
    app.innerHTML = viewHome();
  }
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
  moveTabIndicator();
}

// ---------- toast ----------

let toastTimer;
function toast(message, undo) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(message)}</span>${undo ? '<button type="button">Undo</button>' : ''}`;
  if (undo) {
    el.querySelector('button').onclick = () => {
      undo();
      el.classList.remove('show');
    };
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), undo ? 5000 : 2500);
}

// ---------- actions ----------

// What was just logged, so the next render can animate it once.
let flash = null;

function logClass(subjectId, status, date = todayISO(), note = '', eventUid = null) {
  const subject = getSubject(subjectId);
  if (!subject) return;
  const record = { id: uid(), subjectId, date, status, note, at: Date.now(), ...(eventUid ? { eventUid } : {}) };
  state.records.push(record);
  save();
  flash = { recordId: record.id, subjectId };
  render();
  flash = null;
  const st = stats(subject);
  let msg = `${STATUS[status].verb} · ${subject.name}`;
  if (status === 'absent' && st.left != null) {
    msg = st.left < 0 ? `Skipped · ${subject.name} — over the limit!`
      : `Skipped · ${st.left} ${plural(st.left, 'skip', 'skips')} left`;
  } else if (status === 'excused' && st.excusedLeft != null) {
    msg = st.excusedLeft < 0 ? `Excused · ${subject.name} — over the excused limit!`
      : `Excused · ${st.excusedLeft} excused left`;
  }
  toast(msg, () => {
    state.records = state.records.filter((r) => r.id !== record.id);
    save();
    render();
  });
}

// Subject dialog

const subjectDialog = $('#subject-dialog');
const subjectForm = $('#subject-form');
let editingSubjectId = null;

function renderSwatches(selected) {
  const custom = !COLORS.includes(selected);
  const customValue = custom ? selected : '#ff6b9a';
  $('#swatches').innerHTML = COLORS.map((c, i) => `
    <label class="swatch" style="--c:${c}">
      <input type="radio" name="color" value="${c}" ${c === selected ? 'checked' : ''} aria-label="Color ${i + 1}">
      <span></span>
    </label>`).join('') + `
    <label class="swatch custom" style="--c:${customValue}" title="Custom color">
      <input type="radio" name="color" value="custom" ${custom ? 'checked' : ''} aria-label="Custom color">
      <span></span>
      <input type="color" name="customColor" value="${customValue}" aria-label="Pick a custom color">
    </label>`;
}

function selectedColor() {
  const f = subjectForm.elements;
  const value = f.color.value === 'custom' ? f.customColor.value : f.color.value;
  return isHex(value) ? value.toLowerCase() : COLORS[0];
}

function updateSubjectHint() {
  const f = subjectForm.elements;
  const type = f.limitType.value;
  const value = clampInt(f.limitValue.value, 0, type === 'percent' ? 100 : 999, null);
  const excused = clampInt(f.excusedLimit.value, 0, 999, null);
  const total = clampInt(f.total.value, 1, 999, null);
  $('#limit-label').textContent = type === 'percent' ? 'Min attendance, %' : 'Skips allowed';
  f.limitValue.placeholder = type === 'percent' ? '75' : '4';
  f.limitValue.max = type === 'percent' ? 100 : 999;
  $('#total-optional').textContent = type === 'percent' ? 'required' : 'optional';
  const extra = excused != null ? ` + ${excused} excused` : '';
  let hint = '';
  if (value != null) {
    if (type === 'count') {
      hint = `You can skip ${value} ${plural(value, 'class', 'classes')}${extra}${total ? ` out of ${total}` : ''}.`;
    } else if (total) {
      const allowed = Math.floor(total * (100 - value) / 100);
      hint = `Attend ${value}% of ${total} → you can skip ${allowed} ${plural(allowed, 'class', 'classes')}${extra}.`;
    } else {
      hint = 'Enter the total number of classes to calculate your skips.';
    }
  }
  const tracked = f.tracked.checked;
  $('#limit-fields').hidden = !tracked;
  $('#subject-hint').textContent = tracked ? hint : "Skips are kept for your own record only and don't count anywhere.";
  $('#subject-error').hidden = true;
}

const lastLimits = () => state.subjects.filter((s) => s.tracked).at(-1) ?? DEFAULT_LIMITS;

function openSubjectDialog(subject) {
  editingSubjectId = subject?.id ?? null;
  subjectForm.reset();
  $('#subject-title').textContent = subject ? 'Edit subject' : 'New subject';
  $('#subject-delete').hidden = !subject;
  const f = subjectForm.elements;
  const usedColors = new Set(state.subjects.map((s) => s.color));
  renderSwatches(subject?.color ?? COLORS.find((c) => !usedColors.has(c)) ?? COLORS[0]);
  // New subjects start with the limits of the last one added (most subjects share them).
  const src = subject ?? lastLimits();
  if (subject) f.name.value = subject.name;
  f.tracked.checked = subject ? subject.tracked : true;
  f.limitType.value = src.limitType;
  f.limitValue.value = src.limitValue;
  f.excusedLimit.value = src.excusedLimit ?? '';
  f.total.value = src.total ?? '';
  updateSubjectHint();
  subjectDialog.showModal();
  if (!subject) setTimeout(() => f.name.focus(), 50);
}

subjectForm.addEventListener('input', (e) => {
  if (e.target.name === 'customColor') {
    e.target.closest('.swatch').style.setProperty('--c', e.target.value);
    subjectForm.elements.color.value = 'custom';
  }
  updateSubjectHint();
});

subjectForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = subjectForm.elements;
  const type = f.limitType.value;
  const name = f.name.value.trim();
  const limitValue = clampInt(f.limitValue.value, 0, type === 'percent' ? 100 : 999, null);
  const excusedLimit = clampInt(f.excusedLimit.value, 0, 999, null);
  const total = clampInt(f.total.value, 1, 999, null);
  const fail = (msg) => {
    const el = $('#subject-error');
    el.textContent = msg;
    el.hidden = false;
  };
  const tracked = f.tracked.checked;
  if (!name) return fail('Give the subject a name.');
  if (tracked && limitValue == null) return fail(type === 'percent' ? 'Enter the minimum attendance percentage.' : 'Enter how many classes you can skip.');
  if (tracked && type === 'percent' && !total) return fail('Percentage limits need the total number of classes.');

  const data = { name, color: selectedColor(), tracked, limitType: type, limitValue: limitValue ?? 0, excusedLimit, total };
  if (editingSubjectId) {
    Object.assign(getSubject(editingSubjectId), data);
  } else {
    state.subjects.push({ id: uid(), createdAt: Date.now(), ...data });
  }
  save();
  closeSheet(subjectDialog);
  render();
});

$('#subject-delete').addEventListener('click', () => {
  const subject = getSubject(editingSubjectId);
  if (!subject) return;
  if (!confirm(`Delete "${subject.name}" and all its history?`)) return;
  state.subjects = state.subjects.filter((s) => s.id !== subject.id);
  state.records = state.records.filter((r) => r.subjectId !== subject.id);
  state.events = state.events.filter((e) => e.subjectId !== subject.id);
  state.tasks = state.tasks.filter((t) => t.subjectId !== subject.id);
  save();
  closeSheet(subjectDialog);
  location.hash = '#/';
  render();
});

// Record dialog

const recordDialog = $('#record-dialog');
const recordForm = $('#record-form');
let editingRecord = null; // { id } when editing, { subjectId } when adding

// subjectId: fixed subject; without it (calendar) the dialog shows a subject picker.
function openRecordDialog({ record, subjectId, date }) {
  editingRecord = record ? { id: record.id } : { subjectId: subjectId || null };
  recordForm.reset();
  const f = recordForm.elements;
  $('#record-title').textContent = record ? 'Edit class' : 'Log a class';
  $('#record-delete').hidden = !record;
  const pickSubject = !record && !subjectId;
  $('#record-subject-field').hidden = !pickSubject;
  if (pickSubject) {
    f.subjectId.innerHTML = state.subjects.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
  }
  f.date.max = todayISO();
  f.date.value = record?.date ?? date ?? todayISO();
  f.status.value = record?.status ?? 'absent';
  f.note.value = record?.note ?? '';
  recordDialog.showModal();
}

recordForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = recordForm.elements;
  const date = f.date.value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const status = f.status.value;
  const note = f.note.value.trim().slice(0, 200);
  if (editingRecord.id) {
    const rec = state.records.find((r) => r.id === editingRecord.id);
    if (rec) {
      if (rec.date !== date) delete rec.eventUid; // moved to another day: no longer tied to that class
      Object.assign(rec, { date, status, note });
    }
    save();
    closeSheet(recordDialog);
    render();
  } else {
    closeSheet(recordDialog);
    logClass(editingRecord.subjectId || f.subjectId.value, status, date, note);
  }
});

$('#record-delete').addEventListener('click', () => {
  const rec = state.records.find((r) => r.id === editingRecord?.id);
  if (!rec) return;
  state.records = state.records.filter((r) => r.id !== rec.id);
  save();
  closeSheet(recordDialog);
  render();
  toast('Class deleted', () => {
    state.records.push(rec);
    save();
    render();
  });
});

// Timetable import (.ics)

const importDialog = $('#import-dialog');
const importForm = $('#import-form');
let pendingImport = null; // classified events from the chosen file

function importRange() {
  return importForm.elements.range.value === 'future' ? todayISO() : '0000-00-00';
}

function renderImportGroups() {
  const from = importRange();
  const events = pendingImport.filter((e) => e.date >= from);
  // Keep what the user unticked; groups that newly appear start ticked.
  const unchecked = new Set([...importForm.querySelectorAll('input[name="group"]:not(:checked)')].map((i) => i.value));
  const groups = new Map();
  for (const e of events) {
    if (e.exam) continue;
    const g = groups.get(e.key) ?? { key: e.key, name: e.defaultName, events: [] };
    g.events.push(e);
    groups.set(e.key, g);
  }
  const exams = events.filter((e) => e.exam).length;
  const dates = events.map((e) => e.date).sort();
  $('#import-summary').textContent = events.length
    ? `${events.length} classes · ${formatDate(dates[0])} – ${formatDate(dates.at(-1))} · ${groups.size} subjects${exams ? ` · ${exams} exams` : ''}`
    : 'No classes in this range.';

  $('#import-groups').innerHTML = [...groups.values()].map((g) => {
    const existing = state.subjects.find((s) => s.icsKey === g.key);
    const slots = new Map();
    for (const e of g.events) {
      const k = `${weekday(e.start)} ${hm(e.start)}`;
      slots.set(k, (slots.get(k) || 0) + 1);
    }
    const slotText = [...slots].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k).join(', ');
    const rooms = [...new Set(g.events.map((e) => e.room).filter(Boolean))].slice(0, 2).join(', ');
    const isChecked = !unchecked.has(g.key);
    return `
      <label class="import-group">
        <input type="checkbox" name="group" value="${esc(g.key)}" ${isChecked ? 'checked' : ''}>
        <span class="import-check"></span>
        <span class="import-body">
          <span class="import-name">${esc(existing?.name ?? g.name)}${existing ? '<em>update</em>' : ''}${!existing && isLecture(g.events[0]) ? '<em class="free">not checked</em>' : ''}</span>
          <span class="import-meta">${g.events.length} ${plural(g.events.length, 'class', 'classes')} · ${esc(slotText)}${rooms ? ` · ${esc(rooms)}` : ''}</span>
        </span>
      </label>`;
  }).join('');
}

// Attendance isn't checked at lectures, so imported lectures start as "not checked".
const isLecture = (ev) => ev.typeLabel === 'Lecture';

function openImportDialog(events) {
  pendingImport = events.map((e) => ({ ...e, date: toISO(new Date(e.start)) }));
  importForm.reset();
  $('#import-groups').innerHTML = '';
  // Default to upcoming classes when the file still has some.
  importForm.elements.range.value = pendingImport.some((e) => e.date >= todayISO()) ? 'future' : 'all';
  renderImportGroups();
  importDialog.showModal();
}

importForm.addEventListener('change', (e) => {
  if (e.target.name === 'range') renderImportGroups();
});

importForm.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-select]');
  if (!btn) return;
  const on = btn.dataset.select === 'all';
  importForm.querySelectorAll('input[name="group"]').forEach((i) => { i.checked = on; });
});

importForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const from = importRange();
  const keys = new Set([...importForm.querySelectorAll('input[name="group"]:checked')].map((i) => i.value));
  const events = pendingImport.filter((ev) => ev.date >= from && (ev.exam || keys.has(ev.key)));
  if (!keys.size) {
    toast('Pick at least one subject');
    return;
  }

  const usedColors = new Set(state.subjects.map((s) => s.color));
  const limits = lastLimits();
  const incoming = new Set(events.map((ev) => ev.uid));
  state.events = state.events.filter((ev) => !incoming.has(ev.uid));
  let created = 0;

  for (const key of keys) {
    const group = events.filter((ev) => ev.key === key && !ev.exam);
    if (!group.length) continue;
    let subject = state.subjects.find((s) => s.icsKey === key);
    if (!subject) {
      const color = COLORS.find((c) => !usedColors.has(c)) ?? COLORS[state.subjects.length % COLORS.length];
      usedColors.add(color);
      subject = {
        id: uid(),
        createdAt: Date.now(),
        name: group[0].defaultName,
        code: group[0].code,
        icsKey: key,
        color,
        tracked: !isLecture(group[0]),
        limitType: limits.limitType,
        limitValue: limits.limitValue,
        excusedLimit: limits.excusedLimit ?? null,
        total: null,
      };
      state.subjects.push(subject);
      created++;
    }
    // Replace this subject's classes in the imported range with the fresh ones.
    state.events = state.events.filter((ev) => !(ev.subjectId === subject.id && ev.date >= from));
    for (const ev of group) state.events.push(storedEvent(ev, subject.id));
    subject.total = state.events.filter((ev) => ev.subjectId === subject.id).length;
  }
  for (const ev of events.filter((x) => x.exam)) state.events.push(storedEvent(ev, null));

  save();
  closeSheet(importDialog);
  location.hash = '#/';
  render();
  toast(`Imported ${events.length} classes${created ? ` · ${created} new ${plural(created, 'subject', 'subjects')}` : ''}`);
});

function storedEvent(ev, subjectId) {
  const { uid: id, code, typeLabel, room, teacher, exam, start, end, date } = ev;
  return { uid: id, subjectId, code, typeLabel, room, teacher, exam, start, end, date };
}

$('#ics-input').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const events = parseICS(await file.text()).map(classifyEvent);
    if (!events.length) throw new Error('No classes found in this file.');
    openImportDialog(events);
  } catch (err) {
    toast(err.message);
  }
});

// Tasks

const taskDialog = $('#task-dialog');
const taskForm = $('#task-form');
let editingTask = null; // task id when editing

// "Due" choices: the subject's upcoming classes, a custom date, or nothing.
function fillTaskWhen(subjectId, selected) {
  const f = taskForm.elements;
  const classes = upcomingEvents((e) => e.subjectId === subjectId).slice(0, 12);
  const current = selected?.startsWith('ev:') ? eventByUid(selected.slice(3)) : null;
  if (current && !classes.includes(current)) classes.unshift(current);
  f.when.innerHTML = [
    ...classes.map((ev) => `<option value="ev:${esc(ev.uid)}">${esc(formatDate(ev.date))}, ${hm(ev.start)}${ev.room ? ` · ${esc(ev.room)}` : ''}</option>`),
    '<option value="date">On a date…</option>',
    '<option value="none">No due date</option>',
  ].join('');
  f.when.value = selected && [...f.when.options].some((o) => o.value === selected) ? selected : f.when.options[0].value;
  $('#task-date-field').hidden = f.when.value !== 'date';
}

function openTaskDialog({ task, subjectId, eventUid }) {
  editingTask = task?.id ?? null;
  taskForm.reset();
  const f = taskForm.elements;
  $('#task-title').textContent = task ? 'Edit task' : 'New task';
  $('#task-delete').hidden = !task;
  $('#task-error').hidden = true;
  const sid = task?.subjectId ?? subjectId ?? state.subjects[0]?.id;
  f.subjectId.innerHTML = state.subjects.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
  f.subjectId.value = sid;
  const ev = task?.eventUid ?? eventUid;
  fillTaskWhen(sid, ev ? `ev:${ev}` : task?.due ? 'date' : task ? 'none' : null);
  f.due.value = task?.due ?? todayISO();
  f.text.value = task?.text ?? '';
  f.optional.checked = !!task?.optional;
  taskDialog.showModal();
  if (!task) setTimeout(() => f.text.focus(), 50);
}

taskForm.addEventListener('change', (e) => {
  if (e.target.name === 'subjectId') fillTaskWhen(e.target.value, null);
  if (e.target.name === 'when') $('#task-date-field').hidden = e.target.value !== 'date';
});

taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = taskForm.elements;
  const text = f.text.value.trim().slice(0, 500);
  if (!text) {
    $('#task-error').textContent = 'Write what needs to be done.';
    $('#task-error').hidden = false;
    return;
  }
  const when = f.when.value;
  const ev = when.startsWith('ev:') ? eventByUid(when.slice(3)) : null;
  const data = {
    subjectId: f.subjectId.value,
    eventUid: ev?.uid ?? null,
    // Keep the class date too, so the task still has a date if the timetable is removed.
    due: ev ? ev.date : when === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(f.due.value) ? f.due.value : null,
    text,
    optional: f.optional.checked,
  };
  let task = state.tasks.find((t) => t.id === editingTask);
  if (task) Object.assign(task, data);
  else {
    task = { id: uid(), done: false, createdAt: Date.now(), ...data };
    state.tasks.push(task);
  }
  save();
  closeSheet(taskDialog);
  flash = { taskId: task.id };
  render();
  flash = null;
});

$('#task-delete').addEventListener('click', () => {
  const task = state.tasks.find((t) => t.id === editingTask);
  if (!task) return;
  state.tasks = state.tasks.filter((t) => t.id !== task.id);
  save();
  closeSheet(taskDialog);
  render();
  toast('Task deleted', () => {
    state.tasks.push(task);
    save();
    render();
  });
});

function toggleTask(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  task.done = !task.done;
  save();
  flash = { taskId: task.id };
  render();
  flash = null;
  if (task.done) {
    toast('Done ✓', () => {
      task.done = false;
      save();
      render();
    });
  }
}

// Course rules

const courseDialog = $('#course-dialog');
const courseForm = $('#course-form');
let editingCourseFor = null; // subject id

const rowItem = (it = {}) => `
  <div class="rule-row" data-kind="item" data-id="${esc(it.id ?? '')}">
    <input class="rule-title" name="title" maxlength="60" placeholder="e.g. Test, Project, Colloquium" value="${esc(it.title ?? '')}" aria-label="Name">
    <div class="rule-nums">
      <label><span>Max pts</span><input name="max" type="number" inputmode="decimal" step="0.5" min="0" value="${it.max ?? ''}"></label>
      <label><span>Min pts</span><input name="min" type="number" inputmode="decimal" step="0.5" min="0" value="${it.min ?? ''}"></label>
      <label><span>Class #</span><input name="classNo" type="number" inputmode="numeric" min="1" max="99" value="${it.classNo ?? ''}"></label>
      <label><span>or date</span><input name="date" type="date" value="${it.date ?? ''}"></label>
    </div>
    <input class="rule-note" name="note" maxlength="300" placeholder="Note (e.g. retake in class 13)" value="${esc(it.note ?? '')}" aria-label="Note">
    <button type="button" class="rule-remove" data-remove aria-label="Remove">${icons.close}</button>
  </div>`;

const rowScale = (b = {}) => `
  <div class="rule-row scale" data-kind="scale">
    <label><span>From pts</span><input name="from" type="number" inputmode="decimal" step="0.5" min="0" value="${b.from ?? ''}"></label>
    <label><span>Grade</span><input name="grade" maxlength="12" value="${esc(b.grade ?? '')}" placeholder="3.0"></label>
    <button type="button" class="rule-remove" data-remove aria-label="Remove">${icons.close}</button>
  </div>`;

function openCourseDialog(subject) {
  editingCourseFor = subject.id;
  const c = subject.course;
  courseForm.reset();
  const f = courseForm.elements;
  $('#course-title').textContent = `${subject.name} · rules`;
  f.passPoints.value = c?.passPoints ?? '';
  f.bonusMax.value = c?.bonusMax ?? '';
  f.notes.value = c?.notes ?? '';
  $('#course-items').innerHTML = (c?.items.length ? c.items : [{}]).map(rowItem).join('');
  $('#course-scale').innerHTML = (c?.scale ?? []).map(rowScale).join('');
  $('#course-delete').hidden = !c;
  courseDialog.showModal();
}

courseForm.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) {
    const box = add.dataset.add === 'item' ? $('#course-items') : $('#course-scale');
    box.insertAdjacentHTML('beforeend', add.dataset.add === 'item' ? rowItem() : rowScale());
    box.lastElementChild.querySelector('input').focus();
  }
  const remove = e.target.closest('[data-remove]');
  if (remove) remove.closest('.rule-row').remove();
});

courseForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const subject = getSubject(editingCourseFor);
  if (!subject) return;
  const f = courseForm.elements;
  const val = (row, name) => row.querySelector(`[name="${name}"]`).value;
  const prevScores = new Map((subject.course?.items ?? []).map((it) => [it.id, it.score]));
  const items = [...courseForm.querySelectorAll('.rule-row[data-kind="item"]')].map((row) => ({
    id: row.dataset.id || undefined,
    title: val(row, 'title'),
    max: val(row, 'max'),
    min: val(row, 'min'),
    classNo: val(row, 'classNo'),
    date: val(row, 'date'),
    note: val(row, 'note'),
    score: prevScores.get(row.dataset.id) ?? null,
  }));
  const scale = [...courseForm.querySelectorAll('.rule-row[data-kind="scale"]')].map((row) => ({ from: val(row, 'from'), grade: val(row, 'grade') }));
  subject.course = normalizeCourse({ ...emptyCourse(), passPoints: f.passPoints.value, bonusMax: f.bonusMax.value, notes: f.notes.value, items, scale });
  save();
  closeSheet(courseDialog);
  render();
});

$('#course-delete').addEventListener('click', () => {
  const subject = getSubject(editingCourseFor);
  if (!subject || !confirm('Remove the course rules and your points for this subject?')) return;
  subject.course = null;
  save();
  closeSheet(courseDialog);
  render();
});

// Points typed on the subject page.
document.addEventListener('change', (e) => {
  const input = e.target.closest('input[data-score]');
  if (!input) return;
  const subject = getSubject(input.dataset.subject);
  const item = subject?.course?.items.find((it) => it.id === input.dataset.score);
  if (!item) return;
  const v = input.value.trim();
  const n = Number(v.replace(',', '.'));
  item.score = v === '' || !Number.isFinite(n) ? null : Math.max(0, Math.round(n * 10) / 10);
  save();
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
});

// Rules prepared from the course PDFs: { "skipcount": "course-info", "courses": [...] }
$('#course-input').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const courses = parseCourseImport(JSON.parse(await file.text()));
    let updated = 0;
    const missing = [];
    for (const c of courses) {
      const sameCode = state.subjects.filter((s) => (s.code || s.name).toUpperCase() === c.code || s.name.toUpperCase().startsWith(`${c.code} `));
      let targets = c.type ? sameCode.filter((s) => s.name.toLowerCase().includes(c.type.toLowerCase())) : sameCode.filter((s) => s.tracked);
      if (!c.type && !targets.length) targets = sameCode;
      if (!targets.length) missing.push(c.type ? `${c.code} ${c.type}` : c.code);
      for (const s of targets) {
        s.course = mergeScores(c.course, s.course);
        updated++;
      }
    }
    save();
    render();
    toast(`Course rules: ${updated} updated${missing.length ? ` · not found: ${missing.join(', ')}` : ''}`);
  } catch (err) {
    toast(err instanceof SyntaxError ? 'This file is not valid JSON' : err.message);
  }
});

// Close dialogs via ✕ or a tap on the backdrop
for (const dialog of [subjectDialog, recordDialog, importDialog, taskDialog, courseDialog]) {
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-close]')) closeSheet(dialog);
  });
  initSheetGestures(dialog);
}
window.addEventListener('resize', () => moveTabIndicator(true));

// Backup

async function exportData() {
  const name = `skipcount-backup-${todayISO()}.json`;
  const file = new File([JSON.stringify(state, null, 2)], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'SkipCount backup' });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('#import-input').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = normalize(JSON.parse(await file.text()));
    const summary = `${data.subjects.length} ${plural(data.subjects.length, 'subject', 'subjects')}, ${data.records.length} ${plural(data.records.length, 'class', 'classes')}`;
    if (!confirm(`Replace current data with this backup (${summary})?`)) return;
    state = data;
    save();
    applyTheme();
    location.hash = '#/';
    render();
    toast('Backup restored');
  } catch (err) {
    toast(err instanceof SyntaxError ? 'This file is not valid JSON' : err.message);
  }
});

// Theme

function applyTheme() {
  const theme = state.settings.theme;
  const root = document.documentElement;
  if (theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = theme;
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.content = dark ? '#0f1015' : '#f4f4f7';
  });
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// Global click delegation

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id, status } = el.dataset;
  switch (action) {
    case 'log':
      logClass(id, status, el.dataset.date || todayISO(), '', el.dataset.event || null);
      break;
    case 'import-ics':
      $('#ics-input').click();
      break;
    case 'add-task':
      if (state.subjects.length) openTaskDialog({ subjectId: id, eventUid: el.dataset.event });
      break;
    case 'edit-task':
      openTaskDialog({ task: state.tasks.find((t) => t.id === id) });
      break;
    case 'toggle-task':
      toggleTask(id);
      break;
    case 'toggle-all-tasks':
      home.showAllTasks = !home.showAllTasks;
      render();
      break;
    case 'edit-course':
      openCourseDialog(getSubject(id));
      break;
    case 'toggle-scale':
      if (openScales.has(id)) openScales.delete(id);
      else openScales.add(id);
      render();
      break;
    case 'import-course':
      $('#course-input').click();
      break;
    case 'clear-schedule':
      if (confirm('Remove the imported timetable? Subjects and logged classes stay.')) {
        state.events = [];
        save();
        render();
        toast('Timetable removed');
      }
      break;
    case 'cal-day':
      cal.day = el.dataset.date;
      render();
      fadeIn($('.day-list'));
      break;
    case 'week-day':
      week.day = el.dataset.date === todayISO() ? null : el.dataset.date;
      render();
      fadeIn($('.today-body'));
      break;
    case 'week-shift': {
      const target = addDays(week.day ?? todayISO(), Number(el.dataset.delta));
      week.day = mondayOf(target) === mondayOf(todayISO()) ? null : mondayOf(target);
      render();
      fadeIn($('.wk-days'));
      fadeIn($('.today-body'));
      break;
    }
    case 'week-today':
      week.day = null;
      render();
      fadeIn($('.today-body'));
      break;
    case 'cal-month':
      cal.month = shiftMonth(cal.month, Number(el.dataset.delta));
      render();
      slideIn($('.cal-days'), Number(el.dataset.delta));
      break;
    case 'cal-today':
      cal.day = todayISO();
      cal.month = cal.day.slice(0, 7);
      render();
      break;
    case 'cal-filter':
      cal.filter = id || null;
      render();
      break;
    case 'subject-calendar':
      cal.filter = id;
      location.hash = '#/calendar';
      break;
    case 'add-subject':
      openSubjectDialog(null);
      break;
    case 'edit-subject':
      openSubjectDialog(getSubject(id));
      break;
    case 'add-record':
      openRecordDialog({ subjectId: id, date: el.dataset.date });
      break;
    case 'edit-record':
      openRecordDialog({ record: state.records.find((r) => r.id === id) });
      break;
    case 'theme':
      state.settings.theme = el.value;
      save();
      applyTheme();
      break;
    case 'export':
      exportData();
      break;
    case 'import':
      $('#import-input').click();
      break;
    case 'clear-records':
      if (state.records.length && confirm('Clear all logged classes? Subjects and limits stay.')) {
        state.records = [];
        save();
        render();
        toast('History cleared');
      }
      break;
    case 'reset':
      if (confirm('Delete all subjects and history? This cannot be undone.')) {
        state = emptyState();
        save();
        applyTheme();
        location.hash = '#/';
        render();
      }
      break;
  }
});

let lastHash = location.hash;
window.addEventListener('hashchange', () => {
  subjectDialog.close();
  recordDialog.close();
  importDialog.close();
  taskDialog.close();
  courseDialog.close();
  render();
  window.scrollTo(0, 0);
  playEnter($('#app'), lastHash, location.hash);
  lastHash = location.hash;
});

// Re-render when the app comes back to the foreground on a new day
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') render();
});

// ---------- boot ----------

applyTheme();
render();

initUpdates();
initSwipeNav($('#app'));
// Ask the browser not to evict our data under storage pressure.
navigator.storage?.persist?.().catch(() => {});
