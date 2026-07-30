import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Platform, Modal, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useTheme, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import PrimaryButton from '../components/PrimaryButton';
import { format, addMinutes } from 'date-fns';
import { relTime } from '../utils/relTime';

const genId  = () => `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const genHId = () => `hobby_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const genRId = () => `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const REMINDER_PRESETS = [
  { label: '5 min before',  minutes: -5 },
  { label: '15 min before', minutes: -15 },
  { label: '30 min before', minutes: -30 },
  { label: '1 hr before',   minutes: -60 },
  { label: '2 hrs before',  minutes: -120 },
  { label: '1 day before',  minutes: -1440 },
  { label: 'Custom time',   minutes: null },
];

export default function AddTaskScreen() {
  const { state, addTask, updateTask, addHobby } = useApp();
  const { COLORS } = useTheme();
  const toast = useToast();
  const navigation = useNavigation();
  const route = useRoute();

  const editingTask = route.params?.task || null;
  const isEditing = !!editingTask;
  const isHobbyFlow = route.params?.isHobby === true;

  const PRIORITY_LEVELS = [
    { label: 'Low',    color: COLORS.success, icon: 'ellipse-outline' },
    { label: 'Medium', color: COLORS.warning, icon: 'ellipse' },
    { label: 'High',   color: COLORS.danger,  icon: 'ellipse' },
  ];

  const [title,      setTitle]      = useState(editingTask?.title || '');
  const [notes,      setNotes]      = useState(editingTask?.notes || '');
  const [categoryId, setCategoryId] = useState(editingTask?.categoryId || state.categories[0]?.id || null);
  const [priority,   setPriority]   = useState(editingTask?.priority || 'Medium');
  const [startDate,  setStartDate]  = useState(editingTask?.startDate  ? new Date(editingTask.startDate)  : null);
  const [expiryDate, setExpiryDate] = useState(editingTask?.expiryDate ? new Date(editingTask.expiryDate) : null);
  const [reminders,  setReminders]  = useState(editingTask?.reminders || []);
  const [isHobby,    setIsHobby]    = useState(isHobbyFlow);

  const [activePicker,   setActivePicker]   = useState(null);
  const [tempDate,       setTempDate]       = useState(new Date());
  const [pickerStage,    setPickerStage]    = useState('date');

  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [reminderNote,         setReminderNote]         = useState('');
  const [reminderLabel,        setReminderLabel]        = useState('');
  const [reminderDateTime,     setReminderDateTime]     = useState(new Date());
  const [showReminderPicker,   setShowReminderPicker]   = useState(false);
  const [reminderPickerStage,  setReminderPickerStage]  = useState('date');
  const [editingReminderId,    setEditingReminderId]    = useState(null);

  const openPicker = (target, baseDate) => {
    setTempDate(baseDate || new Date());
    setActivePicker(target);
    setPickerStage('date');
  };

  const handlePickerChange = (event, selected) => {
    if (event?.type === 'dismissed') { setActivePicker(null); return; }
    const d = selected || tempDate;
    if (activePicker === 'start') setStartDate(d);
    else if (activePicker === 'expiry') setExpiryDate(d);
    setActivePicker(null);
  };

  const openAddReminder = () => {
    setEditingReminderId(null);
    setReminderLabel('Custom reminder');
    setReminderNote('');
    setReminderDateTime(startDate || expiryDate || new Date());
    setShowReminderPicker(false);
    setReminderModalVisible(true);
  };

  const openEditReminder = (r) => {
    setEditingReminderId(r.id);
    setReminderLabel(r.label);
    setReminderNote(r.note || '');
    setReminderDateTime(new Date(r.datetime));
    setShowReminderPicker(false);
    setReminderModalVisible(true);
  };

  const applyPreset = (preset) => {
    if (preset.minutes === null) { setShowReminderPicker(true); return; }
    const base = startDate || expiryDate || new Date();
    const dt = addMinutes(base, preset.minutes);
    if (dt <= new Date()) { Alert.alert('Invalid time', 'That reminder time is in the past.'); return; }
    setReminderDateTime(dt);
    setReminderLabel(preset.label);
    setShowReminderPicker(false);
  };

  const saveReminder = () => {
    if (!reminderLabel.trim()) { Alert.alert('Label required', 'Please enter a label for this reminder.'); return; }
    if (reminderDateTime <= new Date()) { Alert.alert('Invalid time', 'Reminder must be set in the future.'); return; }
    const entry = {
      id: editingReminderId || genRId(),
      label: reminderLabel.trim(),
      note: reminderNote.trim(),
      datetime: reminderDateTime.toISOString(),
    };
    if (editingReminderId) {
      setReminders(prev => prev.map(r => r.id === editingReminderId ? entry : r));
    } else {
      setReminders(prev => [...prev, entry]);
    }
    setReminderModalVisible(false);
  };

  const deleteReminder = (id) => setReminders(prev => prev.filter(r => r.id !== id));

  const handleSubmit = () => {
    if (!title.trim()) { Alert.alert('Missing title', 'Please enter a task title.'); return; }
    if (expiryDate && startDate && expiryDate <= startDate) {
      Alert.alert('Invalid dates', 'Expiry must be after start date.'); return;
    }

    if (isHobby) {
      const hobby = {
        id: editingTask?.id || genHId(),
        name: title.trim(),
        icon: 'leaf-outline',
        color: COLORS.cat[0],
        categoryId,
        completions: {},
        createdAt: editingTask?.createdAt || new Date().toISOString(),
      };
      addHobby(hobby);
      toast.success('Hobby created');
      const rootNav = navigation.getParent ? navigation.getParent() : null;
      if (rootNav && rootNav.navigate) rootNav.navigate('Hobbies');
      else navigation.navigate('Hobbies');
      return;
    }

    const task = {
      ...(editingTask || {}),
      id: editingTask?.id || genId(),
      title: title.trim(),
      notes: notes.trim(),
      categoryId,
      priority,
      startDate:  startDate  ? startDate.toISOString()  : null,
      expiryDate: expiryDate ? expiryDate.toISOString() : null,
      reminders,
      status:      editingTask?.status    || 'pending',
      createdAt:   editingTask?.createdAt || new Date().toISOString(),
      completedAt: editingTask?.completedAt || null,
    };
    if (isEditing) {
      updateTask(task);
      toast.success('Task updated');
    } else {
      addTask(task);
      toast.success('Task created');
    }
    const rootNav = navigation.getParent ? navigation.getParent() : null;
    if (rootNav && rootNav.navigate) rootNav.navigate('Tasks', { screen: 'TasksList' });
    else navigation.navigate('Tasks', { screen: 'TasksList' });
  };

  const showTaskFields = !isHobby;
  const showHobbyNote = isHobby && isEditing && editingTask?.createdAt;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: COLORS.text }]}>
            {isEditing ? 'Edit task' : (isHobby ? 'New hobby' : 'New task')}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Hobby toggle (only when not editing) */}
        {!isEditing && (
          <View style={[styles.hobbyToggle, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
            <View style={styles.hobbyToggleLeft}>
              <Ionicons name="leaf-outline" size={22} color={COLORS.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.hobbyToggleTitle, { color: COLORS.text }]}>Make this a hobby</Text>
                <Text style={[styles.hobbyToggleSub, { color: COLORS.textMuted }]}>
                  Repeat daily — check it off each day.
                </Text>
              </View>
            </View>
            <Switch
              value={isHobby}
              onValueChange={setIsHobby}
              trackColor={{ false: COLORS.border, true: COLORS.accent + '88' }}
              thumbColor={isHobby ? COLORS.accent : COLORS.textMuted}
            />
          </View>
        )}

        {/* Title */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: COLORS.textMuted }]}>TITLE *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border, color: COLORS.text }]}
            placeholder={isHobby ? 'e.g. Read, Meditate, Run' : 'What needs to be done?'}
            placeholderTextColor={COLORS.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
        </View>

        {/* Notes — task only */}
        {showTaskFields && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: COLORS.textMuted }]}>NOTES</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border, color: COLORS.text }]}
              placeholder="Add details or description..."
              placeholderTextColor={COLORS.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Category */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: COLORS.textMuted }]}>CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {state.categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catChip,
                    { borderColor: cat.color + '55', backgroundColor: COLORS.surfaceAlt },
                    categoryId === cat.id && { backgroundColor: cat.color + '22', borderColor: cat.color },
                  ]}
                  onPress={() => setCategoryId(cat.id)}
                >
                  <Ionicons
                    name={cat.icon}
                    size={14}
                    color={categoryId === cat.id ? cat.color : COLORS.textSub}
                  />
                  <Text style={[
                    styles.catChipText,
                    { color: COLORS.textSub },
                    categoryId === cat.id && { color: cat.color },
                  ]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Priority — task only */}
        {showTaskFields && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: COLORS.textMuted }]}>PRIORITY</Text>
            <View style={styles.chipRow}>
              {PRIORITY_LEVELS.map(p => (
                <TouchableOpacity
                  key={p.label}
                  style={[
                    styles.priorityChip,
                    { borderColor: p.color + '55', backgroundColor: COLORS.surfaceAlt },
                    priority === p.label && { backgroundColor: p.color + '22', borderColor: p.color },
                  ]}
                  onPress={() => setPriority(p.label)}
                >
                  <Ionicons name={p.icon} size={14} color={priority === p.label ? p.color : COLORS.textSub} />
                  <Text style={[
                    styles.catChipText,
                    { color: COLORS.textSub },
                    priority === p.label && { color: p.color },
                  ]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Dates — task only */}
        {showTaskFields && (
          <>
            <View style={styles.field}>
              <Text style={[styles.label, { color: COLORS.textMuted }]}>START DATE & TIME</Text>
              <TouchableOpacity
                style={[styles.datePicker, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}
                onPress={() => openPicker('start', startDate)}
              >
                <Ionicons name="calendar-outline" size={18} color={COLORS.accent} />
                <Text style={[styles.dateText, { color: startDate ? COLORS.text : COLORS.textMuted }]}>
                  {startDate ? format(startDate, 'EEE, MMM d yyyy • h:mm a') : 'Set start date (optional)'}
                </Text>
                {startDate && (
                  <TouchableOpacity onPress={() => setStartDate(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              {activePicker === 'start' && Platform.OS === 'ios' && (
                <DateTimePicker value={startDate || new Date()} mode="datetime" display="spinner"
                  onChange={(e, d) => { if (e?.type !== 'dismissed' && d) setStartDate(d); }} minimumDate={new Date()} />
              )}
              {activePicker === 'start' && Platform.OS === 'android' && (
                <DateTimePicker
                  value={tempDate || startDate || new Date()}
                  mode={pickerStage === 'date' ? 'date' : 'time'}
                  display="default"
                  onChange={(e, d) => {
                    if (!e || e.type === 'dismissed') { setActivePicker(null); setPickerStage('date'); return; }
                    if (pickerStage === 'date') {
                      const combined = new Date(d.getFullYear(), d.getMonth(), d.getDate(), tempDate.getHours(), tempDate.getMinutes());
                      setTempDate(combined); setPickerStage('time');
                    } else {
                      const final = new Date(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate(), d.getHours(), d.getMinutes());
                      setStartDate(final); setActivePicker(null); setPickerStage('date');
                    }
                  }}
                  minimumDate={new Date()}
                />
              )}
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: COLORS.textMuted }]}>EXPIRY DATE & TIME</Text>
              <TouchableOpacity
                style={[
                  styles.datePicker,
                  { backgroundColor: COLORS.surfaceAlt, borderColor: expiryDate ? COLORS.danger + '55' : COLORS.border },
                ]}
                onPress={() => openPicker('expiry', expiryDate)}
              >
                <Ionicons name="alarm-outline" size={18} color={COLORS.danger} />
                <Text style={[styles.dateText, { color: expiryDate ? COLORS.text : COLORS.textMuted }]}>
                  {expiryDate ? format(expiryDate, 'EEE, MMM d yyyy • h:mm a') : 'Set expiry date (optional)'}
                </Text>
                {expiryDate && (
                  <TouchableOpacity onPress={() => setExpiryDate(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              {activePicker === 'expiry' && Platform.OS === 'ios' && (
                <DateTimePicker value={expiryDate || new Date()} mode="datetime" display="spinner"
                  onChange={(e, d) => { if (e?.type !== 'dismissed' && d) setExpiryDate(d); }} minimumDate={startDate || new Date()} />
              )}
              {activePicker === 'expiry' && Platform.OS === 'android' && (
                <DateTimePicker
                  value={tempDate || expiryDate || new Date()}
                  mode={pickerStage === 'date' ? 'date' : 'time'}
                  display="default"
                  onChange={(e, d) => {
                    if (!e || e.type === 'dismissed') { setActivePicker(null); setPickerStage('date'); return; }
                    if (pickerStage === 'date') {
                      const combined = new Date(d.getFullYear(), d.getMonth(), d.getDate(), tempDate.getHours(), tempDate.getMinutes());
                      setTempDate(combined); setPickerStage('time');
                    } else {
                      const final = new Date(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate(), d.getHours(), d.getMinutes());
                      setExpiryDate(final); setActivePicker(null); setPickerStage('date');
                    }
                  }}
                  minimumDate={startDate || new Date()}
                />
              )}
            </View>
          </>
        )}

        {/* Reminders — task only */}
        {showTaskFields && (
          <View style={styles.field}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.label, { color: COLORS.textMuted, marginBottom: 0 }]}>CUSTOM REMINDERS</Text>
              <TouchableOpacity
                style={[styles.addReminderBtn, { backgroundColor: COLORS.accentDim, borderColor: COLORS.accent + '55' }]}
                onPress={openAddReminder}
              >
                <Ionicons name="add" size={14} color={COLORS.accent} />
                <Text style={[styles.addReminderBtnText, { color: COLORS.accent }]}>Add</Text>
              </TouchableOpacity>
            </View>

            {reminders.length === 0 ? (
              <View style={[styles.emptyReminders, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
                <Text style={[styles.emptyRemindersText, { color: COLORS.textMuted }]}>No custom reminders set</Text>
              </View>
            ) : (
              reminders
                .slice()
                .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
                .map(r => (
                  <View key={r.id} style={[styles.reminderItem, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.accent + '33' }]}>
                    <View style={styles.reminderLeft}>
                      <Text style={[styles.reminderLabel, { color: COLORS.text }]}>{r.label}</Text>
                      <Text style={[styles.reminderTime, { color: COLORS.accent }]}>{format(new Date(r.datetime), 'EEE MMM d • h:mm a')}</Text>
                      {r.note ? <Text style={[styles.reminderNote, { color: COLORS.textMuted }]}>{r.note}</Text> : null}
                    </View>
                    <View style={styles.reminderActions}>
                      <TouchableOpacity onPress={() => openEditReminder(r)} style={styles.reminderActionBtn}>
                        <Ionicons name="create-outline" size={16} color={COLORS.accent} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteReminder(r.id)} style={styles.reminderActionBtn}>
                        <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
            )}
          </View>
        )}

        {/* Created/Last edited timestamps */}
        {showHobbyNote && (
          <Text style={[styles.timestamp, { color: COLORS.textMuted }]}>
            Created {relTime(editingTask.createdAt)}
          </Text>
        )}

        {/* Submit */}
        <PrimaryButton
          label={isEditing ? 'Save changes' : (isHobby ? 'Create hobby' : 'Create task')}
          icon={isEditing ? 'save-outline' : 'checkmark'}
          color={isHobby ? COLORS.success : COLORS.accent}
          onPress={handleSubmit}
        />

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Reminder Modal */}
      <Modal visible={reminderModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: COLORS.text }]}>
                {editingReminderId ? 'Edit reminder' : 'Add reminder'}
              </Text>
              <TouchableOpacity onPress={() => setReminderModalVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, { color: COLORS.textMuted }]}>LABEL</Text>
            <TextInput
              style={[styles.input, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border, color: COLORS.text }]}
              placeholder="e.g. Don't forget!"
              placeholderTextColor={COLORS.textMuted}
              value={reminderLabel}
              onChangeText={setReminderLabel}
            />

            <Text style={[styles.modalLabel, { color: COLORS.textMuted, marginTop: 12 }]}>NOTE (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border, color: COLORS.text }]}
              placeholder="Add a short note..."
              placeholderTextColor={COLORS.textMuted}
              value={reminderNote}
              onChangeText={setReminderNote}
            />

            {(startDate || expiryDate) && (
              <>
                <Text style={[styles.modalLabel, { color: COLORS.textMuted, marginTop: 14 }]}>QUICK PRESETS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {REMINDER_PRESETS.map(p => (
                      <TouchableOpacity
                        key={p.label}
                        style={[styles.presetChip, { backgroundColor: COLORS.accentDim, borderColor: COLORS.accent + '44' }]}
                        onPress={() => applyPreset(p)}
                      >
                        <Text style={[styles.presetChipText, { color: COLORS.accentLight }]}>{p.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            <Text style={[styles.modalLabel, { color: COLORS.textMuted, marginTop: 14 }]}>REMINDER TIME</Text>
            <TouchableOpacity
              style={[styles.datePicker, { marginBottom: 0, backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}
              onPress={() => {
                if (Platform.OS === 'android') { setReminderPickerStage('date'); setShowReminderPicker(true); }
                else setShowReminderPicker(v => !v);
              }}
            >
              <Ionicons name="notifications-outline" size={18} color={COLORS.accent} />
              <Text style={[styles.dateText, { color: COLORS.text }]}>{format(reminderDateTime, 'EEE, MMM d yyyy • h:mm a')}</Text>
            </TouchableOpacity>

            {showReminderPicker && Platform.OS === 'ios' && (
              <DateTimePicker value={reminderDateTime} mode="datetime" display="spinner"
                onChange={(e, d) => { if (e.type !== 'dismissed' && d) setReminderDateTime(d); }} minimumDate={new Date()} />
            )}
            {showReminderPicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={reminderDateTime}
                mode={reminderPickerStage === 'date' ? 'date' : 'time'}
                display="default"
                onChange={(e, d) => {
                  if (!e || e.type === 'dismissed') { setShowReminderPicker(false); setReminderPickerStage('date'); return; }
                  if (reminderPickerStage === 'date') {
                    const combined = new Date(d.getFullYear(), d.getMonth(), d.getDate(), reminderDateTime.getHours(), reminderDateTime.getMinutes());
                    setReminderDateTime(combined); setReminderPickerStage('time');
                  } else {
                    const final = new Date(reminderDateTime.getFullYear(), reminderDateTime.getMonth(), reminderDateTime.getDate(), d.getHours(), d.getMinutes());
                    setReminderDateTime(final); setShowReminderPicker(false); setReminderPickerStage('date');
                  }
                }}
                minimumDate={new Date()}
              />
            )}

            <TouchableOpacity
              style={[styles.submitBtn, { marginTop: 18, backgroundColor: COLORS.accent }]}
              onPress={saveReminder}
            >
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.submitText}>Save reminder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  container: { flex: 1, paddingHorizontal: SPACING.lg },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: SPACING.lg, marginBottom: SPACING.lg },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  title:   { ...FONTS.heading, fontSize: 22 },

  hobbyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  hobbyToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  hobbyToggleTitle: { fontSize: 14, fontWeight: '700' },
  hobbyToggleSub:   { fontSize: 11, marginTop: 2 },

  timestamp: { fontSize: 12, marginTop: SPACING.md, fontStyle: 'italic' },

  field: { marginBottom: SPACING.lg },
  label: { ...FONTS.label, marginBottom: SPACING.sm, fontSize: 11 },

  input:    { borderRadius: RADIUS.md, borderWidth: 1, fontSize: 15, paddingHorizontal: 14, paddingVertical: 13 },
  textArea: { minHeight: 90, paddingTop: 12 },

  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  catChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1, gap: 6 },
  catChipText: { fontSize: 13, fontWeight: '600' },
  priorityChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1, flex: 1, justifyContent: 'center', gap: 6 },

  datePicker: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  dateText:   { flex: 1, fontSize: 14 },

  sectionHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  addReminderBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1 },
  addReminderBtnText: { fontWeight: '700', fontSize: 13 },

  emptyReminders:     { borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center' },
  emptyRemindersText: { fontSize: 13 },

  reminderItem:      { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.md, padding: 12, marginBottom: 8, borderWidth: 1 },
  reminderLeft:      { flex: 1 },
  reminderLabel:     { fontSize: 14, fontWeight: '700' },
  reminderTime:      { fontSize: 12, marginTop: 2 },
  reminderNote:      { fontSize: 11, marginTop: 2 },
  reminderActions:   { flexDirection: 'row', gap: 8 },
  reminderActionBtn: { padding: 6 },

  submitBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.lg, paddingVertical: 16, marginTop: 8, gap: 8, ...SHADOW.accent },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  modalOverlay: { flex: 1, backgroundColor: '#000000BB', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: SPACING.xl, borderWidth: 1, borderBottomWidth: 0, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle:  { ...FONTS.heading, fontSize: 20 },
  modalLabel:  { ...FONTS.label, marginBottom: 8, fontSize: 11 },

  presetChip:     { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.pill, borderWidth: 1 },
  presetChipText: { fontSize: 12, fontWeight: '600' },
});
