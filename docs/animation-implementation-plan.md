# Vatic motion experience

Branch: `feature/vatic-motion-experience` (based on `feature/expressive-subscription-paywall`).

## Architecture
- Remotion renders prebuilt, noninteractive videos offline. Never embed a Remotion renderer in the Expo runtime.
- React Native animations respond to playback and AI state, and remain accessible.
- Do not change Firebase authentication, RevenueCat purchase handling, or entitlement checks.

## Planned sequences
1. **Intro:** 3–4-second logo reveal, played during onboarding rather than every app launch.
2. **TTS:** native activity pulse and playback-synchronized highlighting; never fabricate word timing from an audio duration.
3. **Ask Vatic:** pending pulse; progressively reveal actual answer text only when it arrives; preserve retry/error states.
4. **Paywall:** optional 6–8-second silent video showing document → audio → answer. Pricing, offers, plan selection, restore purchases, and checkout stay native.

## First component
`apps/mobile/components/animations/VaticPulse.tsx` is a reusable native pulse with reduced-motion support. It can be wired to existing TTS or Ask Vatic loading state after identifying the actual screen integration points.

## Integration acceptance criteria
- Pause loops on screen blur, background, cancellation, and unmount.
- Honor Reduce Motion, and provide static fallbacks for video.
- Avoid blocking app launch or paywall purchase interactions.
- Verify real Android hardware, low-end performance, and screen-reader labels.
- Run Expo TypeScript, lint, component tests, and Android build before merge.

## Remaining work
Inspect and wire existing screens; create Remotion compositions and export optimized assets; add video playback only using compatible Expo media dependencies; add tests. Do not claim this initial scaffold is fully integrated.
