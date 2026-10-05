import { describe, expect, it } from "vitest";
import { emptyBoard, moveCard, parse, reorderCard, serialize, stamp } from "../src/board";

const lines = (...l: string[]) => l.join("\n");

describe("parse", () => {
  it("reads cards under each heading", () => {
    const board = parse(lines("## Todo", "- a", "- b", "", "## Doing", "- c", "", "## Done", "- d"));
    expect(board.cards).toEqual({
      todo: [
        { title: "a", description: "" },
        { title: "b", description: "" },
      ],
      doing: [{ title: "c", description: "" }],
      done: [{ title: "d", description: "" }],
    });
  });

  it("keeps frontmatter verbatim", () => {
    const board = parse(lines("---", "cards: true", "tags: [x]", "---", "## Todo", "- a"));
    expect(board.frontmatter).toBe(lines("---", "cards: true", "tags: [x]", "---"));
  });

  it("handles empty frontmatter", () => {
    const board = parse(lines("---", "---", "## Todo", "- a"));
    expect(board.frontmatter).toBe(lines("---", "---"));
    expect(board.cards.todo).toHaveLength(1);
  });

  it("matches headings case-insensitively", () => {
    expect(parse(lines("## todo", "- a")).cards.todo).toHaveLength(1);
    expect(parse(lines("## DOING", "- a")).cards.doing).toHaveLength(1);
  });

  it("strips task checkboxes and accepts * bullets", () => {
    const board = parse(lines("## Todo", "- [ ] a", "* [x] b"));
    expect(board.cards.todo.map((c) => c.title)).toEqual(["a", "b"]);
  });

  it("ignores items under unknown headings and before any heading", () => {
    const board = parse(lines("- stray", "## Other", "- x", "## Todo", "- a"));
    expect(board.cards).toEqual({ ...emptyBoard().cards, todo: [{ title: "a", description: "" }] });
  });

  it("reads indented lines as a dedented markdown description", () => {
    const board = parse(
      lines(
        "## Todo",
        "- Write post",
        "  Draft for **Friday**, see [[Notes]]",
        "",
        "  - outline",
        "    - nested",
        "  ```js",
        "  const x = 1;",
        "  ```",
        "- Next"
      )
    );
    expect(board.cards.todo).toEqual([
      {
        title: "Write post",
        description: lines("Draft for **Friday**, see [[Notes]]", "", "- outline", "  - nested", "```js", "const x = 1;", "```"),
      },
      { title: "Next", description: "" },
    ]);
  });

  it("accepts tab-indented descriptions", () => {
    expect(parse(lines("## Todo", "- a", "\tdesc")).cards.todo[0].description).toBe("desc");
  });

  it("ends a description at unindented text", () => {
    const board = parse(lines("## Todo", "- a", "  desc", "stray", "  not desc"));
    expect(board.cards.todo).toEqual([{ title: "a", description: "desc" }]);
  });

  it("handles CRLF line endings", () => {
    const board = parse("---\r\ncards: true\r\n---\r\n## Todo\r\n- a\r\n  desc\r\n");
    expect(board.frontmatter).toBe("---\r\ncards: true\r\n---");
    expect(board.cards.todo).toEqual([{ title: "a", description: "desc" }]);
  });
});

describe("serialize", () => {
  it("writes all three sections, even when empty", () => {
    expect(serialize(emptyBoard())).toBe(lines("## Todo", "", "## Doing", "", "## Done", ""));
  });

  it("writes frontmatter and indented descriptions", () => {
    const board = emptyBoard(lines("---", "cards: true", "---"));
    board.cards.todo.push({ title: "a", description: lines("line 1", "", "- sub") });
    board.cards.done.push({ title: "b", description: "" });
    expect(serialize(board)).toBe(
      lines("---", "cards: true", "---", "## Todo", "- a", "  line 1", "", "  - sub", "", "## Doing", "", "## Done", "- b", "")
    );
  });

  it("round-trips its own output", () => {
    const md = lines("---", "cards: true", "---", "## Todo", "- a", "  **desc**", "", "  more", "", "## Doing", "", "## Done", "- b", "");
    expect(serialize(parse(md))).toBe(md);
  });
});

