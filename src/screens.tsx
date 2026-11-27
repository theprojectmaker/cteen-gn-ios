import { useEffect } from 'react';
import { nextOccurrence, useShabbat, useStore } from './store';
import { scheduleEventReminders, scheduleShabbatReminders } from './push';
import { shabbatReminderTimes } from './shabbatTimes';

// The tab screens live in their own files; this file keeps the old import path working.
export { Home } from './home';
export { Events, EventDetails } from './events';
export { Chapter } from './chapter';
// Feed and post cards live in feed.tsx.
export { Feed, PostCard } from './feed';

// The coming Shabbat's reminders (Friday 9:00 AM and an hour before candle lighting), from the same Hebcal
// data as the Shabbat times. Only when notifications are on and the switch in Settings is on; they are
// replaced whenever the data changes, and old ones are cleared.
export function ShabbatReminderSync() {
  const { push, shabbatOff } = useStore();
  const sh = useShabbat();
  const candlesAt = sh && sh !== 'error' ? sh.candlesAt : undefined;
  useEffect(() => {
    if (push !== 'on' || shabbatOff) { scheduleShabbatReminders([]); return; }
    if (sh === null) return; // still loading: leave what is scheduled
    scheduleShabbatReminders(shabbatReminderTimes(candlesAt, Date.now()));
  }, [push, shabbatOff, candlesAt, sh === null]);
  return null;
}

// Schedules a heads-up the evening before and the morning of: events the teen RSVP'd to, and the
// next date of every weekly event they can see (so recurring events remind everyone to come).
export function EventReminderSync() {
  const { going, content, push, name, fits } = useStore();
  const todayNY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const rsvp = content.events.filter((e) => e.repeat !== 'weekly' && going.includes(e.id) && e.start >= todayNY).map((e) => ({ e, date: e.start }));
  const weekly = content.events.filter((e) => e.repeat === 'weekly' && fits(e)).map((e) => ({ e, date: nextOccurrence(e) })).filter((x) => !!x.date);
  const all = [...rsvp, ...weekly];
  const key = all.map((x) => x.e.id + x.date + (x.e.time || '')).join('|') + push + name;
  useEffect(() => {
    if (push !== 'on') return;
    const first = name.trim().split(' ')[0];
    const times: { id: string; at: number; title: string; body: string; target: string }[] = [];
    for (const { e, date } of all.slice(0, 20)) {
      const [y, m, d] = date.split('-').map(Number);
      const mine = e.repeat !== 'weekly';
      const eve = new Date(y, m - 1, d - 1, 18, 0, 0);
      times.push({ id: `evr-${e.id}-eve`, at: eve.getTime(), title: `Tomorrow: ${e.title}`, body: `${mine ? (first ? first + ", you're" : "You're") + ' going' : 'Join us'}${e.time ? ` · ${e.time}` : ''}${e.place ? ` · ${e.place}` : ''}.`, target: e.id });
      const morn = new Date(y, m - 1, d, 9, 0, 0);
      times.push({ id: `evr-${e.id}-morn`, at: morn.getTime(), title: `Today: ${e.title}`, body: `See you there${e.time ? ` · ${e.time}` : ''}${e.place ? ` · ${e.place}` : ''}.`, target: e.id });
    }
    scheduleEventReminders(times);
  }, [key]);
  return null;
}
