/**
 * In-App Update Service
 *
 * Uses a custom native module (InAppUpdateModule) that calls
 * Google Play Core In-App Updates API directly.
 *
 * No third-party JS libraries needed — zero 16KB alignment issues.
 */

import { Platform, NativeModules } from 'react-native';

const { InAppUpdateModule } = NativeModules;

/** Android Play Core update types */
const UPDATE_TYPE_FLEXIBLE = 0;
const UPDATE_TYPE_IMMEDIATE = 1;

export type UpdateStatus =
  | { available: false }
  | { available: true; availableVersionCode: number; stalenessDays: number };

/**
 * Check if an update is available on the Play Store.
 */
export async function checkForUpdate(): Promise<UpdateStatus> {
  if (Platform.OS !== 'android' || !InAppUpdateModule) {
    return { available: false };
  }

  try {
    const result = await InAppUpdateModule.checkForUpdate();

    if (result.available) {
      return {
        available: true,
        availableVersionCode: result.availableVersionCode,
        stalenessDays: result.stalenessDays,
      };
    }

    return { available: false };
  } catch (error) {
    console.warn('[UpdateService] Failed to check for update:', error);
    return { available: false };
  }
}

/**
 * Start the in-app update flow.
 *
 * @param kind - 'flexible' downloads in background,
 *               'immediate' shows a full-screen blocking update.
 */
export async function startUpdate(kind: 'flexible' | 'immediate' = 'flexible'): Promise<void> {
  if (Platform.OS !== 'android' || !InAppUpdateModule) {
    return;
  }

  try {
    const updateType = kind === 'immediate' ? UPDATE_TYPE_IMMEDIATE : UPDATE_TYPE_FLEXIBLE;
    await InAppUpdateModule.startUpdate(updateType);
  } catch (error) {
    console.warn('[UpdateService] Failed to start update:', error);
    throw error;
  }
}
