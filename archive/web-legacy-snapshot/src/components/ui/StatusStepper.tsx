import { cn } from "@/lib/utils";

export interface Step {
  label: string;
  value: string;
}

export interface StatusStepperProps {
  steps: Step[];
  activeStep: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeConfig = {
  sm: {
    height: 32,
    text: "text-xs",
    padding: "px-4",
  },
  md: {
    height: 40,
    text: "text-sm",
    padding: "px-5",
  },
  lg: {
    height: 48,
    text: "text-base",
    padding: "px-6",
  },
};

export const StatusStepper = ({
  steps,
  activeStep,
  size = "md",
  className,
}: StatusStepperProps) => {
  const config = sizeConfig[size];

  return (
    <div className={cn("inline-flex items-center gap-0", className)}>
      {steps.map((step, index) => {
        const isActive = step.value === activeStep;
        const isFirst = index === 0;
        const isLast = index === steps.length - 1;
        const chevronWidth = config.height * 0.5;

        // Calculate dynamic width based on text content
        // Estimate: each character is roughly 0.6em, add padding
        const minWidth = config.height * 2.5;
        const estimatedTextWidth = step.label.length * (size === "sm" ? 7 : size === "md" ? 8 : 9);
        const contentWidth = Math.max(minWidth, estimatedTextWidth + config.height);
        const totalWidth = isLast ? contentWidth : contentWidth + chevronWidth;

        return (
          <div
            key={step.value}
            className="relative"
            style={{
              marginLeft: isFirst ? 0 : -chevronWidth * 0.8,
            }}
          >
            <svg
              width={totalWidth}
              height={config.height}
              viewBox={`0 0 ${totalWidth} ${config.height}`}
              className="block"
              preserveAspectRatio="none"
            >
              <defs>
                <clipPath id={`clip-${step.value}-${index}`}>
                  <path
                    d={
                      isLast
                        ? `M 0 0 L ${contentWidth} 0 L ${contentWidth} ${config.height} L 0 ${config.height} ${isFirst ? "" : `L ${chevronWidth * 0.5} ${config.height / 2}`} Z`
                        : `M 0 0 L ${contentWidth} 0 L ${contentWidth + chevronWidth * 0.5} ${config.height / 2} L ${contentWidth} ${config.height} L 0 ${config.height} ${isFirst ? "" : `L ${chevronWidth * 0.5} ${config.height / 2}`} Z`
                    }
                  />
                </clipPath>
              </defs>

              {/* Background */}
              <path
                d={
                  isLast
                    ? `M 0 0 L ${contentWidth} 0 L ${contentWidth} ${config.height} L 0 ${config.height} ${isFirst ? "" : `L ${chevronWidth * 0.5} ${config.height / 2}`} Z`
                    : `M 0 0 L ${contentWidth} 0 L ${contentWidth + chevronWidth * 0.5} ${config.height / 2} L ${contentWidth} ${config.height} L 0 ${config.height} ${isFirst ? "" : `L ${chevronWidth * 0.5} ${config.height / 2}`} Z`
                }
                className={cn(
                  "transition-all duration-200",
                  isActive ? "fill-[color-mix(in_srgb,var(--theme-color)_30%,white)]" : "fill-muted"
                )}
              />

              {/* Border */}
              <path
                d={
                  isLast
                    ? `M 0 0 L ${contentWidth} 0 L ${contentWidth} ${config.height} L 0 ${config.height} ${isFirst ? "" : `L ${chevronWidth * 0.5} ${config.height / 2}`} Z`
                    : `M 0 0 L ${contentWidth} 0 L ${contentWidth + chevronWidth * 0.5} ${config.height / 2} L ${contentWidth} ${config.height} L 0 ${config.height} ${isFirst ? "" : `L ${chevronWidth * 0.5} ${config.height / 2}`} Z`
                }
                className={cn(
                  "transition-all duration-200 fill-none stroke-1",
                  isActive ? "stroke-[var(--theme-color)]" : "stroke-gray-300"
                )}
              />
            </svg>

            {/* Text overlay */}
            <div
              className={cn(
                "absolute inset-0 flex items-center pointer-events-none transition-all duration-200",
                config.text,
                // Use same font-weight for all steps (font-normal = 400)
                "font-normal",
                isActive
                  ? "text-[color-mix(in_srgb,var(--theme-color)_90%,black)]"
                  : "text-muted-foreground"
              )}
              style={{
                paddingLeft: isFirst ? config.height * 0.3 : chevronWidth * 0.8,
                paddingRight: isLast ? config.height * 0.3 : chevronWidth * 1.2,
                justifyContent: "center",
              }}
            >
              <span className="truncate max-w-full px-1">{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
