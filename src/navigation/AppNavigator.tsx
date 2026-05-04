import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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
import { AISettingsScreen } from '../screens/AISettingsScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { AIMoodInsightsScreen } from '../screens/AIMoodInsightsScreen';
import { GanttScreen } from '../screens/GanttScreen';
import { ShareProgressScreen } from '../screens/ShareProgressScreen';
import { SketchScreen } from '../screens/SketchScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { CloudSyncScreen } from '../screens/CloudSyncScreen';
import { TimeBlockingScreen } from '../screens/TimeBlockingScreen';
import { ShareNoteCardScreen } from '../screens/ShareNoteCardScreen';
import { ProductivityStatsScreen } from '../screens/ProductivityStatsScreen';
import { GoalsScreen } from '../screens/GoalsScreen';
import { HabitStacksScreen } from '../screens/HabitStacksScreen';
import { ThinkoraTabBar } from '../components/ThinkoraTabBar';
import { useTheme } from '../context/ThemeContext';
import { navigationRef } from '../services/navigationService';
import type { RootStackParamList, HomeTabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<HomeTabParamList>();

/** Empty placeholder — tapping the Scan tab navigates to the Scan stack route
 *  in `ThinkoraTabBar`, so this component never actually renders content. */
function ScanTabPlaceholder() {
  return <View />;
}

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <ThinkoraTabBar {...props} />}
    >
      <Tab.Screen name="MyDay" component={MyDayScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Tasks" component={TaskListScreen} />
      <Tab.Screen
        name="ScanTab"
        component={ScanTabPlaceholder}
        options={{ tabBarLabel: 'Scan' }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.getParent()?.navigate('Scan' as never);
          },
        })}
      />
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
        <Stack.Screen name="AISettings" component={AISettingsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Search" component={SearchScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="AIMoodInsights" component={AIMoodInsightsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Gantt" component={GanttScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="ShareProgress" component={ShareProgressScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Sketch" component={SketchScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Scan" component={ScanScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="CloudSync" component={CloudSyncScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="TimeBlocking" component={TimeBlockingScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="ShareNoteCard" component={ShareNoteCardScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="ProductivityStats" component={ProductivityStatsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Goals" component={GoalsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="HabitStacks" component={HabitStacksScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Quotes" component={QuotesScreen} options={{ presentation: 'card' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
