/*
 * ───────────────────────────────────────────────────────────────────────────────────────────
 *  THE FLYER LOOK · shared pieces.  READ THIS BLOCK FIRST; you should not need the code below.
 * ───────────────────────────────────────────────────────────────────────────────────────────
 *  Dark navy, heavy slanted condensed capitals, one orange brush stroke per screen, posters
 *  shown whole. Content sits straight on the page, separated by hairlines. No boxed cards,
 *  no pastel icon tiles, no pill buttons, no shadows except under posters.
 *
 *  Tokens come from ./theme:
 *    C.*          colors (never a raw color in a screen, except black/white on top of a photo)
 *    T.hero/h1/h2/h3/eyebrow   condensed capitals      T.body/small/strong   Apple's system font
 *    display(n)   800 Italic capitals at size n         numeral(n, color)     900 Italic numbers
 *    upright(n)   700 upright capitals at size n        F.*   the raw families (never add
 *                                                             fontWeight or fontStyle to them)
 *    R.*  corners      SP.gutter 18 / SP.section 26 / SP.row 12 / SP.gap 14      SH.print (posters)
 *
 *  THE FRAME
 *    <Backdrop />                 The page background: navy, a glow at the top right, film grain.
 *                                 Absolutely fills its parent and does not scroll: put it first
 *                                 inside a `flex: 1` View. Tab pages already get it from <Screen>
 *                                 (shell.tsx); pages opened on top get it from <Page> or add it.
 *    <Page top? bottom? gutter? refreshControl? scroll?>
 *                                 A whole standalone page (account, settings, challenge...):
 *                                 Backdrop + a ScrollView + the 18 pt gutter column. `top` is the
 *                                 space under the status bar (default 56, room for the back button).
 *    <Band tone? bleed? onPress? accessibilityLabel? style>
 *                                 A full-width strip that bleeds past the gutter to both screen
 *                                 edges: faint fill, hairline on top and bottom. tone "plain"
 *                                 (default: scoreboard, Shabbat, invitations, the live banner),
 *                                 "orange" (solid orange; text on it uses tone "onOrange" /
 *                                 C.onOrange), "flat" (no fill, hairlines only). Its parent must
 *                                 have the page gutter; pass bleed={0} when it does not.
 *    <Hairline strong? vertical? style>   One 1 pt rule.
 *
 *  TEXT
 *    <Label tone? size? numberOfLines? onPress? style>   Small tracked capitals. tone: "sub"
 *                                 (default) | "blue" | "orange" | "faint" | "mute" | "ink" | "red"
 *                                 | "green" | "onOrange" | "onBlue" | "night". size 11, 12 (default)
 *                                 or 13. With onPress it is a link (44 pt tap area): this is how
 *                                 every "ALL EVENTS", "SEE ALL", "SEE THE EVENT" link is made.
 *    <SectionHead title action? onAction? right? top?>   Section title (T.h2) on the left; on the
 *                                 right a cyan Label link (`action` + `onAction`) or any `right`
 *                                 node. No chevron. `top` = space above (default 26). The rows
 *                                 under it start with their own 12 pt padding.
 *    <BrushTag label seed? size? style>   THE signature: an orange painted stroke with dark
 *                                 slanted text, tilted -2.2 degrees. AT MOST ONE PER SCREEN. It
 *                                 names the single most time-relevant thing ("TONIGHT · 6:00 PM",
 *                                 "TODAY", "DAY 10", "THIS SHABBAT"); if nothing on the screen is
 *                                 about time, there is none. `label` usually comes from
 *                                 whenTag(event). `seed` changes the stroke's shape (same seed,
 *                                 same stroke). `size` is the text size (22; 28 for a clock).
 *    <Stat value label size? tone? align? style>   A big slanted number or time with a Label
 *                                 under it ("4:11 PM" / "CANDLE LIGHTING"). size default 40.
 *    heroType(title)              The T.hero style, stepped down for long titles (over 22
 *                                 characters 44/41, over 34 characters 38/36).
 *
 *  BUTTONS
 *    <Slab label onPress? kind? size? height? icon? disabled? style accessibilityLabel? accessibilityState?>
 *                                 The button. A rectangle, never a pill.
 *                                 kind:  "cyan" (default) the main action · "orange" Snap / now ·
 *                                        "paper" a quiet action in a row (RSVP) · "outline" a done
 *                                        state ("YOU'RE IN" with icon="tick") · "ghost" secondary ·
 *                                        "danger" delete (red label).
 *                                 size:  "lg" 48 tall, label 23 (pass height={56} or {60} for the
 *                                        biggest) · "md" 36 tall, label 19 · "chip" 31 tall, label 15.
 *                                 In a column it fills the width; in a row it hugs its label.
 *                                 Without onPress it is drawn the same but is not tappable (a
 *                                 state, not an action). Small sizes get a 44 pt tap area.
 *    <TextTabs options value onChange style?>   Filter tabs as plain words (ALL · GREAT NECK ·
 *                                 SAVED): the selected one is ink with a slanted cyan bar under it.
 *    <CloseButton onPress label? style>   The round glass x for sheets and pop-ups (38 pt).
 *    From ./ui (old names, restyled to this look, same props as before):
 *      Button (maps onto Slab: primary = cyan, ghost, danger; `small` = md) · Chips (choice chips
 *      for forms; `tabs` turns them into TextTabs) · Field (labelled input) · Toggle (switch) ·
 *      Card (quiet card-colored block for forms and the leader panel ONLY) · Empty (text-only
 *      empty state) · IconTile (outlined square, leader panel only) · Sheet · SaveHeart ·
 *      EventCard / EventMeta / Cover / ScopeBadge (see ui.tsx).
 *
 *  LISTS
 *    <Row title kicker? kickerTone? meta? metaLines? foot? footTone? titleLines?
 *         date? lead? thumb? right? value? chevron? onPress? accessibilityLabel? last? style>
 *                                 The list row everything uses. Left: `date` (a YYYY-MM-DD string,
 *                                 drawn as a DayBlock) or any `lead` node (a Thumb, a TimeBlock, a
 *                                 small Print). Middle: an optional `kicker` Label above the title
 *                                 ("FEATURED"), the title (T.h3, 1 or 2 lines), a `meta` line
 *                                 (T.small) and a `foot` Label line ("PINNED · NEWS · 1D"). Right:
 *                                 a `thumb` picture (56 pt square), any `right` node (a chip Slab,
 *                                 a Toggle), a `value` (cyan text: a phone number) and/or a
 *                                 `chevron` (only when the row just navigates and has no chip).
 *                                 A hairline is drawn under it; pass `last` on the final row of a
 *                                 group to drop it. Extra content can go in as children (shown
 *                                 under the text, for rows that expand).
 *    <DayBlock date big? align? style>   The date at the left of a row: a cyan label (the weekday
 *                                 within 7 days, otherwise the month; "TODAY" in orange) over the
 *                                 slanted day number. 42 wide. `big` = the 64 pt version for a
 *                                 hero without a picture.
 *    <TimeBlock time style>       The same shape for a time: "6:00" over "PM" (Calendar rows).
 *    <Thumb source size? radius? style>   A small square picture (56, radius 5).
 *    <Ticks total done pending? height? style>   Progress as slanted bars: `done` cyan bars, then
 *                                 (when `pending`) today's bar outlined in orange, the rest dim.
 *                                 One bar per unit up to 30; more units are scaled to 30 bars.
 *
 *  PICTURES  (a poster is never cropped to another shape and never has text on it)
 *    eventPicture(event)          -> { source, kind: 'poster' | 'photo' } or null. The one place
 *                                 that decides which picture an event shows and whether it is a
 *                                 poster (a flyer, shown whole) or a photograph (may be cropped).
 *    <Print source width? tilt? onPress? accessibilityLabel? style>   A poster shown whole and
 *                                 tilted like a print taped to a wall: 128 wide (150 when the
 *                                 picture is wider than tall), height from the picture's real
 *                                 proportions, deep shadow. Pass width={52} for a small one.
 *    <PosterStage source maxHeight? radius? onPress? accessibilityLabel? style>   A poster shown
 *                                 large and whole, centered on a blurred matte made from itself.
 *                                 Full width; as tall as the poster needs, up to maxHeight (300).
 *                                 Children are drawn on top (a close button).
 *    <Photo source ratio? radius? onPress? accessibilityLabel? style>   A photograph, full width,
 *                                 16:10, radius 6, cropped to fill.
 *    useAspect(source, fallback?) -> width / height of a picture (bundled or remote).
 *
 *  PEOPLE AND STATE
 *    <Avatar name size? ring? uri? style>   The profile circle: the first initial on navy with a
 *                                 cyan ring. 34 with a 2 pt ring in the header; 84 with ring={3}
 *                                 on the account page. `uri` shows a photo instead.
 *    <LiveDot color? size?>       A small dot that breathes (still when Reduce motion is on).
 *
 *  HELPERS
 *    prettyTime('6:00pm')         -> '6:00 PM'. Anything it does not recognise comes back as typed.
 *    whenTag(event)               -> the text for a BrushTag or Label: "TONIGHT · 6:00 PM" (today,
 *                                 5 PM or later), "TODAY · 10:15 AM" / "TODAY", "TOMORROW · 7:30 PM",
 *                                 "THIS SUNDAY · 10:15 AM" (within 6 days), "HAPPENING NOW" (a
 *                                 multi-day event that has started), otherwise the date
 *                                 ("DEC 10 – 11"). Weekly events use their next date.
 *    dateRange(event)             -> "DEC 10 – 11" / "NOV 29" (no year), for meta lines.
 *    hebrewDate()                 -> "15 Kislev" ('' when the phone cannot work it out; after
 *                                 sunset it is tomorrow's date).
 *
 *  RULES OF THE LOOK
 *    · Condensed capitals are for titles, numbers, labels and buttons. Sentences (post bodies,
 *      About text, comments, hints, form values) are T.body / T.small, as typed.
 *    · Text on cyan: C.onBlue. On orange: C.onOrange. On paper: C.night. Never C.white.
 *    · Tap targets 44 pt, accessibilityRole / accessibilityLabel on everything tappable.
 *    · Any motion you add checks PREFS.reduceMotion.
 * ───────────────────────────────────────────────────────────────────────────────────────────
 */
