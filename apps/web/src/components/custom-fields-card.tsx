import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListChecks } from "lucide-react";
import type { CustomFieldValue } from "@repo/research-models/custom-fields";

interface CustomFieldsCardProps {
  values: CustomFieldValue[];
}

/**
 * Displays the agent-filled custom fields for a research job as a labeled grid
 * (e.g. "Estimated CAGR: 15%"). Fields the agent could not determine render as
 * a muted "Unavailable".
 */
export function CustomFieldsCard({ values }: CustomFieldsCardProps) {
  if (values.length === 0) {
    return null;
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="size-4" />
          Key Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {values.map((field) => (
            <div
              key={field.id}
              className="flex min-w-0 flex-col gap-0.5 border-l-2 border-border/60 pl-3"
            >
              <dt className="truncate text-xs font-medium text-muted-foreground">
                {field.title}
              </dt>
              <dd className="min-w-0 break-words text-sm font-semibold">
                {field.value ?? (
                  <span className="font-normal text-muted-foreground italic">
                    Unavailable
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
