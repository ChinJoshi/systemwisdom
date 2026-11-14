"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon, SendIcon } from "lucide-react";
import {
  submitAssessment,
  type AssessmentSubmissionResponse,
  type TakeAssessmentResponse,
} from "@/lib/api/generated";
import { useApiClient } from "@/lib/api/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// The contributor dropdown's value for "I'm not in this list".
const NEW_CONTRIBUTOR = "new";

type AssessmentValues = {
  // A contributor id, NEW_CONTRIBUTOR, or "" before choosing.
  contributor: string;
  // Only used for a new contributor.
  name: string;
  email: string;
  // The chosen choice index per question (as a string, for the radio group), "" if unanswered.
  answers: string[];
};

// Validators return this shape so errors render directly in <FieldError errors={...} />.
type FieldIssue = { message: string };
const issue = (message: string): FieldIssue => ({ message });

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AssessmentForm({ assessment }: { assessment: TakeAssessmentResponse }) {
  const apiClient = useApiClient();
  const [result, setResult] = useState<AssessmentSubmissionResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const contributorItems = [
    ...assessment.contributors.map((contributor) => ({
      value: contributor.id,
      label: `${contributor.name} (${contributor.email})`,
    })),
    { value: NEW_CONTRIBUTOR, label: "I'm not in this list" },
  ];

  const form = useForm({
    defaultValues: {
      // With nobody to pick from, go straight to entering a name and email.
      contributor: assessment.contributors.length === 0 ? NEW_CONTRIBUTOR : "",
      name: "",
      email: "",
      answers: assessment.questions.map(() => ""),
    } satisfies AssessmentValues as AssessmentValues,
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const { data, error, response } = await submitAssessment({
        client: apiClient,
        path: { assessment_id: assessment.id },
        body: {
          contributor:
            value.contributor === NEW_CONTRIBUTOR
              ? { kind: "new", name: value.name.trim(), email: value.email.trim() }
              : { kind: "existing", contributor_id: value.contributor },
          answers: assessment.questions.map((question, index) => ({
            question_id: question.id,
            choice_index: Number(value.answers[index]),
          })),
        },
      });
      if (data) {
        setResult(data);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const detail =
        error && typeof error === "object" && "detail" in error && typeof error.detail === "string"
          ? error.detail
          : null;
      setSubmitError(
        response?.status === 410
          ? "This assessment was replaced by a newer one while you were taking it."
          : (detail ?? "We couldn't submit your answers. Check your connection and try again."),
      );
    },
  });

  if (result) return <AssessmentResults result={result} />;

  return (
    <form
      noValidate
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Who are you?</CardTitle>
          <CardDescription>Your scores are recorded against this contributor.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <form.Field
              name="contributor"
              validators={{
                onChange: ({ value }) => (value ? undefined : issue("Choose who you are.")),
              }}
            >
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Contributor</FieldLabel>
                    <Select
                      name={field.name}
                      items={contributorItems}
                      value={field.state.value || null}
                      onValueChange={(value) => field.handleChange((value as string | null) ?? "")}
                    >
                      <SelectTrigger
                        id={field.name}
                        className="w-full"
                        aria-invalid={isInvalid}
                        onBlur={field.handleBlur}
                      >
                        <SelectValue placeholder="Select your name" />
                      </SelectTrigger>
                      <SelectContent>
                        {contributorItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      People who have committed to this codebase.
                    </FieldDescription>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </form.Field>

            {/* Name and email stay mounted (just hidden) when an existing contributor is picked,
                so their validators re-run and clear when the contributor changes. */}
            <form.Subscribe selector={(state) => state.values.contributor === NEW_CONTRIBUTOR}>
              {(isNew) => (
                <div hidden={!isNew} className="flex flex-col gap-6">
                  <form.Field
                    name="name"
                    validators={{
                      onChangeListenTo: ["contributor"],
                      onChange: ({ value, fieldApi }) =>
                        fieldApi.form.getFieldValue("contributor") === NEW_CONTRIBUTOR &&
                        !value.trim()
                          ? issue("Enter your name.")
                          : undefined,
                    }}
                  >
                    {(field) => {
                      const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            maxLength={255}
                            autoComplete="name"
                            aria-invalid={isInvalid}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                          />
                          {isInvalid && <FieldError errors={field.state.meta.errors} />}
                        </Field>
                      );
                    }}
                  </form.Field>
                  <form.Field
                    name="email"
                    validators={{
                      onChangeListenTo: ["contributor"],
                      onChange: ({ value, fieldApi }) => {
                        if (fieldApi.form.getFieldValue("contributor") !== NEW_CONTRIBUTOR) {
                          return undefined;
                        }
                        if (!value.trim()) return issue("Enter your email.");
                        return EMAIL_PATTERN.test(value.trim())
                          ? undefined
                          : issue("Enter a valid email address.");
                      },
                    }}
                  >
                    {(field) => {
                      const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="email"
                            value={field.state.value}
                            maxLength={320}
                            autoComplete="email"
                            aria-invalid={isInvalid}
                            aria-describedby={`${field.name}-description`}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                          />
                          <FieldDescription id={`${field.name}-description`}>
                            The email you commit with, if you have one.
                          </FieldDescription>
                          {isInvalid && <FieldError errors={field.state.meta.errors} />}
                        </Field>
                      );
                    }}
                  </form.Field>
                </div>
              )}
            </form.Subscribe>
          </FieldGroup>
        </CardContent>
      </Card>

      {assessment.questions.map((question, index) => (
        <form.Field
          key={question.id}
          name={`answers[${index}]`}
          validators={{
            onChange: ({ value }) => (value ? undefined : issue("Choose an answer.")),
          }}
        >
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <FieldSet data-invalid={isInvalid}>
                <FieldLegend>
                  <span className="text-muted-foreground">{index + 1}.</span> {question.question}
                </FieldLegend>
                <FieldDescription className="-mt-3">{question.concept}</FieldDescription>
                <RadioGroup
                  name={field.name}
                  value={field.state.value || null}
                  onValueChange={(value) => field.handleChange(value as string)}
                  aria-invalid={isInvalid}
                >
                  {question.choices.map((choice, choiceIndex) => {
                    const id = `${question.id}-${choiceIndex}`;
                    return (
                      <Field key={id} orientation="horizontal" data-invalid={isInvalid}>
                        <RadioGroupItem
                          id={id}
                          value={String(choiceIndex)}
                          aria-invalid={isInvalid}
                          onBlur={field.handleBlur}
                        />
                        <FieldLabel htmlFor={id} className="font-normal">
                          {choice}
                        </FieldLabel>
                      </Field>
                    );
                  })}
                </RadioGroup>
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </FieldSet>
            );
          }}
        </form.Field>
      ))}

      {submitError && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Submission failed</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {/* Granular subscription: only the submit button re-renders as these flags change. */}
      <form.Subscribe selector={(state) => [state.isSubmitting, state.submissionAttempts, state.isValid] as const}>
        {([submitting, attempts, isValid]) => (
          <div className="flex flex-col items-start gap-2">
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
              {submitting ? "Submitting…" : "Submit answers"}
            </Button>
            {attempts > 0 && !isValid && !submitting && (
              <p role="alert" className="text-xs text-destructive">
                Some answers are missing. Check the highlighted questions above.
              </p>
            )}
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}

function AssessmentResults({ result }: { result: AssessmentSubmissionResponse }) {
  const correct = result.scores.reduce((sum, score) => sum + score.correct, 0);
  const total = result.scores.reduce((sum, score) => sum + score.total, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Thanks, {result.contributor_name}</CardTitle>
        <CardDescription>
          Your answers are recorded. You got {correct} of {total} questions right.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Concept</TableHead>
              <TableHead>Correct</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.scores.map((score) => (
              <TableRow key={score.concept}>
                <TableCell className="font-medium whitespace-normal">{score.concept}</TableCell>
                <TableCell>
                  {score.correct} / {score.total}
                </TableCell>
                <TableCell className="text-right">{score.score.toFixed(0)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
