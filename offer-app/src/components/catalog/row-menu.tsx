"use client";

import { Ellipsis } from "lucide-react";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Menu, MenuContent, MenuTrigger } from "@/components/ui/menu";
import { cn } from "@/lib/utils";

/** "…" button that reveals on row hover. Stops clicks from reaching the row's own onClick. */
export function RowMenu({ children, label = "Row actions" }: { children: ReactNode; label?: string }) {
  return (
    <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
      <Menu>
        <MenuTrigger
          aria-label={label}
          className={cn(
            buttonVariants({ variant: "ghost", size: "xs", icon: true }),
            "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100",
          )}
        >
          <Ellipsis />
        </MenuTrigger>
        <MenuContent align="end" className="min-w-44">
          {children}
        </MenuContent>
      </Menu>
    </div>
  );
}
