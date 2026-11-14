import { Skeleton } from "@/components/ui/skeleton";
import { ContributorCardSkeleton, ResultsGrid, ResultsShell } from "./results-shell";

// Shown immediately when opening an assessment's results while the page fetches its data.
export default function AssessmentResultsLoading() {
  return (
    <ResultsShell
      title={<Skeleton className="h-8 w-56" />}
      description={<Skeleton className="h-5 w-72" />}
    >
      <ResultsGrid>
        <div className="contents" aria-busy="true" aria-label="Loading results">
          {Array.from({ length: 6 }, (_, index) => (
            <ContributorCardSkeleton key={index} />
          ))}
        </div>
      </ResultsGrid>
    </ResultsShell>
  );
}
