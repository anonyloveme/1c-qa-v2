import { cn } from "@/lib/utils";

function Input({ className, type = "text", ...props }) {
  return (
    <input
      type={type}
      className={cn(
        "h-10 w-full rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60 placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Input };