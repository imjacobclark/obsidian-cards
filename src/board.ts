export type Status = "todo" | "doing" | "done";

export const STATUSES: Status[] = ["todo", "doing", "done"];

export const TITLES: Record<Status, string> = {
  todo: "Todo",
  doing: "Doing",
  done: "Done",
};

export interface Card {
  title: string;
  // Markdown, stored in the file as indented lines under the card's list item.
  description: string;
  // YYYY-MM-DD the card was moved to Done, stored as a trailing "✅ date" on the
  // title (the Tasks plugin's done-date marker).
  done?: string;
}

export interface Board {
  frontmatter: string;
  cards: Record<Status, Card[]>;
}

export function emptyBoard(frontmatter = ""): Board {
  return { frontmatter, cards: { todo: [], doing: [], done: [] } };
}

const FRONTMATTER = /^---\r?\n(?:[\s\S]*?\r?\n)?---(?:\r?\n|$)/;
const HEADING = /^##\s+(.+?)\s*$/;
const ITEM = /^[-*]\s+(?:\[[ xX]\]\s+)?(.*)$/;
const INDENT = "  ";
const DONE_DATE = /\s*\u2705\uFE0F?\s*(\d{4}-\d{2}-\d{2})\s*$/;

// Only the frontmatter and the cards under the three headings survive;
// anything else in the file is dropped on the next save.
export function parse(md: string): Board {
  const fm = md.match(FRONTMATTER);
  const board = emptyBoard(fm ? fm[0].trimEnd() : "");
  const body = fm ? md.slice(fm[0].length) : md;

  let current: Status | null = null;
  let card: Card | null = null;
  let lines: string[] = [];

  const finishCard = () => {
    if (card) card.description = dedent(lines);
    card = null;
    lines = [];
  };

  for (const line of body.split(/\r?\n/)) {
    const heading = line.match(HEADING);
    if (heading) {
      finishCard();
      const name = heading[1].toLowerCase();
      current = STATUSES.find((s) => s === name) ?? null;
      continue;
    }
    const item = line.match(ITEM);
    const title = item?.[1].trim();
    if (current && title) {
      finishCard();
      card = parseTitle(title);
      board.cards[current].push(card);
    } else if (card && (line.trim() === "" || /^\s/.test(line))) {
      lines.push(line);
    } else {
      finishCard();
    }
  }
  finishCard();
  return board;
}

export function serialize(board: Board): string {
  const sections = STATUSES.map((s) =>
    [`## ${TITLES[s]}`, ...board.cards[s].map(serializeCard)].join("\n")
  );
  const head = board.frontmatter ? board.frontmatter + "\n" : "";
  return head + sections.join("\n\n") + "\n";
}

function parseTitle(text: string): Card {
  const match = text.match(DONE_DATE);
  const title = match ? text.slice(0, match.index).trim() : text;
  // A title that is only a date marker keeps it as the title rather than going blank.
  if (!match || !title) return { title: text, description: "" };
  return { title, description: "", done: match[1] };
}

// Stamps today's date on a card entering Done and clears it on a card leaving Done.
export function stamp(card: Card, status: Status, today: string): Card {
  if (status !== "done") {
    const { done: _, ...rest } = card;
    return rest;
  }
  return card.done ? card : { ...card, done: today };
}

export function moveCard(board: Board, from: Status, index: number, to: Status, today: string): void {
  const [card] = board.cards[from].splice(index, 1);
  board.cards[to].push(stamp(card, to, today));
}

// Moves a card one place up (-1) or down (+1) within its column.
export function reorderCard(board: Board, status: Status, index: number, delta: -1 | 1): void {
  const cards = board.cards[status];
  const target = index + delta;
  if (target < 0 || target >= cards.length) return;
  [cards[index], cards[target]] = [cards[target], cards[index]];
}

// The one line of a description shown on its card, and whether more is hidden.
// Code fence markers are skipped, since a lone fence renders as an empty code block.
export function descriptionPreview(description: string): { line: string; more: boolean } {
  const lines = description
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("```"));
  return { line: lines[0] ?? "", more: lines.length > 1 };
}

function serializeCard(card: Card): string {
  const description = card.description
    .split("\n")
    .map((line) => (line.trim() ? INDENT + line : ""));
  const title = card.done ? `${card.title} \u2705 ${card.done}` : card.title;
  return [`- ${title}`, ...(card.description ? description : [])].join("\n");
}

function dedent(lines: string[]): string {
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)![0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  const out = lines.map((l) => (l.trim() ? l.slice(min) : ""));
  while (out.length && !out[0]) out.shift();
  while (out.length && !out[out.length - 1]) out.pop();
  return out.join("\n");
}