import React, { useEffect, useId, useRef, useState } from 'react';
import { Animated, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type AccessibilityState, type ImageSourcePropType, type ScrollViewProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { C, F, PREFS, R, SH, SP, T, display, numeral } from './theme';
import { brushPath } from './brush';
import { Icon } from './icons';
import { Glass } from './glass';
import { IMAGES, daysUntil, withNextDate, type EventItem } from './store';
import { nyDate, sunTimes } from './zmanim';

const ND = Platform.OS !== 'web';

// A picture: a bundled image (require), a { uri } source, or just the address.
export type Pic = ImageSourcePropType | string;
const toSource = (p: Pic): ImageSourcePropType => (typeof p === 'string' ? { uri: p } : p);

// SVG gradients need an id nobody else on the page uses.
function useSvgId(prefix: string) {
  return prefix + useId().replace(/[^a-zA-Z0-9]/g, '');
}

// ───────────────────────── the frame ─────────────────────────

// The page background. radial-gradient(130% 55% at 85% -8%, bgGlow, bg 62%) from the mockup:
// the glow only reaches the top quarter, so it is one rectangle over the top 42.3% of the page
// (130% of that rectangle's height is 55% of the page). Then the film grain, tiled.
export function Backdrop({ grain = true }: { grain?: boolean }) {
  const id = useSvgId('bd');
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, bd.root]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={id} cx="85%" cy="-18.9%" r="130%">
            <Stop offset="0" stopColor={C.bgGlow} stopOpacity={1} />
            <Stop offset="0.62" stopColor={C.bg} stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="42.3%" fill={`url(#${id})`} />
      </Svg>
      {grain ? <Image source={require('../assets/look/grain.png')} resizeMode="repeat" style={bd.grain} /> : null}
    </View>
  );
}
const bd = StyleSheet.create({
  root: { backgroundColor: C.bg, overflow: 'hidden' },
  grain: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0.5 },
});

