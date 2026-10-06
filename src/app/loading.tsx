export default function Loading() {
  return (
    <div className="content" aria-label="Loading">
      <div className="skeleton" />
      <div className="skeleton" style={{ marginTop: 24, height: 350 }} />
    </div>
  );
}
