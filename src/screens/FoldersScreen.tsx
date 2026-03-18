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
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../components/Icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';

export function FoldersScreen() {
  const nav = useNavigation();
  const { theme } = useTheme();
  const { folders, filter, setFilter, addFolder, deleteFolder, updateFolder } = useApp();
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

  const rootFolders = folders.filter((f) => !f.parentId);

  const handleAddFolder = () => {
    const name = newName.trim();
    if (!name) return;
    addFolder(name, null);
    setNewName('');
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete folder', `Delete "${name}"? Notes inside will be moved to root.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteFolder(id) },
    ]);
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      updateFolder(editingId, { name: editName.trim() });
      setEditingId(null);
    }
  };

  const selectFolder = (folderId: string | null) => {
    setFilter({ folderId });
    nav.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Folders</Text>
        <Text style={styles.headerSubtitle}>Organize notes into folders</Text>
      </View>
      <View style={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All notes</Text>
        <TouchableOpacity style={styles.row} onPress={() => selectFolder(null)}>
          <Icon name="folder" size={24} color={!filter.folderId ? theme.colors.primary : theme.colors.icon} />
          <Text style={styles.rowText}>All notes</Text>
          {!filter.folderId && <Text style={styles.check}>✓</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Folders</Text>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="New folder name"
            value={newName}
            onChangeText={setNewName}
            onSubmitEditing={handleAddFolder}
            placeholderTextColor={theme.colors.textDisabled}
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddFolder}>
            <Icon name="add" size={24} style={{ color: theme.colors.surface }} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={rootFolders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.rowWrap}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => selectFolder(item.id)}
              >
                <Icon name="folder" size={24} color={filter.folderId === item.id ? theme.colors.primary : theme.colors.icon} />
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
                {filter.folderId === item.id && <Text style={styles.check}>✓</Text>}
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
