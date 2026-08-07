import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MyDayScreen } from '../screens/MyDayScreen';
import { TaskListScreen } from '../screens/TaskListScreen';
import { TaskEditorScreen } from '../screens/TaskEditorScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { DailyPulseScreen } from '../screens/DailyPulseScreen';
import { TodayCardScreen } from '../screens/TodayCardScreen';
import { MorningBrewScreen } from '../screens/MorningBrewScreen';
import { VoiceCaptureScreen } from '../screens/VoiceCaptureScreen';
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
import { FoldersScreen } from '../screens/FoldersScreen';
import { BudgetScreen } from '../screens/BudgetScreen';
import { BudgetCategoriesScreen } from '../screens/BudgetCategoriesScreen';
import { BudgetLimitsScreen } from '../screens/BudgetLimitsScreen';
import { BudgetRecurringScreen } from '../screens/BudgetRecurringScreen';
import { BudgetReportsScreen } from '../screens/BudgetReportsScreen';
import { MedicineScreen } from '../screens/MedicineScreen';
import { MedicineHistoryScreen } from '../screens/MedicineHistoryScreen';
import { MedicineProfilesScreen } from '../screens/MedicineProfilesScreen';
import { MedicineInventoryScreen } from '../screens/MedicineInventoryScreen';
import { MedicineAnalyticsScreen } from '../screens/MedicineAnalyticsScreen';
import { DoctorVisitsScreen } from '../screens/DoctorVisitsScreen';
import { WhiteboardsScreen } from '../screens/WhiteboardsScreen';
import { WhiteboardScreen } from '../screens/WhiteboardScreen';
import { ArchiveTrashScreen } from '../screens/ArchiveTrashScreen';
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
import { VoiceCommandScreen } from '../screens/VoiceCommandScreen';
import { NoteCustomizationScreen } from '../screens/NoteCustomizationScreen';
import { StreakRewardsScreen } from '../screens/StreakRewardsScreen';
import { BirthdayRecapScreen } from '../screens/BirthdayRecapScreen';
import { KnowledgeBasesScreen } from '../screens/KnowledgeBasesScreen';
import { KnowledgeBaseDetailScreen } from '../screens/KnowledgeBaseDetailScreen';
import { KbChatScreen } from '../screens/KbChatScreen';
import { KbDocumentScreen } from '../screens/KbDocumentScreen';
import { KbSearchScreen } from '../screens/KbSearchScreen';
import { WeatherDetailScreen } from '../screens/WeatherDetailScreen';
import { DailyPlannerScreen } from '../screens/DailyPlannerScreen';
import { MorningPlanningScreen } from '../screens/MorningPlanningScreen';
import { WeeklyPlannerScreen } from '../screens/WeeklyPlannerScreen';
import { PlannerTemplatesScreen } from '../screens/PlannerTemplatesScreen';
import { PlannerAnalyticsScreen } from '../screens/PlannerAnalyticsScreen';
import { PlannerSettingsScreen } from '../screens/PlannerSettingsScreen';
import { ThinkoraTabBar } from '../components/ThinkoraTabBar';
import { PremiumScreenGate } from '../components/PremiumScreenGate';
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
      screenOptions={{
        headerShown: false,
        // ThinkoraTabBar positions itself absolutely and screens pad their own
        // bottoms, so the navigator must not also reserve tab-bar space —
        // that reserved strip is what pushed the pill up off the bottom.
        tabBarStyle: { position: 'absolute' },
      }}
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


/** Premium-only screens, gated here so no entry point can bypass the paywall. */
function GatedBudgetLimits() {
  return (
    <PremiumScreenGate feature="budget_limits" title="Budgets">
      <BudgetLimitsScreen />
    </PremiumScreenGate>
  );
}
function GatedBudgetRecurring() {
  return (
    <PremiumScreenGate feature="budget_recurring" title="Recurring">
      <BudgetRecurringScreen />
    </PremiumScreenGate>
  );
}
function GatedBudgetReports() {
  return (
    <PremiumScreenGate feature="budget_reports" title="Reports">
      <BudgetReportsScreen />
    </PremiumScreenGate>
  );
}
function GatedMedicineInventory() {
  return (
    <PremiumScreenGate feature="medicine_inventory" title="Inventory">
      <MedicineInventoryScreen />
    </PremiumScreenGate>
  );
}
function GatedMedicineAnalytics() {
  return (
    <PremiumScreenGate feature="medicine_analytics" title="Analytics">
      <MedicineAnalyticsScreen />
    </PremiumScreenGate>
  );
}
function GatedMedicineProfiles() {
  return (
    <PremiumScreenGate feature="medicine_family" title="Family">
      <MedicineProfilesScreen />
    </PremiumScreenGate>
  );
}
function GatedDoctorVisits() {
  // Same gate as Family — visits are only reachable from a profile card.
  return (
    <PremiumScreenGate feature="medicine_family" title="Doctor visits">
      <DoctorVisitsScreen />
    </PremiumScreenGate>
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
        <Stack.Screen name="Notebooks" component={FoldersScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Budget" component={BudgetScreen} />
        <Stack.Screen name="BudgetCategories" component={BudgetCategoriesScreen} />
        <Stack.Screen name="BudgetLimits" component={GatedBudgetLimits} />
        <Stack.Screen name="BudgetRecurring" component={GatedBudgetRecurring} />
        <Stack.Screen name="BudgetReports" component={GatedBudgetReports} />
        <Stack.Screen name="Medicine" component={MedicineScreen} />
        <Stack.Screen name="MedicineHistory" component={MedicineHistoryScreen} />
        <Stack.Screen name="MedicineProfiles" component={GatedMedicineProfiles} />
        <Stack.Screen name="DoctorVisits" component={GatedDoctorVisits} />
        <Stack.Screen name="MedicineInventory" component={GatedMedicineInventory} />
        <Stack.Screen name="MedicineAnalytics" component={GatedMedicineAnalytics} />
        <Stack.Screen name="Whiteboards" component={WhiteboardsScreen} />
        <Stack.Screen name="Whiteboard" component={WhiteboardScreen} />
        <Stack.Screen name="ArchiveTrash" component={ArchiveTrashScreen} />
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
        <Stack.Screen name="VoiceCommand" component={VoiceCommandScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="NoteCustomization" component={NoteCustomizationScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="StreakRewards" component={StreakRewardsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="BirthdayRecap" component={BirthdayRecapScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Quotes" component={QuotesScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Calendar" component={CalendarScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="DailyPulse" component={DailyPulseScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="TodayCard" component={TodayCardScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="MorningBrew" component={MorningBrewScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="VoiceCapture" component={VoiceCaptureScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="KnowledgeBases" component={KnowledgeBasesScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="KnowledgeBaseDetail" component={KnowledgeBaseDetailScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="KbChat" component={KbChatScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="KbDocument" component={KbDocumentScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="KbSearch" component={KbSearchScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="WeatherDetail" component={WeatherDetailScreen} options={{ presentation: 'card' }} />

        {/* ── Daily Planner ── */}
        <Stack.Screen name="DailyPlanner" component={DailyPlannerScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="MorningPlanning" component={MorningPlanningScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="WeeklyPlanner" component={WeeklyPlannerScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="PlannerTemplates" component={PlannerTemplatesScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="PlannerAnalytics" component={PlannerAnalyticsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="PlannerSettings" component={PlannerSettingsScreen} options={{ presentation: 'card' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
