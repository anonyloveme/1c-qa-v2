import { cn } from "@/lib/utils";

function Separator({ className, orientation = "horizontal" }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        orientation === "vertical" ? "h-full w-px" : "h-px w-full",
        "shrink-0 bg-border",
        className
      )}
    />
  );
}

export { Separator };