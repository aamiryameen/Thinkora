# NotioX

A full-featured note-taking app for **Android** (React Native), with rich text, folders, tags, reminders, and attachments.

## Features (Android)

- **Notes**: Create, edit, delete; rich text (bold, italic, underline, lists); tags; search by title, content, tags; sort (date, title, tags); favorites & pinned; auto-save; undo/redo.
- **Organization**: Folders and sub-folders; nested tags; smart categories (Work, Personal, Ideas, To-Dos).
- **Reminders**: Time-based reminders (Notifee); repeat (daily/weekly); smart suggestions (e.g. In 1 hour, Tomorrow 9:00).
- **Attachments**: Photos & camera; documents & PDFs; voice memos (record in-app); handwritten sketches; file picker.
- **Voice**: Voice typing / speech-to-text in the note editor (Android).

**Note**: This app targets Android. Some features (e.g. rich editor, voice, reminders) are implemented only on Android; on iOS the app still runs with a simplified editor and no voice/Notifee.

### Codebase

The project uses a **clean, layered structure** suitable for production and a large audience:

- **`src/core/`** – Constants and design system (theme, colors, spacing). No magic numbers in features.
- **`src/navigation/`** – Typed navigation params and navigator setup.
- **`src/context/`** – Global state (notes, folders, tags, reminders) with persistence.
- **`src/services/`** – Storage, reminders (Notifee), voice, attachments (platform-specific where needed).
- **`src/components/`** – Reusable UI; **`src/screens/`** – Full-screen views.
- **Error boundary** and **loading state** so the app degrades gracefully on errors and shows a loading screen until data is hydrated.

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for conventions and scaling notes.

---

This is a [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