export function Page({ children, top = 56, bottom = 40, gutter = true, scroll = true, refreshControl, keyboardShouldPersistTaps = 'handled' }: {
  children: React.ReactNode; top?: number; bottom?: number; gutter?: boolean; scroll?: boolean;
  refreshControl?: ScrollViewProps['refreshControl']; keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
}) {
  const insets = useSafeAreaInsets();
  const col = <View style={[pg.col, gutter && pg.gutter]}>{children}</View>;
  return (
    <View style={pg.root}>
      <Backdrop />
      {scroll ? (
        <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" keyboardShouldPersistTaps={keyboardShouldPersistTaps} style={pg.fill} refreshControl={refreshControl}
          contentContainerStyle={{ paddingTop: insets.top + top, paddingBottom: insets.bottom + bottom }}>
          {col}
        </ScrollView>
      ) : (
        <View style={[pg.fill, { paddingTop: insets.top + top, paddingBottom: insets.bottom + bottom }]}>{col}</View>
      )}
    </View>
  );
}
const pg = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  fill: { flex: 1 },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  gutter: { paddingHorizontal: SP.gutter },
});

export function Band({ children, tone = 'plain', bleed = SP.gutter, onPress, accessibilityLabel, accessibilityRole = 'button', style }: {
  children: React.ReactNode; tone?: 'plain' | 'orange' | 'flat'; bleed?: number; onPress?: () => void;
  accessibilityLabel?: string; accessibilityRole?: 'button' | 'link'; style?: StyleProp<ViewStyle>;
}) {
  const id = useSvgId('bn');
  const box = [bn.box, { marginHorizontal: -bleed, paddingHorizontal: bleed || SP.gutter }, tone === 'orange' ? bn.orange : bn.lined, style];
  const fill = tone === 'plain' ? (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={C.white} stopOpacity={0.06} />
          <Stop offset="1" stopColor={C.white} stopOpacity={0.025} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  ) : null;
  if (!onPress) return <View style={box}>{fill}{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole={accessibilityRole} accessibilityLabel={accessibilityLabel} style={({ pressed }) => [box, pressed && bn.pressed]}>
      {fill}{children}
    </Pressable>
  );
}
const bn = StyleSheet.create({
  box: { paddingTop: 12, paddingBottom: 13 },
  lined: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.lineStrong },
  orange: { backgroundColor: C.orange },
  pressed: { opacity: 0.88 },
});

export function Hairline({ strong, vertical, style }: { strong?: boolean; vertical?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[vertical ? hl.v : hl.h, { backgroundColor: strong ? C.lineStrong : C.line }, style]} />;
}
const hl = StyleSheet.create({ h: { height: 1, alignSelf: 'stretch' }, v: { width: 1, alignSelf: 'stretch' } });

// ───────────────────────── text ─────────────────────────

