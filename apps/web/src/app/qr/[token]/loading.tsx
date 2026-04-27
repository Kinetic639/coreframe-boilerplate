import { BrandLoader } from "@/components/branding";

export default function QRRedirectLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <BrandLoader
        variant="beacon_swap"
        label="Loading..."
        showWordmark={false}
        logoClassName="h-32 w-32"
      />
    </div>
  );
}
