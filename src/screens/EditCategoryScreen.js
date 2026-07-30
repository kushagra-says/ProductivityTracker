import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useTheme, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import PrimaryButton from '../components/PrimaryButton';

const ICONS = [
  'book-outline', 'home-outline', 'barbell-outline', 'briefcase-outline',
  'brush-outline', 'medkit-outline', 'cash-outline', 'car-outline',
  'leaf-outline', 'musical-notes-outline', 'phone-portrait-outline', 'airplane-outline',
  'game-controller-outline', 'paw-outline', 'cafe-outline', 'film-outline',
  'school-outline', 'cart-outline', 'pencil-outline', 'pizza-outline',
  'bed-outline', 'flame-outline', 'heart-outline', 'flower-outline', 'folder-outline',
];

export default function EditCategoryScreen() {
  const { updateCategory } = useApp();
  const { COLORS } = useTheme();
  const toast = useToast();
  const navigation = useNavigation();
  const route = useRoute();
  const cat = route.params?.category;

  const COLOR_OPTIONS = COLORS.cat;

  const [name, setName] = useState(cat?.name || '');
  const [icon, setIcon] = useState(cat?.icon || 'folder-outline');
  const [color, setColor] = useState(cat?.color || COLOR_OPTIONS[0]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a category name.');
      return;
    }
    updateCategory({ ...cat, name: name.trim(), icon, color });
    toast.success('Category updated');
    navigation.goBack();
  };

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
          <Text style={[styles.title, { color: COLORS.text }]}>Edit category</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={[styles.preview, { backgroundColor: COLORS.surfaceAlt, borderColor: color + '66' }]}>
          <Ionicons name={icon} size={36} color={color} />
          <Text style={[styles.previewName, { color }]}>{name || 'Category name'}</Text>
        </View>

        <Text style={[styles.label, { color: COLORS.textMuted }]}>NAME</Text>
        <TextInput
          style={[styles.input, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border, color: COLORS.text }]}
          placeholder="Category name..."
          placeholderTextColor={COLORS.textMuted}
          value={name}
          onChangeText={setName}
          maxLength={30}
        />

        <Text style={[styles.label, { color: COLORS.textMuted, marginTop: SPACING.lg }]}>ICON</Text>
        <View style={styles.iconGrid}>
          {ICONS.map(ic => (
            <TouchableOpacity
              key={ic}
              style={[
                styles.iconBtn,
                { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border },
                icon === ic && { borderColor: color, backgroundColor: color + '22' },
              ]}
              onPress={() => setIcon(ic)}
            >
              <Ionicons
                name={ic}
                size={22}
                color={icon === ic ? color : COLORS.textSub}
              />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: COLORS.textMuted, marginTop: SPACING.lg }]}>COLOR</Text>
        <View style={styles.colorRow}>
          {COLOR_OPTIONS.map(c => (
            <TouchableOpacity
              key={c}
              style={[
                styles.colorDot,
                { backgroundColor: c },
                color === c && styles.colorDotSelected,
              ]}
              onPress={() => setColor(c)}
            >
              {color === c && <Ionicons name="checkmark" size={12} color="#fff" />}
            </TouchableOpacity>
          ))}
        </View>

        <PrimaryButton
          label="Save changes"
          icon="save-outline"
          color={color}
          onPress={handleSave}
        />

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

  preview:     { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, gap: SPACING.md, marginBottom: SPACING.xl },
  previewName: { fontSize: 22, fontWeight: '800' },

  label: { ...FONTS.label, marginBottom: SPACING.sm, fontSize: 11 },
  input: { borderRadius: RADIUS.md, borderWidth: 1, fontSize: 15, paddingHorizontal: 14, paddingVertical: 13 },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconBtn:  { width: 44, height: 44, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  colorRow:        { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorDot:        { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorDotSelected:{ borderColor: '#fff', transform: [{ scale: 1.15 }] },

  saveBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.lg, paddingVertical: 16, marginTop: SPACING.xl, gap: 8, ...SHADOW.accent },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
