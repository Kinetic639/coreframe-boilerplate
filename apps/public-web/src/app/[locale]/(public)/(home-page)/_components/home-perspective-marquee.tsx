"use client";

const MARQUEE_WORDS = [
  "Real-time",
  "Multi-branch",
  "QR / EAN",
  "API",
  "PZ · WZ · MM",
  "Audyt",
  "Cloud",
  "RLS",
  "Mobile-first",
  "PL/EN",
];

export function HomePerspectiveMarquee() {
  return (
    <section className="py-32 overflow-hidden bg-background">
      <div className="relative" style={{ perspective: "800px" }}>
        <div style={{ transform: "rotateX(-8deg)" }}>
          {[0, 1].map((row) => (
            <div
              key={row}
              className={`flex gap-8 marquee whitespace-nowrap ${row === 1 ? "flex-row-reverse" : ""}`}
              style={{ animationDirection: row === 1 ? "reverse" : "normal" }}
            >
              {[...MARQUEE_WORDS, ...MARQUEE_WORDS, ...MARQUEE_WORDS].map((w, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-3 text-5xl md:text-7xl font-bold tracking-tighter px-6 py-4"
                >
                  <span className={idx % 2 === 0 ? "text-foreground" : "text-gradient-amber"}>
                    {w}
                  </span>
                  <span className="text-primary">·</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
