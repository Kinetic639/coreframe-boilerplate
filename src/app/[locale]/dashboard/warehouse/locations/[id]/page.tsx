import Image from "next/image";
import { notFound } from "next/navigation";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { loadLocation, loadLocations } from "@/modules/warehouse/api/locations";
import { Link } from "@/i18n/navigation";

export default async function LocationDetails({
  params,
}: {
  params: { id: string; locale: string };
}) {
  const appContext = await loadAppContextServer();
  const orgId = appContext?.active_org_id;
  if (!orgId) return notFound();

  const location = await loadLocation(params.id);
  if (!location || location.organization_id !== orgId) return notFound();

  const all = await loadLocations(orgId);
  const children = all.filter((l) => l.parent_id === params.id);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">{location.name}</h1>
      {location.image_url && (
        <div className="relative h-48 w-full max-w-md">
          <Image
            src={location.image_url}
            alt={location.name}
            fill
            className="rounded border object-cover"
          />
        </div>
      )}
      <div className="space-y-1 text-sm">
        {location.code && (
          <p>
            <strong>Kod:</strong> {location.code}
          </p>
        )}
        {location.color && (
          <p className="flex items-center gap-2">
            <strong>Kolor:</strong>
            <span
              className="inline-block h-4 w-4 rounded"
              style={{ backgroundColor: location.color }}
            />
          </p>
        )}
        {location.icon_name && (
          <p className="flex items-center gap-2">
            <strong>Ikona:</strong> <i className={`lucide lucide-${location.icon_name}`} />
          </p>
        )}
      </div>
      {children.length > 0 && (
        <div>
          <h2 className="mt-4 text-lg font-semibold">Podlokalizacje</h2>
          <ul className="ml-4 list-disc space-y-1">
            {children.map((child) => (
              <li key={child.id}>
                <Link href={`/dashboard/warehouse/locations/${child.id}`}>{child.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
