# October 16 audit fixes

Based on the repository audit of merged main `5ff81ab`.

| Finding | Change |
| --- | --- |
| F1: mixed PDFs lose scanned pages | Detect image content even when selectable text exists. OCR the complete document as bounded, ordered page images instead of returning partial extraction. |
| F2: base64 PDF data exhausts a fresh allowance | Use the existing image-token reservation path for rendered PDF pages and settle against provider usage. Preserve allowance failures as HTTP 429 rather than generic file errors. |
| F3: PDF client timeout precedes OCR | Allow three minutes for the complete mobile PDF request; paid gateway operations remain bounded to two minutes. |
| F4: interrupted requests permanently occupy slots | Count only pending execution leases from the last 150 seconds. Retain uncertain charges; enforce the gateway lifetime even if response-body reading stalls. Existing persistent ledgers recover without migration. |
| F5: Android cannot receive new formats | Generate native share MIME registrations from the same list used by the picker and shared-file handler, including common RTF aliases. |
| F6: RTF code pages and Unicode fallback corrupt text | Decode declared code pages and multibyte text runs, skip fallback by RTF tokens, and validate/skip binary runs. |
| F7: green secret scan inspected no commits | Fetch complete history, run an explicit full-history Gitleaks scan, and reject empty/error scan logs. |

The fixed-field error object that triggered Semgrep is now a dedicated error class. The Android workflow explicitly installs the expected NDK and retries incomplete downloads, clearing partial installation state. This recovery does not guarantee external SDK availability.

PDF limits are explicit: 12 MB source, 20 pages for scanned/illustrated PDFs, longest rendered side 1600 pixels, and 24 MB total PNG data. The server rejects incomplete OCR. Text-only PDFs retain normal extraction. An illustrated PDF is conservatively routed through OCR so text within an image cannot be silently discarded.

Validation: 159 backend tests, 283 mobile behavior tests, and 377 component/integration tests passed (819 total). Type checking, lint, formatting, and Expo compatibility passed. New regressions use actual generated mixed PDFs and a PDF over 1.5 MB, test persistent lease recovery/retained charges across workers, exercise RTF encodings and binary handling, verify MIME registrations, and reject empty secret scans. A pinned, checksum-verified Gitleaks release scanned 568 existing commits with no leaks found before this change was committed.

Live provider OCR and physical Android/iOS behavior were not exercised. The native share-filter change requires rebuilding the app. The repaired CI jobs must run on the published branch to verify Semgrep and the NDK-dependent native compilation.

The previously reported upstream `braces`, `node-forge`, and `sprintf-js` advisories remain open. This fix does not hide them, broaden their exceptions, or claim that a safe upstream patch is available.
