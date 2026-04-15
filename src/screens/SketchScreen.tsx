import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  Dimensions,
  Alert,
  Share,
  Modal,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import { useTheme } from '../context/ThemeContext';
import { Icon } from '../components/Icons';

const SKETCHES_KEY = '@thinkora/saved_sketches';

interface SavedSketch {
  id: string;
  path: string;
  createdAt: number;
  name: string;
}

const { width: SCREEN_W } = Dimensions.get('window');

let SignatureCanvas: any = null;
if (Platform.OS === 'android') {
  try {
    SignatureCanvas = require('react-native-signature-canvas').default;
  } catch {
    SignatureCanvas = null;
  }
}

const PEN_COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#FF6B6B', '#FF9500',
  '#FFCC00', '#34C759', '#00C7BE', '#007AFF', '#5856D6',
  '#AF52DE', '#FF2D55', '#8E8E93', '#48484A', '#636366',
  '#C7C7CC', '#FF6347', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#85C1E9',
];

const BG_COLORS = [
  '#FFFFFF', '#F8F8F8', '#1a1a2e', '#0f0f0f', '#FFF8E1',
  '#E8F5E9', '#E3F2FD', '#FCE4EC', '#F3E5F5', '#FFFDE7',
  '#E0F7FA', '#FBE9E7', '#F1F8E9', '#EDE7F6',
];

const BRUSH_SIZES = [
  { label: 'XS', min: 0.5, max: 1 },
  { label: 'S', min: 1, max: 2 },
  { label: 'M', min: 2, max: 4 },
  { label: 'L', min: 4, max: 8 },
  { label: 'XL', min: 8, max: 14 },
];

type Tool = 'pen' | 'eraser';

