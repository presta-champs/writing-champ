/**
 * TipTap / ProseMirror plugin that renders [IMAGE: ...] markers as clickable
 * styled widgets inside the editor.
 *
 * When clicked, fires a custom event with the marker prompt and position so the
 * parent component can open the image picker.
 */
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Extension } from "@tiptap/core";

export const IMAGE_MARKER_EVENT = "image-marker-click";

export type ImageMarkerClickDetail = {
  prompt: string;
  from: number;
  to: number;
};

const pluginKey = new PluginKey("imageMarkerPlugin");

function buildDecorations(doc: Parameters<typeof Decoration.widget>[2] extends (...args: infer _A) => infer _R ? never : any) {
  const decorations: Decoration[] = [];

  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;
    const text: string = node.text || "";
    const regex = /\[IMAGE:\s*([^\]]+)\]/gi;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;
      const prompt = match[1].trim();

      // Replace the text range with a widget decoration
      decorations.push(
        Decoration.inline(from, to, {
          class: "image-marker-widget",
          "data-prompt": prompt,
          "data-from": String(from),
          "data-to": String(to),
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

const imageMarkerProseMirrorPlugin = new Plugin({
  key: pluginKey,
  state: {
    init(_, { doc }) {
      return buildDecorations(doc);
    },
    apply(tr, oldDecorations) {
      if (tr.docChanged) {
        return buildDecorations(tr.doc);
      }
      return oldDecorations;
    },
  },
  props: {
    decorations(state) {
      return pluginKey.getState(state);
    },
    handleClick(view, _pos, event) {
      const target = event.target as HTMLElement;
      const widget = target.closest?.(".image-marker-widget");
      if (!widget) return false;

      const prompt = widget.getAttribute("data-prompt") || "";
      const from = parseInt(widget.getAttribute("data-from") || "0", 10);
      const to = parseInt(widget.getAttribute("data-to") || "0", 10);

      // Dispatch custom event that the React component listens to
      view.dom.dispatchEvent(
        new CustomEvent(IMAGE_MARKER_EVENT, {
          detail: { prompt, from, to } satisfies ImageMarkerClickDetail,
          bubbles: true,
        })
      );

      return true; // Prevent default editor click behavior
    },
  },
});

/**
 * TipTap extension wrapping the ProseMirror plugin.
 */
export const ImageMarkerExtension = Extension.create({
  name: "imageMarkerPlugin",

  addProseMirrorPlugins() {
    return [imageMarkerProseMirrorPlugin];
  },
});
