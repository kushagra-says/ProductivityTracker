import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, Modal, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useTheme, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import { usePullRefresh } from '../hooks/usePullRefresh';
import ConfirmDialog from '../components/ConfirmDialog';

const ICONS = [
  'book-outline', 'home-outline', 'barbell-outline', 'briefcase-outline',
  'brush-outline', 'medkit-outline', 'cash-outline', 'car-outline',
  'leaf-outline', 'musical-notes-outline', 'phone-portrait-outline', 'airplane-outline',
  'game-controller-outline', 'paw-outline', 'cafe-outline', 'film-outline',
  'school-outline', 'cart-outline', 'pencil-outline', 'pizza-outline',
  'bed-outline', 'flame-outline', 'heart-outline', 'flower-outline',
];

const FALLBACK_CATEGORY_ICON = 'folder-outline';

function isIoniconsName(s) {
  return typeof s === 'string' && /^[a-z]+(?:-outline)?$/.test(s);
}

const genId = () => `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

export default function CategoriesScreen() {
  const { state, addCategory, deleteCategory } = useApp();
  const { COLORS } = useTheme();
  const navigation = useNavigation();
  const toast = useToast();
  const { refreshing, onRefresh } = usePullRefresh();

  const COLOR_OPTIONS = COLORS.cat;

  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);

  // Pending category awaiting delete confirmation. When set, the themed
  // ConfirmDialog is shown instead of a native Alert.alert so the styling
  // matches the rest of the app.
  const [pendingDelete, setPendingDelete] = useState(null);

  const handleAdd = () => {
    if (!newName.trim()) {
      Alert.alert('Name required', 'Please enter a category name.');
      return;
    }
    addCategory({ id: genId(), name: newName.trim(), icon: selectedIcon, color: selectedColor });
    setNewName('');
    setSelectedIcon(ICONS[0]);
    setSelectedColor(COLOR_OPTIONS[0]);
    setModalVisible(false);
    toast.success('Category created');
  };

  const handleDelete = (cat) => {
    // Open the themed confirm dialog; the actual deletion runs once the
    // user taps Delete inside the modal.
    setPendingDelete(cat);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteCategory(pendingDelete.id);
    toast.danger('Category deleted');
    setPendingDelete(null);
  };

  const cancelDelete = () => setPendingDelete(null);

  // Message for the confirm dialog — surfaces the task count so the user
  // knows deleting will unlink any tasks that referenced this category.
  const pendingTaskCount = pendingDelete
    ? state.tasks.filter(t => t.categoryId === pendingDelete.id).length
    : 0;

  const renderCategory = ({ item: cat }) => {
    const tasks = state.tasks.filter(t => t.categoryId === cat.id);
    const done = tasks.filter(t => t.status === 'completed').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const expired = tasks.filter(t => t.status === 'expired').length;
    const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const iconName = isIoniconsName(cat.icon) ? cat.icon : FALLBACK_CATEGORY_ICON;

    return (
      <View style={[styles.catCard, { backgroundColor: COLORS.surfaceAlt, borderColor: cat.color + '40' }]}>
        <View style={styles.catHeader}>
          <View style={[styles.catIconWrap, { backgroundColor: cat.color + '22' }]}>
            <Ionicons name={iconName} size={22} color={cat.color} />
          </View>
          <View style={styles.catInfo}>
            <Text style={[styles.catName, { color: cat.color }]}>{cat.name}</Text>
            <Text style={[styles.catSubtext, { color: COLORS.textMuted }]}>
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} total
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => navigation.navigate('EditCategory', { category: cat })}
              style={[styles.iconActionBtn, { backgroundColor: COLORS.accentDim, borderColor: COLORS.accent + '44' }]}
            >
              <Ionicons name="create-outline" size={14} color={COLORS.accent} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(cat)}
              style={[styles.iconActionBtn, { backgroundColor: COLORS.dangerDim, borderColor: COLORS.danger + '44' }]}
            >
              <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.progressBar, { backgroundColor: COLORS.border }]}>
          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: cat.color }]} />
        </View>

        <View style={styles.catStats}>
          <View style={styles.catStat}>
            <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
            <Text style={[styles.catStatText, { color: COLORS.textSub }]}>{done} done</Text>
          </View>
          <View style={styles.catStat}>
            <View style={[styles.dot, { backgroundColor: COLORS.accent }]} />
            <Text style={[styles.catStatText, { color: COLORS.textSub }]}>{pending} pending</Text>
          </View>
          <View style={styles.catStat}>
            <View style={[styles.dot, { backgroundColor: COLORS.danger }]} />
            <Text style={[styles.catStatText, { color: COLORS.textSub }]}>{expired} expired</Text>
          </View>
          <Text style={[styles.pctText, { color: cat.color }]}>{pct}%</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]}>
      <FlatList
        data={state.categories}
        keyExtractor={c => c.id}
        renderItem={renderCategory}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: COLORS.text }]}>Categories</Text>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: COLORS.accent }]}
              onPress={() => setModalVisible(true)}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addBtnText}>New</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={40} color={COLORS.textMuted} />
            <Text style={[styles.emptyText, { color: COLORS.textMuted }]}>No categories yet</Text>
          </View>
        }
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: COLORS.text }]}>New category</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: COLORS.textMuted }]}>NAME</Text>
            <TextInput
              style={[styles.input, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border, color: COLORS.text }]}
              placeholder="e.g. Studies, Fitness..."
              placeholderTextColor={COLORS.textMuted}
              value={newName}
              onChangeText={setNewName}
              maxLength={30}
            />

            <Text style={[styles.fieldLabel, { color: COLORS.textMuted }]}>ICON</Text>
            <View style={styles.iconGrid}>
              {ICONS.map(icon => (
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
              {COLOR_OPTIONS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorDot,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorDotSelected,
                  ]}
                  onPress={() => setSelectedColor(color)}
                >
                  {selectedColor === color && <Ionicons name="checkmark" size={12} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.preview, { backgroundColor: COLORS.surfaceAlt, borderColor: selectedColor + '55' }]}>
              <Ionicons name={selectedIcon} size={22} color={selectedColor} />
              <Text style={[styles.previewName, { color: selectedColor }]}>
                {newName || 'Category name'}
              </Text>
            </View>

            <TouchableOpacity style={[styles.createBtn, { backgroundColor: selectedColor }]} onPress={handleAdd}>
              <Text style={styles.createBtnText}>Create category</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={!!pendingDelete}
        title="Delete category"
        message={
          pendingDelete
            ? (pendingTaskCount > 0
                ? `"${pendingDelete.name}" has ${pendingTaskCount} task${pendingTaskCount !== 1 ? 's' : ''}. Deleting it will unlink those tasks. Continue?`
                : `Delete "${pendingDelete.name}"?`)
            : ''
        }
        icon="trash-outline"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 32 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  title:      { ...FONTS.heading, fontSize: 28 },
  addBtn:     { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 8, gap: 4, ...SHADOW.accent },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  catCard:    { borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, borderWidth: 1 },
  catHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  catIconWrap:{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md },
  catInfo:    { flex: 1 },
  catName:    { fontSize: 16, fontWeight: '800' },
  catSubtext: { fontSize: 12, marginTop: 2 },
  iconActionBtn: { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  progressBar:  { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: SPACING.md },
  progressFill: { height: '100%', borderRadius: 3 },

  catStats:   { flexDirection: 'row', alignItems: 'center', gap: 14 },
  catStat:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:        { width: 7, height: 7, borderRadius: 3.5 },
  catStatText:{ fontSize: 12 },
  pctText:    { marginLeft: 'auto', fontSize: 14, fontWeight: '800' },

  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, marginTop: 10 },

  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modal:        { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: SPACING.xl, borderWidth: 1, borderBottomWidth: 0 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:   { ...FONTS.heading, fontSize: 20 },

  fieldLabel: { ...FONTS.label, marginBottom: SPACING.sm, fontSize: 11 },
  input:      { borderRadius: RADIUS.md, borderWidth: 1, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, marginBottom: SPACING.lg },

  iconGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.lg },
  iconBtn:         { width: 44, height: 44, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  colorRow:        { flexDirection: 'row', gap: 10, marginBottom: SPACING.lg, flexWrap: 'wrap' },
  colorDot:        { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorDotSelected:{ borderColor: '#fff', transform: [{ scale: 1.15 }] },

  preview:     { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, gap: 10, marginBottom: SPACING.lg },
  previewName: { fontSize: 16, fontWeight: '800' },

  createBtn:     { borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