const TONES = { sub: C.sub, blue: C.blue, orange: C.orangeText, faint: C.faint, mute: C.mute, ink: C.ink, red: C.red, green: C.green, onOrange: C.onOrange, onBlue: C.onBlue, night: C.night } as const;
export type Tone = keyof typeof TONES;

export function Label({ children, tone = 'sub', size = 12, numberOfLines, onPress, accessibilityLabel, style }: {
  children: React.ReactNode; tone?: Tone; size?: 11 | 12 | 13; numberOfLines?: number; onPress?: () => void; accessibilityLabel?: string; style?: StyleProp<TextStyle>;
}) {
  const text = (
    <Text numberOfLines={numberOfLines} style={[lb.text, { fontSize: size, lineHeight: size + 3, letterSpacing: size === 13 ? 2.1 : size === 11 ? 1.8 : 2, color: TONES[tone] }, style]}>
      {children}
    </Text>
  );
  if (!onPress) return text;
  return (
    <Pressable onPress={onPress} hitSlop={15} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => pressed && lb.pressed}>
      {text}
    </Pressable>
  );
}
const lb = StyleSheet.create({
  text: { fontFamily: F.bold, textTransform: 'uppercase' },
  pressed: { opacity: 0.55 },
});

export function SectionHead({ title, action, onAction, right, top = SP.section, style }: {
  title: string; action?: string; onAction?: () => void; right?: React.ReactNode; top?: number; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[sh.row, { marginTop: top }, style]}>
      <Text style={[T.h2, sh.title]} numberOfLines={1} accessibilityRole="header">{title}</Text>
      {right ?? (action ? <Label tone="blue" onPress={onAction}>{action}</Label> : null)}
    </View>
  );
}
const sh = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  title: { flexShrink: 1 },
});

// The orange painted stroke. The label is measured, then the stroke is drawn behind it:
// 46 wider than the text (13 before it, the frayed tails after it) and 1.62 x the text size tall.
export function BrushTag({ label, seed = 7, size = 22, style }: { label: string; seed?: number; size?: number; style?: StyleProp<ViewStyle> }) {
  const pad = Math.ceil(size * 0.12); // room for the slant of the last letter
  // The box hugs the text (13 before it, 33 after it); a fair guess at its width until the
  // real one arrives, so the stroke never pops in from nothing.
  const [w, setW] = useState(() => Math.round(label.length * size * 0.46) + 10 + 46);
  const h = Math.round(size * 1.62);
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={label} style={[bt.box, { height: h, paddingRight: 33 - pad }, style]}
      onLayout={(e) => { const n = Math.ceil(e.nativeEvent.layout.width); if (n > 0 && n !== w) setW(n); }}>
      <Svg width={w} height={h} style={bt.stroke}>
        <Path d={brushPath(w, h, seed)} fill={C.orange} />
      </Svg>
      <Text numberOfLines={1} style={[bt.text, { fontSize: size, lineHeight: Math.round(size * 1.1), paddingRight: pad }]}>{label}</Text>
    </View>
  );
}
const bt = StyleSheet.create({
  box: { alignSelf: 'flex-start', justifyContent: 'center', paddingLeft: 13, transform: [{ rotate: '-2.2deg' }], transformOrigin: 'left center' },
  stroke: { position: 'absolute', left: 0, top: 0 },
  text: { fontFamily: F.display, letterSpacing: 0.8, color: C.onOrange, textTransform: 'uppercase' },
});

export function Stat({ value, label, size = 40, tone = 'ink', align = 'left', style }: {
  value: string; label: string; size?: number; tone?: Tone; align?: 'left' | 'center' | 'right'; style?: StyleProp<ViewStyle>;
}) {
  const side = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  return (
    <View style={[{ alignItems: side }, style]}>
      <Text style={numeral(size, TONES[tone])} numberOfLines={1}>{value}</Text>
      <Label style={{ marginTop: 2 }}>{label}</Label>
    </View>
  );
}

export function heroType(title: string): TextStyle {
  const n = title.trim().length;
  if (n > 34) return { ...T.hero, fontSize: 38, lineHeight: 36, paddingRight: 5 };
  if (n > 22) return { ...T.hero, fontSize: 44, lineHeight: 41, paddingRight: 6 };
  return T.hero;
}

// ───────────────────────── buttons ─────────────────────────

export type SlabKind = 'cyan' | 'orange' | 'paper' | 'outline' | 'ghost' | 'danger';
export type SlabSize = 'lg' | 'md' | 'chip';
const SLAB_SIZE = {
  lg: { h: 48, r: R.btn, font: 23, pad: 20, icon: 20, gap: 8 },
  md: { h: 36, r: R.btnSm, font: 19, pad: 20, icon: 16, gap: 6 },
  chip: { h: 31, r: R.chip, font: 15, pad: 12, icon: 13, gap: 5 },
} as const;
const SLAB_KIND: Record<SlabKind, { fg: string; box: ViewStyle }> = {
  cyan: { fg: C.onBlue, box: { backgroundColor: C.blue } },
  orange: { fg: C.onOrange, box: { backgroundColor: C.orange } },
  paper: { fg: C.night, box: { backgroundColor: C.paper } },
  outline: { fg: C.blue, box: { borderWidth: 1.5, borderColor: C.blue } },
  ghost: { fg: C.ink, box: { borderWidth: 1, borderColor: C.lineStrong } },
  danger: { fg: C.red, box: { borderWidth: 1, borderColor: C.lineStrong } },
};