export function SketchScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const sigRef = useRef<any>(null);

  const [penColor, setPenColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [brushIndex, setBrushIndex] = useState(2); // M
  const [tool, setTool] = useState<Tool>('pen');
  const [showColors, setShowColors] = useState(false);
  const [showBgColors, setShowBgColors] = useState(false);
  const [showBrush, setShowBrush] = useState(false);
  const [savedSketches, setSavedSketches] = useState<SavedSketch[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load saved sketches list
  useEffect(() => {
    AsyncStorage.getItem(SKETCHES_KEY).then(raw => {
      if (raw) setSavedSketches(JSON.parse(raw));
    }).catch(() => {});
  }, []);

  const brush = BRUSH_SIZES[brushIndex];
  const activePenColor = tool === 'eraser' ? bgColor : penColor;

  // Inject JS into the WebView to change pen color/size dynamically
  const changePenColor = useCallback((color: string) => {
    sigRef.current?.changePenColor(color);
  }, []);

  const changePenSize = useCallback((min: number, max: number) => {
    sigRef.current?.changePenSize(min, max);
  }, []);

  const closeAllPanels = useCallback(() => {
    setShowColors(false);
    setShowBgColors(false);
    setShowBrush(false);
  }, []);

  const togglePanel = useCallback((panel: 'colors' | 'bg' | 'brush') => {
    setShowColors(panel === 'colors' ? (v: boolean) => !v : false);
    setShowBgColors(panel === 'bg' ? (v: boolean) => !v : false);
    setShowBrush(panel === 'brush' ? (v: boolean) => !v : false);
  }, []);

  // Save action — shows options
  const pendingAction = useRef<'save' | 'share'>('save');

  const handleSaveBtn = useCallback(() => {
    pendingAction.current = 'save';
    sigRef.current?.readSignature();
  }, []);

  const handleShareBtn = useCallback(() => {
    pendingAction.current = 'share';
    sigRef.current?.readSignature();
  }, []);

  // Called when signature canvas produces base64
  const handleSignatureData = useCallback(async (base64: string) => {
    if (saving) return;
    setSaving(true);
    try {
      const clean = base64.replace(/^data:image\/\w+;base64,/, '');
      const ts = Date.now();
      const fileName = `thinkora-sketch-${ts}.png`;

      // Save to app's document directory (persists across app updates)
      const dir = `${RNFS.DocumentDirectoryPath}/sketches`;
      const dirExists = await RNFS.exists(dir);
      if (!dirExists) await RNFS.mkdir(dir);
      const filePath = `${dir}/${fileName}`;
      await RNFS.writeFile(filePath, clean, 'base64');

      if (pendingAction.current === 'save') {
        // Save to gallery list
        const sketch: SavedSketch = {
          id: `sketch-${ts}`,
          path: filePath,
          createdAt: ts,
          name: `Sketch ${new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        };
        const updated = [sketch, ...savedSketches];
        setSavedSketches(updated);
        await AsyncStorage.setItem(SKETCHES_KEY, JSON.stringify(updated));
        Alert.alert('Saved', 'Sketch saved to your collection.');
      } else {
        // Share
        await Share.share({
          message: 'My sketch from Thinkora\nhttps://play.google.com/store/apps/details?id=com.thinkora',
          url: `file://${filePath}`,
        });
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to process sketch.');
    } finally {
      setSaving(false);
    }
  }, [saving, savedSketches]);

  const deleteSketch = useCallback(async (id: string) => {
    const sketch = savedSketches.find(s => s.id === id);
    if (!sketch) return;
    Alert.alert('Delete Sketch', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await RNFS.unlink(sketch.path); } catch {}
          const updated = savedSketches.filter(s => s.id !== id);
          setSavedSketches(updated);
          await AsyncStorage.setItem(SKETCHES_KEY, JSON.stringify(updated));
        },
      },
    ]);
  }, [savedSketches]);

  const shareSketchFromGallery = useCallback(async (sketch: SavedSketch) => {
    try {
      const exists = await RNFS.exists(sketch.path);
      if (!exists) {
        Alert.alert('Error', 'Sketch file not found.');
        return;
      }
      await Share.share({
        message: 'My sketch from Thinkora\nhttps://play.google.com/store/apps/details?id=com.thinkora',
        url: `file://${sketch.path}`,
      });
    } catch {}
  }, []);

  const handleClear = useCallback(() => {
    Alert.alert('Clear Canvas', 'Are you sure you want to clear everything?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => sigRef.current?.clearSignature() },
    ]);
  }, []);

  const webStyle = useMemo(() => `
    .m-signature-pad {
      box-shadow: none;
      border: none;
      margin: 0;
      width: 100%;
      height: 100%;
    }
    .m-signature-pad--body {
      border: none;
      width: 100%;
      height: 100%;
    }
    .m-signature-pad--footer {
      display: none;
    }
    body, html {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: ${bgColor};
    }
  `, [bgColor]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: insets.top + 8,
      paddingBottom: 10,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 8,
    },
    headerBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    saveBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
    canvasWrap: {
      flex: 1,
      backgroundColor: bgColor,
    },

    // Bottom toolbar
    toolbar: {
      backgroundColor: theme.colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      paddingBottom: insets.bottom + 8,
    },
    toolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-evenly',
      paddingVertical: 10,
      paddingHorizontal: 8,
    },
    toolBtn: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
    toolBtnActive: {
      backgroundColor: theme.colors.primary + '20',
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    toolLabel: {
      fontSize: 9,
      fontWeight: '600',
      color: theme.colors.textMuted,
      marginTop: 2,
      textAlign: 'center',
    },
    toolLabelActive: {
      color: theme.colors.primary,
    },

    // Color indicator on pen button
    colorDot: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: theme.colors.surface,
    },

    // Panels
    panel: {
      backgroundColor: theme.colors.cardBg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    panelTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textMuted,
      marginBottom: 10,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    colorSwatch: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorSwatchSelected: {
      borderColor: theme.colors.primary,
      borderWidth: 3,
    },
    colorSwatchInner: {
      width: '100%',
      height: '100%',
      borderRadius: 16,
    },
    brushRow: {
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'center',
    },
    brushBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.inputBg,
    },
    brushBtnActive: {
      backgroundColor: theme.colors.primary,
    },
    brushLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
    },
    brushLabelActive: {
      color: '#FFF',
    },
    brushPreview: {
      marginTop: 6,
      borderRadius: 10,
      backgroundColor: theme.colors.text,
    },
    brushPreviewActive: {
      backgroundColor: '#FFF',
    },
  }), [theme, insets, bgColor]);

  if (Platform.OS !== 'android' || !SignatureCanvas) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="brush-outline" size={48} color={theme.colors.textMuted} />
        <Text style={{ color: theme.colors.textMuted, marginTop: 12 }}>Sketch is only supported on Android.</Text>
        <TouchableOpacity style={[styles.saveBtn, { marginTop: 20 }]} onPress={() => navigation.goBack()}>
          <Text style={styles.saveBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="back" size={20} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sketch</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => sigRef.current?.undo()}>
            <Ionicons name="arrow-undo" size={18} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => sigRef.current?.redo()}>
            <Ionicons name="arrow-redo" size={18} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowGallery(true)}>
            <Ionicons name="images" size={18} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleShareBtn}>
            <Ionicons name="share-social" size={18} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveBtn} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Canvas */}
      <View style={styles.canvasWrap}>
        <SignatureCanvas
          ref={sigRef}
          onOK={handleSignatureData}
          onEmpty={() => Alert.alert('Empty', 'Draw something first!')}
          webStyle={webStyle}
          style={{ flex: 1 }}
          backgroundColor={bgColor}
          penColor={activePenColor}
          minWidth={brush.min}
          maxWidth={brush.max}
          autoClear={false}
          descriptionText=""
          clearText="Clear"
          confirmText="Save"
        />
      </View>

      {/* Expandable panels */}
      {showColors && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Pen Color</Text>
          <View style={styles.colorGrid}>
            {PEN_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.colorSwatch, penColor === c && styles.colorSwatchSelected]}
                onPress={() => { setPenColor(c); setTool('pen'); changePenColor(c); }}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.colorSwatchInner,
                  { backgroundColor: c },
                  c === '#FFFFFF' && { borderWidth: 1, borderColor: '#E0E0E0' },
                ]} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {showBgColors && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Canvas Background</Text>
          <View style={styles.colorGrid}>
            {BG_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.colorSwatch, bgColor === c && styles.colorSwatchSelected]}
                onPress={() => {
                  setBgColor(c);
                  if (tool === 'eraser') changePenColor(c);
                }}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.colorSwatchInner,
                  { backgroundColor: c },
                  (c === '#FFFFFF' || c === '#F8F8F8') && { borderWidth: 1, borderColor: '#E0E0E0' },
                ]} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {showBrush && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Brush Size</Text>
          <View style={styles.brushRow}>
            {BRUSH_SIZES.map((b, i) => {
              const isActive = brushIndex === i;
              return (
                <TouchableOpacity
                  key={b.label}
                  style={[styles.brushBtn, isActive && styles.brushBtnActive]}
                  onPress={() => {
                  setBrushIndex(i);
                  changePenSize(BRUSH_SIZES[i].min, BRUSH_SIZES[i].max);
                }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.brushLabel, isActive && styles.brushLabelActive]}>{b.label}</Text>
                  <View style={[
                    styles.brushPreview,
                    isActive && styles.brushPreviewActive,
                    { width: 8 + i * 8, height: Math.max(3, b.max) },
                  ]} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Bottom toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.toolRow}>
          {/* Pen tool */}
          <TouchableOpacity
            onPress={() => { setTool('pen'); closeAllPanels(); changePenColor(penColor); changePenSize(brush.min, brush.max); }}
            activeOpacity={0.7}
          >
            <View style={[styles.toolBtn, tool === 'pen' && !showColors && styles.toolBtnActive]}>
              <Ionicons name="pencil" size={22} color={tool === 'pen' ? theme.colors.primary : theme.colors.text} />
              <View style={[styles.colorDot, { backgroundColor: penColor }]} />
            </View>
            <Text style={[styles.toolLabel, tool === 'pen' && styles.toolLabelActive]}>Pen</Text>
          </TouchableOpacity>

          {/* Color picker */}
          <TouchableOpacity
            onPress={() => togglePanel('colors')}
            activeOpacity={0.7}
          >
            <View style={[styles.toolBtn, showColors && styles.toolBtnActive]}>
              <Ionicons name="color-palette" size={22} color={showColors ? theme.colors.primary : theme.colors.text} />
            </View>
            <Text style={[styles.toolLabel, showColors && styles.toolLabelActive]}>Colors</Text>
          </TouchableOpacity>

          {/* Brush size */}
          <TouchableOpacity
            onPress={() => togglePanel('brush')}
            activeOpacity={0.7}
          >
            <View style={[styles.toolBtn, showBrush && styles.toolBtnActive]}>
              <Ionicons name="resize" size={22} color={showBrush ? theme.colors.primary : theme.colors.text} />
            </View>
            <Text style={[styles.toolLabel, showBrush && styles.toolLabelActive]}>Size</Text>
          </TouchableOpacity>

          {/* Eraser */}
          <TouchableOpacity
            onPress={() => { setTool('eraser'); closeAllPanels(); changePenColor(bgColor); changePenSize(8, 14); }}
            activeOpacity={0.7}
          >
            <View style={[styles.toolBtn, tool === 'eraser' && styles.toolBtnActive]}>
              <Ionicons name="bandage" size={22} color={tool === 'eraser' ? theme.colors.primary : theme.colors.text} />
            </View>
            <Text style={[styles.toolLabel, tool === 'eraser' && styles.toolLabelActive]}>Eraser</Text>
          </TouchableOpacity>

          {/* Background */}
          <TouchableOpacity
            onPress={() => togglePanel('bg')}
            activeOpacity={0.7}
          >
            <View style={[styles.toolBtn, showBgColors && styles.toolBtnActive]}>
              <Ionicons name="image" size={22} color={showBgColors ? theme.colors.primary : theme.colors.text} />
            </View>
            <Text style={[styles.toolLabel, showBgColors && styles.toolLabelActive]}>Canvas</Text>
          </TouchableOpacity>

          {/* Clear */}
          <TouchableOpacity
            onPress={handleClear}
            activeOpacity={0.7}
          >
            <View style={styles.toolBtn}>
              <Ionicons name="trash" size={22} color={theme.colors.error} />
            </View>
            <Text style={[styles.toolLabel, { color: theme.colors.error }]}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Gallery Modal */}
      <Modal visible={showGallery} animationType="slide" onRequestClose={() => setShowGallery(false)}>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={[styles.header, { paddingTop: 12 }]}>
            <View style={styles.headerLeft}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setShowGallery(false)}>
                <Ionicons name="close" size={20} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>My Sketches</Text>
            </View>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>
              {savedSketches.length} saved
            </Text>
          </View>

          {savedSketches.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Ionicons name="brush-outline" size={48} color={theme.colors.textMuted} />
              <Text style={{ color: theme.colors.textMuted, fontSize: 15 }}>No saved sketches yet</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>Draw something and tap Save!</Text>
            </View>
          ) : (
            <FlatList
              data={savedSketches}
              keyExtractor={item => item.id}
              numColumns={2}
              contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 20 }}
              columnWrapperStyle={{ gap: 12 }}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              renderItem={({ item }) => (
                <View style={{
                  flex: 1,
                  backgroundColor: theme.colors.cardBg,
                  borderRadius: 16,
                  overflow: 'hidden',
                  ...theme.shadows.card,
                }}>
                  <Image
                    source={{ uri: `file://${item.path}` }}
                    style={{ width: '100%', aspectRatio: 1, backgroundColor: '#F0F0F0' }}
                    resizeMode="cover"
                  />
                  <View style={{ padding: 10 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.text }} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <TouchableOpacity
                        style={{
                          flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                          gap: 4, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.colors.primary + '15',
                        }}
                        onPress={() => shareSketchFromGallery(item)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="share-social" size={14} color={theme.colors.primary} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.primary }}>Share</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                          gap: 4, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.colors.error + '15',
                        }}
                        onPress={() => deleteSketch(item.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash" size={14} color={theme.colors.error} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.error }}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}
