import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R, SP, T, display } from '../../src/theme';
import { dateLabel, useStore } from '../../src/store';
import { firstName, personal } from '../../src/invites';
import { Backdrop, CloseButton, Label, PosterStage, Slab } from '../../src/look';

// A personal invitation, written like a note from the rabbi. Accept or decline at the bottom.
export default function InviteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { content, name, invites: answers, respondInvite, openEvent } = useStore();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const v = (content.invites || []).find((x) => x.id === id);
  if (!v) return <View style={[st.root, { alignItems: 'center', justifyContent: 'center' }]}><Backdrop /><Text style={st.body}>This invitation was taken down.</Text></View>;
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
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: 58, paddingBottom: insets.bottom + 150 }} showsVerticalScrollIndicator={false}>
        <View style={st.col}>
          {/* the poster whole, never cropped */}
          {v.image ? <PosterStage source={v.image} maxHeight={320} style={{ marginBottom: 20 }} /> : null}
          <Label tone={answer === 'yes' ? 'blue' : 'orange'}>{answer === 'yes' ? "You're going" : 'A personal invitation'}</Label>
          <Text style={st.hi}>{firstName(name)},</Text>
          <Text style={st.body}>{message}</Text>
          <Text style={st.sign}>Rabbi Zevy</Text>

          <View style={st.facts}>
            <Text style={T.h2}>{v.title}</Text>
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
              <Pressable onPress={() => setMore((m) => !m)} hitSlop={10} style={st.moreBtn} accessibilityRole="button" accessibilityState={{ expanded: more }}>
                <Text style={st.moreText}>{more ? 'Less info' : 'More info'}</Text>
              </Pressable>
              {more ? <Text style={st.details}>{v.details}</Text> : null}
            </>
          ) : null}
          {ev ? (
            <View style={{ marginTop: 18, alignSelf: 'flex-start' }}>
              <Label tone="blue" onPress={() => { router.back(); setTimeout(() => openEvent(ev.id), 300); }}>See the event page</Label>
            </View>
          ) : null}
          {err ? <Text style={st.err}>{err}</Text> : null}
        </View>
      </ScrollView>

      <View style={[st.bar, { paddingBottom: insets.bottom + 14 }]}>
        <View style={st.barCol}>
          {answer === 'yes' ? (
            <>
              <Slab kind="outline" icon="tick" label="You're going. See you there." />
              <Pressable onPress={() => answerIt('no')} disabled={busy} hitSlop={10} style={st.quiet} accessibilityRole="button"><Text style={st.change}>I can't make it anymore</Text></Pressable>
            </>
          ) : (
            <>
              <Slab height={56} label={busy ? 'Saving…' : "I'm in"} disabled={busy} onPress={() => answerIt('yes')} />
              <Pressable onPress={() => answerIt('no')} disabled={busy} hitSlop={10} style={st.quiet} accessibilityRole="button"><Text style={st.change}>Not this time</Text></Pressable>
            </>
          )}
        </View>
      </View>
      <CloseButton onPress={() => router.back()} style={st.close} />
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={st.fact}>
      <Label style={st.factLabel}>{label}</Label>
      <Text style={[T.strong, { flex: 1 }]}>{value}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: SP.gutter },
  hi: { ...display(40), marginTop: 10 },
  body: { fontSize: 18, lineHeight: 27, color: C.ink, marginTop: 8 },
  sign: { fontSize: 16, color: C.sub, marginTop: 14, fontStyle: 'italic' },
  facts: { marginTop: 24, paddingTop: 18, borderTopWidth: 1, borderTopColor: C.line },
  fact: { flexDirection: 'row', alignItems: 'baseline', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  factLabel: { width: 72 },
  moreBtn: { marginTop: 18, alignSelf: 'flex-start', paddingHorizontal: 14, minHeight: 36, borderRadius: R.chip, borderWidth: 1, borderColor: C.lineStrong, justifyContent: 'center' },
  moreText: { fontSize: 14, fontWeight: '700', color: C.ink },
  details: { fontSize: 15, lineHeight: 22, color: C.ink, marginTop: 12 },
  err: { color: C.red, marginTop: 12, fontSize: 14, fontWeight: '700' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: SP.gutter, paddingTop: 12, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.lineStrong },
  barCol: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  quiet: { alignSelf: 'center', marginTop: 12, minHeight: 24, justifyContent: 'center' },
  change: { fontSize: 14, fontWeight: '600', color: C.sub },
  close: { position: 'absolute', top: 12, right: 14 },
});
