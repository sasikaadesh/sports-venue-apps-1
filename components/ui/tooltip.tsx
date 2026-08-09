"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";

/**
 * Hover/focus label for a control whose meaning is carried by an icon.
 *
 * A tooltip is *never* the only way to know what a button does — every trigger
 * that uses one also carries an `aria-label`, so a screen reader and a touch
 * user (who has no hover) are told the same thing without it. The tooltip is
 * the sighted-mouse shortcut, nothing more.
 *
 * `Provider` is inside `Tooltip` rather than around the page: it groups
 * adjacent tooltips so that once one has opened, moving along a row of icons
 * shows the next instantly instead of re-waiting the delay.
 */
function Tooltip({
  delay = 300,
  ...props
}: TooltipPrimitive.Root.Props & { delay?: number }) {
  return (
    <TooltipPrimitive.Provider delay={delay}>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipPrimitive.Provider>
  );
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 6,
  children,
  ...props
}: TooltipPrimitive.Popup.Props & {
  side?: TooltipPrimitive.Positioner.Props["side"];
  sideOffset?: TooltipPrimitive.Positioner.Props["sideOffset"];
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        className="z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            // `bg-popover` is a step lighter than the card in dark mode, which
            // is what separates the tooltip from the table behind it —
            // elevation here is lightness, not shadow (docs/DESIGN.md).
            "rounded-lg bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent };
