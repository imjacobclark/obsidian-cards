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
      card = { title, description: "" };
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

function serializeCard(card: Card): string {
  const description = card.description
    .split("\n")
    .map((line) => (line.trim() ? INDENT + line : ""));
  return [`- ${card.title}`, ...(card.description ? description : [])].join("\n");
}

function dedent(lines: string[]): string {
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)![0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  const out = lines.map((l) => (l.trim() ? l.slice(min) : ""));
  while (out.length && !out[0]) out.shift();
  while (out.length && !out[out.length - 1]) out.pop();
  return out.join("\n");
}
