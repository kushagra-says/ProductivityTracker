import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
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

  const value = {
    toast: show,
    success: useCallback((m) => show(m, COLORS.success), [show, COLORS.success]),
    danger:  useCallback((m) => show(m, COLORS.danger),  [show, COLORS.danger]),
    info:    useCallback((m) => show(m, COLORS.accent),  [show, COLORS.accent]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
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
