import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { format, isPast } from 'date-fns';
import { useApp, todayKey } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useTheme, FONTS, RADIUS, SHADOW, SPACING } from '../utils/theme';
import { relTime } from '../utils/relTime';
import { useCountUp } from '../hooks/useCountUp';
import { usePullRefresh } from '../hooks/usePullRefresh';

function StatCard({ label, value, color, icon, COLORS }) {
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: COLORS.surfaceAlt, borderColor: color + '44' },
      ]}
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: COLORS.textMuted }]}>{label}</Text>
    </View>
  );
}

function TaskRow({ task, categories, onComplete, COLORS }) {
  const cat = categories.find((c) => c.id === task.categoryId);
  const statusColor = {
    pending: COLORS.accent,
    completed: COLORS.success,
    expired: COLORS.danger,
  }[task.status];

  const dueLabel = (() => {
    if (!task.expiryDate) return null;
    const d = new Date(task.expiryDate);
    return `Due ${format(d, 'MMM d, h:mm a')}`;
  })();

  return (
    <View
      style={[
        styles.taskRow,
        {
          backgroundColor: COLORS.surfaceAlt,
          borderColor: task.status !== 'completed' && task.expiryDate && isPast(new Date(task.expiryDate))
            ? COLORS.danger + '55'
            : COLORS.border,
        },
      ]}
    >
      <TouchableOpacity
        onPress={() => task.status === 'pending' && onComplete(task.id)}
        style={[styles.checkbox, { borderColor: statusColor, backgroundColor: task.status === 'completed' ? statusColor + '22' : 'transparent' }]}
      >
        {task.status === 'completed' && (
          <Ionicons name="checkmark" size={14} color={statusColor} />
        )}
        {task.status === 'expired' && (
          <Ionicons name="close" size={14} color={statusColor} />
        )}
      </TouchableOpacity>

      <View style={styles.taskBody}>
        <Text
          style={[
            styles.taskTitle,
            { color: task.status !== 'pending' ? COLORS.textMuted : COLORS.text },
            task.status !== 'pending' && styles.struck,
          ]}
          numberOfLines={1}
        >
          {task.title}
        </Text>

        <View style={styles.taskMetaRow}>
          {cat && (
            <View style={[styles.pill, { backgroundColor: cat.color + '22' }]}>
              <Ionicons name={cat.icon} size={11} color={cat.color} />
              <Text style={[styles.pillText, { color: cat.color }]}>{cat.name}</Text>
            </View>
          )}
          {dueLabel && (
            <Text style={[styles.metaText, { color: COLORS.textMuted }]}>{dueLabel}</Text>
          )}
        </View>

        <Text style={[styles.timestamp, { color: COLORS.textMuted }]}>
          {task.status === 'completed'
            ? `Completed ${relTime(task.completedAt)}`
            : `Created ${relTime(task.createdAt)}`}
        </Text>
      </View>
    </View>
  );
}

