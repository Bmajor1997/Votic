import AsyncStorage from "@react-native-async-storage/async-storage";
import { PropsWithChildren, useLayoutEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthProvider";
import { account_storage_key } from "../storage/accountStorage";
import { write_account_data } from "../storage/accountDeletion";
import { useVoticTheme } from "../theme/ThemeProvider";
import { AI_CONSENT_VERSION, register_ai_consent } from "./aiConsent";

export function AiConsentProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  // Remount the disclosure session on sign-out/switch, resolving old requests as declined.
  return (
    <ConsentSession key={user?.uid ?? "signed-out"} uid={user?.uid ?? null}>
      {children}
    </ConsentSession>
  );
}
function ConsentSession({ uid, children }: PropsWithChildren<{ uid: string | null }>) {
  const { theme } = useVoticTheme();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const waiters = useRef<((allowed: boolean) => void)[]>([]);
  const alive = useRef(true);
  const key = uid ? account_storage_key(`votic.mobile.ai-consent.${AI_CONSENT_VERSION}`, uid) : null;
  const finish = (allowed: boolean) => {
    setVisible(false);
    for (const resolve of waiters.current.splice(0)) resolve(allowed);
  };
  useLayoutEffect(() => {
    alive.current = true;
    const pending = waiters.current;
    register_ai_consent(async (signal) => {
      if (!key || !alive.current) return false;
      const saved = await AsyncStorage.getItem(key).catch(() => null);
      if (!alive.current || signal?.aborted) return false;
      if (saved === AI_CONSENT_VERSION) return true;
      return new Promise<boolean>((resolve) => {
        const settle = (allowed: boolean) => {
          signal?.removeEventListener("abort", abort);
          resolve(allowed);
        };
        const abort = () => {
          const index = waiters.current.indexOf(settle);
          if (index >= 0) waiters.current.splice(index, 1);
          settle(false);
          if (!waiters.current.length && alive.current) setVisible(false);
        };
        waiters.current.push(settle);
        signal?.addEventListener("abort", abort, { once: true });
        setError("");
        setVisible(true);
      });
    });
    return () => {
      alive.current = false;
      register_ai_consent(null);
      for (const resolve of pending.splice(0)) resolve(false);
    };
  }, [key]);
  async function agree() {
    if (!uid || !key || saving) return;
    setSaving(true);
    try {
      await write_account_data(uid, () => AsyncStorage.setItem(key, AI_CONSENT_VERSION));
      if (alive.current) finish(true);
    } catch {
      if (alive.current) setError("Your choice could not be saved. Please retry.");
    } finally {
      if (alive.current) setSaving(false);
    }
  }
  return (
    <>
      {children}
      <Modal
        visible={visible}
        animationType="none"
        onRequestClose={() => {
          if (!saving) finish(false);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
            <Text accessibilityRole="header" style={{ color: theme.text, fontSize: 24 }}>
              Before using AI features
            </Text>
            <Text style={{ color: theme.text, fontSize: 17, lineHeight: 26 }}>
              Votic sends your questions, relevant document text, included notes and recent conversation
              through its server to OpenAI for answers, summaries and review. Short documents may be sent in
              full. Scan photos and scanned PDFs may be sent for text recognition. Recorded voice questions
              are sent for transcription. OpenAI also receives a coded account identifier with answer and
              text-recognition requests to help detect abuse.
            </Text>
            <Text style={{ color: theme.text, fontSize: 17, lineHeight: 26 }}>
              OpenAI processes this content to provide the feature. Provider retention varies by feature and
              account configuration; some content may be kept for security or legal reasons. Avoid sharing
              sensitive content you do not want OpenAI to process. Camera and microphone permissions are
              separate choices.
            </Text>
            <Text style={{ color: theme.text, fontSize: 17, lineHeight: 26 }}>
              Agree to enable these features for this account on this device. You can decline and keep reading
              saved documents or using local text imports. You can withdraw this choice in Settings, Privacy.
            </Text>
            {error ? <Text style={{ color: theme.text }}>{error}</Text> : null}
            <View style={{ gap: 12 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: saving }}
                disabled={saving}
                onPress={() => void agree()}
                style={{ minHeight: 48, justifyContent: "center" }}
              >
                <Text style={{ color: theme.accentText, fontSize: 18 }}>Agree to AI sharing</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                accessibilityState={{ disabled: saving }}
                onPress={() => finish(false)}
                style={{ minHeight: 48, justifyContent: "center" }}
              >
                <Text style={{ color: theme.text, fontSize: 18 }}>Decline</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
