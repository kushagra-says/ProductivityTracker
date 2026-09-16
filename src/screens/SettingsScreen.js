import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// SDK 57 moved the readAsString/writeAsString/SAF API into the `legacy`
// subpath — the new top-level API is a File/Directory class model that has
// no StorageAccessFramework, which the backup export needs.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useTheme, ACCENTS, ACCENTS_CREAM, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import { ACCENT_STORAGE_KEY } from '../utils/theme';
import InlineTimePicker from '../components/InlineTimePicker';
import ConfirmDialog from '../components/ConfirmDialog';
import { APP_VERSION } from '../utils/appVersion';
import { WHATS_NEW } from '../utils/whatsNew';
import {
  buildBackup, parseBackup, backupFileName,
} from '../utils/backup';

// Remembered SAF directory (the user's Downloads folder) so exports
// after the first one don't re-ask for the folder.
const BACKUP_DIR_KEY = '@pt_backup_dir';

// Parse a stored "HH:mm" string into a Date for the time picker.
const timeFromHHMM = (hhmm) => {
  const d = new Date();
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  d.setHours(h, m, 0, 0);
  return d;
};

const hhmmFromDate = (d) => {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const formatTime = (hhmm) => {
  const d = timeFromHHMM(hhmm);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

function NotificationRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  timeValue,
  onTimeChange,
  COLORS,
  danger,
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={[styles.notifRow, { borderBottomColor: COLORS.border }]}>
      <View style={styles.notifRowTop}>
        <View style={[styles.rowIconWrap, { backgroundColor: COLORS.accentDim }]}>
          <Ionicons name={icon} size={18} color={danger ? COLORS.danger : COLORS.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: COLORS.text }]}>{title}</Text>
          <Text style={[styles.rowSub, { color: COLORS.textMuted }]}>
            {value
              ? `At ${formatTime(timeValue)}`
              : subtitle}
          </Text>
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: COLORS.border, true: COLORS.accent + '88' }}
          thumbColor={value ? COLORS.accent : COLORS.textMuted}
        />
      </View>

      {value && (
        <View style={styles.timeBlock}>
          <TouchableOpacity
            style={[styles.timeBtn, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}
            onPress={() => setExpanded((v) => !v)}
          >
            <Ionicons name="time-outline" size={16} color={COLORS.accent} />
            <Text style={[styles.timeBtnText, { color: COLORS.text }]}>
              {formatTime(timeValue)}
            </Text>
            <Ionicons
              name={expanded ? 'chevron-down' : 'chevron-up'}
              size={14}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>

          {expanded && (
            <View style={{ marginTop: 10 }}>
              <InlineTimePicker
                value={timeFromHHMM(timeValue)}
                onChange={(d) => onTimeChange(hhmmFromDate(d))}
                accent={COLORS.accent}
                surface={COLORS.surface}
                surfaceAlt={COLORS.surfaceAlt}
                border={COLORS.border}
                text={COLORS.text}
                textMuted={COLORS.textMuted}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const { COLORS, mode, accent, visibleAccentKeys, setAccentChoice, toggleThemeMode, applyAccentMap } = useTheme();
  const { state, updateSettings, restoreData } = useApp();
  const toast = useToast();
  const navigation = useNavigation();
  const route = useRoute();
  const settings = state.settings;

  const [busy, setBusy] = useState(false);
  // Parsed + validated backup awaiting the destructive-restore confirm.
  const [pendingImport, setPendingImport] = useState(null);

  // Auto-scroll to the What's-New card when the Dashboard's "See now"
  // deep-links here with { highlightWhatsNew: true }. The section reports
  // its content offset via onLayout; once known, scroll to it (slightly
  // above, so the section title stays visible) and consume the param.
  const scrollRef = useRef(null);
  const [whatsNewY, setWhatsNewY] = useState(null);
  useEffect(() => {
    if (route.params?.highlightWhatsNew && whatsNewY != null) {
      scrollRef.current?.scrollTo({ y: Math.max(0, whatsNewY - 70), animated: true });
      navigation.setParams({ highlightWhatsNew: undefined });
    }
  }, [route.params?.highlightWhatsNew, whatsNewY, navigation]);

  // Export: write a versioned JSON envelope. On Android the user picks a
  // folder (their Downloads) ONCE — the SAF directory URI is remembered,
  // so every later export auto-saves with no prompt. If the remembered
  // folder has since been deleted/revoked, the write falls back to a
  // single re-pick and re-members the new folder. Elsewhere, the file is
  // written to cache and handed to the system share sheet.
  const handleExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      let accentByTheme = null;
      try {
        const raw = await AsyncStorage.getItem(ACCENT_STORAGE_KEY);
        if (raw) accentByTheme = JSON.parse(raw);
      } catch {
        // Accents are optional in the backup — proceed without them.
      }
      const json = JSON.stringify(buildBackup(state, accentByTheme), null, 2);
      const name = backupFileName();

      if (Platform.OS === 'android') {
        const writeInto = async (dirUri) => {
          const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            dirUri,
            'application/json',
            name,
          );
          await FileSystem.writeAsStringAsync(fileUri, json, {
            encoding: FileSystem.EncodingType.UTF8,
          });
        };
        const askForFolder = async () => {
          const perms = await FileSystem.StorageAccessFramework
            .requestDirectoryPermissionsAsync();
          if (!perms.granted) {
            toast.info('Export cancelled — no folder chosen.');
            return null;
          }
          await AsyncStorage.setItem(BACKUP_DIR_KEY, perms.directoryUri);
          return perms.directoryUri;
        };

        let dirUri = await AsyncStorage.getItem(BACKUP_DIR_KEY);
        if (dirUri) {
          try {
            await writeInto(dirUri);
          } catch {
            // Remembered folder is stale (deleted, moved, or permission
            // revoked by the OS) — forget it and ask exactly once more.
            await AsyncStorage.removeItem(BACKUP_DIR_KEY);
            dirUri = await askForFolder();
            if (!dirUri) return;
            await writeInto(dirUri);
          }
        } else {
          dirUri = await askForFolder();
          if (!dirUri) return;
          await writeInto(dirUri);
        }
        toast.success(`Backup saved: ${name}`);
      } else {
        const uri = `${FileSystem.cacheDirectory}${name}`;
        await FileSystem.writeAsStringAsync(uri, json, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/json',
            dialogTitle: 'Save your backup',
          });
        }
        toast.success(`Backup ready: ${name}`);
      }
    } catch (e) {
      console.warn('Export failed', e);
      toast.error('Export failed — please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Import: pick a file, parse + validate, then ask before destroying.
  const handlePickImport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        // NOT 'application/json': most Android file providers report
        // .json files as 'application/octet-stream' (or no MIME at all),
        // which greys them out in the picker. Accept everything here —
        // parseBackup below rejects anything that isn't a real backup.
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) return;
      const text = await FileSystem.readAsStringAsync(res.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        toast.error('That file is not valid JSON.');
        return;
      }
      const backup = parseBackup(parsed);
      if (!backup.ok) {
        toast.error(backup.error);
        return;
      }
      setPendingImport(backup);
    } catch (e) {
      console.warn('Import failed', e);
      toast.error('Could not read the selected file.');
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = () => {
    const backup = pendingImport;
    if (!backup) return;
    setPendingImport(null);
    restoreData(backup.data);
    if (backup.accentByTheme) applyAccentMap(backup.accentByTheme);
    toast.success(
      `Restored ${backup.counts.tasks} tasks · ${backup.counts.hobbies} hobbies`,
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]}>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        showsVerticalScrollIndicator={false}
      >
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

        {/* Accent picker — both themes show the same ten accents (brown is
            available in dark too, in its own lighter dark-tuned shade). */}
        <Text style={[styles.section, { color: COLORS.textMuted, marginTop: SPACING.xl }]}>
          ACCENT COLOR
        </Text>
        <View style={styles.accentGrid}>
          {visibleAccentKeys.map((key) => {
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

        {/* Notifications */}
        <Text style={[styles.section, { color: COLORS.textMuted, marginTop: SPACING.xl }]}>
          NOTIFICATIONS
        </Text>
        <View style={[styles.card, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
          <NotificationRow
            icon="list-circle-outline"
            title="Pending tasks reminder"
            subtitle="Daily reminder to clear pending work"
            value={settings.tasksReminderEnabled}
            onValueChange={(v) => updateSettings({ tasksReminderEnabled: v })}
            timeValue={settings.tasksReminderTime}
            onTimeChange={(t) => updateSettings({ tasksReminderTime: t })}
            COLORS={COLORS}
          />
          <NotificationRow
            icon="sunny-outline"
            title="Morning briefing"
            subtitle="Wake-up nudge with today's plan"
            value={settings.morningBriefingEnabled}
            onValueChange={(v) => updateSettings({ morningBriefingEnabled: v })}
            timeValue={settings.morningBriefingTime}
            onTimeChange={(t) => updateSettings({ morningBriefingTime: t })}
            COLORS={COLORS}
          />
          <NotificationRow
            icon="flame-outline"
            title="Streak-at-risk nudge"
            subtitle="One-shot ping if you haven't completed anything yet today"
            value={settings.streakNudgeEnabled}
            onValueChange={(v) => updateSettings({ streakNudgeEnabled: v })}
            timeValue={settings.streakNudgeTime}
            onTimeChange={(t) => updateSettings({ streakNudgeTime: t })}
            COLORS={COLORS}
            danger
          />
        </View>

        {/* Data backup */}
        <Text style={[styles.section, { color: COLORS.textMuted, marginTop: SPACING.xl }]}>
          DATA
        </Text>
        <View style={[styles.card, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
          <TouchableOpacity
            style={[styles.row, styles.dataRow, { borderBottomColor: COLORS.border }]}
            onPress={handleExport}
            disabled={busy}
          >
            <View style={[styles.rowIconWrap, { backgroundColor: COLORS.accentDim }]}>
              <Ionicons name="download-outline" size={18} color={COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: COLORS.text }]}>Export data</Text>
              <Text style={[styles.rowSub, { color: COLORS.textMuted }]}>
                Save a backup file (tasks, hobbies, streak, settings) to your Downloads folder
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            onPress={handlePickImport}
            disabled={busy}
          >
            <View style={[styles.rowIconWrap, { backgroundColor: COLORS.accentDim }]}>
              <Ionicons name="folder-open-outline" size={18} color={COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: COLORS.text }]}>Import backup</Text>
              <Text style={[styles.rowSub, { color: COLORS.textMuted }]}>
                Restore from a backup file — replaces all current data
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Data info */}
        <Text style={[styles.section, { color: COLORS.textMuted, marginTop: SPACING.xl }]}>
          ABOUT
        </Text>
        <View style={[styles.card, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
          <View style={styles.aboutRow}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
            <Text style={[styles.aboutText, { color: COLORS.textSub }]}>
              Version {APP_VERSION}
            </Text>
          </View>
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

        {/* What's new — features shipped in this release batch. Wrapped so
            onLayout can report its content offset for the dashboard
            "See now" auto-scroll. */}
        <View onLayout={(e) => setWhatsNewY(e.nativeEvent.layout.y)}>
          <Text style={[styles.section, { color: COLORS.textMuted, marginTop: SPACING.xl }]}>
            WHAT'S NEW
          </Text>
          <View style={[styles.card, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border, padding: SPACING.md }]}>
            {WHATS_NEW.map((item) => (
              <View key={item} style={styles.newRow}>
                <View style={[styles.newDot, { backgroundColor: COLORS.accent }]} />
                <Text style={[styles.newText, { color: COLORS.textSub }]}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <ConfirmDialog
        visible={!!pendingImport}
        title="Restore backup?"
        message={
          pendingImport
            ? `This will replace ALL current data with the backup (${pendingImport.counts.tasks} tasks, ${pendingImport.counts.hobbies} hobbies, ${pendingImport.counts.categories} categories). This cannot be undone.`
            : ''
        }
        icon="server-outline"
        confirmLabel="Restore"
        destructive
        onConfirm={confirmImport}
        onCancel={() => setPendingImport(null)}
      />
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

  // Notification rows — a column with the toggle row + the time button.
  notifRow: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  notifRowTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  timeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.md,
    marginLeft: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  timeBtnText: { flex: 1, fontSize: 14, fontWeight: '700' },

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

  dataRow: { borderBottomWidth: 1 },

  newRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 5 },
  newDot:  { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  newText: { fontSize: 12, flex: 1, lineHeight: 17 },
});