import { Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { formatISO, startOfMonth } from "date-fns";
import { z } from "zod";
import { zodSearchValidator } from "@tanstack/router-zod-adapter";
import { NoteService } from "@/services/note.service";
import { Editor } from "@/components/Editor";

export const indexSearchSchema = z.object({
  date: z
    .string()
    .date()
    // default to today
    .default(() => formatISO(new Date(), { representation: "date" })),
});

export const Route = createFileRoute("/_app/")({
  component: Index,
  validateSearch: zodSearchValidator(indexSearchSchema),
  loaderDeps: ({ search: { date } }) => {
    const monthStartISO = formatISO(startOfMonth(date), {
      representation: "date",
    });
    return { monthStartISO };
  },
  loader: async ({ deps }) => {
    return NoteService.listInMonth(deps.monthStartISO);
  },
  staleTime: 0,
});

function Index() {
  const days = Route.useLoaderData();

  return (
    <div className="space-y-4 pb-[100vh] divide-y">
      {days.map(({ day, note }) => (
        <Fragment key={day}>
          <Editor note={note} className="p-8" />
        </Fragment>
      ))}
    </div>
  );
}
