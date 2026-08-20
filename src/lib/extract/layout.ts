/**
 * Rebuilds reading-order text from pdf.js text item positions. pdf.js hands
 * back an unordered bag of positioned glyphs/words, not lines, so this is
 * the piece that turns positions back into something that reads like the
 * original document.
 */

export interface PositionedItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Fraction of item height treated as "still the same line" when grouping by Y. */
const Y_TOLERANCE_RATIO = 0.4;

/** A vertical gap bigger than this many line-heights starts a new paragraph. */
const PARAGRAPH_GAP_RATIO = 1.6;

/** A horizontal gap bigger than this fraction of the item height reads as a word break. */
const WORD_GAP_RATIO = 0.25;

function groupIntoLines(items: PositionedItem[]): PositionedItem[][] {
  // PDF space has Y growing upward, so the top of the page sorts first when
  // Y is descending. Ties (same line) fall back to X so the grouping pass
  // below sees left-to-right order for free.
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: PositionedItem[][] = [];
  for (const item of sorted) {
    const currentLine = lines[lines.length - 1];
    const reference = currentLine?.[0];
    if (reference) {
      const tolerance = Math.max(reference.height, item.height) * Y_TOLERANCE_RATIO;
      if (Math.abs(reference.y - item.y) <= tolerance) {
        currentLine.push(item);
        continue;
      }
    }
    lines.push([item]);
  }

  for (const line of lines) {
    line.sort((a, b) => a.x - b.x);
  }

  return lines;
}

function renderLine(items: PositionedItem[]): string {
  let text = '';
  let previous: PositionedItem | null = null;

  for (const item of items) {
    if (previous) {
      const gap = item.x - (previous.x + previous.width);
      const wordThreshold = Math.max(previous.height, item.height) * WORD_GAP_RATIO;
      if (gap > wordThreshold) {
        text += ' ';
      }
    }
    text += item.str;
    previous = item;
  }

  return text;
}

/** Reconstructs a page of text from its positioned items, in reading order. */
export function reconstructPageText(items: PositionedItem[]): string {
  const withText = items.filter((item) => item.str.length > 0);
  if (withText.length === 0) return '';

  const lines = groupIntoLines(withText);

  let result = '';
  let previousLine: PositionedItem[] | null = null;

  for (const line of lines) {
    if (previousLine) {
      const lineHeight = Math.max(previousLine[0].height, line[0].height) || 1;
      const gap = previousLine[0].y - line[0].y;
      result += gap > lineHeight * PARAGRAPH_GAP_RATIO ? '\n\n' : '\n';
    }
    result += renderLine(line);
    previousLine = line;
  }

  return result;
}

/** Below this many non-whitespace characters, a page is treated as a scan regardless of area. */
const MIN_TEXT_CHARS = 40;

/**
 * Characters per square device-pixel below which a page reads as "mostly
 * blank with a caption" rather than a real text page — tuned against a
 * typical 612x792pt page rendered at 1x, where a full paragraph lands
 * comfortably above this and a scanned page with a stray watermark doesn't.
 */
const MIN_TEXT_DENSITY = 0.0006;

/** True when a page's text layer is too thin to trust, so it should be OCR'd instead. */
export function isSparsePage(pageText: string, viewportWidth: number, viewportHeight: number): boolean {
  const nonWhitespaceCount = pageText.replace(/\s+/g, '').length;
  if (nonWhitespaceCount < MIN_TEXT_CHARS) return true;

  const area = viewportWidth * viewportHeight;
  if (area <= 0) return true;

  return nonWhitespaceCount / area < MIN_TEXT_DENSITY;
}
