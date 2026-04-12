import { cn } from "@/lib/utils";

function ScrollArea({ className, children, ...props }) {
  return (
    <div
      className={cn("overflow-y-auto custom-scrollbar", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { ScrollArea };