export function Slab({ label, onPress, kind = 'cyan', size = 'lg', height, icon, disabled, style, accessibilityLabel, accessibilityState }: {
  label: string; onPress?: () => void; kind?: SlabKind; size?: SlabSize; height?: number; icon?: string; disabled?: boolean;
  style?: StyleProp<ViewStyle>; accessibilityLabel?: string; accessibilityState?: AccessibilityState;
}) {
  const z = SLAB_SIZE[size];
  const k = SLAB_KIND[kind];
  const h = height ?? z.h;
  const box: StyleProp<ViewStyle> = [sl.box, { minHeight: h, borderRadius: z.r, paddingHorizontal: z.pad, gap: z.gap }, k.box, disabled && sl.off, style];
  const inside = (
    <>
      {icon ? <Icon name={icon} size={z.icon} color={k.fg} stroke={2.8} /> : null}
      <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75} style={[sl.label, { fontSize: z.font, lineHeight: Math.round(z.font * 1.1), color: k.fg }]}>{label}</Text>
    </>
  );
  if (!onPress) return <View accessible accessibilityRole="text" accessibilityLabel={accessibilityLabel ?? label} style={box}>{inside}</View>;
  const slop = Math.max(0, Math.ceil((44 - h) / 2));
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={slop ? { top: slop, bottom: slop, left: 4, right: 4 } : undefined}
      accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      style={({ pressed }) => [box, pressed && sl.pressed]}>
      {inside}
    </Pressable>
  );
}
const sl = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 3 },
  label: { fontFamily: F.display, letterSpacing: 1.1, textTransform: 'uppercase', textAlign: 'center', paddingHorizontal: 2, flexShrink: 1 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  off: { opacity: 0.45 },
});

export function TextTabs<V extends string>({ options, value, onChange, style }: { options: readonly V[]; value: V; onChange: (v: V) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[tt.wrap, style]} contentContainerStyle={tt.row}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onChange(o)} style={tt.tab} accessibilityRole="button" accessibilityState={{ selected: on }}>
            <Text style={[tt.text, on && tt.textOn]}>{o}</Text>
            <View style={[tt.bar, on && tt.barOn]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
const tt = StyleSheet.create({
  wrap: { flexGrow: 0, marginHorizontal: -SP.gutter },
  row: { paddingHorizontal: SP.gutter, gap: 24 },
  tab: { minHeight: 44, justifyContent: 'center' },
  text: { fontFamily: F.bold, fontSize: 16, lineHeight: 18, letterSpacing: 0.9, color: C.sub, textTransform: 'uppercase' },
  textOn: { color: C.ink },
  bar: { height: 3, marginTop: 5, borderRadius: 1, transform: [{ skewX: '-16deg' }] },
  barOn: { backgroundColor: C.blue },
});

export function CloseButton({ onPress, label = 'Close', style }: { onPress: () => void; label?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [style, pressed && { opacity: 0.6 }]}>
      <Glass style={cb.circle}>
        <Icon name="x" size={18} color={C.ink} stroke={2.4} />
      </Glass>
    </Pressable>
  );
}
const cb = StyleSheet.create({ circle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } });

// ───────────────────────── lists ─────────────────────────

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const WEEKDAYS_LONG = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const parseDay = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };

export function DayBlock({ date, big, align = 'center', style }: { date: string; big?: boolean; align?: 'left' | 'center' | 'right'; style?: StyleProp<ViewStyle> }) {
  const dt = parseDay(date);
  const n = daysUntil(date);
  const today = n === 0;
  const label = today ? 'TODAY' : n > 0 && n < 7 ? WEEKDAYS[dt.getDay()] : MONTHS[dt.getMonth()];
  const side = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  return (
    <View style={[big ? null : db.box, { alignItems: side }, style]} accessible accessibilityLabel={dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}>
      <Text style={[big ? db.labelBig : db.label, today && db.today]} numberOfLines={1}>{label}</Text>
      <Text style={big ? db.numBig : db.num} numberOfLines={1}>{dt.getDate()}</Text>
    </View>
  );
}
const db = StyleSheet.create({
  box: { width: 42 },
  label: { fontFamily: F.bold, fontSize: 11, lineHeight: 12, letterSpacing: 1.8, color: C.blue, marginRight: -1.8 },
  labelBig: { fontFamily: F.bold, fontSize: 13, lineHeight: 15, letterSpacing: 2.1, color: C.blue },
  today: { color: C.orangeText },
  num: { fontFamily: F.display, fontSize: 29, lineHeight: 29, color: C.ink, marginTop: 2, paddingHorizontal: 3 },
  numBig: { fontFamily: F.display, fontSize: 64, lineHeight: 60, color: C.ink, paddingRight: 8 },
});

