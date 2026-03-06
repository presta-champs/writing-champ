"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Link as LinkIcon,
  Unlink,
  ImagePlus,
} from "lucide-react";
import { ImagePickerModal } from "./image-picker-modal";
import {
  ImageMarkerExtension,
  IMAGE_MARKER_EVENT,
  type ImageMarkerClickDetail,
} from "./image-marker-plugin";

type Props = {
  /** Initial HTML content to load */
  content?: string;
  /** Called when content changes (debounced) */
  onChange?: (html: string) => void;
  /** If true, streamed HTML is being appended — editor stays read-only */
  streaming?: boolean;
  /** Whether the editor is editable */
  editable?: boolean;
  /** Primary keyword for image alt text suggestions */
  primaryKeyword?: string;
};

export function ArticleEditor({
  content = "",
  onChange,
  streaming = false,
  editable = true,
  primaryKeyword,
}: Props) {
  const lastStreamContent = useRef(content);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [markerPickerOpen, setMarkerPickerOpen] = useState(false);
  const [activeMarker, setActiveMarker] = useState<ImageMarkerClickDetail | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image,
      Placeholder.configure({
        placeholder: "Your article will appear here...",
      }),
      ImageMarkerExtension,
    ],
    content,
    immediatelyRender: false,
    editable: editable && !streaming,
    onUpdate: ({ editor }) => {
      if (!streaming && onChange) {
        onChange(editor.getHTML());
      }
    },
  });

  // Handle streaming content updates
  useEffect(() => {
    if (!editor || !streaming) return;
    if (content !== lastStreamContent.current) {
      lastStreamContent.current = content;
      editor.commands.setContent(content, { emitUpdate: false });
      // Scroll to bottom during streaming
      const el = editor.view.dom;
      el.scrollTop = el.scrollHeight;
    }
  }, [content, streaming, editor]);

  // Toggle editable when streaming stops
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable && !streaming);
  }, [streaming, editable, editor]);

  // Listen for [IMAGE: ...] marker clicks from the ProseMirror plugin
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;

    function handleMarkerClick(e: Event) {
      const detail = (e as CustomEvent<ImageMarkerClickDetail>).detail;
      setActiveMarker(detail);
      setMarkerPickerOpen(true);
    }

    dom.addEventListener(IMAGE_MARKER_EVENT, handleMarkerClick);
    return () => dom.removeEventListener(IMAGE_MARKER_EVENT, handleMarkerClick);
  }, [editor]);

  const handleMarkerImageSelected = useCallback(
    (url: string, alt: string) => {
      if (!editor || !activeMarker) return;

      // Replace the [IMAGE: ...] text with an <img> tag
      editor
        .chain()
        .focus()
        .deleteRange({ from: activeMarker.from, to: activeMarker.to })
        .setImage({ src: url, alt })
        .run();

      setMarkerPickerOpen(false);
      setActiveMarker(null);

      // Trigger onChange so parent gets updated HTML
      if (onChange) {
        onChange(editor.getHTML());
      }
    },
    [editor, activeMarker, onChange]
  );

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Toolbar — only shown when editable and not streaming */}
      {editable && !streaming && (
        <div
          className="flex items-center gap-0.5 px-3 py-2 flex-wrap"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-warm)" }}
        >
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Bold"
          >
            <Bold size={16} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic"
          >
            <Italic size={16} />
          </ToolbarButton>
          <ToolbarSep />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            <Heading2 size={16} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
            title="Heading 3"
          >
            <Heading3 size={16} />
          </ToolbarButton>
          <ToolbarSep />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Bullet List"
          >
            <List size={16} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Ordered List"
          >
            <ListOrdered size={16} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            title="Blockquote"
          >
            <Quote size={16} />
          </ToolbarButton>
          <ToolbarSep />
          <ToolbarButton
            onClick={setLink}
            active={editor.isActive("link")}
            title="Add Link"
          >
            <LinkIcon size={16} />
          </ToolbarButton>
          {editor.isActive("link") && (
            <ToolbarButton
              onClick={() => editor.chain().focus().unsetLink().run()}
              title="Remove Link"
            >
              <Unlink size={16} />
            </ToolbarButton>
          )}
          <ToolbarSep />
          <ToolbarButton
            onClick={() => setImagePickerOpen(true)}
            title="Insert Image"
          >
            <ImagePlus size={16} />
          </ToolbarButton>
          <ToolbarSep />
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            <Undo size={16} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            <Redo size={16} />
          </ToolbarButton>
        </div>
      )}

      {/* Editor content area */}
      <EditorContent
        editor={editor}
        className="article-editor-content prose prose-neutral max-w-none"
      />

      {/* Toolbar image picker (insert at cursor) */}
      <ImagePickerModal
        open={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onSelect={(url, alt) => {
          editor.chain().focus().setImage({ src: url, alt }).run();
          setImagePickerOpen(false);
        }}
        primaryKeyword={primaryKeyword}
      />

      {/* Marker image picker (replace [IMAGE: ...] in-place) */}
      <ImagePickerModal
        open={markerPickerOpen}
        onClose={() => { setMarkerPickerOpen(false); setActiveMarker(null); }}
        onSelect={handleMarkerImageSelected}
        initialQuery={activeMarker?.prompt || ""}
        primaryKeyword={primaryKeyword}
      />
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-1.5 rounded transition"
      style={{
        color: active ? "var(--accent)" : "var(--text-muted)",
        background: active ? "var(--accent-light)" : "transparent",
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ToolbarSep() {
  return (
    <div
      className="w-px h-5 mx-1"
      style={{ background: "var(--border)" }}
    />
  );
}
