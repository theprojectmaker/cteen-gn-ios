import type { Challenge } from './store';

// The rules shown in a challenge's rules pop-up. Leaders write their own in the leader panel
// (Challenges); until they do, the Tefillin Challenge uses the rules from the flyer and the app.
export const TEFILLIN_RULES = [
  "Wrap tefillin every day for 30 days. Shabbat doesn't count.",
  'Snap a selfie in the app between sunrise and sunset. On Fridays, before candle lighting.',
  "Your photo goes on the day's board for everyone in the challenge.",
  'Miss a day and your streak starts over. The 2nd miss adds one extra day to your goal.',
  'A 3rd missed day and you are out of the challenge.',
  'Finish all 30 and you automatically win the prize. For teens in 8th to 12th grade.',
];

export function challengeRules(ch: Challenge): string[] {
  if (ch.rules && ch.rules.length) return ch.rules;
  if (ch.id === 'tefillin') return TEFILLIN_RULES;
  return [ch.every === 'day' ? 'Check in every day.' : 'Check in once a week.', ch.photo ? 'Take a photo in the app to check in.' : 'Tap Check in when you have done it.'];
}
