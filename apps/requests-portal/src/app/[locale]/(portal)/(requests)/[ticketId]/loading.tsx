import { DetailSkeleton } from "@/components/requests/skeletons";

/** Detail pane only -- the list in the (requests) layout stays as it is. */
export default function Loading() {
  return <DetailSkeleton />;
}
