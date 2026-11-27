// The older shared pieces, restyled to the Flyer look so every screen that still uses them
// inherits it. New screens should reach for the pieces in look.tsx first (its top comment lists
// them); the ones here keep their old names and props.
import React, { useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { C, F, HUES, R, SP, T, display, shadow } from './theme';
import { Icon, challengeIcon } from './icons';
import { IMAGES, dateLabel, repeatLabel, useStore, type ColorKey, type EventItem } from './store';
import { CloseButton, CountChip, DayBlock, Label, Photo, PosterStage, Slab, TextTabs, eventPicture, galleryCount, whenTag } from './look';

export { SectionHead } from './look';

// A quiet card-colored block. Only where a container is truly needed: forms and the leader panel.
// Teen-facing content sits straight on the page (use Row / Band from look.tsx instead).
export function Card({ children, style, onPress, label }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string }) {
  if (!onPress) return <View style={[s.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.card, style, pressed && s.pressed]}>
      {children}
    </Pressable>
  );
}

// Choice chips for forms: radius 8, hairline outline, the chosen one paper-white with dark text.
// `wrap` lets them flow onto more lines; without it they scroll sideways.
// `tabs` draws them as the text tabs used for filters (TextTabs in look.tsx) instead.
export function Chips<V extends string>({ options, value, onChange, wrap, tabs }: { options: readonly V[]; value: V; onChange: (v: V) => void; wrap?: boolean; tabs?: boolean }) {
  if (tabs) return <TextTabs options={options} value={value} onChange={onChange} />;
  const items = options.map((o) => {
    const on = o === value;
    return (
      <Pressable key={o} onPress={() => onChange(o)} style={[s.chip, on && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
        <Text style={[s.chipText, on && s.chipTextOn]} numberOfLines={1}>{o}</Text>
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

// The old button, drawn as a Slab: primary = cyan (orange when asked for), ghost, danger = red label.
export function Button({ label, onPress, kind = 'primary', icon, color, disabled, small }: { label: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; icon?: string; color?: string; disabled?: boolean; small?: boolean }) {
  const slab = kind === 'danger' ? 'danger' : kind === 'ghost' ? 'ghost' : color === C.orange || color === HUES.orange.solid ? 'orange' : 'cyan';
  return <Slab label={label} onPress={onPress} kind={slab} size={small ? 'md' : 'lg'} height={small ? 38 : 48} icon={icon} disabled={disabled} />;
}

export function Field({ label, value, onChange, placeholder, multiline, hint, secure }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; hint?: string; secure?: boolean }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.faint} multiline={multiline} secureTextEntry={secure} autoCapitalize={secure ? 'none' : undefined} accessibilityLabel={label}
        selectionColor={C.blue} keyboardAppearance="dark" onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} style={[s.input, multiline && s.inputMulti, focus && s.inputFocus]} />
      {hint ? <Text style={[T.small, s.hint]}>{hint}</Text> : null}
    </View>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable onPress={() => onChange(!value)} hitSlop={8} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} style={[s.switch, value && s.switchOn]}>
      <View style={[s.knob, value && { alignSelf: 'flex-end' }]} />
    </Pressable>
  );
}

// Leader panel only: an outlined square holding one icon. No fill, no pastel. (Teen-facing
// screens do not use icon tiles at all; `color` and `solid` are accepted and ignored.)
export function IconTile({ icon, size = 44 }: { icon: string; color?: ColorKey; size?: number; solid?: boolean }) {
  return (
    <View style={[s.tile, { width: size, height: size }]}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={C.ink} stroke={1.9} />
    </View>
  );
}

// "GREAT NECK" / "INTERNATIONAL" as a small dark tag. Old screens put it on top of a picture;
// on the page itself use a plain <Label> instead.
export function ScopeBadge({ scope, style }: { scope: 'gn' | 'intl'; style?: StyleProp<ViewStyle> }) {
  const gn = scope === 'gn';
  return (
    <View style={[s.scope, style]}>
      <Icon name={gn ? 'pin' : 'globe'} size={11} color={gn ? C.blue : C.ink} stroke={2.4} />
      <Label size={11} tone={gn ? 'blue' : 'ink'}>{gn ? 'Great Neck' : 'International'}</Label>
    </View>
  );
}

// A picture filling whatever box `style` gives it, cropped to fit (thumbnails in old screens).
// With no picture: a card-colored block with a faint icon, never a color wash.
// New code: use eventPicture() with Print / PosterStage / Photo / Thumb from look.tsx.
export function Cover({ e, style, iconSize = 56 }: { e: { id?: string; image?: string; poster?: string; cover?: string; icon: string; color: ColorKey }; style?: StyleProp<ViewStyle>; iconSize?: number }) {
  // A wide cover photo wins; the portrait poster/flyer is the fallback.
  const img = e.cover ? { uri: e.cover } : e.poster ? { uri: e.poster } : e.image ? IMAGES[e.image] : undefined;
  return (
    <View style={[s.cover, style]}>
      {img ? <Image source={img} style={s.fill} resizeMode="cover" /> : (
        <Icon name={e.id ? challengeIcon({ id: e.id, icon: e.icon || 'star' }) : e.icon || 'star'} size={Math.min(iconSize, 64)} color={C.faint} stroke={1.6} />
      )}
    </View>
  );
}

// The save heart: an outline, filled orange once saved.
export function SaveHeart({ id, style }: { id: string; style?: StyleProp<ViewStyle> }) {
  const { saved, toggleSaved } = useStore();
  const on = saved.includes(id);
  return (
    <Pressable onPress={() => toggleSaved(id)} hitSlop={6} style={({ pressed }) => [s.heart, style, pressed && { opacity: 0.55 }]} accessibilityRole="button" accessibilityLabel={on ? 'Remove from saved' : 'Save event'}>
      <Icon name="heart" size={22} color={on ? C.orange : C.sub} fill={on ? C.orange : 'none'} stroke={2} />
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
      <Text style={{ color: mine ? C.blue : C.sub }}>{mine ? "You're signed up" : repeatLabel(e) || dateLabel(e)}</Text>
      {e.price ? <Text style={{ color: C.ink }}> · {e.price}</Text> : null}
      {audienceLabel(e) ? <Text style={{ color: C.sub }}> · {audienceLabel(e)}</Text> : null}
    </Text>
  );
}

// One event in a list, as a block on the page (not a card): its picture whole (a photograph at
// 16:10, a poster on a PosterStage, nothing when it has none), then the date, a cyan time
// label, the title, a meta line, who is going, the save heart and the RSVP / IN chip.
export function EventCard({ e, width }: { e: EventItem; width?: number }) {
  const { openEvent, goingCount, going } = useStore();
  const n = e.signup === 'app' ? goingCount[e.id] ?? 0 : 0;
  const mine = going.includes(e.id);
  const picture = eventPicture(e);
  const meta = [repeatLabel(e), e.place, e.price, audienceLabel(e)].filter(Boolean).join(' · ');
  const goingLine = mine ? `You're in${n > 1 ? ` · ${n} going` : ''}` : n > 0 ? `${n} going` : '';
  const chip = e.signup !== 'app' ? null : mine ? <Slab size="chip" kind="outline" icon="tick" label="In" /> : <Slab size="chip" kind="paper" label="RSVP" onPress={() => openEvent(e.id)} accessibilityLabel={`RSVP to ${e.title}`} />;
  // A self-contained unit: what and when on top, then its picture, then what you can do about it.
  return (
    <View style={{ width }}>
      <Pressable onPress={() => openEvent(e.id)} style={({ pressed }) => pressed && s.pressed} accessibilityRole="button" accessibilityLabel={e.title}>
        <View style={s.evRow}>
          <DayBlock date={e.start} />
          <View style={s.evText}>
            <View style={s.evKickers}>
              {e.priority ? <Label size={11} tone="orange">Featured</Label> : null}
              <Label size={11} tone="blue" numberOfLines={1} style={{ flexShrink: 1 }}>{whenTag(e)}</Label>
            </View>
            <Text style={s.evTitle} numberOfLines={2}>{e.title}</Text>
            {meta ? <Text style={[T.small, { marginTop: 4 }]} numberOfLines={2}>{meta}</Text> : null}
          </View>
          <SaveHeart id={e.id} />
        </View>
        {picture ? (
          <View style={{ marginTop: 16 }}>
            {picture.kind === 'poster' ? <PosterStage source={picture.source} maxHeight={300} /> : <Photo source={picture.source} />}
            <CountChip n={galleryCount(e)} />
          </View>
        ) : null}
      </Pressable>
      {goingLine || chip ? (
        <View style={s.evFoot}>
          <Text style={[s.evGoing, mine && { color: C.blue }]}>{goingLine}</Text>
          {chip}
        </View>
      ) : null}
      {e.about ? <Text style={[T.small, { marginTop: 12 }]} numberOfLines={2}>{e.about}</Text> : null}
    </View>
  );
}

// No icon tile: one quiet headline and one line under it, left aligned, with room above.
export function Empty({ title, body }: { icon?: string; title: string; body: string }) {
  return (
    <View style={s.empty}>
      <Text style={[T.h2, { color: C.sub }]}>{title}</Text>
      <Text style={[T.small, { marginTop: 6 }]}>{body}</Text>
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
          <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" bounces={false} keyboardShouldPersistTaps="handled">{children}</ScrollView>
          <CloseButton onPress={onClose} style={s.closePos} />
        </View>
      </View>
    </Modal>
  );
}

// These names are also used directly by other files (as `u.chip`, `u.fieldLabel`, ...).
export const s = StyleSheet.create({
  // Note: the 100% size is measured inside the parent's padding. In a padded box use
  // StyleSheet.absoluteFill instead.
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' },
  card: { backgroundColor: C.card, borderRadius: R.card, padding: 16, ...shadow },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  // choice chips
  chipsWrap: { flexGrow: 0, marginHorizontal: -SP.gutter },
  chips: { gap: 8, paddingHorizontal: SP.gutter, paddingVertical: 2 },
  chipsFlow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, minHeight: 42, borderRadius: R.chip, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.lineStrong },
  chipOn: { backgroundColor: C.paper, borderColor: C.paper },
  chipText: { fontSize: 15, fontWeight: '600', color: C.ink },
  chipTextOn: { color: C.night },
  // form fields
  fieldLabel: { fontFamily: F.bold, fontSize: 12, lineHeight: 15, letterSpacing: 2, color: C.sub, textTransform: 'uppercase', marginBottom: 7 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.lineStrong, borderRadius: R.input, paddingHorizontal: 14, minHeight: 48, fontSize: 16, color: C.ink, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
  inputMulti: { minHeight: 96, paddingVertical: 12, textAlignVertical: 'top' },
  inputFocus: { borderColor: C.blue },
  hint: { marginTop: 5, fontSize: 12.5, lineHeight: 17 },
  switch: { width: 50, height: 30, borderRadius: 15, backgroundColor: C.track, padding: 3, justifyContent: 'center' },
  switchOn: { backgroundColor: C.blue },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.white },
  tile: { borderRadius: R.chip, borderWidth: 1, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' },
  scope: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 4, paddingHorizontal: 8, height: 22, alignSelf: 'flex-start', backgroundColor: C.onPhoto },
  cover: { backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  blob: { position: 'absolute', width: 200, height: 200, borderRadius: 100 },
  heart: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  meta: { fontSize: 13.5, lineHeight: 18, fontWeight: '500', color: C.sub, marginTop: 3 },
  // event block
  evRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SP.gap },
  evText: { flex: 1, minWidth: 0 },
  evKickers: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  evTitle: { ...display(26) },
  evFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 },
  evGoing: { flex: 1, fontSize: 14, fontWeight: '600', color: C.sub },
  // a link in the old screens: a cyan label
  link: { fontFamily: F.bold, fontSize: 12, lineHeight: 15, letterSpacing: 2, color: C.blue, textTransform: 'uppercase' },
  empty: { paddingTop: 44, paddingBottom: 20 },
  sheetBack: { flex: 1, backgroundColor: C.shade, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, maxHeight: '92%', width: '100%', maxWidth: 560, overflow: 'hidden' },
  closePos: { position: 'absolute', right: 14, top: 14 },
});
