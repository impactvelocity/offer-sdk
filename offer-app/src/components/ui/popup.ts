// Shared surface styles for floating popups (menus, selects, popovers).
export const popupSurface =
  "origin-[var(--transform-origin)] rounded-xl border border-border bg-bg-elevated p-1.5 text-sm text-fg shadow-lg outline-none transition-[transform,scale,opacity] duration-100 ease-out data-starting-style:scale-[0.97] data-starting-style:opacity-0 data-ending-style:scale-[0.97] data-ending-style:opacity-0";

export const popupItem =
  "flex h-9 cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 text-sm text-fg outline-none data-highlighted:bg-bg-hover data-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-icon";
