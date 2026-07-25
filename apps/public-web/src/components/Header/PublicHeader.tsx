import { PublicHeaderClient } from "./PublicHeaderClient";
import { loadUserContextV2 } from "@/server/loaders/v2/load-user-context.v2";
import { PublicHeaderAuth } from "./PublicHeaderAuth";

const PublicHeader = async ({ showPricing = true }: { showPricing?: boolean } = {}) => {
  const userContext = await loadUserContextV2();

  return (
    <PublicHeaderClient
      showPricing={showPricing}
      authActions={<PublicHeaderAuth userContext={userContext} />}
    />
  );
};

export default PublicHeader;
