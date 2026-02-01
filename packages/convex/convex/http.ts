import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/api/research-callback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Validate webhook signature
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = request.headers.get("x-webhook-signature");
      if (!signature) {
        return new Response("Missing webhook signature", { status: 401 });
      }

      // Compute HMAC-SHA256 signature
      const body = await request.text();
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(webhookSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signatureBytes = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(body),
      );
      const expectedSignature = Array.from(new Uint8Array(signatureBytes))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      if (signature !== expectedSignature) {
        return new Response("Invalid webhook signature", { status: 401 });
      }

      // Parse the body we already read
      return await handleWebhookPayload(ctx, body);
    }

    // No webhook secret configured — parse body directly
    const body = await request.text();
    return await handleWebhookPayload(ctx, body);
  }),
});

async function handleWebhookPayload(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  body: string,
): Promise<Response> {
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(body) as WebhookPayload;
  } catch {
    return new Response("Invalid JSON payload", { status: 400 });
  }

  const responseId = payload.response?.id ?? payload.id;
  if (!responseId) {
    return new Response("Missing response ID in payload", { status: 400 });
  }

  // Look up the research job by external ID
  const job = await ctx.runQuery(internal.researchJobs.getJobByExternalId, {
    externalJobId: responseId,
  });

  if (!job) {
    return new Response("No matching research job found", { status: 404 });
  }

  // Extract result content
  const status = payload.response?.status ?? payload.status;
  if (status === "completed") {
    const outputContent = extractOutputContent(payload);
    const completedAt = Date.now();
    const durationMs = completedAt - job.createdAt;

    // Extract usage/cost if available
    const usage = payload.response?.usage ?? payload.usage;
    const costUsd = estimateCost(usage);

    await ctx.runMutation(internal.researchJobs.updateJobStatus, {
      id: job._id,
      status: "completed",
      result: outputContent,
      costUsd,
      durationMs,
    });

    // Log cost
    if (costUsd !== undefined) {
      await ctx.runMutation(internal.researchJobs.logCost, {
        jobId: job._id,
        provider: "openai",
        costUsd,
      });
    }
  } else if (status === "failed" || status === "cancelled") {
    const error =
      payload.response?.status_details?.error?.message ??
      payload.error?.message ??
      `Research ${status}`;

    await ctx.runMutation(internal.researchJobs.updateJobStatus, {
      id: job._id,
      status: "failed",
      error,
    });

    // Trigger retry if under max attempts
    if (status === "failed" && job.attempts < 3) {
      await ctx.scheduler.runAfter(
        Math.pow(2, job.attempts) * 5000,
        internal.researchActions.startResearch,
        { jobId: job._id },
      );
    }
  }

  return new Response("OK", { status: 200 });
}

function extractOutputContent(payload: WebhookPayload): string {
  // Try to extract text from the response output array
  const output = payload.response?.output ?? payload.output;
  if (Array.isArray(output)) {
    const textParts = output
      .filter(
        (item: OutputItem) => item.type === "message" && item.content,
      )
      .flatMap((item: OutputItem) =>
        (item.content ?? [])
          .filter((c: ContentItem) => c.type === "output_text")
          .map((c: ContentItem) => c.text ?? ""),
      );
    if (textParts.length > 0) {
      return textParts.join("\n\n");
    }
  }

  // Fallback: return raw stringified output
  return JSON.stringify(output ?? payload);
}

function estimateCost(
  usage: WebhookPayload["usage"],
): number | undefined {
  if (!usage) return undefined;

  // Approximate pricing for o3-deep-research
  // Input: $2/1M tokens, Output: $8/1M tokens (approximate)
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  return (inputTokens * 2 + outputTokens * 8) / 1_000_000;
}

// Type definitions for the webhook payload
interface ContentItem {
  type: string;
  text?: string;
}

interface OutputItem {
  type: string;
  content?: ContentItem[];
}

interface WebhookPayload {
  id?: string;
  status?: string;
  output?: OutputItem[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    message?: string;
  };
  response?: {
    id?: string;
    status?: string;
    output?: OutputItem[];
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
    status_details?: {
      error?: {
        message?: string;
      };
    };
  };
}

export default http;
