import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, SPACING, RADIUS } from '../utils/theme';

/**
 * Drop-in styled primary button. Provides:
 *  - pressed-state scale + opacity
 *  - soft haptic on press (10ms Vibration, iOS + Android)
 *  - color/icon/text from props; rest from theme
 *
 * Props:
 *   label:        string
 *   icon?:        Ionicons name
 *   color?:       override background (defaults to COLORS.accent)
 *   onPress:      () => void
 *   variant?:     'solid' | 'danger' | 'success' | 'ghost'
 *   style?:       extra styles merged into press feedback
 *   disabled?:    boolean
 */
export default function PrimaryButton({
  label,
  icon,
  color,
  onPress,
  variant = 'solid',
  style,
  disabled = false,
}) {
  const { COLORS } = useTheme();

  const onPressIn = useCallback(() => {
    Vibration.vibrate(8);
  }, []);

  const bg =
    color ||
    (variant === 'danger' ? COLORS.danger : variant === 'success' ? COLORS.success : COLORS.accent);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles.dynamicShadow,
        { backgroundColor: bg, shadowColor: COLORS.accent, opacity: disabled ? 0.5 : 1 },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.85 },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={18} color="#fff" />}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    paddingHorizontal: SPACING.lg,
    gap: 8,
  },
  dynamicShadow: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
