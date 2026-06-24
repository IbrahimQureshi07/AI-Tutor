"use client";

import * as React from "react";
import { KpiInsightTooltip } from "@/components/kpi/kpi-insight-tooltip";
import { ADMIN_HELP, type AdminHelpKey } from "@/components/admin/admin-help-copy";

export function AdminMetricTooltip({
  k,
  children,
  className,
}: {
  k: AdminHelpKey;
  children: React.ReactNode;
  className?: string;
}) {
  const { title, description } = ADMIN_HELP[k];
  return (
    <KpiInsightTooltip title={title} description={description} className={className}>
      {children}
    </KpiInsightTooltip>
  );
}
