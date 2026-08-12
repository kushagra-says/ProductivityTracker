import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { format, isPast } from 'date-fns';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useTheme, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import { relTime } from '../utils/relTime';
import { usePullRefresh } from '../hooks/usePullRefresh';
import ConfirmDialog from '../components/ConfirmDialog';

const FILTERS = ['All', 'Pending', 'Completed', 'Expired'];

const FALLBACK_CATEGORY_ICON = 'folder-outline';

function isIoniconsName(s) {
  return typeof s === 'string' && /^[a-z]+(?:-outline)?$/.test(s);
}

// Pick the most recent valid timestamp from a list. Missing/invalid
// values are coerced to the epoch so they sort to the bottom rather than
// raising an error mid-sort.
function maxDate(...values) {
  let max = 0;
  for (const v of values) {
    if (!v) continue;
    const t = new Date(v).getTime();
    if (!Number.isNaN(t) && t > max) max = t;
  }
  return new Date(max).toISOString();
}

export default function TasksScreen() {
  const { state, completeTask, deleteTask } = useApp();
  const { COLORS } = useTheme();
  const navigation = useNavigation();
  const toast = useToast();
  const { refreshing, onRefresh } = usePullRefresh();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState(null);
  // Pending delete — held in state so we can show the themed ConfirmDialog
  // and only fire deleteTask after the user confirms.
  const [pendingDelete, setPendingDelete] = useState(null);

  const tasks = useMemo(() => {
    let list = state.tasks.map((t) => {
      if (t.status === 'pending' && t.expiryDate && isPast(new Date(t.expiryDate))) {
        return { ...t, status: 'expired' };
      }
      return t;
    });
    if (filter !== 'All') list = list.filter((t) => t.status === filter.toLowerCase());
    if (catFilter) list = list.filter((t) => t.categoryId === catFilter);
    if (search.trim()) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          (t.notes || '').toLowerCase().includes(search.toLowerCase()),
      );
    }
    // "Most recent on top" = whichever timestamp was touched last on the
    // task (creation, edit, or completion). Edits and completions therefore
    // bubble a task back to the top instead of being stuck in creation order.
    return list.sort((a, b) => {
      const aRecent = maxDate(a.createdAt, a.updatedAt, a.completedAt);
      const bRecent = maxDate(b.createdAt, b.updatedAt, b.completedAt);
      return new Date(bRecent) - new Date(aRecent);
    });
  }, [state.tasks, filter, catFilter, search]);

  const handleDelete = (id) => {
    setPendingDelete(id);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteTask(pendingDelete);
    toast.danger('Task deleted');
    setPendingDelete(null);
  };

  const handleComplete = (id) => {
    completeTask(id);
    toast.success('Task completed');
  };

  const statusConfig = {
    pending:   { color: COLORS.accent,  label: 'Pending', icon: 'time-outline' },
    completed: { color: COLORS.success, label: 'Done',    icon: 'checkmark-circle' },
    expired:   { color: COLORS.danger,  label: 'Expired', icon: 'alert-circle' },
  };

  const renderTask = ({ item: task }) => {
    const cat = state.categories.find((c) => c.id === task.categoryId);
    const sc = statusConfig[task.status] || statusConfig.pending;
    const isUrgent =
      task.status === 'pending' &&
      task.expiryDate &&
      new Date(task.expiryDate) - new Date() < 3600000;

    const catIcon = cat && isIoniconsName(cat.icon) ? cat.icon : FALLBACK_CATEGORY_ICON;

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: COLORS.surfaceAlt,
            borderColor: isUrgent ? COLORS.warning + '55' : COLORS.border,
          },
        ]}
      >
        <View style={[styles.accentBar, { backgroundColor: sc.color }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text
              style={[
                styles.taskTitle,
                { color: task.status !== 'pending' ? COLORS.textMuted : COLORS.text },
                task.status !== 'pending' && styles.struck,
              ]}
              numberOfLines={3}
            >
              {task.title}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: sc.color + '22' }]}>
              <Ionicons name={sc.icon} size={10} color={sc.color} />
              <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
            </View>
          </View>

          {task.notes ? (
            <Text style={[styles.notes, { color: COLORS.textSub }]}>
              {task.notes}
            </Text>
          ) : null}

          <View style={styles.cardMeta}>
            {cat && (
              <View style={[styles.catChip, { backgroundColor: cat.color + '22' }]}>
                <Ionicons name={catIcon} size={11} color={cat.color} />
                <Text style={[styles.catChipText, { color: cat.color }]}>{cat.name}</Text>
              </View>
            )}
            {task.expiryDate && (
              <Text style={[styles.metaText, { color: isUrgent ? COLORS.warning : COLORS.textMuted }]}>
                {isUrgent ? 'Due ' : 'Due '}
                {format(new Date(task.expiryDate), 'MMM d, h:mm a')}
              </Text>
            )}
          </View>

          <Text style={[styles.timestamp, { color: COLORS.textMuted }]}>
            {task.status === 'completed' && task.completedAt
              ? `Completed ${relTime(task.completedAt)}`
              : `Created ${relTime(task.createdAt)}`}
          </Text>

          <View style={styles.cardActions}>
            {task.status === 'pending' && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleComplete(task.id)}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                <Text style={[styles.actionText, { color: COLORS.success }]}>Complete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('AddTask', { task })}
            >
              <Ionicons name="create-outline" size={14} color={COLORS.accent} />
              <Text style={[styles.actionText, { color: COLORS.accent }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(task.id)}>
              <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
              <Text style={[styles.actionText, { color: COLORS.danger }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: COLORS.text }]}>Tasks</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: COLORS.accent }]}
          onPress={() => navigation.navigate('AddTask')}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.searchRow,
          { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border },
        ]}
      >
        <Ionicons name="search" size={16} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: COLORS.text }]}
          placeholder="Search tasks..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterChip,
              { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border },
              filter === f && { backgroundColor: COLORS.accentDim, borderColor: COLORS.accent },
            ]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                { color: COLORS.textMuted },
                filter === f && { color: COLORS.accent },
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.catFilterWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: null, name: 'All', icon: 'apps-outline', color: COLORS.textMuted }, ...state.categories]}
          keyExtractor={(item) => item.id || 'all'}
          contentContainerStyle={styles.catFilterRow}
          renderItem={({ item: cat }) => {
            const active = catFilter === cat.id;
            const iconName = isIoniconsName(cat.icon) ? cat.icon : FALLBACK_CATEGORY_ICON;
            return (
              <TouchableOpacity
                style={[
                  styles.catFilterChip,
                  { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border },
                  active && { backgroundColor: COLORS.accentDim, borderColor: COLORS.accent },
                ]}
                onPress={() => setCatFilter(cat.id)}
              >
                <Ionicons
                  name={iconName}
                  size={14}
                  color={active ? COLORS.accent : COLORS.textMuted}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.catFilterLabel,
                    { color: COLORS.textMuted },
                    active && { color: COLORS.accent },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        renderItem={renderTask}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="mail-open-outline" size={40} color={COLORS.textMuted} />
            <Text style={[styles.emptyText, { color: COLORS.textMuted }]}>No tasks found</Text>
          </View>
        }
      />

      <ConfirmDialog
        visible={!!pendingDelete}
        title="Delete task?"
        message="This task and its reminders will be removed permanently."
        icon="trash-outline"
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title:     { ...FONTS.heading, fontSize: 28 },
  addBtn:    { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 8, gap: 4, ...SHADOW.accent },
  addBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  searchIcon:   { marginRight: 8 },
  searchInput:  { flex: 1, fontSize: 14, paddingVertical: 12 },

  filterRow: { flexDirection: 'row', paddingHorizontal: SPACING.lg, gap: 8, marginBottom: SPACING.sm },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  filterText: { fontSize: 12, fontWeight: '600' },

  catFilterWrapper: { marginBottom: SPACING.sm },
  catFilterRow: { paddingHorizontal: SPACING.lg, alignItems: 'center' },
  catFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: 14,
    marginRight: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  catFilterLabel: { fontSize: 12, fontWeight: '600' },

  list: { paddingHorizontal: SPACING.lg, paddingBottom: 24 },

  card: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    marginBottom: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accentBar: { width: 4 },
  cardBody: { flex: 1, padding: SPACING.md },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  taskTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  struck:     { textDecorationLine: 'line-through' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 3,
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  notes: { fontSize: 13, marginBottom: 8, lineHeight: 18 },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  catChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  catChipText: { fontSize: 11, fontWeight: '700' },
  metaText:    { fontSize: 11 },
  timestamp:   { fontSize: 10, marginBottom: 10 },

  cardActions: { flexDirection: 'row', gap: 12 },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText:  { fontSize: 12, fontWeight: '600' },

  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, marginTop: 10 },
});
