import React from 'react';
import { Text, TextStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

/** Map app icon names to Ionicons (outline style for consistency). */
const IONICON_NAMES = {
  star: 'star',
  starEmpty: 'star-outline',
  pin: 'pin',
  folder: 'folder-outline',
  tag: 'pricetag-outline',
  reminder: 'alarm-outline',
  settings: 'settings-outline',
  search: 'search-outline',
  add: 'add',
  edit: 'create-outline',
  delete: 'trash-outline',
  back: 'arrow-back',
  sort: 'swap-vertical',
  filter: 'ellipsis-vertical',
  photo: 'image-outline',
  camera: 'camera-outline',
  doc: 'document-text-outline',
  draw: 'pencil',
  attach: 'attach',
  undo: 'arrow-undo',
  redo: 'arrow-redo',
  bold: 'B',
  italic: 'I',
  underline: 'U',
  list: 'list',
  bullet: 'list-outline',
  work: 'briefcase-outline',
  personal: 'person-outline',
  ideas: 'bulb-outline',
  todos: 'checkbox-outline',
  location: 'location-outline',
  repeat: 'repeat',
  sun: 'sunny-outline',
  moon: 'moon-outline',
  system: 'phone-portrait-outline',
  check: 'checkmark-circle',
  calendar: 'calendar-outline',
  calendarFilled: 'calendar',
  stats: 'stats-chart-outline',
  statsFilled: 'stats-chart',
  checkboxEmpty: 'square-outline',
  checkboxDone: 'checkbox',
  chevronRight: 'chevron-forward',
  chevronLeft: 'chevron-back',
  chevronDown: 'chevron-down',
  clock: 'time-outline',
  flag: 'flag-outline',
  flagFilled: 'flag',
  note: 'document-text-outline',
  task: 'checkbox-outline',
  taskFilled: 'checkbox',
  close: 'close',
  ellipsis: 'ellipsis-horizontal',
  notifications: 'notifications-outline',
  lock: 'lock-closed-outline',
  sync: 'sync-outline',
  mail: 'mail-outline',
  info: 'information-circle-outline',
  shield: 'shield-outline',
  pencilOutline: 'create-outline',
} as const;

export type IconName = keyof typeof IONICON_NAMES;

const TEXT_ONLY_ICONS = ['bold', 'italic', 'underline'];

export function Icon({
  name,
  size = 20,
  style,
  color,
}: {
  name: IconName;
  size?: number;
  style?: TextStyle;
  color?: string;
}) {
  const { theme } = useTheme();
  const iconColor = color ?? theme.colors.icon;
  const ionName = IONICON_NAMES[name];
  const isTextOnly = (typeof ionName === 'string' && ionName.length === 1) || TEXT_ONLY_ICONS.includes(name);

  if (ionName && isTextOnly) {
    return (
      <Text
        style={[
          {
            color: iconColor,
            fontSize: size * 0.9,
            fontWeight: '700',
          },
          style,
        ]}
      >
        {ionName}
      </Text>
    );
  }

  if (ionName && typeof ionName === 'string') {
    return (
      <Ionicons
        name={ionName}
        size={size}
        color={iconColor}
        style={style}
      />
    );
  }

  return null;
}
