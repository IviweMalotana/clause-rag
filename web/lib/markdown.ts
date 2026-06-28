// A deliberately small markdown parser that preserves *raw character offsets*.
//
// Why custom: the citation highlight must map a chunk's [char_start, char_end]
// range in the raw document text to exactly the right rendered text. Off-the-
// shelf markdown→HTML loses that mapping. Here, every emitted leaf segment
// carries the raw offset range it came from, and segment.text.length always
// equals (rawEnd - rawStart), so a raw offset maps to a local index by simple
// subtraction.

export type Segment = {
  text: string;
  rawStart: number;
  rawEnd: number;
  bold: boolean;
};

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3; segments: Segment[]; rawStart: number }
  | { kind: "paragraph"; segments: Segment[]; rawStart: number };

// Parse inline `**bold**` spans, keeping raw offsets. Markers are not emitted
// as visible text, so each segment's length matches its raw range exactly.
function parseInline(text: string, baseOffset: number): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  let plainStart = 0;

  const pushPlain = (end: number) => {
    if (end > plainStart) {
      segments.push({
        text: text.slice(plainStart, end),
        rawStart: baseOffset + plainStart,
        rawEnd: baseOffset + end,
        bold: false,
      });
    }
  };

  while (i < text.length) {
    if (text.startsWith("**", i)) {
      const close = text.indexOf("**", i + 2);
      if (close !== -1) {
        pushPlain(i);
        const innerStart = i + 2;
        segments.push({
          text: text.slice(innerStart, close),
          rawStart: baseOffset + innerStart,
          rawEnd: baseOffset + close,
          bold: true,
        });
        i = close + 2;
        plainStart = i;
        continue;
      }
    }
    i += 1;
  }
  pushPlain(text.length);
  return segments;
}

// Split raw markdown into blocks, tracking the raw offset where each begins.
export function parseMarkdown(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.split("\n");

  let offset = 0;
  let para: { text: string; start: number } | null = null;

  const flushPara = () => {
    if (para && para.text.trim().length > 0) {
      blocks.push({
        kind: "paragraph",
        segments: parseInline(para.text, para.start),
        rawStart: para.start,
      });
    }
    para = null;
  };

  for (const line of lines) {
    const lineStart = offset;
    offset += line.length + 1; // +1 for the consumed newline

    const headingMatch = /^(#{1,3})\s+/.exec(line);
    if (headingMatch) {
      flushPara();
      const prefixLen = headingMatch[0].length;
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push({
        kind: "heading",
        level,
        segments: parseInline(line.slice(prefixLen), lineStart + prefixLen),
        rawStart: lineStart + prefixLen,
      });
      continue;
    }

    if (line.trim() === "") {
      flushPara();
      continue;
    }

    if (para === null) {
      para = { text: line, start: lineStart };
    } else {
      // Soft line break inside a paragraph: keep the newline char so offsets
      // stay exact (the browser collapses it to a space visually).
      para.text += "\n" + line;
    }
  }
  flushPara();
  return blocks;
}

// Split one segment against a highlight range into up to three parts, marking
// the overlapping middle. Returns parts in order with a `marked` flag.
export function splitSegmentByHighlight(
  seg: Segment,
  hStart: number,
  hEnd: number,
): { text: string; marked: boolean }[] {
  const start = Math.max(seg.rawStart, hStart);
  const end = Math.min(seg.rawEnd, hEnd);
  if (start >= end) return [{ text: seg.text, marked: false }];

  const a = start - seg.rawStart;
  const b = end - seg.rawStart;
  const parts: { text: string; marked: boolean }[] = [];
  if (a > 0) parts.push({ text: seg.text.slice(0, a), marked: false });
  parts.push({ text: seg.text.slice(a, b), marked: true });
  if (b < seg.text.length) parts.push({ text: seg.text.slice(b), marked: false });
  return parts;
}