export function TimeBlock({ time, style }: { time: string; style?: StyleProp<ViewStyle> }) {
  const pretty = prettyTime(time);
  const m = /^(\d{1,2}:\d{2}) (AM|PM)$/.exec(pretty);
  return (
    <View style={[tb.box, style]} accessible accessibilityLabel={pretty}>
      {m ? (
        <>
          <Text style={tb.time} numberOfLines={1}>{m[1]}</Text>
          <Text style={tb.half} numberOfLines={1}>{m[2]}</Text>
        </>
      ) : <Text style={tb.typed} numberOfLines={2}>{pretty}</Text>}
    </View>
  );
}
const tb = StyleSheet.create({
  box: { width: 50, alignItems: 'center' },
  time: { ...display(20), paddingHorizontal: 2, paddingRight: 2 },
  half: { fontFamily: F.bold, fontSize: 11, lineHeight: 12, letterSpacing: 1.8, color: C.blue, marginRight: -1.8, marginTop: 1 },
  typed: { fontFamily: F.bold, fontSize: 13, lineHeight: 15, letterSpacing: 0.5, color: C.ink, textTransform: 'uppercase', textAlign: 'center' },
});

export function Thumb({ source, size = 56, radius = R.print, style }: { source: Pic; size?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: C.card }, style]}>
      <Image source={toSource(source)} style={pic.fill} resizeMode="cover" />
    </View>
  );
}

export function Row({ title, titleLines = 2, kicker, kickerTone = 'orange', meta, metaLines = 1, foot, footTone = 'sub', date, lead, thumb, right, value, chevron, onPress, accessibilityLabel, last, style, children }: {
  title: string; titleLines?: number; kicker?: string; kickerTone?: Tone; meta?: string; metaLines?: number; foot?: string; footTone?: Tone;
  date?: string; lead?: React.ReactNode; thumb?: Pic; right?: React.ReactNode; value?: string; chevron?: boolean;
  onPress?: () => void; accessibilityLabel?: string; last?: boolean; style?: StyleProp<ViewStyle>; children?: React.ReactNode;
}) {
  const box = [rw.row, !last && rw.rule, style];
  const inside = (
    <>
      {date ? <DayBlock date={date} /> : lead ?? null}
      <View style={rw.text}>
        {kicker ? <Label tone={kickerTone} size={11} numberOfLines={1} style={rw.kicker}>{kicker}</Label> : null}
        <Text style={T.h3} numberOfLines={titleLines}>{title}</Text>
        {meta ? <Text style={[T.small, rw.meta]} numberOfLines={metaLines}>{meta}</Text> : null}
        {foot ? <Label tone={footTone} size={11} numberOfLines={1} style={rw.foot}>{foot}</Label> : null}
        {children}
      </View>
      {thumb ? <Thumb source={thumb} /> : null}
      {value ? <Text style={rw.value} numberOfLines={1}>{value}</Text> : null}
      {right ?? null}
      {chevron ? <Icon name="right" size={16} color={C.faint} stroke={2.4} /> : null}
    </>
  );
  if (!onPress) return <View style={box}>{inside}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => [box, pressed && rw.pressed]}>
      {inside}
    </Pressable>
  );
}
const rw = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SP.gap, paddingVertical: SP.row, minHeight: 56 },
  rule: { borderBottomWidth: 1, borderBottomColor: C.line },
  pressed: { opacity: 0.6 },
  text: { flex: 1, minWidth: 0 },
  kicker: { marginBottom: 3 },
  meta: { marginTop: 3 },
  foot: { marginTop: 5 },
  value: { fontSize: 15, fontWeight: '600', color: C.blue, fontVariant: ['tabular-nums'], flexShrink: 0 },
});

export function Ticks({ total, done, pending, height = 14, style }: { total: number; done: number; pending?: boolean; height?: number; style?: StyleProp<ViewStyle> }) {
  const bars = Math.max(1, Math.min(30, Math.round(total)));
  const on = Math.max(0, Math.min(bars, Math.round(total > 30 ? (done / total) * bars : done)));
  return (
    <View style={[tk.row, style]} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: Math.round(total), now: Math.round(done) }}>
      {Array.from({ length: bars }, (_, i) => (
        <View key={i} style={[tk.bar, { height }, i < on ? tk.on : i === on && pending ? tk.now : null]} />
      ))}
    </View>
  );
}
const tk = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, borderRadius: 1.5, backgroundColor: C.tick, transform: [{ skewX: '-16deg' }] },
  on: { backgroundColor: C.blue },
  now: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.orange },
});

// ───────────────────────── pictures ─────────────────────────

const ratios: Record<string, number> = {}; // remote pictures we have already measured
function knownAspect(p: Pic): number | null {
  if (typeof p === 'number') {
    const r = Image.resolveAssetSource ? Image.resolveAssetSource(p) : null;
    return r && r.width && r.height ? r.width / r.height : null;
  }
  if (p && typeof p === 'object' && !Array.isArray(p)) {
    const o = p as { width?: number; height?: number; uri?: string };
    if (o.width && o.height) return o.width / o.height;
    if (o.uri && ratios[o.uri]) return ratios[o.uri];
  }
  if (typeof p === 'string' && ratios[p]) return ratios[p];
  return null;
}
const uriOf = (p: Pic | null | undefined) => (typeof p === 'string' ? p : p && typeof p === 'object' && !Array.isArray(p) ? (p as { uri?: string }).uri : undefined);

