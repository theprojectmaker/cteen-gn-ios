// WHEN an event is, worked out and put into words. Everything here is a plain function of the
// event and the clock you hand it (no React, no store, no hidden "now"), so it can be tested alone.
//
//   spotlight(events, now)   THE DAY LOGIC OF HOME: which event, if any, takes over the top of the
//                            page today, and the words for its brush tag.
//   isOver(event, now)       a one-day event that started more than 3 hours ago (or a past one)
//   whenWords(event, now)    the words for any other tag or label: "TONIGHT AT 6:00 PM", "THIS SUNDAY · 10:15 AM"
//   dayAndTime(event, now)   the two halves of a caption: "SUN, NOV 29" and "10:15 AM"
//   clockOf / clockText / prettyTime / startsAt / daysAway / dateRange   the small parts
import type { EventItem } from './store';

const MINUTE = 60000;
const DAY = 86400000;
/** "Happening now" begins this long before the start time ... */
export const SOON_MS = 15 * MINUTE;
/** ... and a one-day event counts as over this long after it. */
export const LASTS_MS = 180 * MINUTE;

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const WEEKDAYS_LONG = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

type Dated = Pick<EventItem, 'start' | 'end'>;
type Timed = Pick<EventItem, 'start' | 'end' | 'time'>;

// ───────── the clock ─────────

export type Clock = { h: number; m: number };

const hour24 = (hour: number, half: string) => (hour % 12) + (half === 'p' ? 12 : 0);

/**
 * The time of day a typed time starts at: "6:00pm", "10:15 AM", "7pm", "7 p.m.", and the first
 * half of a range ("6:00 PM - 8:00 PM", "6-8pm"). null when it is something else ("After
 * Shabbat", "TBA", "7:30" with no AM or PM): then there is simply no countdown and no "over".
 */
export function clockOf(time?: string): Clock | null {
  const s = (time || '').trim().toLowerCase().replace(/(\d)\.(\d)/g, '$1:$2').replace(/\./g, '');
  const one =/^(\d{1,2})(?::(\d{2}))?\s*([ap])m?(?![a-z0-9])/.exec(s);
  if (one) {
    const hour = Number(one[1]), min = Number(one[2] || 0);
    if (hour < 1 || hour > 12 || min > 59) return null;
    return { h: hour24(hour, one[3]), m: min };
  }
  // "6-8pm": the first half borrows AM or PM from the second
  const two = /^(\d{1,2})(?::(\d{2}))?\s*(?:-|–|—|to|until|till)\s*(\d{1,2})(?::(\d{2}))?\s*([ap])m?(?![a-z0-9])/.exec(s);
  if (!two) return null;
  const hour = Number(two[1]), min = Number(two[2] || 0), endHour = Number(two[3]);
  if (hour < 1 || hour > 12 || min > 59 || endHour < 1 || endHour > 12) return null;
  const end = hour24(endHour, two[5]);
  let start = hour24(hour, two[5]);
  if (start > end) start -= 12; // "10-1pm" starts in the morning
  return start < 0 ? null : { h: start, m: min };
}

/** { h: 18, m: 0 } -> "6:00 PM" */
export function clockText(c: Clock): string {
  return `${((c.h + 11) % 12) + 1}:${String(c.m).padStart(2, '0')} ${c.h < 12 ? 'AM' : 'PM'}`;
}

/** "6:00pm" -> "6:00 PM". Anything that is not one plain time comes back as typed. */
export function prettyTime(time?: string): string {
  const typed = (time || '').trim();
  const c = /^\d{1,2}(?::\d{2})?\s*[ap]\.?\s?m?\.?$/i.test(typed) ? clockOf(typed) : null;
  return c ? clockText(c) : typed;
}

// ───────── days ─────────

/** "2026-11-25" -> that day at midnight, in the phone's own time zone. */
export function parseDay(ymd: string): Date {
  const [y, m, d] = (ymd || '').split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

/** Whole days from today to that date: 0 today, 1 tomorrow, -1 yesterday. */
export function daysAway(ymd: string, now: number = Date.now()): number {
  const n = new Date(now);
  return Math.round((parseDay(ymd).getTime() - new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()) / DAY);
}

/** The moment an event starts, when its time can be read; otherwise null. */
export function startsAt(e: Pick<EventItem, 'start' | 'time'>): number | null {
  const c = clockOf(e.time);
  if (!c) return null;
  const d = parseDay(e.start);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), c.h, c.m).getTime();
}

/** "DEC 10 – 11" / "NOV 29" (no year). */
export function dateRange(e: Dated): string {
  const a = parseDay(e.start), b = parseDay(e.end || e.start);
  const left = `${MONTHS[a.getMonth()]} ${a.getDate()}`;
  if (!e.end || e.start === e.end) return left;
  return `${left} – ${a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear() ? b.getDate() : `${MONTHS[b.getMonth()]} ${b.getDate()}`}`;
}

/** Over: its last day has passed, or it is a one-day event that started more than 3 hours ago. */
export function isOver(e: Timed, now: number = Date.now()): boolean {
  const first = daysAway(e.start, now), last = daysAway(e.end || e.start, now);
  if (last < 0) return true;
  if (first !== 0 || last !== 0) return false;
  const at = startsAt(e);
  return at !== null && now > at + LASTS_MS;
}

