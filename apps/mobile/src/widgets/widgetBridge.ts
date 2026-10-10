/**
 * Hands the widget snapshot to the home-screen widgets and asks them to redraw.
 *
 * iPhone: saved in the App Group shared with the widget extension (targets/widget), through
 * @bacons/apple-targets' ExtensionStorage. Android: saved by the local VoticWidgets module
 * (modules/votic-widgets), which also owns the Android widgets. Anywhere else (web, tests, Expo Go
 * without the native code) this does nothing.
 */
import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

/** Must match the App Group in app.json and targets/widget. */
export const WIDGET_APP_GROUP = "group.com.votic.app";
/** Must match the key the iOS and Android widgets read. */
export const WIDGET_SNAPSHOT_KEY = "votic.widgets.snapshot.v1";

type AndroidWidgets = { publish: (snapshot: string) => void };

export function publishWidgetSnapshot(snapshot: string) {
  try {
    if (Platform.OS === "ios") {
      // Loaded only on iPhone; the module reads a native global that other platforms don't have.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ExtensionStorage } = require("@bacons/apple-targets") as typeof import("@bacons/apple-targets");
      new ExtensionStorage(WIDGET_APP_GROUP).set(WIDGET_SNAPSHOT_KEY, snapshot);
      ExtensionStorage.reloadWidget();
    } else if (Platform.OS === "android") {
      requireOptionalNativeModule<AndroidWidgets>("VoticWidgets")?.publish(snapshot);
    }
  } catch {
    // Widgets are a convenience; failing to update them must never affect the app.
  }
}
