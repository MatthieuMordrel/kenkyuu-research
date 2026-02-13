import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type {
  ResponseCancelledWebhookEvent,
  ResponseCompletedWebhookEvent,
  ResponseFailedWebhookEvent,
} from "openai/resources/webhooks";

const http = httpRouter();

http.route({
  path: "/api/research-callback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.WEBHOOK_SECRET;
    const body = await request.text();

    if (!webhookSecret) {
      console.error("WEBHOOK_SECRET is not configured — rejecting webhook");
      return new Response("Webhook verification not configured", {
        status: 500,
      });
    }

    // Validate webhook signature using Standard Webhooks spec
    // Note: We can't use the OpenAI SDK's client.webhooks.unwrap() here
    // because Convex HTTP actions run in a V8 runtime, not Node.js.
    const msgId = request.headers.get("webhook-id");
    const timestamp = request.headers.get("webhook-timestamp");
    const signature = request.headers.get("webhook-signature");

    if (!msgId || !timestamp || !signature) {
      return new Response("Missing webhook verification headers", {
        status: 401,
      });
    }

    // Reject stale timestamps to prevent replay attacks (5-minute window)
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp, 10);
    if (Number.isNaN(ts) || Math.abs(now - ts) > 300) {
      return new Response("Webhook timestamp too old or invalid", {
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
      secretBytes.buffer as ArrayBuffer,
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

    return await handleWebhookPayload(ctx, body);
  }),
});

/** @internal Exported for testing */
export function base64Decode(str: string): Uint8Array {
  const binaryStr = atob(str);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/** @internal Exported for testing */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
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
  type ResponseWebhookEvent =
    | ResponseCompletedWebhookEvent
    | ResponseFailedWebhookEvent
    | ResponseCancelledWebhookEvent;

  let event: ResponseWebhookEvent;
  try {
    event = JSON.parse(body) as ResponseWebhookEvent;
  } catch {
    return new Response("Invalid JSON payload", { status: 400 });
  }

  if (
    event.type !== "response.completed" &&
    event.type !== "response.failed" &&
    event.type !== "response.cancelled"
  ) {
    return new Response("OK", { status: 200 });
  }

  const responseId = event.data.id;
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

  // Schedule a Node.js action to fetch the full response via the SDK
  await ctx.scheduler.runAfter(
    0,
    internal.researchActions.processWebhookEvent,
    { jobId: job._id, eventType: event.type },
  );

  return new Response("OK", { status: 200 });
}

export default http;