export function useAspect(source: Pic | null | undefined, fallback = 0.8): number {
  const uri = uriOf(source);
  const key = typeof source === 'number' ? source : uri;
  const [ratio, setRatio] = useState<number | null>(() => (source != null ? knownAspect(source) : null));
  useEffect(() => {
    const k = source != null ? knownAspect(source) : null;
    setRatio(k);
    if (k || !uri) return;
    let alive = true;
    Image.getSize(uri, (w, h) => { if (w > 0 && h > 0) { ratios[uri] = w / h; if (alive) setRatio(w / h); } }, () => {});
    return () => { alive = false; };
  }, [key]);
  return ratio ?? fallback;
}

export function eventPicture(e: Pick<EventItem, 'image' | 'poster' | 'cover' | 'fullPoster'>): { source: ImageSourcePropType; kind: 'poster' | 'photo' } | null {
  if (e.cover) return { source: { uri: e.cover }, kind: e.fullPoster ? 'poster' : 'photo' };
  if (e.poster) return { source: { uri: e.poster }, kind: 'poster' };
  if (e.image && IMAGES[e.image]) return { source: IMAGES[e.image], kind: 'photo' };
  return null;
}

export function Print({ source, width, tilt = -3.4, onPress, accessibilityLabel, style }: {
  source: Pic; width?: number; tilt?: number; onPress?: () => void; accessibilityLabel?: string; style?: StyleProp<ViewStyle>;
}) {
  const ratio = useAspect(source, 128 / 154);
  const base = width ?? (ratio > 1.05 ? 150 : 128);
  const k = base / (ratio > 1.05 && !width ? 150 : 128); // the 100..176 limits are for the full-size print
  let w = base;
  let h = w / ratio;
  let whole = true; // the box has the picture's own shape
  if (h > 176 * k) { h = 176 * k; w = h * ratio; }
  else if (h < 100 * k) { h = 100 * k; w = Math.min(h * ratio, base * 1.15); whole = Math.abs(w / h - ratio) < 0.01; }
  const small = base < 100;
  const box = [pr.box, small ? SH.printSmall : SH.print, { width: Math.round(w), height: Math.round(h), transform: [{ rotate: `${tilt}deg` }] }, style];
  const inside = (
    <>
      <View style={pr.clip}>
        <Image source={toSource(source)} style={pic.fill} resizeMode={whole ? 'cover' : 'contain'} accessibilityLabel={onPress ? undefined : accessibilityLabel} />
      </View>
      <View pointerEvents="none" style={pr.edge} />
    </>
  );
  if (!onPress) return <View style={box}>{inside}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => [box, pressed && { opacity: 0.9 }]}>
      {inside}
    </Pressable>
  );
}
const pr = StyleSheet.create({
  box: { borderRadius: R.print, backgroundColor: C.card },
  clip: { flex: 1, borderRadius: R.print, overflow: 'hidden' },
  edge: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: R.print, borderWidth: 1, borderColor: C.printEdge },
});
const pic = StyleSheet.create({ fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' } });

export function PosterStage({ source, maxHeight = 300, radius = R.photo, onPress, accessibilityLabel, style, children }: {
  source: Pic; maxHeight?: number; radius?: number; onPress?: () => void; accessibilityLabel?: string; style?: StyleProp<ViewStyle>; children?: React.ReactNode;
}) {
  const ratio = useAspect(source, 0.8);
  const win = useWindowDimensions();
  const [w, setW] = useState(() => Math.min(win.width, 560) - SP.gutter * 2);
  const h = Math.max(80, Math.min(Math.round(w / ratio), maxHeight));
  const src = toSource(source);
  const box = [ps.box, { height: h, borderRadius: radius }, style];
  const inside = (
    <>
      {/* the matte: the same picture, blurred and dimmed (scaled up so its soft edge stays outside) */}
      <Image source={src} blurRadius={28} resizeMode="cover" style={ps.matte} />
      <Image source={src} resizeMode="contain" style={pic.fill} accessibilityLabel={onPress ? undefined : accessibilityLabel} />
      {children}
    </>
  );
  const onLayout = (e: { nativeEvent: { layout: { width: number } } }) => { const n = e.nativeEvent.layout.width; if (n > 0 && Math.abs(n - w) > 0.5) setW(n); };
  if (!onPress) return <View style={box} onLayout={onLayout}>{inside}</View>;
  return (
    <Pressable onPress={onPress} onLayout={onLayout} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => [box, pressed && { opacity: 0.92 }]}>
      {inside}
    </Pressable>
  );
}
const ps = StyleSheet.create({
  box: { width: '100%', overflow: 'hidden', backgroundColor: C.card },
  matte: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0.45, transform: [{ scale: 1.25 }] },
});