describe("done dates", () => {
  const TODAY = "2026-10-05";

  it("parses a trailing \u2705 date off the title", () => {
    const board = parse(lines("## Done", "- Ship it \u2705 2026-10-01", "  notes"));
    expect(board.cards.done).toEqual([{ title: "Ship it", description: "notes", done: "2026-10-01" }]);
  });

  it("accepts the emoji variation selector and tight spacing", () => {
    expect(parse(lines("## Done", "- a \u2705\uFE0F 2026-10-01")).cards.done[0]).toMatchObject({ title: "a", done: "2026-10-01" });
    expect(parse(lines("## Done", "- a\u27052026-10-01")).cards.done[0]).toMatchObject({ title: "a", done: "2026-10-01" });
  });

  it("only treats a trailing marker as the done date", () => {
    const card = parse(lines("## Todo", "- \u2705 2026-10-01 was a good day")).cards.todo[0];
    expect(card).toEqual({ title: "\u2705 2026-10-01 was a good day", description: "" });
  });

  it("keeps a title that is only a marker", () => {
    expect(parse(lines("## Done", "- \u2705 2026-10-01")).cards.done[0]).toEqual({ title: "\u2705 2026-10-01", description: "" });
  });

  it("writes the marker after the title", () => {
    const board = emptyBoard();
    board.cards.done.push({ title: "Ship it", description: "notes", done: "2026-10-01" });
    expect(serialize(board)).toContain(lines("## Done", "- Ship it \u2705 2026-10-01", "  notes"));
  });

  it("round-trips done dates", () => {
    const md = lines("## Todo", "", "## Doing", "", "## Done", "- Ship it \u2705 2026-10-01", "");
    expect(serialize(parse(md))).toBe(md);
  });

  it("stamps today when a card enters Done", () => {
    const board = parse(lines("## Doing", "- a"));
    moveCard(board, "doing", 0, "done", TODAY);
    expect(board.cards.doing).toEqual([]);
    expect(board.cards.done).toEqual([{ title: "a", description: "", done: TODAY }]);
  });

  it("clears the date when a card leaves Done", () => {
    const board = parse(lines("## Done", "- a \u2705 2026-10-01"));
    moveCard(board, "done", 0, "doing", TODAY);
    expect(board.cards.doing).toEqual([{ title: "a", description: "" }]);
    expect(serialize(board)).toContain(lines("## Doing", "- a"));
  });

  it("keeps an existing date rather than restamping", () => {
    expect(stamp({ title: "a", description: "", done: "2026-01-01" }, "done", TODAY).done).toBe("2026-01-01");
  });

  it("stamps cards added straight to Done, and nothing else", () => {
    expect(stamp({ title: "a", description: "" }, "done", TODAY).done).toBe(TODAY);
    expect(stamp({ title: "a", description: "" }, "todo", TODAY)).not.toHaveProperty("done");
  });
});

describe("reorderCard", () => {
  const titles = (md: string, move: (b: ReturnType<typeof parse>) => void) => {
    const board = parse(md);
    move(board);
    return board.cards.todo.map((c) => c.title);
  };
  const md = lines("## Todo", "- a", "- b", "- c");

  it("moves a card up", () => {
    expect(titles(md, (b) => reorderCard(b, "todo", 2, -1))).toEqual(["a", "c", "b"]);
  });

  it("moves a card down", () => {
    expect(titles(md, (b) => reorderCard(b, "todo", 0, 1))).toEqual(["b", "a", "c"]);
  });

  it("does nothing past either end", () => {
    expect(titles(md, (b) => reorderCard(b, "todo", 0, -1))).toEqual(["a", "b", "c"]);
    expect(titles(md, (b) => reorderCard(b, "todo", 2, 1))).toEqual(["a", "b", "c"]);
  });

  it("keeps descriptions and done dates with their card", () => {
    const board = parse(lines("## Done", "- a \u2705 2026-10-01", "  about a", "- b"));
    reorderCard(board, "done", 0, 1);
    expect(serialize(board)).toContain(lines("## Done", "- b", "- a \u2705 2026-10-01", "  about a"));
  });
});
