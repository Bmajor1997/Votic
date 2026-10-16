import AsyncStorage from "@react-native-async-storage/async-storage";
const THEME_KEY = "votic.mobile.theme.v1",
  ACCESSIBILITY_KEY = "votic.mobile.accessibility.v1";
export async function load_theme_preferences() {
  try {
    const raw = await AsyncStorage.getItem(THEME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export async function save_theme_preferences(value: unknown) {
  await AsyncStorage.setItem(THEME_KEY, JSON.stringify(value));
}
export async function load_accessibility_preferences() {
  try {
    const raw = await AsyncStorage.getItem(ACCESSIBILITY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export async function save_accessibility_preferences(value: unknown) {
  await AsyncStorage.setItem(ACCESSIBILITY_KEY, JSON.stringify(value));
}