export function Photo({ source, ratio = 16 / 10, radius = R.photo, onPress, accessibilityLabel, style, children }: {
  source: Pic; ratio?: number; radius?: number; onPress?: () => void; accessibilityLabel?: string; style?: StyleProp<ViewStyle>; children?: React.ReactNode;
}) {
  const box = [ph.box, { aspectRatio: ratio, borderRadius: radius }, style];
  const inside = (
    <>
      <Image source={toSource(source)} resizeMode="cover" style={pic.fill} accessibilityLabel={onPress ? undefined : accessibilityLabel} />
      {children}
    </>
  );
  if (!onPress) return <View style={box}>{inside}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => [box, pressed && { opacity: 0.92 }]}>
      {inside}
    </Pressable>
  );
}
const ph = StyleSheet.create({ box: { width: '100%', overflow: 'hidden', backgroundColor: C.card } });

// ───────────────────────── people and state ─────────────────────────

export function Avatar({ name, size = 34, ring = 2, uri, style }: { name?: string; size?: number; ring?: number; uri?: string | null; style?: StyleProp<ViewStyle> }) {
  const outer = size + ring * 2;
  const initial = (name || '').trim()[0];
  return (
    <View style={[av.box, { width: outer, height: outer, borderRadius: outer / 2, borderWidth: ring }, style]}>
      {uri ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : initial ? <Text style={[av.initial, { fontSize: Math.round(size * 0.41) }]}>{initial.toUpperCase()}</Text>
          : <Icon name="user" size={Math.round(size * 0.5)} color={C.white} stroke={2.2} />}
    </View>
  );
}
const av = StyleSheet.create({
  box: { backgroundColor: C.avatar, borderColor: C.blue, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { color: C.white, fontWeight: '700' },
});

export function LiveDot({ color = C.red, size = 7 }: { color?: string; size?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (PREFS.reduceMotion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 900, useNativeDriver: ND }),
      Animated.timing(a, { toValue: 0, duration: 900, useNativeDriver: ND }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: a.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) }} />;
}

// ───────────────────────── helpers ─────────────────────────

// Hour and minute of a typed time ("6:00pm", "10:15 AM", "7pm"), or null when it is something else.
function clockOf(time?: string): { h: number; m: number } | null {
  const x = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s?m\.?\s*$/i.exec(time || '');
  if (!x) return null;
  const hour = Number(x[1]), min = Number(x[2] || 0);
  if (hour < 1 || hour > 12 || min > 59) return null;
  return { h: (hour % 12) + (x[3].toLowerCase() === 'p' ? 12 : 0), m: min };
}

export function prettyTime(time?: string): string {
  const c = clockOf(time);
  if (!c) return (time || '').trim();
  return `${((c.h + 11) % 12) + 1}:${String(c.m).padStart(2, '0')} ${c.h < 12 ? 'AM' : 'PM'}`;
}

export function dateRange(e: Pick<EventItem, 'start' | 'end'>): string {
  const a = parseDay(e.start), b = parseDay(e.end || e.start);
  const left = `${MONTHS[a.getMonth()]} ${a.getDate()}`;
  if (!e.end || e.start === e.end) return left;
  return `${left} – ${a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear() ? b.getDate() : `${MONTHS[b.getMonth()]} ${b.getDate()}`}`;
}

export function whenTag(event: EventItem): string {
  const e = withNextDate(event);
  const n = daysUntil(e.start);
  const clock = clockOf(e.time);
  const at = e.time ? ` · ${prettyTime(e.time).toUpperCase()}` : '';
  if (n === 0) return (clock && clock.h >= 17 ? 'TONIGHT' : 'TODAY') + at;
  if (n === 1) return 'TOMORROW' + at;
  if (n > 1 && n <= 6) return `THIS ${WEEKDAYS_LONG[parseDay(e.start).getDay()]}${at}`;
  if (n < 0 && daysUntil(e.end || e.start) >= 0) return 'HAPPENING NOW';
  return dateRange(e);
}

const HEBREW_MONTHS = /^(\d{1,2}) (Tishri|Tishrei|Heshvan|Cheshvan|Kislev|Tevet|Shevat|Shvat|Adar|Adar I|Adar II|Nisan|Iyar|Iyyar|Sivan|Tamuz|Tammuz|Av|Elul)$/;
export function hebrewDate(now: Date = new Date()): string {
  try {
    const [y, m, d] = nyDate(now).split('-').map(Number);
    const night = now.getTime() > sunTimes(nyDate(now)).set; // the Hebrew day starts at sunset
    const noon = new Date(Date.UTC(y, m - 1, d + (night ? 1 : 0), 12));
    const parts = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long', timeZone: 'UTC' }).formatToParts(noon);
    const part = (type: string) => (parts.find((p) => p.type === type)?.value ?? '').trim();
    const text = `${part('day')} ${part('month')}`;
    return HEBREW_MONTHS.test(text) ? text : ''; // a phone that does not know the Hebrew calendar answers "25 November"
  } catch {
    return '';
  }
}
