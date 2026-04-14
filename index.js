/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerNotificationHandlers } from './src/services/reminderService';

// Register background notification event handler (snooze/dismiss actions)
registerNotificationHandlers();

AppRegistry.registerComponent(appName, () => App);
