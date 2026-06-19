// src/components/company-filter.tsx
"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FOLDERS = [
  { value: "all", label: "All Companies" },
  { value: "ZF2526", label: "ZF2526" },
  { value: "ZF2627", label: "ZF2627" },
  { value: "ZFN2526", label: "ZFN2526" },
];

export function CompanyFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("source_folder") || "all";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("source_folder");
    } else {
      params.set("source_folder", value);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-44">
        <SelectValue placeholder="Select company" />
      </SelectTrigger>
      <SelectContent>
        {FOLDERS.map((f) => (
          <SelectItem key={f.value} value={f.value}>
            {f.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
