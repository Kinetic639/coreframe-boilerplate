import { MapPin, Search } from "lucide-react";

interface MarketplaceSearchFormProps {
  cities: string[];
  categories?: string[];
  action: string;
  query?: string;
  city?: string;
  category?: string;
  showCategory?: boolean;
}

export function MarketplaceSearchForm({
  cities,
  categories = [],
  action,
  query = "",
  city = "",
  category = "",
  showCategory = false
}: MarketplaceSearchFormProps) {
  return (
    <form
      action={action}
      className="grid gap-2 rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-slate-200 md:grid-cols-[1fr_220px_auto]"
    >
      <label className="flex min-h-12 items-center gap-2 rounded-xl bg-slate-50 px-3">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="sr-only">Szukaj</span>
        <input
          name="query"
          defaultValue={query}
          placeholder="Szukaj produktu, marki lub dostawcy..."
          className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-slate-400"
        />
      </label>

      <label className="flex min-h-12 items-center gap-2 rounded-xl bg-slate-50 px-3">
        <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="sr-only">Miasto</span>
        <select
          name="city"
          defaultValue={city}
          className="w-full bg-transparent text-sm font-bold outline-none"
        >
          <option value="">Wszystkie miasta</option>
          {cities.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      {showCategory ? (
        <label className="md:col-span-2">
          <span className="sr-only">Kategoria</span>
          <select
            name="category"
            defaultValue={category}
            className="min-h-12 w-full rounded-xl bg-slate-50 px-3 text-sm font-bold outline-none"
          >
            <option value="">Wszystkie kategorie</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <button
        type="submit"
        className="min-h-12 rounded-xl bg-blue-700 px-5 text-sm font-black text-white shadow-sm hover:bg-blue-800"
      >
        Szukaj
      </button>
    </form>
  );
}
