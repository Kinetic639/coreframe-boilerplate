"use client";

import { useState } from "react";
import { Columns3, MessageSquare, PanelRight, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CommentEditor, CommentRenderer } from "@/components/primitives/comments";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";
import { createEmptyRichText } from "@/components/primitives/rich-text/rich-text-utils";
import { cn } from "@/utils";

type DemoComment = {
  id: string;
  value: RichTextValue;
  author: {
    name: string;
    fallback?: string;
    email?: string;
    profileHref?: string;
  };
  createdAt: string;
  edited?: boolean;
};

const CURRENT_USER = {
  name: "Michałek",
  fallback: "M",
  email: "michalek@ambra.app",
  profileHref: "/dashboard/organization/users/members/current-user",
};

function paragraph(text: string): RichTextValue {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}

const INITIAL_COMMENTS: DemoComment[] = [
  {
    id: "comment-1",
    value: paragraph("Produkt utworzono"),
    author: CURRENT_USER,
    createdAt: "16:36",
  },
  {
    id: "comment-2",
    value: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Dodałem notatkę z " },
            { type: "text", text: "ważnym kontekstem", marks: [{ type: "bold" }] },
            { type: "text", text: " dla osoby, która przejmie zgłoszenie." },
          ],
        },
      ],
    },
    author: CURRENT_USER,
    createdAt: "16:37",
    edited: true,
  },
  {
    id: "comment-3",
    value: paragraph("Sprawdzić przypisanie do właściwego magazynu przed zamknięciem."),
    author: {
      name: "Supa Dupa",
      fallback: "SD",
      email: "supa.dupa@ambra.app",
      profileHref: "/dashboard/organization/users/members/supa-dupa",
    },
    createdAt: "16:38",
  },
];

function createTimestamp() {
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function isCurrentUserComment(comment: DemoComment): boolean {
  return comment.author.profileHref === CURRENT_USER.profileHref;
}

export default function CommentsDemoPage() {
  const [comments, setComments] = useState<DemoComment[]>(INITIAL_COMMENTS);
  const [panelDraft, setPanelDraft] = useState<RichTextValue>(createEmptyRichText());
  const [pageDraft, setPageDraft] = useState<RichTextValue>(createEmptyRichText());

  const addComment = (value: RichTextValue, source: "panel" | "page") => {
    setComments((current) => [
      ...current,
      {
        id: `comment-${Date.now()}`,
        value,
        author: CURRENT_USER,
        createdAt: createTimestamp(),
      },
    ]);

    if (source === "panel") setPanelDraft(createEmptyRichText());
    else setPageDraft(createEmptyRichText());
  };

  const resetDemo = () => {
    setComments(INITIAL_COMMENTS);
    setPanelDraft(createEmptyRichText());
    setPageDraft(createEmptyRichText());
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-background">
      <div className="border-b px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <Badge variant="outline">Primitive demo</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Comments</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Reusable comment editor and renderer built on the shared TipTap rich text primitives.
            </p>
          </div>

          <Button type="button" variant="outline" onClick={resetDemo}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]">
        <main className="min-w-0 overflow-y-auto px-6 py-6">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Columns3 className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold">Full page usage</h2>
              </div>

              <CommentEditor
                value={pageDraft}
                onChange={setPageDraft}
                onSubmit={(value) => addComment(value, "page")}
                author={CURRENT_USER}
                placeholder="Describe a ticket update, item note, request context..."
                submitLabel="Add note"
                mode="simple"
                density="default"
                maxLength={4000}
              />
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Rendered thread</h2>
                <Badge variant="secondary">{comments.length} comments</Badge>
              </div>

              <div className="space-y-5">
                {comments.map((comment) => (
                  <CommentRenderer
                    key={comment.id}
                    value={comment.value}
                    author={comment.author}
                    createdAt={comment.createdAt}
                    editedLabel={comment.edited ? "edited" : undefined}
                    isOwn={isCurrentUserComment(comment)}
                  />
                ))}
              </div>
            </section>
          </div>
        </main>

        <aside className="min-w-0 border-t bg-muted/20 lg:border-l lg:border-t-0">
          <div className="sticky top-0 flex max-h-[calc(100vh-4rem)] min-h-[520px] flex-col">
            <div className="border-b bg-background/80 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <PanelRight className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Side panel usage</h2>
                </div>
                <Badge variant="outline" className="text-xs">
                  compact
                </Badge>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <CommentEditor
                value={panelDraft}
                onChange={setPanelDraft}
                onSubmit={(value) => addComment(value, "panel")}
                author={CURRENT_USER}
                placeholder="Log an activity note..."
                submitLabel="Save"
                mode="simple"
                density="compact"
                maxLength={1200}
              />

              <Separator className="my-5" />

              <div className="space-y-5">
                {comments
                  .slice()
                  .reverse()
                  .map((comment, index) => (
                    <div key={comment.id} className={cn(index === 0 && "animate-in fade-in-0")}>
                      <CommentRenderer
                        value={comment.value}
                        author={comment.author}
                        createdAt={comment.createdAt}
                        editedLabel={comment.edited ? "edited" : undefined}
                        isOwn={isCurrentUserComment(comment)}
                        density="compact"
                        contentClassName="border-transparent bg-background/70 shadow-none"
                      />
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
