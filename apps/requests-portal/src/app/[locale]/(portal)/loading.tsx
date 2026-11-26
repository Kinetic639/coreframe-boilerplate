import { ListSkeleton } from "@/components/requests/skeletons";

/** First load of a portal page (the header is already shown by the portal layout). */
export default function Loading() {
  return <ListSkeleton />;
}
