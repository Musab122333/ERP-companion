// src/components/state-message.tsx
import { AlertTriangle, Inbox } from "lucide-react";

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 p-8 text-center">
      <AlertTriangle className="h-8 w-8 text-red-500" />
      <p className="text-sm font-medium text-red-700">Couldn&apos;t load this data</p>
      <p className="text-xs text-red-500 max-w-md">{message}</p>
    </div>
  );
}

export function EmptyMessage({ message = "No data found" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
