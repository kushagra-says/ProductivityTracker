import React from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';

/**
 * Themed confirm dialog. Use this anywhere we used to call Alert.alert
 * for a delete/destructive action so the styling matches the rest of
 * the app and stays consistent across iOS/Android.
 *
 * Props:
 *   visible:        boolean — controls the modal
 *   title:          string
 *   message:        string  — body text (longer OK)
 *   icon?:          Ionicons name
 *   iconColor?:     string  — falls back to COLORS.danger
 *   confirmLabel?:  string  — defaults to "Confirm"
 *   cancelLabel?:   string  — defaults to "Cancel"
 *   destructive?:   boolean — tints the confirm button red
 *   onConfirm:      () => void
 *   onCancel:       () => void
 */
export default function ConfirmDialog({
  visible,
  title,
  message,
  icon,
  iconColor,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) {
  const { COLORS } = useTheme();

  const confirmBg = destructive ? COLORS.danger : COLORS.accent;
  const resolvedIconColor = iconColor || (destructive ? COLORS.danger : COLORS.accent);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      {/* Tappable backdrop — the Pressable wrapper lets the user dismiss
          the dialog by tapping outside, mirroring the OS UX. */}
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Inner Pressable swallows the press so taps on the card itself
            don't immediately close the dialog. */}
        <Pressable
          onPress={() => {}}
          style={[
            styles.card,
            {
              backgroundColor: COLORS.surface,
              borderColor: COLORS.border,
              shadowColor: COLORS.shadow,
            },
          ]}
        >
          {icon && (
            <View style={[styles.iconWrap, { backgroundColor: resolvedIconColor + '22' }]}>
              <Ionicons name={icon} size={26} color={resolvedIconColor} />
            </View>
          )}
          <Text style={[styles.title, { color: COLORS.text }]}>{title}</Text>
          {!!message && (
            <Text style={[styles.message, { color: COLORS.textSub }]}>
              {message}
            </Text>
          )}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onCancel}
              activeOpacity={0.7}
              style={[
                styles.btn,
                styles.btnSecondary,
                {
                  backgroundColor: COLORS.surfaceAlt,
                  borderColor: COLORS.border,
                },
              ]}
            >
              <Text style={[styles.btnText, { color: COLORS.text }]}>
                {cancelLabel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              activeOpacity={0.8}
              style={[
                styles.btn,
                { backgroundColor: confirmBg, borderColor: confirmBg },
                destructive && styles.destructiveShadow,
                !destructive && SHADOW.accent,
              ]}
            >
              <Text style={[styles.btnText, styles.btnTextPrimary]}>
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xl,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    ...FONTS.heading,
    fontSize: 18,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    alignSelf: 'stretch',
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: { /* color/border applied inline */ },
  btnText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  btnTextPrimary: { color: '#fff' },
  destructiveShadow: {
    shadowColor: '#FF5C5C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
});
