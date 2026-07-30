import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, Modal, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp, todayKey } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useTheme, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import { currentStreak, lastNDays, dayKey, dayLabel } from '../utils/hobbyStats';
import { usePullRefresh } from '../hooks/usePullRefresh';

const ICONS = [
  'barbell-outline', 'book-outline', 'brush-outline', 'leaf-outline',
  'musical-notes-outline', 'bicycle-outline', 'water-outline', 'flame-outline',
  'medkit-outline', 'fitness-outline', 'headset-outline', 'cafe-outline',
  'airplane-outline', 'bed-outline', 'walk-outline', 'code-slash-outline',
  'camera-outline', 'flower-outline', 'pizza-outline', 'game-controller-outline',
    'pencil-outline', 'heart-outline',
];

const COLOR_OPTIONS_KEY = 'cat';

const genId = () => `hobby_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function HobbiesHeader({ onAdd, COLORS }) {
  return (
    <View style={styles.header}>
      <Text style={[styles.title, { color: COLORS.text }]}>Hobbies</Text>
      <TouchableOpacity
        style={[styles.addBtn, { backgroundColor: COLORS.accent }]}
        onPress={onAdd}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.addBtnText}>New</Text>
      </TouchableOpacity>
    </View>
  );
}

function HobbyListItem({ hobby, onToggle, onPress, COLORS }) {
  const today = todayKey();
  const done = !!(hobby.completions && hobby.completions[today]);
  const streak = currentStreak(hobby.completions);
  const days = lastNDays(7);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.hobbyCard,
        {
          backgroundColor: COLORS.surfaceAlt,
          borderColor: done ? hobby.color + '66' : COLORS.border,
        },
      ]}
    >
      <View style={styles.hobbyTopRow}>
        <View style={[styles.hobbyIconWrap, { backgroundColor: hobby.color + '22' }]}>
          <Ionicons name={hobby.icon} size={22} color={hobby.color} />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={[styles.hobbyName, { color: COLORS.text }, done && styles.struck]}
            numberOfLines={1}
          >
            {hobby.name}
          </Text>
          <View style={styles.streakRow}>
            <Ionicons name="flame" size={12} color={COLORS.warning} />
            <Text style={[styles.streakText, { color: COLORS.textMuted }]}>
              {streak} day{streak === 1 ? '' : 's'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => onToggle(hobby.id, today)}
          style={[
            styles.tickBtn,
            {
              borderColor: hobby.color,
              backgroundColor: done ? hobby.color : 'transparent',
            },
          ]}
        >
          {done && <Ionicons name="checkmark" size={16} color="#fff" />}
        </TouchableOpacity>
      </View>

      {/* 7-day strip */}
      <View style={styles.weekStrip}>
        {days.map((d) => {
          const k = dayKey(d);
          const isDone = hobby.completions && hobby.completions[k];
          const isToday = k === today;
          return (
            <View key={k} style={styles.dayCell}>
              <Text style={[styles.dayLabel, { color: COLORS.textMuted }]}>
                {dayLabel(d).slice(0, 1)}
              </Text>
              <View
                style={[
                  styles.dayBox,
                  {
                    backgroundColor: isDone ? hobby.color : COLORS.border,
                    borderColor: isToday ? hobby.color : 'transparent',
                    borderWidth: isToday ? 2 : 0,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
    </TouchableOpacity>
  );
}

export default function HobbiesScreen() {
  const { state, addHobby, toggleHobbyToday } = useApp();
  const navigation = useNavigation();
  const { COLORS } = useTheme();
  const toast = useToast();
  const { refreshing, onRefresh } = usePullRefresh();

  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
  const [selectedColor, setSelectedColor] = useState(COLORS[COLOR_OPTIONS_KEY][0]);

  const sortedHobbies = useMemo(() => {
    const today = todayKey();
    return [...state.hobbies].sort((a, b) => {
      const aDone = a.completions && a.completions[today];
      const bDone = b.completions && b.completions[today];
      if (aDone !== bDone) return aDone ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [state.hobbies]);

  const handleAdd = () => {
    if (!newName.trim()) {
      Alert.alert('Name required', 'Please enter a hobby name.');
      return;
    }
    addHobby({
      id: genId(),
      name: newName.trim(),
      icon: selectedIcon,
      color: selectedColor,
      completions: {},
      createdAt: new Date().toISOString(),
    });
    setNewName('');
    setSelectedIcon(ICONS[0]);
    setSelectedColor(COLORS[COLOR_OPTIONS_KEY][0]);
    setModalVisible(false);
    toast.success('Hobby created');
  };

  const handleToggle = (id, date) => {
    toggleHobbyToday(id, date);
    toast.info('Hobby updated');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]}>
      <FlatList
        data={sortedHobbies}
        keyExtractor={(h) => h.id}
        renderItem={({ item }) => (
          <HobbyListItem
            hobby={item}
            onToggle={handleToggle}
            onPress={() => navigation.navigate('HobbyDetail', { hobby: item })}
            COLORS={COLORS}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
        ListHeaderComponent={<HobbiesHeader onAdd={() => setModalVisible(true)} COLORS={COLORS} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="leaf-outline" size={40} color={COLORS.textMuted} />
            <Text style={[styles.emptyText, { color: COLORS.textMuted }]}>
              No hobbies yet. Add a daily habit.
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: COLORS.accent }]}
              onPress={() => setModalVisible(true)}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.emptyBtnText}>Add hobby</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={styles.list}
      />

      {/* Add modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: COLORS.text }]}>New hobby</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: COLORS.textMuted }]}>NAME</Text>
            <TextInput
              style={[styles.input, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border, color: COLORS.text }]}
              placeholder="e.g. Read, Run, Meditate"
              placeholderTextColor={COLORS.textMuted}
              value={newName}
              onChangeText={setNewName}
              maxLength={40}
              autoFocus
            />

            <Text style={[styles.fieldLabel, { color: COLORS.textMuted }]}>ICON</Text>
            <View style={styles.iconGrid}>
              {ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconBtn,
                    { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border },
                    selectedIcon === icon && { borderColor: selectedColor, backgroundColor: selectedColor + '22' },
                  ]}
                  onPress={() => setSelectedIcon(icon)}
                >
                  <Ionicons
                    name={icon}
                    size={20}
                    color={selectedIcon === icon ? selectedColor : COLORS.textSub}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: COLORS.textMuted }]}>COLOR</Text>
            <View style={styles.colorRow}>
              {COLORS[COLOR_OPTIONS_KEY].map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorDot,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorDotSelected,
                  ]}
                  onPress={() => setSelectedColor(color)}
                >
                  {selectedColor === color && (
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.preview, { backgroundColor: COLORS.surfaceAlt, borderColor: selectedColor + '66' }]}>
              <Ionicons name={selectedIcon} size={26} color={selectedColor} />
              <Text style={[styles.previewName, { color: selectedColor }]}>
                {newName || 'Hobby name'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: selectedColor }]}
              onPress={handleAdd}
            >
              <Text style={styles.createBtnText}>Create hobby</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  title:     { ...FONTS.heading, fontSize: 28 },
  addBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 8, ...SHADOW.accent },
  addBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },

  hobbyCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    gap: SPACING.md,
  },
  hobbyTopRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  hobbyIconWrap: { width: 44, height: 44, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center' },
  hobbyName:    { fontSize: 16, fontWeight: '700' },
  struck:       { textDecorationLine: 'line-through' },
  streakRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  streakText:   { fontSize: 12, fontWeight: '600' },
  tickBtn:      { width: 32, height: 32, borderRadius: 16, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },

  weekStrip: { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'space-between' },
  dayCell:   { alignItems: 'center', gap: 4, flex: 1 },
  dayLabel:  { fontSize: 10, fontWeight: '700' },
  dayBox:    { width: '100%', height: 24, borderRadius: 6 },

  empty:      { alignItems: 'center', paddingTop: 60, gap: SPACING.sm },
  emptyText:  { fontSize: 16, marginTop: 4 },
  emptyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.lg, paddingVertical: 10, borderRadius: RADIUS.md, marginTop: SPACING.sm, ...SHADOW.accent },
  emptyBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modal:        { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: SPACING.xl, borderWidth: 1, borderBottomWidth: 0, maxHeight: '90%' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:   { ...FONTS.heading, fontSize: 20 },

  fieldLabel: { ...FONTS.label, marginBottom: SPACING.sm, fontSize: 11 },
  input:      { borderRadius: RADIUS.md, borderWidth: 1, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, marginBottom: SPACING.lg },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  iconBtn:  { width: 44, height: 44, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },

  colorRow:        { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg, flexWrap: 'wrap' },
  colorDot:        { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorDotSelected:{ borderColor: '#fff', transform: [{ scale: 1.15 }] },

  preview:     { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, gap: SPACING.md, marginBottom: SPACING.lg },
  previewName: { fontSize: 16, fontWeight: '800' },

  createBtn:     { borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center', ...SHADOW.accent },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
