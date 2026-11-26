import React from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { C } from './theme';

// True on iOS 26+ where the system Liquid Glass material exists.
export const LIQUID = (() => {
  try {
    return Platform.OS === 'ios' && isLiquidGlassAvailable();
  } catch {
    return false;
  }
})();

const webBlur = (css: string) => ({ backdropFilter: css, WebkitBackdropFilter: css }) as unknown as ViewStyle;

// A floating surface: real Liquid Glass (dark) where the system has it. Everywhere else the
// Flyer look's dark glass: a faint white film with a hairline edge, blurring what is behind it
// in the browser, and nearly solid navy on phones that cannot blur.
//   tone "glass" (default): the header bar and the round glass buttons.
//   tone "bar": the darker glass of the tab bar.
// It casts no shadow by itself (only the two floating bars add one, with SH.bar).
export function Glass({ style, children, interactive, tone = 'glass' }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode; interactive?: boolean; tone?: 'glass' | 'bar' }) {
  if (LIQUID) {
    return (
      <GlassView glassEffectStyle="regular" colorScheme="dark" isInteractive={interactive} style={style}>
        {children}
      </GlassView>
    );
  }
  return <View style={[style, tone === 'bar' ? bar : glass]}>{children}</View>;
}

const WEB = Platform.OS === 'web';
const glass: ViewStyle = {
  backgroundColor: WEB ? C.glass : C.glassSolid,
  borderWidth: 1,
  borderColor: C.glassLine,
  ...(WEB ? webBlur('blur(18px) saturate(160%)') : null),
};
const bar: ViewStyle = {
  backgroundColor: WEB ? C.tabBar : C.glassSolid,
  borderWidth: 1,
  borderColor: C.tabBarLine,
  ...(WEB ? webBlur('blur(20px)') : null),
};
