import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '../../src/theme';
import { dateLabel, useStore } from '../../src/store';
import { firstName, personal } from '../../src/invites';

// A personal invitation, written like a note from the rabbi. Accept or decline at the bottom.
export default function InviteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { content, name, invites: answers, respondInvite, openEvent } = useStore();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const v = (content.invites || []).find((x) => x.id === id);
  if (!v) return <View style={[st.root, { alignItems: 'center', justifyContent: 'center' }]}><Text style={st.body}>This invitation was taken down.</Text></View>;
  const ev = v.eventId ? content.events.find((e) => e.id === v.eventId) : undefined;
  const answer = (answers || {})[v.id];
  const answerIt = async (a: 'yes' | 'no') => {
    setBusy(true); setErr(null);
    const e = await respondInvite(v.id, a);
    setBusy(false);
    if (e) return setErr(e);
    if (a === 'no') router.back();
  };
  const message = v.message ? personal(v.message, name) : `Rabbi Zevy would love for you to come to ${v.title}.`;
  return (
    <View style={st.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 140 }} showsVerticalScrollIndicator={false}>
        {v.image ? <Image source={{ uri: v.image }} style={st.poster} resizeMode="cover" /> : <View style={{ height: 34 }} />}
        <View style={st.paper}>
          <Text style={st.kicker}>{answer === 'yes' ? "You're going" : 'A personal invitation'}</Text>
          <Text style={st.hi}>{firstName(name)},</Text>
          <Text style={st.body}>{message}</Text>
          <Text style={st.sign}>Rabbi Zevy</Text>

          <View style={st.facts}>
            <Text style={st.factTitle}>{v.title}</Text>
            {ev ? (
              <>
                <Fact label="When" value={`${dateLabel(ev)}${ev.time ? ' · ' + ev.time : ''}`} />
                {ev.place ? <Fact label="Where" value={ev.place} /> : null}
                {ev.price ? <Fact label="Price" value={ev.price} /> : null}
              </>
            ) : null}
          </View>

          {v.details ? (
            <>
              <Pressable onPress={() => setMore((m) => !m)} hitSlop={8} style={st.moreBtn} accessibilityRole="button" accessibilityState={{ expanded: more }}>
                <Text style={st.moreText}>{more ? 'Less info' : 'More info'}</Text>
              </Pressable>
              {more ? <Text style={st.details}>{v.details}</Text> : null}
            </>
          ) : null}
          {ev ? (
            <Pressable onPress={() => { router.back(); setTimeout(() => openEvent(ev.id), 300); }} hitSlop={8} style={{ marginTop: 14 }} accessibilityRole="button">
              <Text style={st.link}>See the event page</Text>
            </Pressable>
          ) : null}
          {err ? <Text style={st.err}>{err}</Text> : null}
        </View>
      </ScrollView>

      <View style={[st.bar, { paddingBottom: insets.bottom + 14 }]}>
        {answer === 'yes' ? (
          <>
            <View style={st.going}><Text style={st.goingText}>You're going. See you there.</Text></View>
            <Pressable onPress={() => answerIt('no')} disabled={busy} hitSlop={8} accessibilityRole="button"><Text style={st.change}>I can't make it anymore</Text></Pressable>
          </>
        ) : (
          <>
            <Pressable onPress={() => answerIt('yes')} disabled={busy} style={({ pressed }) => [st.accept, pressed && { opacity: 0.9 }]} accessibilityRole="button">
              <Text style={st.acceptText}>{busy ? 'Saving…' : "I'm in"}</Text>
            </Pressable>
            <Pressable onPress={() => answerIt('no')} disabled={busy} hitSlop={8} accessibilityRole="button"><Text style={st.change}>Not this time</Text></Pressable>
          </>
        )}
      </View>
      <Pressable onPress={() => router.back()} style={st.close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close"><Text style={st.closeText}>Close</Text></Pressable>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={st.fact}>
      <Text style={st.factLabel}>{label}</Text>
      <Text style={st.factValue}>{value}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  poster: { width: '100%', height: 280, backgroundColor: C.line },
  paper: { marginHorizontal: 16, marginTop: -26, padding: 22, borderRadius: 24, backgroundColor: C.card, maxWidth: 600, alignSelf: 'center', width: '92%' },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: C.orange },
  hi: { fontSize: 34, fontFamily: F.display, color: C.ink, marginTop: 10, letterSpacing: -0.8 },
  body: { fontSize: 18, lineHeight: 27, color: C.ink, marginTop: 8 },
  sign: { fontSize: 16, color: C.sub, marginTop: 16, fontStyle: 'italic' },
  facts: { marginTop: 22, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  factTitle: { fontSize: 20, fontFamily: F.display, color: C.ink, marginBottom: 6 },
  fact: { flexDirection: 'row', paddingVertical: 6 },
  factLabel: { width: 64, fontSize: 14, color: C.sub },
  factValue: { flex: 1, fontSize: 15, fontWeight: '700', color: C.ink },
  moreBtn: { marginTop: 16, alignSelf: 'flex-start', paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: C.bg, justifyContent: 'center' },
  moreText: { fontSize: 14, fontWeight: '800', color: C.ink },
  details: { fontSize: 15, lineHeight: 22, color: C.ink, marginTop: 12 },
  link: { fontSize: 15, fontWeight: '700', color: C.blue },
  err: { color: '#C0303F', marginTop: 12, fontSize: 14, fontWeight: '700' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: C.bg, alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  accept: { alignSelf: 'stretch', height: 54, borderRadius: 27, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', maxWidth: 560, width: '100%' },
  acceptText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  change: { fontSize: 15, fontWeight: '700', color: C.sub },
  going: { alignSelf: 'stretch', height: 54, borderRadius: 27, backgroundColor: C.greenPale, alignItems: 'center', justifyContent: 'center', maxWidth: 560, width: '100%' },
  goingText: { fontSize: 16, fontWeight: '800', color: C.green },
  close: { position: 'absolute', top: 12, right: 14, paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center' },
  closeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
