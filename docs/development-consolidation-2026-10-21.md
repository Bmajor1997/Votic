# October 21 development consolidation

The working destination is `feature/finish-experience`.

This merge combines `e6f2e43ecdf28aa80a6208642d4733b48efd8d03` (finish experience,
Read/Listen document chooser, and removal of the welcome animation-preview entry)
with `e1eda324a0508bf3ac314d66ad577409259d88de` (PDF/import/navigation fixes).

The native feedback and earlier website-import/configuration branches are already
ancestors of the destination. The merge records both development histories; main
is not modified.

## Changes retained

- Native private feedback with title/description-only bug reports, Firebase
  identity, administrator controls, and existing backend privacy controls.
- Website import errors, source-whitespace handling, pasted-URL validation,
  feedback service-configuration errors, weekly totals, and Home note links.
- New finish experience, summaries, next-document actions, and the Finished shelf.
- Document Read/Listen chooser and removal of the welcome animation-preview link.
- PDF chapter headings, page-bottom sentences, repeated meaningful sentences,
  and conservative page-number cleanup.
- Android `text/rtf` selection and share-intent MIME registration.
- Uploaded HTML/EPUB metadata, hidden-text and navigation cleanup, retaining book
  chapter order and legitimate book notes.
- Voice-message deduplication in both Ask Votic presentations.
- Feedback form navigation that dismisses to the existing Feedback screen.
- Home-origin Quick Notes returning to Home; Notes-origin and direct-link notes
  retain their Notes fallback, with an allowlisted return destination.

## Conflict resolution

The finish-experience branch deliberately removed Review and Check my
understanding. Those route/component deletions remain. The older grading route,
backend endpoint, API wrapper, and feature-specific tests are not restored as
unused code. The new finish experience and its tests remain intact.

The existing complexity gate identified the combined Documents and Reader
functions as regressions. Collection filter labels/counts and Reader animation
calculations were extracted into focused helpers without changing their behavior
or relaxing the complexity baseline.

## Local testing

Backend tests include real HTTP uploads through the isolated PDF and HTML/EPUB
parsers. Navigation regression tests use Expo Router's in-memory history. AI
provider calls in automated tests are mocked.

Final checks executed successfully on the consolidated tree:

| Check | Result |
| --- | --- |
| Backend tests | 227 passed |
| Mobile reliability tests | 410 passed across 39 files |
| Mobile component/integration tests | 504 passed across 63 suites |
| TypeScript | Passed |
| Root ESLint, HTML and CSS lint | Passed |
| Mobile ESLint and Prettier | Passed |
| Complexity gate | Zero regressions; baseline unchanged |
| Android Metro/Hermes export | Passed, 6.3 MB bundle |
| Git whitespace/conflict checks | Passed |

Android verification uses a Metro/Hermes export, not a native APK build or a
physical-device test. No cloud infrastructure or production database is deployed.

## Windows startup

Keep backend and Metro in separate PowerShell tabs. Preserve the existing local
environment files; these contain configuration and must not be committed.

Backend, from the repository root:

```powershell
node --env-file=.env.backend.local votic_server.js
```

Metro, from `apps\mobile`:

```powershell
npx.cmd expo start --clear
```

Press `a` to open Android. Re-import a document when testing extraction changes:
previously imported text is not silently replaced. A new native Android build is
needed to install the updated RTF share-intent registration; the picker MIME fix
is JavaScript and is included in the refreshed Metro bundle.
