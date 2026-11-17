// Notifications: push from the rabbi (through Expo's push service) and local
// challenge reminders. Everything here is a no-op on web, where there is no push.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

const NATIVE = Platform.OS !== 'web';
export type PushState = 'unsupported' | 'off' | 'on' | 'blocked';

if (NATIVE) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export async function pushState(): Promise<PushState> {
  if (!NATIVE) return 'unsupported';
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.granted ? 'on' : p.canAskAgain ? 'off' : 'blocked';
  } catch {
    return 'unsupported';
  }
}

// Ask permission, then hand this phone's push token to the chapter server.
export async function enablePush(register: (token: string) => Promise<void>): Promise<PushState> {
  if (!NATIVE) return 'unsupported';
  try {
    let p = await Notifications.getPermissionsAsync();
    if (!p.granted && p.canAskAgain) p = await Notifications.requestPermissionsAsync();
    if (!p.granted) return p.canAskAgain ? 'off' : 'blocked';
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'CTeen GN', importance: Notifications.AndroidImportance.DEFAULT });
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (Device.isDevice && projectId) {
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      await register(token).catch(() => {});
    }
    return 'on';
  } catch {
    return 'off';
  }
}

// Daily (or Friday, for weekly challenges) reminder at the given hour. hour = null turns it off.
export async function setReminder(id: string, title: string, every: 'day' | 'week', hour: number | null) {
  if (!NATIVE) return;
  const identifier = 'challenge-' + id;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
    if (hour === null) return;
    const content = { title, body: every === 'day' ? "Don't forget to check in today." : "Don't forget to check in this week." };
    const trigger: Notifications.NotificationTriggerInput =
      every === 'day'
        ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0 }
        : { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 6, hour, minute: 0 }; // 6 = Friday
    await Notifications.scheduleNotificationAsync({ identifier, content, trigger });
  } catch {}
}

// Call fn with the target stored on a notification when the user taps it.
export function onNotificationTap(fn: (target: { type: string; id: string } | null) => void) {
  if (!NATIVE) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const t = r.notification.request.content.data?.target as { type: string; id: string } | undefined;
    fn(t && typeof t.id === 'string' ? t : null);
  });
  return () => sub.remove();
}

// Tefillin: a reminder 30 minutes before each day's window closes (sunset, or candle lighting on
// Fridays), for the next week. Today's is skipped once you've posted. Pass [] to clear them all.
export async function scheduleWrapReminders(times: { id: string; at: number; title: string; body: string }[]) {
  if (!NATIVE) return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(all.filter((n) => n.identifier.startsWith('wrap-')).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})));
    for (const t of times) {
      if (t.at <= Date.now() + 60000) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: t.id,
        content: { title: t.title, body: t.body, data: { target: { type: 'challenge', id: 'tefillin' } } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(t.at) },
      });
    }
  } catch {}
}