// ───────── the day logic of Home ─────────

export type Spotlight<E extends Timed = EventItem> = {
  event: E;
  /** now = in progress · today = later today · tomorrow */
  phase: 'now' | 'today' | 'tomorrow';
  /** the words on the brush tag */
  tag: string;
  /** when it starts (null when the time cannot be read, or it began on an earlier day) */
  startsAt: number | null;
};

/**
 * Is today an event day? Hand it the upcoming events that fit the teen. It walks them soonest
 * first (by day, then by start time; events with no readable time go last on their day) and
 * returns the first one that is
 *   · in progress: a multi-day event that began on an earlier day              -> HAPPENING NOW
 *   · today: skipped when it is a one-day event that started over 3 hours ago (it is over);
 *     from 15 minutes before its start until then                              -> HAPPENING NOW
 *     before that                                    -> TODAY AT 10:15 AM / TONIGHT AT 6:00 PM
 *     (TONIGHT when it starts at 5 PM or later; just TODAY when the time cannot be read)
 *   · tomorrow                                              -> TOMORROW AT 10:15 AM / TOMORROW
 * null means a normal day.
 */
export function spotlight<E extends Timed>(events: readonly E[], now: number = Date.now()): Spotlight<E> | null {
  const line = events
    .map((event, i) => ({ event, i, at: startsAt(event) }))
    .sort((a, b) => a.event.start.localeCompare(b.event.start) || Number(a.at === null) - Number(b.at === null) || (a.at ?? 0) - (b.at ?? 0) || a.i - b.i);
  for (const { event, at } of line) {
    const first = daysAway(event.start, now), last = daysAway(event.end || event.start, now);
    if (last < 0) continue; // already past
    if (first < 0) return { event, phase: 'now', tag: 'HAPPENING NOW', startsAt: null };
    if (first === 0) {
      const clock = clockOf(event.time);
      if (at === null || !clock) return { event, phase: 'today', tag: 'TODAY', startsAt: null };
      if (now > at + LASTS_MS && last === 0) continue; // a one-day event that is over
      if (now >= at - SOON_MS) return { event, phase: 'now', tag: 'HAPPENING NOW', startsAt: at };
      return { event, phase: 'today', tag: `${clock.h >= 17 ? 'TONIGHT' : 'TODAY'} AT ${clockText(clock)}`, startsAt: at };
    }
    if (first === 1) {
      const clock = clockOf(event.time);
      return { event, phase: 'tomorrow', tag: clock ? `TOMORROW AT ${clockText(clock)}` : 'TOMORROW', startsAt: at };
    }
    break; // the day after tomorrow or later: nothing further down the line can be sooner
  }
  return null;
}

// ───────── words for everything else ─────────

/**
 * The words for a tag or label on any other screen: "TONIGHT AT 6:00 PM" (today, 5 PM or later),
 * "TODAY AT 10:15 AM" / "TODAY", "TOMORROW AT 7:30 PM", "THIS SUNDAY · 10:15 AM" (within 6 days),
 * "HAPPENING NOW" (a multi-day event that has started), otherwise the date ("DEC 10 – 11").
 * A time that cannot be read is added as typed ("TODAY · AFTER SHABBAT").
 */
export function whenWords(e: Timed, now: number = Date.now()): string {
  const n = daysAway(e.start, now);
  const clock = clockOf(e.time);
  const typed = (e.time || '').trim().toUpperCase();
  const at = clock ? ` AT ${clockText(clock)}` : typed ? ` · ${typed}` : '';
  if (n === 0) return (clock && clock.h >= 17 ? 'TONIGHT' : 'TODAY') + at;
  if (n === 1) return 'TOMORROW' + at;
  if (n > 1 && n <= 6) return `THIS ${WEEKDAYS_LONG[parseDay(e.start).getDay()]}${clock ? ` · ${clockText(clock)}` : typed ? ` · ${typed}` : ''}`;
  if (n < 0 && daysAway(e.end || e.start, now) >= 0) return 'HAPPENING NOW';
  return dateRange(e);
}

/**
 * The two halves of a caption under a poster: the day ("SUN, NOV 29", "TODAY", "TOMORROW",
 * "EVERY SUNDAY" for a weekly event, "DEC 10 – 11" for one that runs several days) and the time
 * ("10:15 AM", or what was typed when it cannot be read; '' when there is none).
 */
export function dayAndTime(e: Timed & Pick<EventItem, 'repeat'>, now: number = Date.now()): { day: string; time: string } {
  const clock = clockOf(e.time);
  const time = clock ? clockText(clock) : (e.time || '').trim().toUpperCase();
  const d = parseDay(e.start);
  if (e.repeat === 'weekly') return { day: `EVERY ${WEEKDAYS_LONG[d.getDay()]}`, time };
  if (e.end && e.end !== e.start) return { day: dateRange(e), time };
  const n = daysAway(e.start, now);
  const day = n === 0 ? 'TODAY' : n === 1 ? 'TOMORROW' : `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return { day, time };
}
