export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-1 items-center justify-center py-6">{children}</div>
  );
}
