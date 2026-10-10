/**
 * Where a tap on a home-screen widget leads. The widgets (targets/widget on iPhone,
 * modules/votic-widgets on Android) open links of this form:
 *
 *   votic://widget?open=listen&id=<document id>   resume listening (starts playing)
 *   votic://widget?open=read&id=<document id>     resume reading, without audio controls
 *   votic://widget?open=statistics                Statistics
 *   votic://widget?open=add                       Documents, to add a first document
 *   votic://widget                                Home
 *
 * Links are only ever followed inside Votic's own navigation, and a document id that isn't in the
 * library (deleted since the widget last updated) falls back to Home.
 */
import { VoticDocument } from "../documents/types";

export type WidgetLinkTarget =
  | { kind: "document"; id: string; mode: "listen" | "read" }
  | { kind: "statistics" }
  | { kind: "documents" }
  | { kind: "home" };

export function widgetLinkTarget(
  params: { open?: string | string[]; id?: string | string[] },
  documents: Pick<VoticDocument, "id">[],
): WidgetLinkTarget {
  const open = Array.isArray(params.open) ? params.open[0] : params.open;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (open === "listen" || open === "read")
    return id && documents.some((document) => document.id === id)
      ? { kind: "document", id, mode: open }
      : { kind: "home" };
  if (open === "statistics") return { kind: "statistics" };
  if (open === "add") return { kind: "documents" };
  return { kind: "home" };
}
