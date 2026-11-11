export default function MessagesLoading() {
  return (
    <div className="flex h-full min-h-0">
      <div className="w-72 shrink-0 space-y-2 border-r p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
      <div className="flex-1" />
    </div>
  );
}
