import { DetailSkeleton, ListSkeleton } from "@/components/requests/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 lg:grid lg:grid-cols-[minmax(380px,480px)_1fr]">
      <div className="hidden min-w-0 border-r border-stone-200 lg:block">
        <ListSkeleton />
      </div>
      <div className="min-w-0 flex-1 bg-stone-50">
        <DetailSkeleton />
      </div>
    </div>
  );
}
