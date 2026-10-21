# Android notification listening

Start listening to a document, then leave Votic or close the Reader. Narration continues through a native Android foreground media service. Swipe down to find the compact Votic media controls: previous passage, play/pause, and next passage. An expanded Stop action ends the session. None of these controls launches an Activity or reopens Votic.

The service uses the device's installed text-to-speech voices, reading speed, and Votic pronunciation substitutions. It holds the document queue in process memory and advances it without JavaScript timers. Long passages are split to respect Android's TTS utterance limit. A small native checkpoint stores only account/document identifiers, title, and the last position so an app-process shutdown does not discard the latest position. Position events update the Reader and document library; returning from a suspended JS runtime reads the native position again. Back/forward moves one passage, rather than a fixed number of seconds.

Playback pauses for audio-focus interruptions and headphone disconnection. A paused session releases its wake lock and foreground status. Completion, Stop, deletion of the document, loss of app access, and sign-out clear active playback. Notifications use private lock-screen visibility. Android owns the notification's placement and appearance.

The local Expo module is `modules/votic-playback`. It needs a newly built Android development or release app (`npx expo run:android`, or the existing EAS build flow). Expo Go and builds without the module retain the previous screen-based speech behavior. iPhone and web are unchanged. Android force-stop or killing the service process ends playback; there is no automatic restart or saved copy of the document queue. Actual speech time now contributes to the same activity log used by Home, Statistics, streaks, widgets, and finish totals. The native engine's onStart/onDone/onStop callbacks delimit measured speech; pauses, initialization and interruptions do not run the clock. A private, account/document-scoped cumulative journal checkpoints every five seconds and at transport boundaries. JavaScript independently reconciles and durably writes activity and document counters before acknowledging native checkpoints. Foreground listening measurement is disabled when this native journal exists. An abrupt process termination can lose the unfinished interval since the last checkpoint (normally at most five seconds), but restart never invents elapsed playback. Cleared immutable checkpoints are removed; active counters are never reset by acknowledgments. Account deletion clears native records, including deletion recovery at launch.

The Reader offers a native sleep timer after a listening session has started: 15, 30, or 60 minutes, or the end of the current passage. Duration includes pauses and uses a monotonic deadline. Expiry pauses audio and never starts it. Cancel is available in the timer sheet. Document/account changes, Stop, completion and playback-process restart cancel the timer. Skipping a passage with a passage timer treats the skip as the boundary and pauses. Timers do not add a JavaScript polling loop or a new wake lock. Paused/dead processes never resume audio automatically.

Listen settings queries the selected Android voice's actual network and installed-data capabilities. It reports offline, network-dependent, missing-data, or unknown separately from the locally saved document text. Voice-name suffixes are not evidence of offline readiness. Device voice settings provide a recovery action; unavailable settings explain how to find text-to-speech manually. Expo Go, iPhone and web report unknown when they cannot verify capabilities.

## Verification

Automated component/integration tests cover native queue creation, notification-driven state changes, Reader closure without stopping narration, progress updates without a mounted Reader, resynchronization after JS suspension, completion, account isolation, cumulative activity reconciliation/replay, provider persistence before acknowledgment, offline-capability messages and timer controls. Kotlin unit tests cover the monotonic speech clock, timer state and existing queue parsing.

For the 2026-10-21 changes, Android JavaScript/Hermes export, native project generation in a temporary checkout, and generated manifest/resource verification ran successfully. Gradle compilation and JVM tests could not run: the wrapper's Gradle 9.3.1 download failed with `java.net.SocketException: Network is unreachable`. There is no installed Android SDK/Kotlin compiler here. These are environment blockers, not passing native build results. The existing Android Full App & Playback Build workflow is the native compilation/lint/JVM-test gate; it must pass before release. Device/emulator testing is reserved for tomorrow.

On a device with the rebuilt app, verify:

1. Start listening, press Home, and lock the phone. Narration should advance across multiple passages.
2. Swipe down and use previous, pause, play, and next. Votic should not reopen.
3. Return to the Reader. Its highlighted word and playback state should match the service.
4. Close the Reader while audio is playing. Notification controls should remain available.
5. Disconnect headphones or play audio in another app. Votic should pause.
6. Stop, complete the document, delete it, or sign out. Audio and the active notification should end.

OEM battery policies and installed voice engines still need physical-device verification.
