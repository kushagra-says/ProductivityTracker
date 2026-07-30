import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme, ACCENTS, ACCENTS_CREAM, ACCENT_KEYS, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';

export default function SettingsScreen() {
  const { COLORS, mode, accent, setAccentChoice, toggleThemeMode } = useTheme();
  const navigation = useNavigation();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: COLORS.text }]}>Settings</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Theme toggle */}
        <Text style={[styles.section, { color: COLORS.textMuted }]}>APPEARANCE</Text>
        <View style={[styles.card, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
          <TouchableOpacity
            style={styles.row}
            onPress={toggleThemeMode}
          >
            <View style={[styles.rowIconWrap, { backgroundColor: COLORS.accentDim }]}>
              <Ionicons
                name={mode === 'dark' ? 'moon' : 'sunny'}
                size={18}
                color={COLORS.accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: COLORS.text }]}>Theme</Text>
              <Text style={[styles.rowSub, { color: COLORS.textMuted }]}>
                {mode === 'dark' ? 'Dark' : 'Cream'} — tap to switch
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Accent picker */}
        <Text style={[styles.section, { color: COLORS.textMuted, marginTop: SPACING.xl }]}>
          ACCENT COLOR
        </Text>
        <View style={styles.accentGrid}>
          {ACCENT_KEYS.map((key) => {
            const palette = mode === 'dark' ? ACCENTS : ACCENTS_CREAM;
            const c = palette[key];
            const isActive = accent === key;
            return (
              <TouchableOpacity
                key={key}
                activeOpacity={0.7}
                onPress={() => setAccentChoice(key)}
                style={[
                  styles.accentCard,
                  {
                    backgroundColor: COLORS.surfaceAlt,
                    borderColor: isActive ? c.accent : COLORS.border,
                    borderWidth: isActive ? 2 : 1,
                  },
                ]}
              >
                <View style={[styles.accentSwatch, { backgroundColor: c.accent }]}>
                  {isActive && <Ionicons name="checkmark" size={20} color="#fff" />}
                </View>
                <Text style={[styles.accentName, { color: COLORS.text }]}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Data info */}
        <Text style={[styles.section, { color: COLORS.textMuted, marginTop: SPACING.xl }]}>
          ABOUT
        </Text>
        <View style={[styles.card, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
          <View style={styles.aboutRow}>
            <Ionicons name="lock-closed-outline" size={16} color={COLORS.textMuted} />
            <Text style={[styles.aboutText, { color: COLORS.textSub }]}>
              All your data stays on this device.
            </Text>
          </View>
          <View style={styles.aboutRow}>
            <Ionicons name="refresh-outline" size={16} color={COLORS.textMuted} />
            <Text style={[styles.aboutText, { color: COLORS.textSub }]}>
              Reinstalling over the existing app keeps your progress.
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  container: { flex: 1, paddingHorizontal: SPACING.lg },

  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: SPACING.lg, marginBottom: SPACING.xl },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  title:   { ...FONTS.heading, fontSize: 22 },

  section: { ...FONTS.label, marginBottom: SPACING.sm, fontSize: 11 },

  card: { borderRadius: RADIUS.lg, padding: 4, borderWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSub:   { fontSize: 11, marginTop: 2 },

  accentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  accentCard: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  accentSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentName: { fontSize: 14, fontWeight: '700' },

  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  aboutText: { fontSize: 12, flex: 1 },
});
