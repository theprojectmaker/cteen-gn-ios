// When to remind about Shabbat. A pure function (no React, no phone APIs) so it can be tested alone:
//   node -e "require('esbuild')..." or simply read the cases in the comment at the bottom.
// Everything is New York time, worked out from the candle-lighting moment itself, so a clock change
// between the morning and the evening cannot move it.

const MIN = 60000;

function nyParts(t: number): { ymd: string; h: number; m: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(t));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return { ymd: `${get('year')}-${get('month')}-${get('day')}`, h: Number(get('hour')) % 24, m: Number(get('minute')) };
}

/** 1:05 PM style clock text in New York time. */
export function nyClockText(t: number): string {
  const { h, m } = nyParts(t);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export type ShabbatReminder = { id: string; at: number; title: string; body: string };

/**
 * The reminders for the coming Shabbat: 9:00 AM New York time on the day of candle lighting
 * ("Shabbat tonight"), and 60 minutes before candle lighting. Anything that is not at least a minute
 * in the future is left out (so nothing is scheduled in the past and nothing fires the moment the app
 * opens). The ids carry the date, so the same Shabbat always gets the same ids (no double reminders)
 * and next week's get new ones.
 *   candles 2026-11-27 4:11 PM  ->  morning 9:00 AM, hour-before 3:11 PM
 */
export function shabbatReminderTimes(candlesAt: number | undefined, now: number): ShabbatReminder[] {
  if (!candlesAt || !Number.isFinite(candlesAt)) return [];
  const { ymd, h, m } = nyParts(candlesAt);
  const clock = nyClockText(candlesAt);
  const sinceNine = (h * 60 + m) - 9 * 60; // minutes from 9:00 AM to candle lighting (same day)
  const out: ShabbatReminder[] = [];
  if (sinceNine > 0) out.push({ id: `shabbat-${ymd}-morning`, at: candlesAt - sinceNine * MIN, title: 'Shabbat tonight', body: `Candle lighting ${clock}` });
  out.push({ id: `shabbat-${ymd}-hour`, at: candlesAt - 60 * MIN, title: 'Candle lighting in 1 hour', body: `(${clock})` });
  return out.filter((r) => r.at > now + MIN);
}
