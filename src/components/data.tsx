import Link from "next/link";
import { Decimal } from "@/lib/billing/money";
export function usd(value: string | null | undefined, places = 2) {
  return "$" + new Decimal(value || 0).toFixed(places);
}
export function Badge({ value }: { value: string }) {
  return (
    <span
      className={`badge ${["ACTIVE", "COMPLETED", "CONFIRMED", "Enabled"].includes(value) ? "" : "off"}`}
    >
      <i className="status-dot" />
      {value.replaceAll("_", " ")}
    </span>
  );
}
export function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note || " "}</div>
    </div>
  );
}
export function Heading({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {children}
    </div>
  );
}
export function Empty({
  title = "Nothing here yet",
  text = "Your activity will appear here as you use the platform.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty />}
    </div>
  );
}
export function Chart({
  daily,
  field = "spend",
}: {
  daily: { day: string; spend: string; requests: string }[];
  field?: "spend" | "requests";
}) {
  const max = Math.max(...daily.map((d) => Number(d[field])), 0.001);
  const days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (29 - i));
    const day = date.toISOString().slice(0, 10);
    return (
      daily.find((d) => d.day === day) || { day, spend: "0", requests: "0" }
    );
  });
  return daily.length ? (
    <div
      className="chart"
      role="img"
      aria-label={`Daily ${field} for the last 30 days`}
    >
      {days.map((d, i) => (
        <div
          className="bar-column"
          key={d.day}
          title={`${d.day}: ${field === "spend" ? usd(d[field], 8) : d[field]}`}
        >
          <div
            className="bar"
            style={{ height: `${(Number(d[field]) / max) * 88}%` }}
          />
          <span>{i % 5 === 0 || i === 29 ? d.day.slice(8) : "\u00a0"}</span>
        </div>
      ))}
    </div>
  ) : (
    <Empty
      title="Your first request starts the story"
      text="Usage will appear here when a customer calls your API."
    />
  );
}
export function Pagination({
  page,
  more,
  base,
}: {
  page: number;
  more: boolean;
  base: string;
}) {
  return (
    <div className="pagination">
      {page > 1 && (
        <Link href={`${base}${base.includes("?") ? "&" : "?"}page=${page - 1}`}>
          Previous
        </Link>
      )}
      <span>Page {page}</span>
      {more && (
        <Link href={`${base}${base.includes("?") ? "&" : "?"}page=${page + 1}`}>
          Next
        </Link>
      )}
    </div>
  );
}
