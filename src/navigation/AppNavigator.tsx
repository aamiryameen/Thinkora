import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MyDayScreen } from '../screens/MyDayScreen';
import { TaskListScreen } from '../screens/TaskListScreen';
import { TaskEditorScreen } from '../screens/TaskEditorScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { QuotesScreen } from '../screens/QuotesScreen';
import { NoteListScreen } from '../screens/NoteListScreen';
import { NoteEditorScreen } from '../screens/NoteEditorScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { HabitTrackerScreen } from '../screens/HabitTrackerScreen';
import { PomodoroScreen } from '../screens/PomodoroScreen';
import { MoodJournalScreen } from '../screens/MoodJournalScreen';
import { EisenhowerScreen } from '../screens/EisenhowerScreen';
import { SharedListsScreen } from '../screens/SharedListsScreen';
import { TemplatesScreen } from '../screens/TemplatesScreen';
import { BadgesScreen } from '../screens/BadgesScreen';
import { CategoryManagerScreen } from '../screens/CategoryManagerScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { AIMoodInsightsScreen } from '../screens/AIMoodInsightsScreen';
import { GanttScreen } from '../screens/GanttScreen';
import { ShareProgressScreen } from '../screens/ShareProgressScreen';
import { useTheme } from '../context/ThemeContext';
import { navigationRef } from '../services/navigationService';
import type { RootStackParamList, HomeTabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<HomeTabParamList>();

const TAB_ICONS: Record<keyof HomeTabParamList, { focused: string; default: string }> = {
  MyDay: { focused: 'home', default: 'home-outline' },
  Tasks: { focused: 'checkbox', default: 'checkbox-outline' },
  Quotes: { focused: 'chatbubble-ellipses', default: 'chatbubble-ellipses-outline' },
  Notes: { focused: 'document-text', default: 'document-text-outline' },
  Dashboard: { focused: 'grid', default: 'grid-outline' },
};

function HomeTabs() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: -2 },
        tabBarStyle: {
          backgroundColor: theme.colors.tabBarBg,
          borderTopWidth: 0,
          paddingTop: 8,
          paddingBottom: insets.bottom,
          height: 64 + insets.bottom,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarIcon: ({ focused, color }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.focused : icons.default;
          return <Ionicons name={iconName} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="MyDay" component={MyDayScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Tasks" component={TaskListScreen} />
      <Tab.Screen name="Quotes" component={QuotesScreen} />
      <Tab.Screen name="Notes" component={NoteListScreen} />
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'More' }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { theme } = useTheme();
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="Home" component={HomeTabs} />
        <Stack.Screen name="NoteEditor" component={NoteEditorScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="TaskEditor" component={TaskEditorScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="HabitTracker" component={HabitTrackerScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Pomodoro" component={PomodoroScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="MoodJournal" component={MoodJournalScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Eisenhower" component={EisenhowerScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="SharedLists" component={SharedListsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Templates" component={TemplatesScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Badges" component={BadgesScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="CategoryManager" component={CategoryManagerScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Reports" component={ReportsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Search" component={SearchScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="AIMoodInsights" component={AIMoodInsightsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Gantt" component={GanttScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="ShareProgress" component={ShareProgressScreen} options={{ presentation: 'card' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
