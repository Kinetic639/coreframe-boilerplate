"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export type PipelineStepId = "session" | "extract" | "preview" | "match" | "pdf";
export type PipelineStatus = "idle" | "running" | "ready" | "error";

export interface WddMatcherPipelineState {
  status: PipelineStatus;
  activeStep: PipelineStepId | null;
  completedSteps: PipelineStepId[];
  error: string | null;
}

export const PIPELINE_STEPS: PipelineStepId[] = ["session", "extract", "preview", "match", "pdf"];

const STEP_PROGRESS: Record<PipelineStepId, number> = {
  session: 8,
  extract: 34,
  preview: 55,
  match: 78,
  pdf: 94,
};

export function runningPipeline(activeStep: PipelineStepId): WddMatcherPipelineState {
  return {
    status: "running",
    activeStep,
    completedSteps: [],
    error: null,
  };
}

function progressValue(pipeline: WddMatcherPipelineState): number {
  if (pipeline.status === "ready") return 100;
  if (!pipeline.activeStep) return pipeline.completedSteps.length ? 100 : 0;
  return STEP_PROGRESS[pipeline.activeStep];
}

export function PipelineProgressOverlay({ pipeline }: { pipeline: WddMatcherPipelineState }) {
  const t = useTranslations("modules.tools.wddMatcher");
  const activeStep = pipeline.activeStep ?? "extract";
  const value = progressValue(pipeline);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="mx-auto w-[calc(100%-2rem)] max-w-md rounded-xl border bg-card p-7 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-lg font-semibold">Ambra System</p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{t(`pipeline.steps.${activeStep}.title`)}</p>
            <span className="font-mono text-xs text-muted-foreground">{value}%</span>
          </div>
          <Progress value={value} className="h-2" />
          <p className="text-sm text-muted-foreground">
            {t(`pipeline.steps.${activeStep}.description`)}
          </p>
        </div>
        {pipeline.error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {pipeline.error}
          </div>
        )}
      </div>
    </div>
  );
}
