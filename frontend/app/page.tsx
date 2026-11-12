import { ArrowRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <Badge variant="outline">Codebase knowledge mapping</Badge>
      <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Know who understands which parts of your codebase.
      </h1>
      <p className="max-w-xl text-base text-pretty text-muted-foreground">
        System Wisdom breaks your codebase into core concepts and measures how
        well each contributor understands them, so you know who to ask, who to
        pair up, and where knowledge is thin.
      </p>
      <Button size="lg" render={<a href="/sign-in" />} nativeButton={false}>
        Get started
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
    </section>
  );
}
