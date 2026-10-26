# Votic visual redesign

Implemented on `feature/paywall-research-improvements-2026-10-22`, starting at `012e8de`. Direction: the approved paywall and activity concepts, while retaining Votic's existing Welcome, wordmark, Home entrance and document/player animations.

## Visual system

Warm ivory navigation, soft white cards, navy text, restrained accent colors, softer elevation and editorial display headings. Native Georgia on iOS and the system serif on Android/web are used for display headings only. Reader body fonts, spacing, sizes and accessible-font choices retain their existing controls. Dark, sepia and high-contrast modes remain available; high-contrast reader palettes are unchanged. The regular light reader now uses warm paper with navy ink.

## Surfaces

- Shared file artwork: folded paper, format-specific colors, explicit extension labels and suitable glyphs. PDF, DOC/DOCX, HTML, RTF, EPUB, TXT, Markdown, ODT, PowerPoint and supported image types retain their existing registry identities and support rules.
- Documents: larger covers, softer cards and a one-line excerpt from actual document text. Excerpt processing is bounded to 160 characters. Source text and imports are not modified.
- Document-opening sheet: actual cover, title, type and saved progress, followed by the existing Read/Listen choices.
- Home: editorial headings and layered document artwork. Existing logo/wordmark and navigation motion are retained.
- Notes: softer notebook covers, editorial notebook titles and roomier grouped notes.
- Reader/listening: clearer file identity, a bounded reading surface on wide screens, warm light paper, a separated progress header and a softer control dock. Text settings and player behavior remain intact.
- Paywall: original paper/audio illustration, editorial heading and price, responsive plan cards and quieter accent styling. Price strings, billing periods, trial eligibility and checkout/recovery behavior still use existing store data. Cards stack below 390 logical pixels or at font scale 1.3 and above.
- Activity: navy total-time card, larger editorial figures, two prominent reading/listening tiles and quieter active-day/question totals. Existing charts, calendars, streaks, document breakdowns and insight calculations remain available.
- Settings and account/setup screens inherit the same palette, typography and card treatment.

## Validation

Full suites: 588 component/integration tests across 76 suites; 458 reliability tests across 47 files. Final targeted reruns cover the additional responsive paywall, reader palette, activity layout, file icons and preview refinements. TypeScript, ESLint and changed-file formatting checks pass. An Expo web export builds with the bundled artwork.

The complexity checker identifies two pre-existing baseline regressions, `ThemedStack` and `PaywallPreview`. Running the checker against the starting implementation reproduces both. This redesign introduces no additional complexity regression; the file-art implementation uses static glyph/status lookups.

A stale personalization test label and a test probe's render-side assignment from the preceding onboarding refinement were corrected while running the complete checks. No functional expectation was weakened.

No native screenshots or real store purchases were verified. A local Chromium installation was attempted for screenshot review, but the browser download returned unusable archives. Device review remains required for the visual result, small screens, large text, dark mode, screen readers and animations. The generated concept is not evidence of the exact running layout.

## Illustration

Bundled asset: `apps/mobile/assets/votic-paper-listening.png`, generated with the built-in image-generation tool. All typography, prices, controls, charts and document text remain native UI; the illustration is decorative, non-interactive and hidden from screen readers. No remote asset dependency is added.

Generation prompt: Create one premium decorative illustration asset for Votic, a document reading and listening app. This is an illustration, not a UI mockup, not an icon set, no text, no labels, no logos, no readable writing, no buttons. A beautiful compact still life of three softly layered ivory paper sheets, a gentle lavender translucent sheet behind them, a small blue bookmark ribbon and one small abstract audio waveform made of cobalt raised rounded bars on an ivory card, all arranged into a single elegant cohesive composition. Soft tactile paper texture, delicate folded page corner, faint gray abstract text lines, premium editorial 3D papercraft with realistic soft studio lighting and very subtle contact shadows. Rich navy details, warm ivory, restrained cobalt blue and pale lavender. Landscape composition, centered isolated subject, generous clear edges, absolutely transparent background, no environmental scene or ground plane. No photorealistic devices, no books with titles, no plants, no people, no neon glow, no gradients spilling into the background. The art will sit on a warm ivory or dark navy app page; crisp silhouette and soft dimensional depth. The whole group should be wider than tall, roughly 2 to 1 aspect ratio, suitable for a paywall hero.

Planned credit-allowance integration remains a separate task as documented in `credit-plan-integration-status.md`; this visual update does not claim unverified offers are live.
