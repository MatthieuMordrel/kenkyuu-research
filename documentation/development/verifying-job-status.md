# Verifying Research Job Status

Research jobs use OpenAI's `o3-deep-research` model in **background mode**, which means they run asynchronously and can take anywhere from 10 minutes to over an hour depending on prompt complexity.

## How Jobs Complete

1. **Webhook (primary)**: OpenAI sends a webhook to `/api/research-callback` when the job finishes.
2. **Stale job recovery (fallback)**: A cron runs every 15 minutes to poll OpenAI for any job that has been running >30 minutes. This catches missed webhooks.
3. **90-minute timeout**: Jobs running longer than 90 minutes are automatically marked as failed.

## Verifying Status via the UI

Each active job card in the **Active Jobs** panel has a **heart-pulse icon button** (Check Health). Clicking it:

1. Calls the `checkJobHealth` action on the backend.
2. The backend fetches the actual status from OpenAI's API using the stored `externalJobId`.
3. Displays the result inline on the job card:
   - **OpenAI status** (`in_progress`, `queued`, `completed`, `failed`, `cancelled`)
   - **Elapsed time** since job creation
   - **Explanatory message** (e.g., "Job is in_progress on OpenAI (running for 23m). This is normal for o3-deep-research.")

### Interpreting Health Check Results

| OpenAI Status   | What It Means                                                                 |
|-----------------|-------------------------------------------------------------------------------|
| `queued`        | Job is waiting to start on OpenAI's side. Normal.                            |
| `in_progress`   | Job is actively running. Normal — can take 10-60+ minutes.                   |
| `completed`     | OpenAI finished but webhook hasn't been processed yet. Recovery cron will handle it within 15 minutes. |
| `failed`        | OpenAI reported a failure. Check the error message for details.              |
| `cancelled`     | Job was cancelled on OpenAI's side.                                          |
| `null`/unknown  | Could not reach OpenAI (API key missing or network issue).                   |

## Verifying Status via CLI (Advanced)

If you need to check job status outside the UI, you can query Convex and OpenAI directly.

### 1. Check Convex Database

Using the Convex dashboard or `npx convex run`:

```bash
# List all running jobs
npx convex run researchJobs:listJobs '{"status": "running", "token": "<your-session-token>"}'

# Get a specific job
npx convex run researchJobs:getJob '{"id": "<job-id>", "token": "<your-session-token>"}'
```

Key fields to check:
- `status`: `pending` | `running` | `completed` | `failed`
- `externalJobId`: The OpenAI response ID (starts with `resp_`)
- `attempts`: Number of execution attempts (max 3)
- `createdAt`: When the job was created (Unix timestamp in ms)

### 2. Check OpenAI Directly

If you have the `externalJobId`, you can query OpenAI's API:

```bash
curl https://api.openai.com/v1/responses/<external-job-id> \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

The response will include a `status` field: `queued`, `in_progress`, `completed`, `failed`, or `cancelled`.

### 3. Check Cron Logs

The stale job recovery cron logs its activity. Check the Convex dashboard **Logs** tab for entries containing `recoverStaleJobs`.

## Troubleshooting

| Symptom                            | Likely Cause                          | Resolution                                                    |
|------------------------------------|---------------------------------------|---------------------------------------------------------------|
| Job stuck in `pending`             | Action scheduler delay or failure     | Check Convex function logs for errors in `startResearch`      |
| Job `running` for >1 hour         | Normal for complex prompts            | Use health check to confirm `in_progress` on OpenAI           |
| Job `running` but OpenAI `completed` | Missed webhook                      | Recovery cron will pick it up within 15 min, or retry manually |
| Job `failed` with quota error      | OpenAI API quota exceeded             | Check your OpenAI billing/usage limits                        |
| Health check shows `null` status   | OpenAI API key missing or invalid     | Verify API key in Settings page                               |
