import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ClipboardListIcon,
  LightbulbIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type {
  AssessmentResponse,
  ConceptResponse,
  ContributorResponse,
} from "@/lib/api/generated";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ActiveAssessmentActions } from "./active-assessment-actions";
import { AssessmentRowMenu } from "./assessment-row-menu";

export const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
// Assessment creation times, in UTC so the server render is the same for every viewer.
const utcDateTimeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

// Static frame of the codebase page, used by both page.tsx and loading.tsx so the fallback
// and the real page line up exactly.
export function CodebaseShell({
  title,
  description,
  action,
  children,
}: {
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2.5 w-fit"
          render={<Link href="/dashboard" />}
          nativeButton={false}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Codebases
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            {/* loading.tsx passes a skeleton, which can't go inside a heading. */}
            {typeof title === "string" ? (
              <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
            ) : (
              title
            )}
            <div className="text-sm text-muted-foreground">{description}</div>
          </div>
          {action}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}

type SectionKey = "contributors" | "concepts" | "assessments";

const SECTIONS: Record<
  SectionKey,
  { icon: LucideIcon; title: string; description: string; className?: string }
> = {
  contributors: {
    icon: UsersIcon,
    title: "Contributors",
    description: "People who have committed to this codebase.",
  },
  concepts: {
    icon: LightbulbIcon,
    title: "Concepts",
    description: "The core ideas this codebase is built around.",
  },
  assessments: {
    icon: ClipboardListIcon,
    title: "Assessments",
    description: "Question sets that measure how well contributors understand each concept.",
    className: "md:col-span-2",
  },
};

function SectionCard({
  section,
  count,
  children,
}: {
  section: SectionKey;
  count?: number;
  children: ReactNode;
}) {
  const { icon: Icon, title, description, className } = SECTIONS[section];
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        {count !== undefined && (
          <CardAction>
            <Badge variant="secondary">{count}</Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SectionMessage({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>;
}

// Past this many contributors, the list scrolls inside the card instead of growing it.
const MAX_UNSCROLLED_CONTRIBUTORS = 10;

function ContributorsScrollArea({
  scrollable,
  children,
}: {
  scrollable: boolean;
  children: ReactNode;
}) {
  // A fixed height that cuts the last visible row partway, which hints there's more to scroll.
  return scrollable ? <ScrollArea className="h-80">{children}</ScrollArea> : children;
}

export function ContributorsSection({
  contributors,
}: {
  contributors: ContributorResponse[] | undefined;
}) {
  return (
    <SectionCard
      section="contributors"
      count={contributors?.length}
    >
      {contributors === undefined ? (
        <SectionMessage>Couldn&apos;t load contributors. Refresh to try again.</SectionMessage>
      ) : contributors.length === 0 ? (
        <SectionMessage>No contributors found yet.</SectionMessage>
      ) : (
        <ContributorsScrollArea scrollable={contributors.length > MAX_UNSCROLLED_CONTRIBUTORS}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contributors.map((contributor) => (
                <TableRow key={contributor.id}>
                  <TableCell className="font-medium">{contributor.name}</TableCell>
                  <TableCell className="text-muted-foreground">{contributor.email}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ContributorsScrollArea>
      )}
    </SectionCard>
  );
}

export function ConceptsSection({ concepts }: { concepts: ConceptResponse[] | undefined }) {
  return (
    <SectionCard
      section="concepts"
      count={concepts?.length}
    >
      {concepts === undefined ? (
        <SectionMessage>Couldn&apos;t load concepts. Refresh to try again.</SectionMessage>
      ) : concepts.length === 0 ? (
        <SectionMessage>No concepts found yet.</SectionMessage>
      ) : (
        <div className="flex flex-wrap gap-2">
          {concepts.map((concept) => (
            <Badge key={concept.id} variant="outline">
              {concept.name}
            </Badge>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export function AssessmentsSection({
  codebaseId,
  assessments,
}: {
  codebaseId: string;
  assessments: AssessmentResponse[] | undefined;
}) {
  return (
    <SectionCard
      section="assessments"
      count={assessments?.length}
    >
      {assessments === undefined ? (
        <SectionMessage>Couldn&apos;t load assessments. Refresh to try again.</SectionMessage>
      ) : assessments.length === 0 ? (
        <SectionMessage>
          No assessments yet. Create one to start measuring understanding.
        </SectionMessage>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assessments.map((assessment) => {
              const created = (
                <time dateTime={assessment.created_at}>
                  {utcDateTimeFormat.format(new Date(assessment.created_at))} UTC
                </time>
              );
              // Generated assessments open their results. The link's ::after stretches over the
              // whole row, so the row is clickable while keyboard users get one real link.
              const hasResults = assessment.status === "ready";
              return (
                <TableRow key={assessment.id} className={hasResults ? "relative" : undefined}>
                  <TableCell className="font-medium">
                    {hasResults ? (
                      <Link
                        href={`/codebase/${codebaseId}/assessments/${assessment.id}`}
                        className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-1 focus-visible:after:ring-ring"
                      >
                        <span className="sr-only">View results of the assessment created </span>
                        {created}
                      </Link>
                    ) : (
                      created
                    )}
                  </TableCell>
                  <TableCell>{assessment.question_count}</TableCell>
                  <TableCell>
                    <AssessmentStatusBadge assessment={assessment} />
                  </TableCell>
                  <TableCell>
                    {/* Sits above the row link, so its buttons stay clickable. */}
                    <div className="relative z-10 flex items-center justify-end gap-1">
                      {/* Only the active, ready assessment can be taken. */}
                      {assessment.active && assessment.status === "ready" && (
                        <ActiveAssessmentActions
                          codebaseId={codebaseId}
                          assessmentId={assessment.id}
                        />
                      )}
                      <AssessmentRowMenu
                        codebaseId={codebaseId}
                        assessmentId={assessment.id}
                        active={assessment.active}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}

function AssessmentStatusBadge({ assessment }: { assessment: AssessmentResponse }) {
  if (assessment.status === "generating") {
    return (
      <Badge variant="secondary">
        <Spinner data-icon="inline-start" />
        Generating
      </Badge>
    );
  }
  if (assessment.status === "failed") {
    if (!assessment.error) return <Badge variant="destructive">Failed</Badge>;
    return (
      <Tooltip>
        {/* Focusable so keyboard users can reach the reason too. */}
        <TooltipTrigger render={<Badge variant="destructive" tabIndex={0} />}>
          Failed
        </TooltipTrigger>
        <TooltipContent>{assessment.error}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Badge variant={assessment.active ? "default" : "secondary"}>
      {assessment.active ? "Active" : "Closed"}
    </Badge>
  );
}

export function CodebaseSectionsSkeleton() {
  return (Object.keys(SECTIONS) as SectionKey[]).map((section) => (
    <SectionCard key={section} section={section}>
      <div
        className="flex flex-col gap-2"
        aria-busy="true"
        aria-label={`Loading ${SECTIONS[section].title.toLowerCase()}`}
      >
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </SectionCard>
  ));
}