function HobbyRow({ hobby, onToggle, COLORS }) {
  const today = todayKey();
  const done = !!(hobby.completions && hobby.completions[today]);

  return (
    <TouchableOpacity
      onPress={() => onToggle(hobby.id, today)}
      activeOpacity={0.7}
      style={[
        styles.hobbyRow,
        {
          backgroundColor: COLORS.surfaceAlt,
          borderColor: done ? hobby.color + '66' : COLORS.border,
        },
      ]}
    >
      <View style={[styles.hobbyIconWrap, { backgroundColor: hobby.color + '22' }]}>
        <Ionicons name={hobby.icon} size={20} color={hobby.color} />
      </View>

      <Text
        style={[
          styles.hobbyName,
          { color: COLORS.text },
          done && styles.struck,
        ]}
        numberOfLines={1}
      >
        {hobby.name}
      </Text>

      <View
        style={[
          styles.hobbyCheck,
          {
            borderColor: hobby.color,
            backgroundColor: done ? hobby.color : 'transparent',
          },
        ]}
      >
        {done && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const { state, completeTask, toggleHobbyToday } = useApp();
  const navigation = useNavigation();
  const { COLORS, mode, toggleThemeMode } = useTheme();
  const toast = useToast();
  const { refreshing, onRefresh } = usePullRefresh();

  const stats = useMemo(() => {
    const tasks = state.tasks;
    const pending = tasks.filter((t) => {
      if (t.status !== 'pending') return false;
      if (t.expiryDate && isPast(new Date(t.expiryDate))) return false;
      return true;
    }).length;
    return {
      total: tasks.length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      active: tasks.filter((t) => t.status === 'pending').length,
      pending,
      hobbiesToday: state.hobbies.filter((h) => h.completions && h.completions[todayKey()]).length,
    };
  }, [state.tasks, state.hobbies]);

  const todayTasks = useMemo(() => {
    return state.tasks
      .filter((t) => {
        if (t.status !== 'pending') return false;
        if (t.expiryDate && isPast(new Date(t.expiryDate))) return false;
        return true;
      })
      .sort((a, b) => {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return new Date(a.expiryDate) - new Date(b.expiryDate);
      })
      .slice(0, 5);
  }, [state.tasks]);

  const sortedHobbies = useMemo(() => {
    const today = todayKey();
    return [...state.hobbies].sort((a, b) => {
      const aDone = a.completions && a.completions[today];
      const bDone = b.completions && b.completions[today];
      if (aDone !== bDone) return aDone ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [state.hobbies]);

  const completedCount = useCountUp(stats.completed);
  const activeCount = useCountUp(stats.active);
  const hobbiesTodayCount = useCountUp(stats.hobbiesToday);

  const handleTaskComplete = (id) => {
    completeTask(id);
    toast.success('Task completed');
  };
  const handleHobbyToggle = (id, date) => {
    toggleHobbyToday(id, date);
    toast.info('Hobby updated');
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const themeIcon = mode === 'dark' ? 'moon' : 'sunny';
  const themeBg   = mode === 'dark' ? COLORS.surfaceAlt : COLORS.outlineAccent;
  const themeFg   = mode === 'dark' ? COLORS.textMuted : COLORS.outline;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
      >

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: COLORS.text }]}>{greeting()}</Text>
            <Text style={[styles.date, { color: COLORS.textMuted }]}>
              {format(new Date(), 'EEEE, MMMM d')}
            </Text>
          </View>

          <View style={styles.headerRight}>
            <View style={[styles.streakBadge, { backgroundColor: COLORS.warningDim, borderColor: COLORS.warning + '44' }]}>
              <Ionicons name="flame" size={16} color={COLORS.warning} />
              <Text style={[styles.streakNum, { color: COLORS.warning }]}>{state.streak}</Text>
            </View>

            <TouchableOpacity
              style={[styles.themeBtn, { backgroundColor: themeBg, borderColor: themeFg + '55' }]}
              onPress={toggleThemeMode}
            >
              <Ionicons name={themeIcon} size={18} color={themeFg} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.themeBtn, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}
              onPress={() => navigation.getParent()?.navigate('Settings')}
            >
              <Ionicons name="settings-outline" size={18} color={COLORS.textSub} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard COLORS={COLORS} label="Completed" value={completedCount} color={COLORS.success} icon="checkmark-circle" />
          <StatCard COLORS={COLORS} label="Active"    value={activeCount}    color={COLORS.accent}  icon="time-outline" />
          <StatCard COLORS={COLORS} label="Hobbies"   value={`${hobbiesTodayCount}/${state.hobbies.length}`} color={COLORS.warning} icon="leaf" />
        </View>

        {/* Hobbies */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Today's hobbies</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Hobbies')}>
              <Text style={[styles.seeAll, { color: COLORS.accent }]}>Manage</Text>
            </TouchableOpacity>
          </View>

          {sortedHobbies.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
              <Ionicons name="leaf-outline" size={28} color={COLORS.textMuted} />
              <Text style={[styles.emptyText, { color: COLORS.textMuted }]}>
                No hobbies yet. Add a daily habit to track.
              </Text>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: COLORS.accent }]}
                onPress={() => navigation.navigate('Hobbies')}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addBtnText}>Add hobby</Text>
              </TouchableOpacity>
            </View>
          ) : (
            sortedHobbies.map((h) => (
              <HobbyRow key={h.id} hobby={h} onToggle={handleHobbyToggle} COLORS={COLORS} />
            ))
          )}
        </View>

        {/* Upcoming tasks */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Upcoming tasks</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Tasks')}>
              <Text style={[styles.seeAll, { color: COLORS.accent }]}>See all</Text>
            </TouchableOpacity>
          </View>

          {todayTasks.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border }]}>
              <Ionicons name="sparkles-outline" size={28} color={COLORS.textMuted} />
              <Text style={[styles.emptyText, { color: COLORS.textMuted }]}>
                All clear. Add a new task to get started.
              </Text>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: COLORS.accent }]}
                onPress={() => navigation.navigate('Tasks', { screen: 'AddTask' })}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addBtnText}>Add task</Text>
              </TouchableOpacity>
            </View>
          ) : (
            todayTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                categories={state.categories}
                onComplete={handleTaskComplete}
                COLORS={COLORS}
              />
            ))
          )}
        </View>

        {/* Category quick view */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Categories</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: SPACING.md, gap: SPACING.sm }}
          >
            {state.categories.map((cat) => {
              const catTasks = state.tasks.filter((t) => t.categoryId === cat.id);
              const done = catTasks.filter((t) => t.status === 'completed').length;
              const pct = catTasks.length ? Math.round((done / catTasks.length) * 100) : 0;
              return (
                <View
                  key={cat.id}
                  style={[
                    styles.catCard,
                    { backgroundColor: COLORS.surfaceAlt, borderColor: cat.color + '55' },
                  ]}
                >
                  <Ionicons name={cat.icon} size={20} color={cat.color} />
                  <Text style={[styles.catName, { color: cat.color }]} numberOfLines={1}>
                    {cat.name}
                  </Text>
                  <Text style={[styles.catCount, { color: COLORS.text }]}>
                    {done}/{catTasks.length}
                  </Text>
                  <View style={[styles.catBar, { backgroundColor: COLORS.border }]}>
                    <View
                      style={[styles.catBarFill, { width: `${pct}%`, backgroundColor: cat.color }]}
                    />
                  </View>
                  <Text style={[styles.catPct, { color: COLORS.textMuted }]}>{pct}%</Text>
                </View>
              );
            })}

            <TouchableOpacity
              style={[
                styles.addCatCard,
                { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderStyle: 'dashed' },
              ]}
              onPress={() => navigation.navigate('Categories')}
            >
              <Ionicons name="add" size={26} color={COLORS.textMuted} />
              <Text style={[styles.addCatText, { color: COLORS.textMuted }]}>New</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  container: { flex: 1, paddingHorizontal: SPACING.lg },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  greeting: { ...FONTS.heading, fontSize: 28 },
  date:     { fontSize: 13, marginTop: 2 },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    gap: 4,
  },
  streakNum:  { ...FONTS.heading, fontSize: 16 },
  themeBtn:   { width: 38, height: 38, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },

  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  statCard: {
    flex: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    gap: 4,
  },
  statValue: { ...FONTS.heading, fontSize: 22 },
  statLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },

  section:      { marginBottom: SPACING.xl },
  sectionHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sectionTitle: { ...FONTS.subheading, fontSize: 17 },
  seeAll:       { fontSize: 13, fontWeight: '600' },

  empty:     { borderRadius: RADIUS.lg, padding: SPACING.xl, alignItems: 'center', borderWidth: 1, gap: SPACING.sm },
  emptyText: { fontSize: 14, textAlign: 'center' },
  addBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: 10, marginTop: SPACING.sm, ...SHADOW.accent },
  addBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },

  // Hobby row
  hobbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    gap: SPACING.md,
  },
  hobbyIconWrap: { width: 36, height: 36, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center' },
  hobbyName:     { flex: 1, fontSize: 15, fontWeight: '600' },
  hobbyCheck:    { width: 26, height: 26, borderRadius: 13, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },

  // Task row
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    gap: SPACING.md,
  },
  checkbox:  { width: 22, height: 22, borderRadius: 6, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  taskBody:  { flex: 1, gap: 4 },
  taskTitle: { fontSize: 15, fontWeight: '600' },
  struck:    { textDecorationLine: 'line-through' },
  taskMetaRow:{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  pill:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  pillText:  { fontSize: 11, fontWeight: '700' },
  metaText:  { fontSize: 11 },
  timestamp: { fontSize: 10, marginTop: 2 },

  // Category carousel
  catCard: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    width: 110,
    borderWidth: 1,
    gap: 4,
  },
  catName:  { fontSize: 12, fontWeight: '700' },
  catCount: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  catBar:   { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  catBarFill:{ height: '100%', borderRadius: 2 },
  catPct:   { fontSize: 10, fontWeight: '600' },

  addCatCard: {
    width: 80,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addCatText: { fontSize: 11, fontWeight: '600' },
});
