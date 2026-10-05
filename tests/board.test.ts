import { describe, expect, it } from "vitest";
import { emptyBoard, parse, serialize } from "../src/board";

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
