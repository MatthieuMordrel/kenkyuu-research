import { escapeHtml } from "./escapeHtml";
import { formatDuration } from "./formatDuration";

/** Builds the HTML body for a single research job notification email. */
export function buildResearchEmailHtml(opts: {
  statusText: string;
  statusEmoji: string;
  stockLabel: string;
  costUsd?: number;
  durationMs?: number;
  error?: string;
  viewUrl?: string;
  createdAt?: number;
}): string {
  const isCompleted = opts.statusText === "completed";
  const accentColor = isCompleted ? "#16a34a" : "#dc2626";
  const statusBg = isCompleted ? "#f0fdf4" : "#fef2f2";

  const metaRows: string[] = [];
  if (opts.costUsd !== undefined) {
    metaRows.push(
      `<td style="padding:4px 12px 4px 0;color:#6b7280;">Cost</td><td style="padding:4px 0;font-weight:500;">$${opts.costUsd.toFixed(2)}</td>`
    );
  }
  if (opts.durationMs !== undefined) {
    metaRows.push(
      `<td style="padding:4px 12px 4px 0;color:#6b7280;">Duration</td><td style="padding:4px 0;font-weight:500;">${formatDuration(opts.durationMs)}</td>`
    );
  }
  if (opts.createdAt) {
    const d = new Date(opts.createdAt);
    const dateStr = d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const timeStr = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    metaRows.push(
      `<td style="padding:4px 12px 4px 0;color:#6b7280;">Date</td><td style="padding:4px 0;font-weight:500;">${escapeHtml(dateStr)} at ${escapeHtml(timeStr)}</td>`
    );
  }

  const metaTable =
    metaRows.length > 0
      ? `<table style="border-collapse:collapse;font-size:14px;margin:16px 0;">${metaRows.map((r) => `<tr>${r}</tr>`).join("")}</table>`
      : "";

  const errorBlock = opts.error
    ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:14px;color:#991b1b;">${escapeHtml(opts.error)}</div>`
    : "";

  const ctaButton = opts.viewUrl
    ? `<div style="margin:24px 0;text-align:center;">
        <a href="${escapeHtml(opts.viewUrl)}" style="display:inline-block;background:${accentColor};color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">View Full Research</a>
      </div>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:24px 16px;">
    <!-- Header -->
    <div style="text-align:center;padding-bottom:24px;">
      <span style="font-size:20px;font-weight:700;color:#111827;">Kenkyuu</span>
    </div>

    <!-- Card -->
    <div style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
      <!-- Status banner -->
      <div style="background:${statusBg};padding:20px 24px;text-align:center;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:28px;margin-bottom:4px;">${opts.statusEmoji}</div>
        <div style="font-size:18px;font-weight:600;color:${accentColor};text-transform:capitalize;">Research ${escapeHtml(opts.statusText)}</div>
      </div>

      <!-- Body -->
      <div style="padding:24px;">
        <div style="font-size:15px;color:#374151;margin-bottom:4px;">
          <span style="color:#6b7280;">Stocks:</span>
          <strong>${escapeHtml(opts.stockLabel)}</strong>
        </div>
        ${metaTable}
        ${errorBlock}
        ${ctaButton}
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding-top:20px;font-size:12px;color:#9ca3af;">
      Sent by Kenkyuu Research
    </div>
  </div>
</body>
</html>`.trim();
}
