import Anthropic from "@anthropic-ai/sdk";
import { downloadReportFile } from "/home/matth/projects/maintained/kenkyuu-research/packages/convex/convex/providers/anthropicManagedAgents/downloadReportFile";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
const client = new Anthropic({ apiKey });

// Find the APH managed-agent session (created 2026-06-09 ~22:30 UTC).
const candidates = [];
for await (const session of client.beta.sessions.list()) {
  candidates.push({
    id: session.id,
    title: session.title,
    created_at: session.created_at,
    status: session.status,
    metadata: session.metadata,
  });
}
console.log("sessions:", JSON.stringify(candidates, null, 2));

const target = candidates.find(
  (s) => s.metadata?.app === "kenkyuu-research" && s.created_at.startsWith("2026-06-09T22:30")
);
if (!target) {
  console.log("No matching session found — see list above.");
  process.exit(1);
}

const report = await downloadReportFile(client, target.id);
if (!report) {
  console.log(`Session ${target.id}: no report file found.`);
  process.exit(1);
}
await Bun.write("/tmp/aph_report.md", report);
console.log(`Recovered ${report.length} chars from session ${target.id}`);
console.log("--- head ---");
console.log(report.slice(0, 400));
