import { useEffect, useRef, useState } from "react";
import { DocumentMatch, find_document_matches } from "./documentFind";
import { word_matches } from "./readerText";

export function useReaderFind(
  passages: string[],
  stop: () => Promise<void>,
  scroll: (at: number) => void,
  savedIndex: number,
) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<DocumentMatch[]>([]);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const navigate = useRef(scroll);
  useEffect(() => {
    navigate.current = scroll;
  });
  useEffect(() => {
    let canceled = false;
    const timer = setTimeout(() => {
      void find_document_matches(passages, query.trim(), () => canceled).then((results) => {
        if (!canceled) {
          setMatches(results);
          setBusy(false);
        }
      });
    }, 180);
    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [passages, query]);
  const match = matches[selected];
  useEffect(() => {
    if (open && match) navigate.current(match.passage);
  }, [open, match]);
  const words = match ? word_matches(passages[match.passage]) : [];
  return {
    open,
    query,
    matches,
    selected,
    busy,
    location:
      open && match
        ? {
            index: match.passage,
            word: Math.max(
              0,
              words.findIndex((word) => (word.index || 0) + word[0].length > match.offset),
            ),
          }
        : null,
    setQuery: (text: string) => {
      setQuery(text);
      setSelected(0);
      setMatches([]);
      setBusy(Boolean(text.trim()));
    },
    show: () => {
      void stop();
      setOpen(true);
    },
    close: () => {
      if (open) navigate.current(savedIndex);
      setOpen(false);
      setQuery("");
    },
    move: (delta: number) =>
      setSelected(
        (at) => (at + delta + Math.min(matches.length, 1000)) % Math.max(1, Math.min(matches.length, 1000)),
      ),
  };
}
