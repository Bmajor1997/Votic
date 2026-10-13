# Android notification listening

Start listening to a document, then leave Votic or close the Reader. Narration continues through a native Android foreground media service. Swipe down to find the compact Votic media controls: previous passage, play/pause, and next passage. An expanded Stop action ends the session. None of these controls launches an Activity or reopens Votic.

The service uses the device's installed text-to-speech voices, reading speed, and Votic pronunciation substitutions. It holds the document queue in process memory and advances it without JavaScript timers. Long passages are split to respect Android's TTS utterance limit. A small native checkpoint stores only account/document identifiers, title, and the last position so an app-process shutdown does not discard the latest position. Position events update the Reader and document library; returning from a suspended JS runtime reads the native position again. Back/forward moves one passage, rather than a fixed number of seconds.

Playback pauses for audio-focus interruptions and headphone disconnection. A paused session releases its wake lock and foreground status. Completion, Stop, deletion of the document, loss of app access, and sign-out clear active playback. Notifications use private lock-screen visibility. Android owns the notification's placement and appearance.

The local Expo module is `modules/votic-playback`. It needs a newly built Android development or release app (`npx expo run:android`, or the existing EAS build flow). Expo Go and builds without the module retain the previous screen-based speech behavior. iPhone and web are unchanged. Android force-stop or killing the service process ends playback; there is no automatic restart or saved copy of the document queue. Background listening time is not added to the existing foreground-only activity statistics in this change.

## Verification

Automated component/integration tests cover native queue creation, notification-driven state changes, Reader closure without stopping narration, progress updates without a mounted Reader, resynchronization after JS suspension, completion, and account isolation. The native service passes a direct Kotlin compilation check against Android API 36. The local full Gradle check was blocked by dependency-download HTTP 403 errors before the Expo bridge could compile. The Android Notification Playback Build workflow performs native-module compilation and manifest processing in GitHub Actions; a successful native build and physical-device playback check are required before considering this ready to release.

On a device with the rebuilt app, verify:

1. Start listening, press Home, and lock the phone. Narration should advance across multiple passages.
2. Swipe down and use previous, pause, play, and next. Votic should not reopen.
3. Return to the Reader. Its highlighted word and playback state should match the service.
4. Close the Reader while audio is playing. Notification controls should remain available.
5. Disconnect headphones or play audio in another app. Votic should pause.
6. Stop, complete the document, delete it, or sign out. Audio and the active notification should end.

OEM battery policies and installed voice engines still need physical-device verification.
