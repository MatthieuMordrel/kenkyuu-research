import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/api/research-callback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.WEBHOOK_SECRET;
    const body = await request.text();

    // Validate webhook signature using Standard Webhooks spec
    if (webhookSecret) {
      const msgId = request.headers.get("webhook-id");
      const timestamp = request.headers.get("webhook-timestamp");
      const signature = request.headers.get("webhook-signature");

      if (!msgId || !timestamp || !signature) {
        return new Response("Missing webhook verification headers", {
          status: 401,
        });
      }

      // Standard Webhooks: sign "msgId.timestamp.body"
      const signedContent = `${msgId}.${timestamp}.${body}`;
      const encoder = new TextEncoder();

      // The secret from OpenAI is base64-encoded, prefixed with "whsec_"
      const secretBytes = base64Decode(webhookSecret.replace("whsec_", ""));
      const key = await crypto.subtle.importKey(
        "raw",
        secretBytes,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signatureBytes = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(signedContent),
      );
      const expectedSignature =
        "v1," + uint8ArrayToBase64(new Uint8Array(signatureBytes));

      // OpenAI may send multiple signatures separated by spaces
      const signatures = signature.split(" ");
      if (!signatures.includes(expectedSignature)) {
        return new Response("Invalid webhook signature", { status: 401 });
      }
    }

    return await handleWebhookPayload(ctx, body);
  }),
});

function base64Decode(str: string): Uint8Array {
  const binaryStr = atob(str);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function handleWebhookPayload(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  body: string,
): Promise<Response> {
  let event: WebhookEvent;
  try {
    event = JSON.parse(body) as WebhookEvent;
  } catch {
    return new Response("Invalid JSON payload", { status: 400 });
  }

  // OpenAI sends an event envelope: { type, data }
  // The response object is inside event.data
  // Also handle legacy/direct payload format for backwards compatibility
  const responseData = event.data ?? event;

  const responseId = responseData.id;
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

  const status = responseData.status;
  if (status === "completed") {
    const outputContent = extractOutputContent(responseData);
    const completedAt = Date.now();
    const durationMs = completedAt - job.createdAt;

    const usage = responseData.usage;
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

    // Dispatch notifications for completed job
    await ctx.scheduler.runAfter(
      0,
      internal.notifications.dispatchJobNotification,
      { jobId: job._id },
    );

    // Check budget alert
    if (costUsd !== undefined) {
      await ctx.scheduler.runAfter(
        0,
        internal.budgetAlert.checkBudgetAlert,
        { currentCostUsd: costUsd },
      );
    }
  } else if (status === "failed" || status === "cancelled") {
    const error =
      responseData.status_details?.error?.message ??
      responseData.error?.message ??
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
    } else {
      // Only notify on final failure (no more retries)
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.dispatchJobNotification,
        { jobId: job._id },
      );
    }
  }

  return new Response("OK", { status: 200 });
}

function extractOutputContent(responseData: ResponseData): string {
  const output = responseData.output;
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
  return JSON.stringify(output ?? responseData);
}

function estimateCost(
  usage: ResponseData["usage"],
): number | undefined {
  if (!usage) return undefined;

  // Approximate pricing for o3-deep-research
  // Input: $2/1M tokens, Output: $8/1M tokens (approximate)
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  return (inputTokens * 2 + outputTokens * 8) / 1_000_000;
}

// Type definitions

interface ContentItem {
  type: string;
  text?: string;
}

interface OutputItem {
  type: string;
  content?: ContentItem[];
}

interface ResponseData {
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
  status_details?: {
    error?: {
      message?: string;
    };
  };
}

interface WebhookEvent {
  type?: string;
  data?: ResponseData;
  // Backwards compatibility: allow direct response fields
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
  status_details?: {
    error?: {
      message?: string;
    };
  };
}

export default http;
