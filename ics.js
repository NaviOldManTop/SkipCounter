// Minimal iCalendar (.ics) reader tuned for university timetables.
// Tested against the PJATK export, whose SUMMARY looks like
//   "RBD ćwiczenia s. B/226A"                        (code, class type, room)
//   "Egzamin ALG [ENG]  Turska Ewa s.A/157 egzamin s. A/157"  (exam with teacher)

export const TYPE_LABELS = {
  'wykład': 'Lecture',
  'wyklad': 'Lecture',
  'ćwiczenia': 'Exercises',
  'cwiczenia': 'Exercises',
  'lektorat': 'Language',
  'laboratorium': 'Lab',
  'lab': 'Lab',
  'seminarium': 'Seminar',
  'projekt': 'Project',
  'lecture': 'Lecture',
  'exercises': 'Exercises',
  'seminar': 'Seminar',
};

const unescapeText = (s) => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

function parseDate(prop) {
  if (!prop) return NaN;
  const m = prop.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return NaN;
  const [, y, mo, d, h = 0, mi = 0, s = 0, utc] = m;
  // UTC times are exact; floating/TZID times are taken as the device's local time.
  return utc ? Date.UTC(+y, mo - 1, +d, +h, +mi, +s) : new Date(+y, mo - 1, +d, +h, +mi, +s).getTime();
}

export function parseICS(text) {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('This file is not an .ics calendar.');
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') {
      if (cur) events.push(cur);
      cur = null;
    } else if (cur) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const name = line.slice(0, i).split(';')[0].toUpperCase();
      cur[name] = { value: line.slice(i + 1) };
    }
  }
  return events
    .map((e) => {
      const start = parseDate(e.DTSTART);
      const end = parseDate(e.DTEND);
      return {
        uid: e.UID?.value || `${e.DTSTART?.value}-${e.SUMMARY?.value}`,
        summary: unescapeText(e.SUMMARY?.value || ''),
        location: unescapeText(e.LOCATION?.value || ''),
        start,
        end: Number.isFinite(end) ? end : start + 90 * 60000,
      };
    })
    .filter((e) => Number.isFinite(e.start) && e.summary);
}

// Splits a SUMMARY into subject code, class type, room and teacher.
export function classifyEvent(e) {
  const summary = e.summary.replace(/\s+/g, ' ').trim();
  const parts = summary.split(/\s+s\.\s*/);
  let head = parts[0];
  let room = e.location || (parts.length > 1 ? parts.at(-1) : '');
  let code, type = '', teacher = '', exam = false;

  if (/^(egzamin|exam)\b/i.test(head)) {
    exam = true;
    head = head.replace(/^(egzamin|exam)\s*/i, '');
    code = head.split(' ')[0] || 'Exam';
    teacher = head.slice(code.length).replace(/\[[^\]]*\]/g, '').trim();
    type = 'exam';
  } else {
    const tokens = head.split(' ');
    if (tokens.length > 1 && /^[A-Z][A-Z0-9]{1,6}$/.test(tokens[0])) {
      code = tokens[0];
      type = tokens.slice(1).join(' ');
    } else {
      code = head; // Not code-style: use the whole title as the subject.
    }
  }

  const typeKey = type.toLowerCase();
  const typeLabel = exam ? 'Exam' : TYPE_LABELS[typeKey] ?? (type ? type[0].toUpperCase() + type.slice(1) : '');
  return {
    uid: e.uid,
    start: e.start,
    end: e.end,
    code,
    type: typeKey,
    typeLabel,
    room: room.trim(),
    teacher,
    exam,
    key: `${code}|${typeKey}`,
    defaultName: typeLabel && !exam ? `${code} · ${typeLabel}` : code,
  };
}
