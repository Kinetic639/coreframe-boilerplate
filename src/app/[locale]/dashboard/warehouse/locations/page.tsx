import { Tabs, TabsContent } from "@/components/ui/tabs";
import { LocationManager } from "@/modules/warehouse/locations/LocationManager";

export default function Locations() {
  return (
    <div className="mx-auto max-w-7xl">
      <Tabs defaultValue="locations" className="w-full">
        {/* <TabsList className="grid w-full max-w-md grid-cols-1">
            <TabsTrigger
              value="locations"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              Lokalizacje
            </TabsTrigger>
          </TabsList> */}

        <TabsContent value="locations" className="">
          <LocationManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
