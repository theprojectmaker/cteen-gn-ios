import { useEffect } from 'react';
import { doneThisPeriod, useStore } from './store';
import { scheduleWrapReminders } from './push';
import { nyTime, sunTimes } from './zmanim';

// Keeps the 30-minutes-before-sunset Tefillin reminders up to date on this phone. Renders nothing.
const addDays = (ymd: string, n: number) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekday = (ymd: string) => new Date(ymd + 'T12:00:00Z').getUTCDay(); // 0 Sun .. 6 Sat

export function WrapReminderSync() {
  const { content, joined, checks, gender, push } = useStore();
  const ch = content.challenges.find((c) => c.id === 'tefillin' && c.active);
  const mine = !!ch && joined.includes('tefillin') && gender !== 'girl';
  const done = !!ch && doneThisPeriod(ch, checks);
  useEffect(() => {
    if (push !== 'on') return;
    if (!mine) { scheduleWrapReminders([]); return; }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    const times = [];
    for (let i = 0; i < 8; i++) {
      const ymd = addDays(today, i);
      const wd = weekday(ymd);
      if (wd === 6) continue; // Shabbat
      if (i === 0 && done) continue; // already posted today
      const friday = wd === 5;
      const close = sunTimes(ymd).set - (friday ? 18 * 60000 : 0);
      times.push({
        id: 'wrap-' + ymd,
        at: close - 30 * 60000,
        title: friday ? '30 minutes to wrap before Shabbat' : '30 minutes left to wrap tefillin',
        body: friday ? `Candle lighting is at ${nyTime(close)}. Snap your selfie, then get ready for Shabbat.` : `Sunset is at ${nyTime(close)}. Snap your selfie to keep your streak alive.`,
      });
    }
    scheduleWrapReminders(times);
  }, [mine, done, push]);
  return null;
}
