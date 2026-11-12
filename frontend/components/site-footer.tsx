import { Separator } from "@/components/ui/separator";

export function SiteFooter() {
  return (
    <footer>
      <Separator />
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} System Wisdom</span>
        <span>Know who knows your code.</span>
      </div>
    </footer>
  );
}
