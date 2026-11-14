"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts";
import type { ContributorResults } from "@/lib/api/generated";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";

// One series per card, so every card uses the same hue: the cards are small multiples on a shared
// 0-100 scale. The theme's chart tokens are gray, which reads as de-emphasized, so this uses a
// blue validated (contrast, chroma, lightness) against the card surface in each mode.
const chartConfig = {
  score: { label: "Score", theme: { light: "#2a78d6", dark: "#3987e5" } },
} satisfies ChartConfig;

const MAX_TICK_LABEL_LENGTH = 14;

const formatScore = (score: number) => `${Math.round(score)}%`;

export function ContributorRadarCard({ contributor }: { contributor: ContributorResults }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="truncate">{contributor.name}</CardTitle>
        <CardDescription className="truncate">{contributor.email}</CardDescription>
        <CardAction>
          <Badge variant="secondary">{formatScore(contributor.average_score)} avg</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {/* A radar needs at least three axes to enclose an area; fewer reads better as bars. */}
        {contributor.scores.length >= 3 ? (
          // Labels at the sides extend past the plot; let them draw into the card's padding
          // instead of being clipped by the SVG.
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-72 [&_.recharts-surface]:overflow-visible"
          >
            <RadarChart data={contributor.scores} outerRadius="58%">
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">Score</span>
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {formatScore(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <PolarGrid className="stroke-border" />
              <PolarAngleAxis dataKey="concept" tick={ConceptTick} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar
                dataKey="score"
                fill="var(--color-score)"
                fillOpacity={0.25}
                stroke="var(--color-score)"
                strokeWidth={2}
                dot={{ r: 4, fillOpacity: 1 }}
                isAnimationActive={false}
              />
            </RadarChart>
          </ChartContainer>
        ) : (
          <ul className="flex flex-col gap-3">
            {contributor.scores.map((score) => (
              <li key={score.concept} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-4 text-xs">
                  <span className="truncate">{score.concept}</span>
                  <span className="font-mono tabular-nums">{formatScore(score.score)}</span>
                </div>
                <Progress value={score.score} aria-label={score.concept} />
              </li>
            ))}
          </ul>
        )}

        {/* The chart's data as a table, for screen readers. */}
        <table className="sr-only">
          <caption>{contributor.name}&apos;s score per concept</caption>
          <thead>
            <tr>
              <th scope="col">Concept</th>
              <th scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {contributor.scores.map((score) => (
              <tr key={score.concept}>
                <th scope="row">{score.concept}</th>
                <td>{formatScore(score.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// Concept names can be long, so the axis shows a shortened label; the full name is in the
// tooltip on hover and in the table.
function ConceptTick({
  x,
  y,
  textAnchor,
  payload,
}: {
  x?: number | string;
  y?: number | string;
  textAnchor?: string;
  payload?: { value?: string };
}) {
  const name = payload?.value ?? "";
  const label =
    name.length > MAX_TICK_LABEL_LENGTH ? `${name.slice(0, MAX_TICK_LABEL_LENGTH - 1)}…` : name;
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor as "start" | "middle" | "end" | undefined}
      dominantBaseline="central"
      className="fill-muted-foreground text-[10px]"
    >
      <title>{name}</title>
      {label}
    </text>
  );
}
