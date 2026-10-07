import { ListSkeleton } from "@/components/requests/skeletons";

/** First load of a portal page (header already shown by the portal layout). */
export default function Loading() {
  return (
    <div className="flex flex-1 lg:grid lg:grid-cols-[minmax(380px,480px)_1fr]">
      <div className="min-w-0 flex-1 lg:border-r lg:border-stone-200">
        <ListSkeleton />
      </div>
    </div>
  );
}
