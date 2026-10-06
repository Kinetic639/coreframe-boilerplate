/** Placeholders shown while a server page streams in (loading.tsx). */
export function CardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3 rounded-xl bg-white px-3.5 py-3 ring-1 ring-stone-200">
      <div className="flex justify-between">
        <div className="h-2.5 w-32 rounded bg-stone-200" />
        <div className="h-2.5 w-14 rounded bg-stone-100" />
      </div>
      <div className="h-3.5 w-4/5 rounded bg-stone-200" />
      <div className="h-2.5 w-3/5 rounded bg-stone-100" />
      <div className="flex justify-between">
        <div className="h-5 w-5 rounded-full bg-stone-200" />
        <div className="h-2.5 w-20 rounded bg-stone-100" />
      </div>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div aria-busy className="flex flex-col">
      <div className="flex flex-col gap-2.5 border-b border-stone-200 bg-white px-4 pb-3 pt-1">
        <div className="h-10 rounded-[10px] bg-stone-100" />
        <div className="h-[38px] rounded-[10px] bg-stone-100" />
        <div className="flex gap-1.5">
          {[64, 84, 96, 104].map((w) => (
            <div key={w} className="h-[30px] rounded-full bg-stone-100" style={{ width: w }} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 px-3 py-2.5">
        {Array.from({ length: 5 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div aria-busy className="flex animate-pulse flex-col">
      <div className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 pb-4 pt-3 lg:px-7 lg:pt-5">
        <div className="h-6 w-40 rounded-full bg-stone-100" />
        <div className="h-5 w-3/4 rounded bg-stone-200" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-3 w-2/3 rounded bg-stone-100" />
        ))}
      </div>
      <div className="flex flex-col gap-4 px-4 py-4 lg:px-7">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-2.5">
            <div className="h-7 w-7 rounded-full bg-stone-200" />
            <div className="h-16 flex-1 rounded-[4px_14px_14px_14px] bg-white ring-1 ring-stone-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
