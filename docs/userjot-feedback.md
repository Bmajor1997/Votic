# Votic feedback and GitHub issues

The app's **Settings → Share feedback** button opens
<https://votic.userjot.com/?openFeedback> in the system browser. The app does not attach email,
Firebase UID, document text, notes, or authentication tokens. UserJot controls guest submission and board login.

## Connection status

The in-app button is implemented. GitHub issue mirroring is prepared but **not active**: UserJot's
live request schema and Votic board identifiers must be verified using an API token first. No recurring
job, issue creation, UserJot comments, or status updates have been enabled.

## Secure setup

1. In the Votic UserJot workspace, open **Settings → API Tokens** and create a dedicated token.
   UserJot's API requires API access on the workspace's plan.
2. In <https://github.com/Bmajor1997/Votic/settings/secrets/actions>, create a repository secret named
   `USERJOT_API_TOKEN` with that token. Do not put it in Expo configuration or commit it to the repository.
3. Rerun the **UserJot connection check** job on `feature/userjot-feedback`. It uses the documented
   `https://api.userjot.com/v1/mcp` endpoint and only lists tools and their request schemas. It does not
   call tools that read customer feedback or change the workspace. Raw provider errors and credentials
   are never printed. The job needs only GitHub `contents: read` permission.
4. After this authenticated check succeeds, verify Votic's board/project identifiers and the request
   response fields. Map only public Votic requests to `{ id, title, body, url }`, then run a dry preview
   with `mirrorFeedbackToGitHub`. Enable a worker only after confirming this source mapping and preview.
   Scheduled GitHub Actions run from the default branch; this feature branch does not change `main`.

For local inspection with a token already stored in an ignored environment file:

```bash
node --env-file=.env.backend.local integrations/userjot.js
```

`integrations/userjot_github.js` supplies the tested one-way issue writer. It validates that each source
is on Votic's public board, limits batches, scans open and closed GitHub issues for stable markers,
skips duplicates, and defaults to a dry run. It never copies author metadata or private messages,
adds assignees, changes GitHub issue statuses, or writes back to UserJot. Ambiguous failed issue POSTs
are not retried within the same run; the next run checks markers again. The future worker must run
serially to prevent two simultaneous jobs from creating the same issue.

## References

- <https://userjot.com/docs/deep-link-feedback>
- <https://userjot.com/docs/mcp-common-setup>
- <https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets>
