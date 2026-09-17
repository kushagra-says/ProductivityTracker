import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FONTS, RADIUS, SPACING } from '../utils/theme';

const ToastContext = createContext(null);

let nextId = 0;

export function ToastProvider({ children }) {
  const { COLORS } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState(null); // { id, message, color }
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const timerRef = useRef(null);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -20, duration: 180, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [opacity, translateY]);

  const show = useCallback(
    (message, color) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const id = ++nextId;
      setToast({ id, message, color });
      opacity.setValue(0);
      translateY.setValue(-20);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
      timerRef.current = setTimeout(() => hide(), 1800);
    },
    [opacity, translateY, hide],
  );

  // Memoized so every useToast() consumer keeps the same function identities
  // across toast show/hide cycles — consumers re-render only when the theme
  // (and thus the callback colors) changes.
  const value = useMemo(
    () => ({
      toast: show,
      success: (m) => show(m, COLORS.success),
      danger:  (m) => show(m, COLORS.danger),
      // Alias of danger — the validation call-sites all say `toast.error`.
      error:   (m) => show(m, COLORS.danger),
      info:    (m) => show(m, COLORS.accent),
    }),
    [show, COLORS.success, COLORS.danger, COLORS.accent],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* The toast renders inside its own transparent Modal — a plain
          absolute view always sits BEHIND any open RN Modal (the reminder
          editor, ConfirmDialog, … render in a separate native window above
          the normal hierarchy). A Modal mounted LATER stacks on top of
          those, so a toast raised over an open popup is visible. Its
          pointerEvents="none" keeps the popup below fully interactive. */}
      {toast && (
        <Modal
          visible
          transparent
          animationType="none"
          statusBarTranslucent
          pointerEvents="none"
        >
          <Animated.View
            style={[
              styles.wrap,
              {
                top: insets.top + 8,
                backgroundColor: COLORS.surface,
                borderColor: (toast.color || COLORS.accent) + '66',
                opacity,
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: (toast.color || COLORS.accent) + '22' }]}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={toast.color || COLORS.accent}
              />
            </View>
            <Text style={[styles.text, { color: COLORS.text }]} numberOfLines={2}>
              {toast.message}
            </Text>
          </Animated.View>
        </Modal>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: () => {},
      success: () => {},
      danger: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: SPACING.md,
    zIndex: 999,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...FONTS.body,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
