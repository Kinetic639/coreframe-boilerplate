"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle } from "lucide-react";

interface Step {
  label: string;
  description?: string;
}

interface ProgressIndicatorProps {
  variant?: "bar" | "steps" | "circular";
  value: number; // 0-100
  max?: number;
  steps?: Step[];
  currentStep?: number;
  showLabel?: boolean;
  className?: string;
}

export function ProgressIndicator({
  variant = "bar",
  value,
  max = 100,
  steps,
  currentStep = 0,
  showLabel = true,
  className,
}: ProgressIndicatorProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  if (variant === "steps" && steps) {
    return (
      <div className={cn("space-y-4", className)}>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div key={index} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Circle
                    className={cn("h-5 w-5", isCurrent ? "text-primary" : "text-muted-foreground")}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "font-medium",
                    isCurrent && "text-primary",
                    isCompleted && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (variant === "circular") {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className={cn("relative inline-flex items-center justify-center", className)}>
        <svg className="transform -rotate-90" width="100" height="100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-muted"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="text-primary transition-all duration-300"
          />
        </svg>
        {showLabel && (
          <span className="absolute text-lg font-semibold">{Math.round(percentage)}%</span>
        )}
      </div>
    );
  }

  // Default: bar variant
  return (
    <div className={cn("space-y-2", className)}>
      <Progress value={percentage} className="h-2" />
      {showLabel && (
        <p className="text-sm text-muted-foreground text-right">{Math.round(percentage)}%</p>
      )}
    </div>
  );
}
