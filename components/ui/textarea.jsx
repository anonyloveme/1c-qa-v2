import { cn } from "@/lib/utils";

function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full resize-none rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60 placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };