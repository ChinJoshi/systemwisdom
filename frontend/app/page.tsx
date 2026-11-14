import Link from "next/link";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { ArrowRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function Home() {
    const { user } = await withAuth();

    return (
        <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
            <Badge variant="outline">Codebase knowledge mapping</Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Know who to talk to.
            </h1>
            <p className="max-w-xl text-base text-pretty text-muted-foreground">
                System Wisdom breaks your codebase into core concepts and
                measures how well each contributor understands them so you can
                direct asks and bugs to the right person.
            </p>
            <Button
                size="lg"
                // /sign-in is a route handler that redirects to AuthKit, so it needs a plain <a> (no prefetch).
                render={
                    user ? <Link href="/dashboard" /> : <a href="/sign-in" />
                }
                nativeButton={false}
            >
                {user ? "Go to dashboard" : "Get started"}
                <ArrowRightIcon data-icon="inline-end" />
            </Button>
        </section>
    );
}
