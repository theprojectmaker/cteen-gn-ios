import React from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { C, HUES, R, T, shadow } from './theme';
import { Icon } from './icons';
import { Glass } from './glass';
import { IMAGES, countdown, dateLabel, useStore, type ColorKey, type EventItem } from './store';

export function Card({ children, style, onPress, label }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[]; onPress?: () => void; label?: string }) {
  if (!onPress) return <View style={[s.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.card, style, pressed && s.pressed]}>
      {children}
    </Pressable>
  );
}

export function Chips<V extends string>({ options, value, onChange, wrap }: { options: readonly V[]; value: V; onChange: (v: V) => void; wrap?: boolean }) {
  const items = options.map((o) => {
    const on = o === value;
    return (
      <Pressable key={o} onPress={() => onChange(o)} style={[s.chip, on && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
        <Text style={[s.chipText, on && s.chipTextOn]}>{o}</Text>
      </Pressable>
    );
  });
  if (wrap) return <View style={s.chipsFlow}>{items}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.chipsWrap}>
      {items}
    </ScrollView>
  );
}

export function Button({ label, onPress, kind = 'primary', icon, color, disabled, small }: { label: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; icon?: string; color?: string; disabled?: boolean; small?: boolean }) {
  const fg = kind === 'primary' ? C.white : kind === 'danger' ? '#C0303F' : C.ink;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} style={({ pressed }) => [s.btn, small && s.btnSmall, kind === 'primary' ? { backgroundColor: color ?? C.blue } : s.btnGhost, disabled && { opacity: 0.45 }, pressed && s.pressed]}>
      {icon ? <Icon name={icon} size={small ? 15 : 17} color={fg} stroke={2.2} /> : null}
      <Text style={[s.btnText, small && { fontSize: 14 }, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, value, onChange, placeholder, multiline, hint, secure }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; hint?: string; secure?: boolean }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.faint} multiline={multiline} secureTextEntry={secure} autoCapitalize={secure ? 'none' : undefined} accessibilityLabel={label} style={[s.input, multiline && s.inputMulti]} />
      {hint ? <Text style={[T.small, { marginTop: 4, fontSize: 12 }]}>{hint}</Text> : null}
    </View>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable onPress={() => onChange(!value)} hitSlop={8} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} style={[s.switch, value && { backgroundColor: C.blue }]}>
      <View style={[s.knob, value && { alignSelf: 'flex-end' }]} />
    </Pressable>
  );
}

// Rounded square holding one icon, tinted with one of the accent colors.
export function IconTile({ icon, color = 'blue', size = 44, solid }: { icon: string; color?: ColorKey; size?: number; solid?: boolean }) {
  const hue = HUES[color] ?? HUES.blue;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: solid ? hue.solid : hue.pale, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.5} color={solid ? C.white : hue.deep} stroke={2} />
    </View>
  );
}

export function ScopeBadge({ scope, style }: { scope: 'gn' | 'intl'; style?: ViewStyle }) {
  const gn = scope === 'gn';
  return (
    <View style={[s.scope, { backgroundColor: gn ? C.blue : C.ink }, style]}>
      <Icon name={gn ? 'pin' : 'globe'} size={12} color={C.white} stroke={2.4} />
      <Text style={s.scopeText}>{gn ? 'Great Neck' : 'International'}</Text>
    </View>
  );
}

