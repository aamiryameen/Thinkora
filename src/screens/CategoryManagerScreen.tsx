import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { categoryColors } from '../core/theme';
import type { TaskCategory } from '../types';

const COLORS = Object.values(categoryColors);
const ICONS = ['briefcase-outline', 'person-outline', 'heart-outline', 'flag-outline', 'star-outline', 'home-outline', 'school-outline', 'fitness-outline', 'car-outline', 'cash-outline', 'game-controller-outline', 'musical-notes-outline', 'restaurant-outline', 'paw-outline', 'globe-outline', 'code-slash-outline'];

export function CategoryManagerScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { taskCategories, addTaskCategory, updateTaskCategory, deleteTaskCategory } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [colorIdx, setColorIdx] = useState(0);
  const [iconIdx, setIconIdx] = useState(0);

  const handleSave = () => {
    if (!name.trim()) return;
    if (editId) {
      updateTaskCategory(editId, { name: name.trim(), color: COLORS[colorIdx], icon: ICONS[iconIdx] });
      setEditId(null);
    } else {
      addTaskCategory({ name: name.trim(), color: COLORS[colorIdx], icon: ICONS[iconIdx] });
    }
    setName('');
    setShowAdd(false);
  };

  const handleEdit = (cat: TaskCategory) => {
    setEditId(cat.id);
    setName(cat.name);
    setColorIdx(COLORS.indexOf(cat.color) >= 0 ? COLORS.indexOf(cat.color) : 0);
    setIconIdx(ICONS.indexOf(cat.icon) >= 0 ? ICONS.indexOf(cat.icon) : 0);
    setShowAdd(true);
  };

  const handleDelete = (cat: TaskCategory) => {
    Alert.alert('Delete category?', `Remove "${cat.name}"? Tasks will be uncategorized.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTaskCategory(cat.id) },
    ]);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { paddingHorizontal: theme.spacing.lg, paddingTop: insets.top + theme.spacing.md, paddingBottom: theme.spacing.md, backgroundColor: theme.colors.surface },
    title: { ...theme.typography.title, color: theme.colors.text, fontSize: 26, fontWeight: '700' },
    list: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: 120 },
    card: { backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.lg, flexDirection: 'row', alignItems: 'center', padding: theme.spacing.lg, marginBottom: theme.spacing.sm, gap: theme.spacing.md, ...theme.shadows.card },
    iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    catName: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600', flex: 1 },
    actionBtn: { padding: theme.spacing.xs },
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.lg, borderRadius: theme.borderRadius.lg, borderWidth: 2, borderColor: theme.colors.primary, borderStyle: 'dashed', marginTop: theme.spacing.md },
    addBtnText: { ...theme.typography.button, color: theme.colors.primary },
    form: { backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.xl, padding: theme.spacing.lg, gap: theme.spacing.md, ...theme.shadows.card, marginTop: theme.spacing.md },
    input: { ...theme.typography.body, color: theme.colors.text, backgroundColor: theme.colors.inputBg, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md },
    label: { ...theme.typography.label, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    colorDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    iconDot: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.inputBg },
    iconDotSelected: { backgroundColor: theme.colors.primaryLight, borderWidth: 2, borderColor: theme.colors.primary },
    btnRow: { flexDirection: 'row', gap: theme.spacing.sm },
    formBtn: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.md, borderRadius: theme.borderRadius.lg },
    formBtnText: { ...theme.typography.button },
  }), [theme, insets]);

  const renderCategory = ({ item }: { item: TaskCategory }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleEdit(item)} onLongPress={() => handleDelete(item)}>
      <View style={[styles.iconWrap, { backgroundColor: item.color + '20' }]}>
        <Ionicons name={item.icon} size={24} color={item.color} />
      </View>
      <Text style={styles.catName}>{item.name}</Text>
      <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(item)}>
        <Ionicons name="create-outline" size={20} color={theme.colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Categories</Text>
        </View>
      </View>
      <FlatList
        data={taskCategories}
        renderItem={renderCategory}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          showAdd ? (
            <View style={styles.form}>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Category name..." placeholderTextColor={theme.colors.textMuted} autoFocus />
              <Text style={styles.label}>Color</Text>
              <View style={styles.colorRow}>
                {COLORS.map((c, i) => (
                  <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c }]} onPress={() => setColorIdx(i)}>
                    {colorIdx === i && <Ionicons name="checkmark" size={18} color="#FFF" />}
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Icon</Text>
              <View style={styles.iconRow}>
                {ICONS.map((icon, i) => (
                  <TouchableOpacity key={icon} style={[styles.iconDot, iconIdx === i && styles.iconDotSelected]} onPress={() => setIconIdx(i)}>
                    <Ionicons name={icon} size={20} color={iconIdx === i ? theme.colors.primary : theme.colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.btnRow}>
                <TouchableOpacity style={[styles.formBtn, { backgroundColor: theme.colors.inputBg }]} onPress={() => { setShowAdd(false); setEditId(null); setName(''); }}>
                  <Text style={[styles.formBtnText, { color: theme.colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.formBtn, { backgroundColor: theme.colors.primary }]} onPress={handleSave}>
                  <Text style={[styles.formBtnText, { color: '#FFF' }]}>{editId ? 'Update' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
              <Ionicons name="add" size={20} color={theme.colors.primary} />
              <Text style={styles.addBtnText}>New Category</Text>
            </TouchableOpacity>
          )
        }
      />
    </View>
  );
}
