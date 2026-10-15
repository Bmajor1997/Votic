# Votic V2 — agreed follow-up work

## Samsung status-bar player that expands over the Home screen

Recorded October 15, 2026. The user explicitly deferred this interaction to V2.

While Votic is reading aloud and the person leaves the app:

- Show a compact Samsung media chip beside the clock, containing the Votic V icon and the current document title.
- Tapping the chip expands a compact player over the upper portion of the phone's Home screen. Keep the rest of the Home screen visible; do not open the full Votic app or require pulling down the notification panel for this interaction.
- The expanded player shows the blue V artwork, the document title, play/pause, previous passage, and next passage controls.
- Use the app's default blue (#2563EB), not the former orange branding.
- Match the Samsung system interaction shown in the user's Spotify screenshots. Prefer the supported Samsung media surface rather than inventing an unrelated floating overlay.

### Reference and validation

The user supplied these screenshots from their Samsung phone running One UI 8.5 / Android 16:

- `Screenshot_20261015_144744_One UI Home.jpg`: collapsed Spotify chip beside the clock.
- `Screenshot_20261015_144749_One UI Home.jpg`: expanded Spotify player over the upper Home screen.

Copies are saved alongside this document in `v2-references/`.

Validate on a compatible physical Samsung phone with Media player enabled in Now bar settings. The current standard Android emulator does not verify Samsung's expanding status-bar player. The existing V1 notification-panel player remains the tested baseline, not acceptance evidence for this V2 interaction.
