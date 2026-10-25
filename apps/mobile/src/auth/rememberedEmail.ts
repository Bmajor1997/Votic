import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The email of the last account that signed in with email and password on this device, so Sign in can fill it in
 * after a sign-out. Only the email is kept, never the password. It belongs to that account: deleting the account
 * on this device forgets it, and Google or Apple sign-ins never replace it.
 */
export const REMEMBERED_EMAIL_KEY = "votic.mobile.remembered-sign-in-email.v1";
type Remembered = { uid: string; email: string };

function parse(raw: string | null): Remembered | null {
  try {
    const value = raw ? JSON.parse(raw) : null;
    return value && typeof value.uid === "string" && typeof value.email === "string" ? value : null;
  } catch {
    return null;
  }
}
export async function remember_sign_in_email(uid: string, email: string) {
  await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, JSON.stringify({ uid, email: email.trim() }));
}
export async function remembered_sign_in_email() {
  return parse(await AsyncStorage.getItem(REMEMBERED_EMAIL_KEY))?.email ?? "";
}
/** Forgets the email only if it belongs to `uid`. */
export async function forget_sign_in_email(uid: string) {
  if (parse(await AsyncStorage.getItem(REMEMBERED_EMAIL_KEY))?.uid === uid)
    await AsyncStorage.removeItem(REMEMBERED_EMAIL_KEY);
}
