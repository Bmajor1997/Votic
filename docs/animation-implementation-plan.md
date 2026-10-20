# Votic motion experience

Branch: `feature/vatic-motion-experience` (based on `feature/expressive-subscription-paywall`).

## Architecture
- Remotion renders prebuilt, noninteractive videos offline. Never embed a Remotion renderer in the Expo runtime.
- React Native animations respond to playback and AI state, and remain accessible.
- Do not change Firebase authentication, RevenueCat purchase handling, or entitlement checks.

## Planned sequences
1. **Intro:** 3–4-second logo reveal, played during onboarding rather than every app launch.
2. **TTS:** native activity pulse and playback-synchronized highlighting; never fabricate word timing from an audio duration.
3. **Ask Votic:** pending pulse; progressively reveal actual answer text only when it arrives; preserve retry/error states.
4. **Paywall:** optional 7-second silent video (VoticPremium) showing documents → listening → answers. Pricing, offers, plan selection, restore purchases, and checkout stay native.

## What exists now
- `apps/mobile/src/components/animations/VoticPulse.tsx`: a decorative native pulse (hidden from screen readers) that follows Votic's Less motion setting, which includes the phone's. The motion lab's text-to-speech demo uses it.
- `apps/mobile/src/components/AIResponse.tsx` (`AIStatus`): when an AI status label ("Reading", "Thinking", "Writing") first appears, a small orb lands and melts into the word, which then stays on screen with its shimmer. It plays once per label, never loops, is hidden from screen readers, skips compact labels (voice transcription), and is off with Less motion.
- `apps/mobile/src/components/animations/MotionShowcase.tsx`: the motion lab, opened from "Preview animations" on the welcome screen in development and preview builds only. Demos: the V's flight, text-to-speech with the pulse, the Ask Votic thinking orb, and the paywall's interactive preview.
- `remotion/`: VoticIntro and VoticPremium video sources (not yet in the app).

## Integration acceptance criteria
- Pause loops on screen blur, background, cancellation, and unmount.
- Honor Reduce Motion, and provide static fallbacks for video.
- Avoid blocking app launch or paywall purchase interactions.
- Verify real Android hardware, low-end performance, and screen-reader labels.
- Run Expo TypeScript, lint, component tests, and Android build before merge.

## Remaining work
Inspect and wire existing screens; create Remotion compositions and export optimized assets; add video playback only using compatible Expo media dependencies; add tests. Do not claim this initial scaffold is fully integrated.
