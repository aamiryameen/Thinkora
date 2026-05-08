/**
 * Streak Rewards — unlock cosmetic perks at streak milestones.
 *
 * Day  3 → first reward (encouragement)
 * Day  7 → unlock a new theme tier
 * Day 14 → unlock a custom app icon style
 * Day 30 → unlock pastel themes pack
 * Day 60 → unlock typography options
 * Day 100→ "Centurion" badge + AMOLED-pure theme
 * Day 200→ legendary tier
 * Day 365→ lifetime badge
 *
 * Rewards are unlocked permanently — losing the streak doesn't take them
 * away (positive reinforcement).
 */

import { storage } from './storage';

export interface StreakReward {
  day: number;
  title: string;
  description: string;
  icon: string;          // ionicon name
  color: string;
  unlocks?: string;      // optional capability id (e.g. "theme:amoled")
}

export const STREAK_REWARDS: StreakReward[] = [
  { day: 3,   title: 'Off the Ground', description: '3-day streak! Keep going.',                                  icon: 'rocket',         color: '#10B981' },
  { day: 7,   title: 'One Week Strong', description: 'Unlocked: extra theme colors',                              icon: 'flame',          color: '#F59E0B', unlocks: 'theme:extra' },
  { day: 14,  title: 'Two Weeks!', description: 'Unlocked: custom app icons',                                     icon: 'sparkles',       color: '#8B5CF6', unlocks: 'app_icon' },
  { day: 21,  title: 'Habit Formed', description: 'Studies say it takes 21 days to form a habit. You did it.',    icon: 'medal',          color: '#EC4899' },
  { day: 30,  title: 'Monthly Master', description: 'Unlocked: pastel theme pack',                                icon: 'trophy',         color: '#3B82F6', unlocks: 'theme:pastel' },
  { day: 60,  title: 'Two Months', description: 'Unlocked: extra typography options',                             icon: 'star',           color: '#F97316', unlocks: 'typography' },
  { day: 100, title: 'Centurion', description: 'Unlocked: AMOLED pure-black theme',                               icon: 'shield',         color: '#1F2937', unlocks: 'theme:amoled' },
  { day: 150, title: '150 Days', description: 'You\'re unstoppable. Unlocked: bonus icons',                        icon: 'flash',          color: '#EAB308', unlocks: 'app_icon:bonus' },
  { day: 200, title: 'Legendary', description: 'Unlocked: legendary theme tier',                                   icon: 'diamond',        color: '#06B6D4', unlocks: 'theme:legendary' },
  { day: 365, title: 'A Full Year!', description: 'Lifetime achievement. Massive respect.',                        icon: 'ribbon',         color: '#DC2626', unlocks: 'lifetime' },
];

const UNLOCKED_KEY = 'streak_rewards_unlocked_v1';

interface UnlockedState {
  unlockedDays: number[];
  unlockedAt: Record<number, number>; // day → timestamp
  capabilities: string[];
}

const EMPTY: UnlockedState = { unlockedDays: [], unlockedAt: {}, capabilities: [] };

export async function getUnlocked(): Promise<UnlockedState> {
  return storage.getSetting<UnlockedState>(UNLOCKED_KEY, EMPTY);
}

async function saveUnlocked(state: UnlockedState): Promise<void> {
  await storage.setSetting(UNLOCKED_KEY, state);
}

/**
 * Check current streak against rewards. Returns any newly-unlocked
 * rewards (so the UI can show a celebration). Persists unlocks.
 */
export async function checkRewardsForStreak(currentStreak: number): Promise<StreakReward[]> {
  const state = await getUnlocked();
  const newly: StreakReward[] = [];

  for (const reward of STREAK_REWARDS) {
    if (reward.day > currentStreak) continue;
    if (state.unlockedDays.includes(reward.day)) continue;
    state.unlockedDays.push(reward.day);
    state.unlockedAt[reward.day] = Date.now();
    if (reward.unlocks && !state.capabilities.includes(reward.unlocks)) {
      state.capabilities.push(reward.unlocks);
    }
    newly.push(reward);
  }

  if (newly.length > 0) await saveUnlocked(state);
  return newly;
}

export async function hasCapability(id: string): Promise<boolean> {
  const state = await getUnlocked();
  return state.capabilities.includes(id);
}
