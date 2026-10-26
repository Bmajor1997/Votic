import { expect, it } from "@jest/globals";
import { act } from "@testing-library/react-native";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { progress_label } from "../../src/documents/documentDisplay";
import { render_with_providers, test_document } from "../renderWithProviders";

const article = test_document("article", "Octopus", {
  plainText: "One two three. Four five six. Seven eight nine. Ten eleven twelve.",
});

it("moves progress with the place when a document is opened at a passage, so cards match the Reader", async () => {
  let library: ReturnType<typeof useDocumentLibrary>;
  function Probe() {
    library = useDocumentLibrary();
    return null;
  }
  await render_with_providers(<Probe />, { documents: [article] });
  await act(async () => library!.openDocument("article", 2));
  const opened = library!.documents.find((document) => document.id === "article")!;
  expect(opened.sentenceIndex).toBe(2);
  expect(opened.progress).toBeCloseTo(6 / 11);
  expect(progress_label(opened)).not.toBe("Not started");
});

it("keeps a finished document finished and leaves progress alone when no passage is given", async () => {
  let library: ReturnType<typeof useDocumentLibrary>;
  function Probe() {
    library = useDocumentLibrary();
    return null;
  }
  const finished = { ...article, id: "done", progress: 1, completedAt: 5 };
  await render_with_providers(<Probe />, { documents: [article, finished] });
  await act(async () => library!.openDocument("done", 1));
  await act(async () => library!.openDocument("article"));
  expect(library!.documents.find((document) => document.id === "done")!.progress).toBe(1);
  expect(library!.documents.find((document) => document.id === "article")!.progress).toBe(0);
});
