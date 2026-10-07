"use client";
import type { AccountInfo } from "@/lib/providers/account";
import type { CustomerLog } from "./customer-console";
import { UsageTooltip } from "./usage-tooltip";

export function MetricChart({
  label,
  stats,
  logs,
}: {
  label: string;
  stats: AccountInfo["stats"] | undefined;
  logs: CustomerLog[];
}) {
  if (label === "Success rate") {
    const days = stats?.days.slice(-30) ?? [];
    return (
      <div
        className="metric-mini metric-success"
        aria-label="Daily success rate"
      >
        {days.length ? (
          days.map((d) => (
            <UsageTooltip
              key={d.date}
              label={`Success on ${d.date}`}
              detail={`${d.date} UTC: ${d.requests} requests, ${d.errors} errors. ${d.requests ? ((Math.max(0, d.requests - d.errors) / d.requests) * 100).toFixed(1) + "% successful" : "No requests"}.`}
            >
              <span
                className="success-tick"
                style={{
                  background: !d.requests
                    ? "#303745"
                    : d.errors
                      ? "#f5a800"
                      : "#13c99a",
                }}
              />
            </UsageTooltip>
          ))
        ) : (
          <span className="mini-empty">Daily data unavailable</span>
        )}
      </div>
    );
  }
  if (label === "Cache hit") {
    const hit = stats?.cacheHit;
    if (hit == null)
      return (
        <div className="metric-mini">
          <span className="mini-empty">Cache data unavailable</span>
        </div>
      );
    return (
      <div className="metric-mini metric-cache">
        <UsageTooltip
          label="Cache hit chart"
          detail={
            hit == null
              ? "Cache data unavailable."
              : `${hit.toFixed(1)}% account cache hit rate over 30 days. ${stats?.tokens.cacheRead?.toLocaleString() ?? "Unavailable"} cache-read tokens.`
          }
        >
          <span className="cache-track">
            <span style={{ width: `${hit ?? 0}%` }} />
          </span>
        </UsageTooltip>
      </div>
    );
  }
  const points =
    label === "Response speed"
      ? logs
          .filter((l) => l.latency != null && Number.isFinite(l.latency))
          .slice(0, 12)
          .reverse()
          .map((l) => ({
            name: l.created,
            value: l.latency! / 1000,
            description: `${l.created}: ${(l.latency! / 1000).toFixed(2)}s`,
          }))
      : label === "Today"
        ? (stats?.days.slice(-14) ?? []).map((d) => ({
            name: d.date,
            value: d.requests,
            description: `${d.date} UTC: ${d.requests} requests, $${Number(d.spend).toFixed(2)} charged`,
          }))
        : [];
  if (!points.length)
    return (
      <div className="metric-mini">
        <span className="mini-empty">Chart data unavailable</span>
      </div>
    );
  const max = Math.max(1, ...points.map((p) => p.value));
  const coords = points.map(
    (p, i) =>
      `${points.length === 1 ? 50 : 2 + (i / (points.length - 1)) * 96},${32 - (p.value / max) * 26}`,
  );
  const color = label === "Today" ? "#f5a800" : "#20b9ec";
  return (
    <div className="metric-mini metric-sparkline">
      <UsageTooltip
        label={`${label} chart`}
        detail={
          <>
            <b>
              {label === "Response speed"
                ? "Recent request durations (sample)"
                : "Daily requests · last 14 reported days"}
            </b>
            {points.map((p, i) => (
              <span className="mini-detail" key={i}>
                {p.description}
              </span>
            ))}
          </>
        }
      >
        <svg viewBox="0 0 100 38" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M 0 32 H 100"
            stroke="#2c3442"
            strokeDasharray="1 2"
            fill="none"
          />
          <polygon
            points={`${coords[0].split(",")[0]},36 ${coords.join(" ")} ${coords[coords.length - 1].split(",")[0]},36`}
            fill={color}
            opacity=".08"
          />
          <polyline
            points={coords.join(" ")}
            fill="none"
            stroke={color}
            strokeWidth="1.3"
            vectorEffect="non-scaling-stroke"
          />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={coords[i].split(",")[0]}
              cy={coords[i].split(",")[1]}
              r="1.3"
              fill={color}
            />
          ))}
        </svg>
      </UsageTooltip>
    </div>
  );
}
