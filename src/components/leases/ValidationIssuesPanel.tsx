import { AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ValidationIssue {
  field: string;
  message: string;
  step: number;
  stepName: string;
}

interface ValidationIssuesPanelProps {
  issues: ValidationIssue[];
  onGoToStep: (step: number) => void;
}

export function ValidationIssuesPanel({ issues, onGoToStep }: ValidationIssuesPanelProps) {
  if (!issues || issues.length === 0) return null;

  // Group issues by step
  const issuesByStep = issues.reduce((acc, issue) => {
    if (!acc[issue.step]) {
      acc[issue.step] = { stepName: issue.stepName, issues: [] };
    }
    acc[issue.step].issues.push(issue);
    return acc;
  }, {} as Record<number, { stepName: string; issues: ValidationIssue[] }>);

  return (
    <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 space-y-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-destructive">
            {issues.length} issue{issues.length > 1 ? 's' : ''} need{issues.length === 1 ? 's' : ''} to be fixed
          </h4>
          <p className="text-sm text-muted-foreground mt-1">
            Please correct the following before generating the lease document:
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {Object.entries(issuesByStep).map(([step, { stepName, issues: stepIssues }]) => (
          <div 
            key={step} 
            className="p-3 rounded-lg bg-background border border-border"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">
                Step: {stepName}
              </span>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onGoToStep(Number(step))}
                className="h-7 text-xs gap-1"
              >
                Go fix
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
            <ul className="space-y-1">
              {stepIssues.map((issue, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-destructive mt-1">•</span>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
