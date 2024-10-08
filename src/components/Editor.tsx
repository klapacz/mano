import { useQuery } from "@tanstack/react-query";
import { db } from "@/sqlocal/client";
import { useEditor, EditorContent } from "@tiptap/react";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Node, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { FlatListNode } from "@/lib/tiptap/flat-list-extension";
import { Link } from "@tiptap/extension-link";
import { Backlink } from "@/lib/tiptap/backlink/backlink";

export function Editor(props: { noteId: string }) {
  const query = useQuery({
    queryKey: ["note", props.noteId],
    queryFn: async () => {
      return await db
        .selectFrom("notes")
        .where("notes.id", "=", props.noteId)
        .select(["notes.content"])
        .executeTakeFirstOrThrow();
    },
    // Refetch only on mount, and do not cache the result
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  if (!query.isSuccess) {
    return null;
  }

  return <EditorInner content={query.data.content} noteId={props.noteId} />;
}

const Document = Node.create({
  name: "doc",
  topNode: true,
  // The document must always have a heading
  content: "heading block+",
});

/**
 * The editor which is used to create the annotation. Supports formatting.
 */
function EditorInner(props: { content: any; noteId: string }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        listItem: false,
        bulletList: false,
        orderedList: false,
        document: false,
      }),
      Backlink,
      Link,
      FlatListNode,
      Document,
    ],
    content: props.content,
    editorProps: {
      attributes: {
        class:
          "rounded-sm border-2 tiptap-editor p-4 focus:outline-none focus:border-slate-400",
      },
    },
    async onUpdate({ editor }) {
      const json = editor.getJSON();
      const firstHeading = getFirstHeadingContent(editor.$doc.node);

      const backlinks = findAllBacklinks(editor.$doc.node);

      await db
        .deleteFrom("backlinks")
        .where("source_id", "=", props.noteId)
        .execute();

      if (backlinks.length) {
        await db
          .insertInto("backlinks")
          .values(
            backlinks.map((backlink) => ({
              source_id: props.noteId,
              target_id: backlink,
            }))
          )
          .execute();
      }

      await db
        .updateTable("notes")
        .where("id", "=", props.noteId)
        .set({
          content: JSON.stringify(json),
          title: firstHeading ?? "Untitled",
        })
        .execute();
    },
  });

  return (
    <>
      <EditorContent editor={editor} />
    </>
  );
}

function findAllBacklinks(doc: ProseMirrorNode): string[] {
  const backlinksSet = new Set<string>();

  doc.descendants((node) => {
    if (node.type.name === "backlink") {
      // TODO: protect against invalid backlinks
      backlinksSet.add(node.attrs.id);
    }
  });

  return Array.from(backlinksSet);
}

function getFirstHeadingContent(doc: ProseMirrorNode): string | null {
  let headingContent: string | null = null;

  doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      headingContent = node.textContent;
      return false; // Stop traversing
    }
  });

  return headingContent;
}
