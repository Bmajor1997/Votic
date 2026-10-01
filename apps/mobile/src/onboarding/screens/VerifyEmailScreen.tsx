import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { AuthError } from "../../auth/authTypes";
import { useAccount } from "../AccountProvider";
import {
  Notice,
  OnboardingScreen,
  PrimaryButton,
  SecondaryButton,
  TextLink,
  Title,
} from "../components/OnboardingUI";

export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Shown until Firebase reports the email as verified. Returning to Votic from the email app checks again
 * automatically, so the person usually never needs to press anything.
 */
export function VerifyEmailScreen({ onUseDifferentEmail }: { onUseDifferentEmail: () => void }) {
  const { services, user, signOut } = useAccount();
  const auth = services.auth;
  // The first email was sent when the account was created, so the cooldown starts right away.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [message, setMessage] = useState<{ tone: "info" | "error" | "success"; text: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void auth.refreshUser().catch(() => {});
    });
    return () => subscription.remove();
  }, [auth]);

  async function check() {
    if (checking) return;
    setChecking(true);
    setMessage(null);
    try {
      const refreshed = await auth.refreshUser();
      if (!refreshed?.emailVerified)
        setMessage({
          tone: "info",
          text: "Your email isn't verified yet. Open the link in the email from Votic, then come back.",
        });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof AuthError ? error.message : "Please try again." });
    } finally {
      setChecking(false);
    }
  }
  async function resend() {
    if (busyRef.current || cooldown > 0) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await auth.sendVerificationEmail();
      setMessage({ tone: "success", text: "We sent a new verification email." });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof AuthError ? error.message : "Please try again." });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function switchEmail() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    await auth.discardUnverifiedAccount().catch(() => signOut());
    onUseDifferentEmail();
  }

  return (
    <OnboardingScreen
      footer={
        <>
          <PrimaryButton
            label="I've Verified My Email"
            onPress={() => void check()}
            loading={checking}
            disabled={busy}
          />
          <SecondaryButton
            label={cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend Email"}
            onPress={() => void resend()}
            disabled={cooldown > 0 || busy}
          />
        </>
      }
    >
      <Title
        subtitle={`We sent a verification link to ${user?.email || "your email"}. Open it to finish setting up your account.`}
      >
        Check your email
      </Title>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <Notice>{"Can't find it? Check your spam or junk folder."}</Notice>
      <TextLink label="Use a different email" onPress={() => void switchEmail()} disabled={busy} />
      <TextLink label="Sign out" onPress={() => void signOut()} disabled={busy} />
    </OnboardingScreen>
  );
}
