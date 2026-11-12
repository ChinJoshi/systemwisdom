import Link from "next/link";
import { BrainCircuitIcon } from "lucide-react";
import { NavAuth } from "@/components/nav-auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function SiteHeader() {
  return (
    <header>
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Button
          variant="ghost"
          size="lg"
          className="text-sm font-semibold"
          render={<Link href="/" />}
          nativeButton={false}
        >
          <BrainCircuitIcon data-icon="inline-start" />
          System Wisdom
        </Button>
        <NavAuth />
      </nav>
      <Separator />
    </header>
  );
}
