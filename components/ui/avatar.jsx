import { cn } from "@/lib/utils";

function Avatar({ className, children }) {
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-secondary-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}

function AvatarImage({ alt = "", className, ...props }) {
  return <img alt={alt} className={cn("size-full object-cover", className)} {...props} />;
}

function AvatarFallback({ className, children }) {
  return <div className={cn("flex size-full items-center justify-center text-sm font-medium", className)}>{children}</div>;
}

export { Avatar, AvatarImage, AvatarFallback };