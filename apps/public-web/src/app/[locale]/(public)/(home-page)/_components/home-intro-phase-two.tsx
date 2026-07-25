"use client";

import { HomeIntroFloorGrid } from "./home-intro-floor-grid";

export function HomeIntroPhaseTwo() {
  return (
    <section className="relative flex h-screen w-full select-none flex-col overflow-hidden bg-white font-sans transition-colors dark:bg-black">
      <div className="pointer-events-none absolute bottom-0 z-10 flex h-[55%] w-full justify-center lg:h-[60%]">
        <HomeIntroFloorGrid
          className="h-full w-full object-cover object-bottom bg-transparent block"
          lineColor="#F59E0B"
        />
      </div>
    </section>
  );
}
