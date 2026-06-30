"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Search,
  Box,
  LayoutGrid,
  Layers,
  Info,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  MapPin,
  ArrowRight,
} from "lucide-react";
import {
  analyzeWorkspaceMappingHealth,
  MappingHealthReport,
} from "../../lib/workspaceMappingHealth";
import { VisualNode, LogicalLocation, Layout } from "../../types";
import { cn } from "../../lib/utils";

interface WorkspaceHealthReportDialogProps {
  layout: Layout;
  visuals: VisualNode[];
  locations: LogicalLocation[];
  scopeLocationId?: string;
  onClose: () => void;
}

export default function WorkspaceHealthReportDialog({
  layout,
  visuals,
  locations,
  scopeLocationId,
  onClose,
}: WorkspaceHealthReportDialogProps) {
  const report = React.useMemo(
    () => analyzeWorkspaceMappingHealth(layout, visuals, locations, scopeLocationId),
    [layout, visuals, locations, scopeLocationId]
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-background/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-5xl h-[85vh] bg-card border border-border rounded-lg shadow-sm flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-8 py-5 border-b border-border bg-card/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground tracking-tight uppercase">
                {report.scopeLocationName
                  ? `Mapping Health: ${report.scopeLocationName}`
                  : "Mapping Health Report"}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                  WORKSPACE: {layout.name}
                </p>
                {report.scopeLocationId && (
                  <>
                    <div className="w-1 h-1 rounded-full bg-muted" />
                    <p className="text-[10px] text-primary font-bold tracking-widest uppercase">
                      BRANCH: {report.scopeLocationName}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted p-8 space-y-10">
          {/* Summary Grid */}
          <div className="grid grid-cols-4 gap-4">
            <HealthSummaryCard
              label="Mapping Coverage"
              value={`${report.coverage.mappedPercentage}%`}
              icon={<TrendingUp className="w-4 h-4" />}
              status={
                report.coverage.mappedPercentage > 90
                  ? "ok"
                  : report.coverage.mappedPercentage > 70
                    ? "warning"
                    : "critical"
              }
            />
            <HealthSummaryCard
              label="Broken Mappings"
              value={report.summary.brokenMappings}
              icon={<AlertCircle className="w-4 h-4" />}
              status={report.summary.brokenMappings === 0 ? "ok" : "critical"}
            />
            <HealthSummaryCard
              label="Hierarchy Integrity"
              value={
                report.summary.hierarchyViolations === 0
                  ? "100%"
                  : `${100 - Math.round((report.summary.hierarchyViolations / report.summary.mappedLocations) * 100)}%`
              }
              icon={<Layers className="w-4 h-4" />}
              status={report.summary.hierarchyViolations === 0 ? "ok" : "warning"}
            />
            <HealthSummaryCard
              label="Operational Links"
              value={report.summary.mappedLocations}
              icon={<Box className="w-4 h-4" />}
              status="info"
            />
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Main Issues */}
            <div className="col-span-2 space-y-10">
              {/* Critical Alerts */}
              {(report.summary.brokenMappings > 0 || report.summary.duplicateMappings > 0) && (
                <section className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    Critical Mapping Conflicts
                  </h3>
                  <div className="space-y-2">
                    {report.details.brokenMappings.map((m, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-rose-400 uppercase">
                            Broken Reference
                          </p>
                          <p className="text-sm text-foreground font-medium">
                            {m.source === "front-view"
                              ? `${m.visualNodeLabel} > ${m.path?.join(" > ")}`
                              : m.visualNodeLabel}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            Location ID: {m.locationId} (Missing from registry)
                          </p>
                        </div>
                        <div className="px-2 py-1 rounded bg-rose-500/10 text-[10px] font-black uppercase tracking-widest text-rose-400">
                          Fix Needed
                        </div>
                      </div>
                    ))}
                    {report.details.outOfScopeMappings.map((m, i) => (
                      <div
                        key={`out-${i}`}
                        className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-primary uppercase">
                            Cross-Boundary Mapping
                          </p>
                          <p className="text-sm text-foreground font-medium">{m.visualNodeLabel}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            Mapped to location outside of {report.scopeLocationName || "this scope"}
                            .
                          </p>
                        </div>
                        <div className="px-2 py-1 rounded bg-primary/10 text-[10px] font-black uppercase tracking-widest text-primary">
                          Out of Root
                        </div>
                      </div>
                    ))}
                    {report.details.unassignedStorageObjects.map((m, i) => (
                      <div
                        key={`storage-${i}`}
                        className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-amber-500 uppercase">
                            Unassigned Storage Object
                          </p>
                          <p className="text-sm text-foreground font-medium">{m.label}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            Visual object of type '{m.type}' has no logical location link.
                          </p>
                        </div>
                        <div className="px-2 py-1 rounded bg-amber-500/10 text-[10px] font-black uppercase tracking-widest text-amber-500">
                          Mapping Needed
                        </div>
                      </div>
                    ))}
                    {report.details.duplicateMappings.map((m, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-amber-500 uppercase">
                              Duplicate Physical Representation
                            </p>
                            <p className="text-sm text-foreground font-bold">{m.locationCode}</p>
                          </div>
                          <div className="px-2 py-1 rounded bg-amber-500/10 text-[10px] font-black uppercase tracking-widest text-amber-500">
                            Conflicts Detected
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {m.occurrences.map((occ, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded bg-muted/50 border border-border/50 text-[10px] text-muted-foreground"
                            >
                              <span className="text-muted-foreground block uppercase font-black text-[8px] mb-1">
                                {occ.type.replace("_", " ")}
                              </span>
                              {occ.type === "front-view"
                                ? `${occ.visualNodeLabel} → Cell`
                                : occ.visualNodeLabel}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Hierarchy Violations */}
              {report.summary.hierarchyViolations > 0 && (
                <section className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-3000" />
                    Structural Hierarchy Inconsistencies
                  </h3>
                  <div className="space-y-2">
                    {report.details.hierarchyViolations.map((v, i) => (
                      <div key={i} className="p-4 rounded-xl border border-border bg-background/40">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-foreground uppercase tracking-tight">
                            {v.locationCode}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-3000/60 uppercase">
                            Incomplete Parent Chain
                          </span>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                          {v.missingAncestors.map((a, idx) => (
                            <React.Fragment key={idx}>
                              <div className="px-2 py-1 rounded bg-muted text-[10px] font-mono text-muted-foreground border border-border flex-shrink-0">
                                {a.code}
                              </div>
                              {idx < v.missingAncestors.length - 1 && (
                                <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              )}
                            </React.Fragment>
                          ))}
                          <ArrowRight className="w-3 h-3 text-emerald-700 dark:text-emerald-3000 flex-shrink-0 ml-1" />
                          <div className="px-2 py-1 rounded bg-emerald-500/10 text-[10px] font-mono text-emerald-400 border border-emerald-500/20 flex-shrink-0 font-bold">
                            {v.locationCode}
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 italic">
                          Reason: Parent locations exist in operational registry but have no
                          physical representation here.
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Unmapped Operational */}
              <section className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Unmapped Operational Locations ({report.summary.unmappedOperationalLocations})
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {report.details.unmappedOperational.slice(0, 20).map((loc, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl border border-border flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-bold text-foreground uppercase">
                          {loc.code}
                        </p>
                        <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">
                          {loc.role}
                        </p>
                      </div>
                      <HelpCircle className="w-3 h-3 text-muted-foreground" />
                    </div>
                  ))}
                  {report.summary.unmappedOperationalLocations > 20 && (
                    <div className="col-span-2 text-center py-2 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      + {report.summary.unmappedOperationalLocations - 20} more unmapped
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Sidebar Info */}
            <div className="space-y-8">
              {/* Score Circle */}
              <div className="p-8 rounded-lg bg-background/60 border border-border flex flex-col items-center text-center">
                <div className="relative w-32 h-32 flex items-center justify-center mb-6">
                  <svg className="w-full h-full -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      fill="none"
                      strokeWidth="12"
                      className="stroke-slate-800"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      fill="none"
                      strokeWidth="12"
                      strokeDasharray={364}
                      strokeDashoffset={364 - (364 * report.coverage.mappedPercentage) / 100}
                      strokeLinecap="round"
                      className={cn(
                        "transition-all duration-1000",
                        report.coverage.mappedPercentage > 90
                          ? "stroke-emerald-500"
                          : report.coverage.mappedPercentage > 70
                            ? "stroke-amber-500"
                            : "stroke-rose-500"
                      )}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-foreground">
                      {report.coverage.mappedPercentage}%
                    </span>
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                      Health Score
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-foreground">Workspace Readiness</h4>
                  <p className="text-[10px] text-muted-foreground leading-relaxed font-bold tracking-tight">
                    Based on operational data link coverage and structural integrity.
                  </p>
                </div>
              </div>

              {/* Recommendations */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Recommendations
                </h3>
                <div className="space-y-3">
                  {report.recommendations.map((rec, i) => (
                    <div key={i} className="flex gap-3 text-[11px] leading-relaxed group">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span className="text-muted-foreground group-hover:text-foreground transition-colors font-medium">
                        {rec}
                      </span>
                    </div>
                  ))}
                  {report.recommendations.length === 0 && (
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-3000 font-bold text-[11px]">
                      <CheckCircle2 className="w-4 h-4" />
                      Everything looks perfect!
                    </div>
                  )}
                </div>
              </section>

              {/* Legend */}
              <section className="pt-6 border-t border-border space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Mapping Legend
                </h3>
                <div className="space-y-3">
                  <LegendRow
                    icon={<LayoutGrid className="w-3.5 h-3.5 text-primary" />}
                    label="Top-Down"
                    desc="Direct mapping on floor map."
                  />
                  <LegendRow
                    icon={<Box className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-3000" />}
                    label="Front-View"
                    desc="Nested structural cell mapping."
                  />
                  <LegendRow
                    icon={<Info className="w-3.5 h-3.5 text-muted-foreground" />}
                    label="Virtual"
                    desc="Excluded from physical map."
                  />
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-card border-t border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Top-Down: {report.coverage.topDownCount}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Front-View: {report.coverage.frontViewCount}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-8 py-2.5 rounded-xl bg-muted hover:bg-muted font-black text-xs uppercase tracking-widest text-foreground transition-all border border-border"
          >
            Acknowledge Findings
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function HealthSummaryCard({
  label,
  value,
  icon,
  status,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  status: "ok" | "warning" | "critical" | "info";
}) {
  const statusStyles = {
    ok: "bg-emerald-500/5 border-emerald-500/10 text-emerald-400",
    warning: "bg-amber-500/5 border-amber-500/10 text-amber-500",
    critical: "bg-rose-500/5 border-rose-500/10 text-rose-400",
    info: "bg-primary/5 border-primary/10 text-primary",
  };

  return (
    <div
      className={cn("p-4 rounded-lg border transition-all hover:bg-muted/30", statusStyles[status])}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 rounded-lg bg-muted/50">{icon}</div>
        {status === "ok" && value !== 0 && <CheckCircle2 className="w-4 h-4 opacity-40" />}
      </div>
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}

function LegendRow({ icon, label, desc }: { icon: React.ReactNode; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-[11px] font-bold text-foreground uppercase leading-none mb-0.5">
          {label}
        </p>
        <p className="text-[10px] text-muted-foreground font-medium">{desc}</p>
      </div>
    </div>
  );
}
