import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useFeatures } from '../context/FeaturesContext';
import type { SharedList } from '../types';

export function SharedListsScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { sharedLists, addSharedList, deleteSharedList, addSharedListItem, toggleSharedListItem, deleteSharedListItem } = useFeatures();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newListTitle, setNewListTitle] = useState('');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const handleAddList = () => {
    if (!newListTitle.trim()) return;
    const list = addSharedList(newListTitle.trim());
    setNewListTitle('');
    setShowAdd(false);
    setExpandedId(list.id);
  };

  const handleShare = async (list: SharedList) => {
    try {
      await Share.share({ message: `Join my shared list "${list.title}" with code: ${list.shareCode}` });
    } catch {}
  };

  const handleAddItem = (listId: string) => {
    if (!newItemTitle.trim()) return;
    addSharedListItem(listId, newItemTitle.trim());
    setNewItemTitle('');
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { paddingHorizontal: theme.spacing.lg, paddingTop: insets.top + theme.spacing.md, paddingBottom: theme.spacing.md, backgroundColor: theme.colors.surface },
    title: { ...theme.typography.title, color: theme.colors.text, fontSize: 26, fontWeight: '700' },
    subtitle: { ...theme.typography.caption, color: theme.colors.textMuted },
    list: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: 120 },
    card: { backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.xl, marginBottom: theme.spacing.md, ...theme.shadows.card, overflow: 'hidden' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.lg, gap: theme.spacing.md },
    cardTitle: { ...theme.typography.titleSmall, color: theme.colors.text, flex: 1 },
    cardCount: { ...theme.typography.caption, color: theme.colors.textMuted },
    shareBtn: { padding: theme.spacing.xs },
    shareCode: { ...theme.typography.overline, color: theme.colors.primary, backgroundColor: theme.colors.primaryLight, paddingHorizontal: theme.spacing.sm, paddingVertical: 2, borderRadius: theme.borderRadius.sm },
    itemsContainer: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
    checkboxDone: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
    itemText: { ...theme.typography.body, color: theme.colors.text, flex: 1 },
    itemTextDone: { textDecorationLine: 'line-through', color: theme.colors.textMuted },
    deleteItemBtn: { padding: 4 },
    addItemRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
    addItemInput: { flex: 1, ...theme.typography.bodySmall, color: theme.colors.text, backgroundColor: theme.colors.inputBg, borderRadius: theme.borderRadius.lg, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
    addItemBtn: { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.lg, paddingHorizontal: theme.spacing.md, alignItems: 'center', justifyContent: 'center' },
    addListBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.lg, borderRadius: theme.borderRadius.lg, borderWidth: 2, borderColor: theme.colors.primary, borderStyle: 'dashed', marginTop: theme.spacing.md },
    addListBtnText: { ...theme.typography.button, color: theme.colors.primary },
    addForm: { backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.xl, padding: theme.spacing.lg, gap: theme.spacing.md, ...theme.shadows.card, marginTop: theme.spacing.md },
    input: { ...theme.typography.body, color: theme.colors.text, backgroundColor: theme.colors.inputBg, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md },
    formBtnRow: { flexDirection: 'row', gap: theme.spacing.sm },
    formBtn: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.md, borderRadius: theme.borderRadius.lg },
    formBtnText: { ...theme.typography.button },
    empty: { alignItems: 'center', paddingTop: 60, gap: theme.spacing.md },
    emptyText: { ...theme.typography.body, color: theme.colors.textMuted },
  }), [theme, insets]);

  const renderList = ({ item: list }: { item: SharedList }) => {
    const isExpanded = expandedId === list.id;
    const completedCount = list.items.filter((i) => i.completed).length;
    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.cardHeader} onPress={() => setExpandedId(isExpanded ? null : list.id)} onLongPress={() => Alert.alert('Delete list?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteSharedList(list.id) }])}>
          <Ionicons name="list-outline" size={22} color={theme.colors.primary} />
          <Text style={styles.cardTitle}>{list.title}</Text>
          <Text style={styles.cardCount}>{completedCount}/{list.items.length}</Text>
          <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare(list)}>
            <Ionicons name="share-social-outline" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.itemsContainer}>
            <Text style={styles.shareCode}>Code: {list.shareCode}</Text>
            {list.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <TouchableOpacity style={[styles.checkbox, item.completed && styles.checkboxDone]} onPress={() => toggleSharedListItem(list.id, item.id)}>
                  {item.completed && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </TouchableOpacity>
                <Text style={[styles.itemText, item.completed && styles.itemTextDone]}>{item.title}</Text>
                <TouchableOpacity style={styles.deleteItemBtn} onPress={() => deleteSharedListItem(list.id, item.id)}>
                  <Ionicons name="close" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.addItemRow}>
              <TextInput style={styles.addItemInput} value={newItemTitle} onChangeText={setNewItemTitle} placeholder="Add item..." placeholderTextColor={theme.colors.textMuted} onSubmitEditing={() => handleAddItem(list.id)} returnKeyType="done" />
              <TouchableOpacity style={styles.addItemBtn} onPress={() => handleAddItem(list.id)}>
                <Ionicons name="add" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Shared Lists</Text>
        </View>
        <Text style={styles.subtitle}>Collaborate with others on checklists</Text>
      </View>

      <FlatList
        data={sharedLists}
        renderItem={renderList}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={64} color={theme.colors.textDisabled} />
            <Text style={styles.emptyText}>No shared lists yet</Text>
          </View>
        }
        ListFooterComponent={
          showAdd ? (
            <View style={styles.addForm}>
              <TextInput style={styles.input} value={newListTitle} onChangeText={setNewListTitle} placeholder="List name..." placeholderTextColor={theme.colors.textMuted} autoFocus />
              <View style={styles.formBtnRow}>
                <TouchableOpacity style={[styles.formBtn, { backgroundColor: theme.colors.inputBg }]} onPress={() => setShowAdd(false)}>
                  <Text style={[styles.formBtnText, { color: theme.colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.formBtn, { backgroundColor: theme.colors.primary }]} onPress={handleAddList}>
                  <Text style={[styles.formBtnText, { color: '#FFF' }]}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addListBtn} onPress={() => setShowAdd(true)}>
              <Ionicons name="add" size={20} color={theme.colors.primary} />
              <Text style={styles.addListBtnText}>New Shared List</Text>
            </TouchableOpacity>
          )
        }
      />
    </View>
  );
}
