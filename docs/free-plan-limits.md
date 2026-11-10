# Votic Free limits

Free includes 75 AI credits per month, up to 5 dedicated summaries, and up to 3 camera scan pages. The backend meters dedicated summary requests and camera OCR per authenticated account in UTC calendar months. Reserved and charged operations count; failed or stale reservations are released. Limits and AI credits are separate. Plus and beta access bypass the Free feature counts, not the credit ledger. Scanned PDF OCR requires Plus or beta access.

The summary counter covers dedicated document and conversation summary actions, Catch me up, and document review. An ordinary Ask Votic question is not classified by topic: a person can ask for a summary in a regular question, so this is not a tamper-proof semantic limit. The backend does not trust a client to grant an allowance, but a client can choose which request feature it sends.

Documents and notes are currently stored in an account-scoped library on the device, not in a synchronized server library. The Free saved-document and note counts are therefore per device and are not an account-wide cross-device quota. Deleted documents and notes do not count; items in a backup or Recently Deleted can be restored even above the limit to preserve user data. Once over the limit, creation of new items is blocked until the live count falls below the limit or the person upgrades. Editing existing items remains available.

Free AI feature counts and Free credits reset on the first day of each UTC calendar month. Plus credit cycles follow the verified subscription billing period. Tests cover mid-month Free-to-Plus and Plus-to-Free transitions; live store transitions still require device testing.

The Free allowance changed from 100 to 75 credits in November 2026. A Free month that had already started at 100 keeps 100 until it ends; every Free month after that starts at 75. Moving from Plus to Free mid-month lands on the current Free allowance. The app learns that an account is on Free from the `plan.free` flag in `/api/ai-usage`, never from the plan's display name.

Free has no pay-as-you-go: reaching any Free limit (files, notes, summaries, scan pages, AI credits, scanned PDFs) offers Votic Plus. When a camera scan needs more Free pages than are left, the scanner opens the Votic Plus sheet before reading any page and keeps the photos.
