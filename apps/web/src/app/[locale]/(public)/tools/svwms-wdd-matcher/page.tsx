import { generatePublicMetadata, MetadataProps } from "@/lib/metadata";
import { PublicWddMatcher } from "@/components/tools/svwms-wdd-matcher/public-wdd-matcher";

export async function generateMetadata({ params }: MetadataProps) {
  return generatePublicMetadata(
    params,
    "metadata.public.tools.svwmsWddMatcher",
    ["SV WMS", "WDD matcher", "warehouse tools", "narzędzia magazynowe"],
    { pathname: "/tools/svwms-wdd-matcher" }
  );
}

export default function PublicWddMatcherPage() {
  return <PublicWddMatcher />;
}
