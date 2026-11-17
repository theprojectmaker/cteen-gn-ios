import React from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

// True on iOS 26+ where the system Liquid Glass material exists.
export const LIQUID = (() => {
  try {
    return Platform.OS === 'ios' && isLiquidGlassAvailable();
  } catch {
    return false;
  }
})();

const webBlur = { backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)' } as unknown as ViewStyle;

// A floating surface: real Liquid Glass where the system has it, a frosted
// translucent panel everywhere else (older iOS, Android, web).
export function Glass({ style, children, interactive }: { style?: ViewStyle | ViewStyle[]; children?: React.ReactNode; interactive?: boolean }) {
  if (LIQUID) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive={interactive} style={style}>
        {children}
      </GlassView>
    );
  }
  return <View style={[style, fallback, Platform.OS === 'web' && webBlur]}>{children}</View>;
}

const fallback: ViewStyle = {
  backgroundColor: Platform.OS === 'web' ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.94)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.7)',
  shadowColor: '#13202C',
  shadowOpacity: 0.12,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
};
