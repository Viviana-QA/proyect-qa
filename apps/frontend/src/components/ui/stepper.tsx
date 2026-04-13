import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface Step {
  label: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <div className={cn('flex items-center w-full', className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <React.Fragment key={index}>
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                  isCompleted && 'border-success bg-success text-white',
                  isCurrent && 'border-primary bg-primary text-primary-foreground',
                  !isCompleted && !isCurrent && 'border-muted-foreground/30 bg-background text-muted-foreground',
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  'mt-2 text-xs font-medium',
                  isCompleted && 'text-success',
                  isCurrent && 'text-primary',
                  !isCompleted && !isCurrent && 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'mx-2 h-0.5 flex-1 transition-colors',
                  index < currentStep ? 'bg-success' : 'bg-muted-foreground/30',
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export { Stepper };
export type { StepperProps, Step };
