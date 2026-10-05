"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ConfirmProvider } from "@/components/ui/confirm";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api/client";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            // Don't retry client errors (404 for a deleted record, 401 when signed out).
            retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
          },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delay={350}>
        <Toaster>
          <ConfirmProvider>{children}</ConfirmProvider>
        </Toaster>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
