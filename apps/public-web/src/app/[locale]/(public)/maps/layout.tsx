export default function PublicMapsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 w-full max-w-none flex-1 flex-col self-stretch justify-start">
      {children}
    </div>
  );
}