// Event artwork: a bundled photo when there is one, otherwise a color block with a large icon.
export function Cover({ e, style, iconSize = 56 }: { e: { image?: string; icon: string; color: ColorKey }; style?: ViewStyle; iconSize?: number }) {
  const img = e.image ? IMAGES[e.image] : undefined;
  const hue = HUES[e.color] ?? HUES.blue;
  return (
    <View style={[{ backgroundColor: hue.solid, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      {img ? <Image source={img} style={s.fill} resizeMode="cover" /> : (
        <>
          <View style={[s.blob, { backgroundColor: hue.deep, opacity: 0.22, right: -40, top: -50 }]} />
          <Icon name={e.icon || 'star'} size={iconSize} color="rgba(255,255,255,0.92)" stroke={1.6} />
        </>
      )}
    </View>
  );
}

export function SaveHeart({ id }: { id: string }) {
  const { saved, toggleSaved } = useStore();
  const on = saved.includes(id);
  return (
    <Pressable onPress={() => toggleSaved(id)} hitSlop={8} style={s.heartPos} accessibilityRole="button" accessibilityLabel={on ? 'Remove from saved' : 'Save event'}>
      <Glass style={s.heart}>
        <Icon name="heart" size={17} color={on ? '#E0445C' : C.ink} fill={on ? '#E0445C' : 'none'} />
      </Glass>
    </Pressable>
  );
}

// 'Girls only · Ages 13-15', or '' for everyone.
export function audienceLabel(e: EventItem) {
  const who = e.gender === 'girls' ? 'Girls only' : e.gender === 'boys' ? 'Boys only' : '';
  const ages = e.minAge != null && e.maxAge != null ? `Ages ${e.minAge}-${e.maxAge}` : e.minAge != null ? `Ages ${e.minAge}+` : e.maxAge != null ? `Up to age ${e.maxAge}` : '';
  return [who, ages].filter(Boolean).join(' · ');
}

export function EventMeta({ e }: { e: EventItem }) {
  const { going } = useStore();
  const mine = going.includes(e.id);
  return (
    <Text style={s.meta} numberOfLines={1}>
      <Text style={{ color: mine ? C.green : C.sub }}>{mine ? "You're signed up" : dateLabel(e)}</Text>
      {e.price ? <Text style={{ color: C.ink }}> · {e.price}</Text> : null}
      {audienceLabel(e) ? <Text style={{ color: C.blueDeep }}> · {audienceLabel(e)}</Text> : null}
    </Text>
  );
}

export function EventCard({ e, width }: { e: EventItem; width?: number }) {
  const { openEvent } = useStore();
  return (
    <View style={{ width }}>
      <Pressable onPress={() => openEvent(e.id)} style={({ pressed }) => pressed && s.pressed} accessibilityRole="button" accessibilityLabel={e.title}>
        <View style={s.evImgWrap}>
          <Cover e={e} style={s.fill} />
          <ScopeBadge scope={e.scope} style={s.tagPos} />
          <View style={s.badge}>
            <Text style={s.badgeText}>{countdown(e)}</Text>
          </View>
        </View>
        <Text style={[T.h3, { marginTop: 10 }]} numberOfLines={2}>{e.title}</Text>
        <EventMeta e={e} />
      </Pressable>
      <SaveHeart id={e.id} />
    </View>
  );
}

export function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.sectionHead}>
      <Text style={T.h2}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10} style={s.sectionAction} accessibilityRole="button">
          <Text style={s.link}>{action}</Text>
          <Icon name="right" size={15} color={C.blue} stroke={2.4} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Empty({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <View style={s.empty}>
      <IconTile icon={icon} size={56} />
      <Text style={[T.h3, { marginTop: 12 }]}>{title}</Text>
      <Text style={[T.small, { marginTop: 4, textAlign: 'center' }]}>{body}</Text>
    </View>
  );
}

// Bottom sheet used for event and challenge details.
export function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.sheetBack}>
        <Pressable style={s.fill} onPress={onClose} accessibilityLabel="Close" />
        <View style={s.sheet}>
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">{children}</ScrollView>
          <Pressable onPress={onClose} style={s.closePos} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <Glass style={s.close}>
              <Icon name="x" size={18} color={C.ink} stroke={2.4} />
            </Glass>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export const s = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' },
  card: { backgroundColor: C.card, borderRadius: R.card, padding: 16, ...shadow },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  chipsWrap: { flexGrow: 0, marginHorizontal: -20 },
  chips: { gap: 8, paddingHorizontal: 20, paddingVertical: 4 },
  chipsFlow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, height: 38, borderRadius: R.pill, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontSize: 14, fontWeight: '700', color: C.ink },
  chipTextOn: { color: C.white },
  btn: { minHeight: 50, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  btnSmall: { minHeight: 38, borderRadius: R.pill, paddingHorizontal: 16 },
  btnGhost: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  btnText: { fontSize: 16, fontWeight: '800' },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: C.sub, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 },
  input: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16, color: C.ink },
  inputMulti: { minHeight: 96, paddingVertical: 12, textAlignVertical: 'top' },
  switch: { width: 50, height: 30, borderRadius: 15, backgroundColor: '#C9D3DC', padding: 3, justifyContent: 'center' },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.white },
  scope: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  scopeText: { color: C.white, fontSize: 12, fontWeight: '800' },
  blob: { position: 'absolute', width: 200, height: 200, borderRadius: 100 },
  heartPos: { position: 'absolute', top: 10, right: 10 },
  heart: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  meta: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  evImgWrap: { borderRadius: 22, overflow: 'hidden', backgroundColor: C.line, aspectRatio: 16 / 10 },
  badge: { position: 'absolute', left: 10, bottom: 10, backgroundColor: 'rgba(19,32,44,0.78)', borderRadius: R.pill, paddingHorizontal: 11, paddingVertical: 6 },
  badgeText: { color: C.white, fontSize: 12, fontWeight: '800' },
  tagPos: { position: 'absolute', left: 10, top: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 30, marginBottom: 12 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  link: { color: C.blue, fontWeight: '800', fontSize: 14 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  sheetBack: { flex: 1, backgroundColor: 'rgba(19,32,44,0.45)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%', width: '100%', maxWidth: 560, overflow: 'hidden' },
  closePos: { position: 'absolute', right: 14, top: 14 },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
