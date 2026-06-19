// src/components/page-header.tsx
import { Suspense } from "react";
import { CompanyFilter } from "@/components/company-filter";

interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      <Suspense fallback={<div className="w-44 h-9" />}>
        <CompanyFilter />
      </Suspense>
    </div>
  );
}
