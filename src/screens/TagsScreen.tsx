import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Icon } from '../components/Icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';

export function TagsScreen() {
  const { theme } = useTheme();
  const { tags, filter, setFilter, addTag, deleteTag, updateTag } = useApp();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        header: {
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
        },
        headerTitle: {
          ...theme.typography.title,
          fontSize: 26,
          color: theme.colors.text,
        },
        headerSubtitle: {
          ...theme.typography.caption,
          color: theme.colors.textMuted,
          marginTop: theme.spacing.xxs,
        },
        content: { padding: theme.spacing.lg },
        section: { marginBottom: theme.spacing.xxl },
        sectionTitle: {
          ...theme.typography.overline,
          color: theme.colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: theme.spacing.md,
          marginLeft: theme.spacing.xs,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: theme.spacing.lg,
          paddingHorizontal: theme.spacing.lg,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          marginBottom: theme.spacing.sm,
        },
        rowWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm },
        rowText: {
          flex: 1,
          marginLeft: theme.spacing.md,
          ...theme.typography.body,
          color: theme.colors.text,
          fontWeight: '500',
        },
        check: { color: theme.colors.primary, fontWeight: '700', fontSize: 16 },
        addRow: {
          flexDirection: 'row',
          marginBottom: theme.spacing.md,
          gap: theme.spacing.sm,
        },
        input: {
          flex: 1,
          backgroundColor: theme.colors.inputBg,
          borderRadius: theme.borderRadius.lg,
          paddingVertical: 12,
          paddingHorizontal: theme.spacing.lg,
          borderWidth: 2,
          borderColor: theme.colors.border,
          ...theme.typography.body,
          color: theme.colors.text,
        },
        addBtn: {
          width: 48,
          height: 48,
          borderRadius: theme.borderRadius.lg,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        editInput: {
          flex: 1,
          marginLeft: theme.spacing.md,
          ...theme.typography.body,
          padding: 0,
          color: theme.colors.text,
        },
        rowActions: {
          flexDirection: 'row',
          gap: theme.spacing.sm,
          paddingLeft: theme.spacing.sm,
        },
      }),
    [theme]
  );

  const rootTags = tags.filter((t) => !t.parentId);

  const handleAddTag = () => {
    const name = newName.trim();
    if (!name) return;
    addTag(name, null);
    setNewName('');
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete tag', `Remove "${name}" from all notes?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTag(id) },
    ]);
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      updateTag(editingId, { name: editName.trim() });
      setEditingId(null);
    }
  };

  const toggleTagFilter = (tagId: string) => {
    const current = filter.tagIds || [];
    if (current.includes(tagId)) {
      setFilter({ tagIds: current.filter((id) => id !== tagId) });
    } else {
      setFilter({ tagIds: [...current, tagId] });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tags</Text>
        <Text style={styles.headerSubtitle}>Filter notes by tags</Text>
      </View>
      <View style={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tags</Text>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="New tag"
            value={newName}
            onChangeText={setNewName}
            onSubmitEditing={handleAddTag}
            placeholderTextColor={theme.colors.textDisabled}
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddTag}>
            <Icon name="add" size={24} style={{ color: theme.colors.surface }} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={rootTags}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.rowWrap}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => toggleTagFilter(item.id)}
              >
                <Icon name="tag" size={24} color={filter.tagIds?.includes(item.id) ? theme.colors.primary : theme.colors.icon} />
                {editingId === item.id ? (
                  <TextInput
                    style={styles.editInput}
                    value={editName}
                    onChangeText={setEditName}
                    onBlur={saveEdit}
                    autoFocus
                  />
                ) : (
                  <Text style={styles.rowText}>{item.name}</Text>
                )}
                {filter.tagIds?.includes(item.id) && <Text style={styles.check}>✓</Text>}
              </TouchableOpacity>
              {editingId !== item.id && (
                <View style={styles.rowActions}>
                  <TouchableOpacity onPress={() => startEdit(item.id, item.name)}>
                    <Icon name="edit" size={18} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id, item.name)}>
                    <Icon name="delete" size={18} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      </View>
      </View>
    </View>
  );
}
