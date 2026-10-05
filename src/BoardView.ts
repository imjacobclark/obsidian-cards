import {
  App,
  Component,
  Keymap,
  MarkdownRenderer,
  Menu,
  Modal,
  Setting,
  TextFileView,
  WorkspaceLeaf,
  moment,
  setIcon,
} from "obsidian";
import { Board, Card, STATUSES, Status, TITLES, descriptionPreview, emptyBoard, moveCard, parse, reorderCard, serialize, stamp } from "./board";
import type CardsPlugin from "./main";

export const VIEW_TYPE = "cards-board";

type CardText = Pick<Card, "title" | "description">;

const today = () => moment().format("YYYY-MM-DD");

export class BoardView extends TextFileView {
  private board: Board = emptyBoard();
  // Owns the rendered markdown of one render pass; replaced on every re-render.
  private renderScope: Component | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: CardsPlugin) {
    super(leaf);
    this.addAction("file-text", "Open as markdown", () => this.plugin.openAsMarkdown(this.leaf));
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.file?.basename ?? "Board";
  }

  getIcon(): string {
    return "layout-dashboard";
  }

  getViewData(): string {
    return serialize(this.board);
  }

  setViewData(data: string): void {
    this.board = parse(data);
    this.render();
  }

  clear(): void {
    this.board = emptyBoard();
    this.resetRenderScope();
    this.contentEl.empty();
  }

  private update(fn: (board: Board) => void): void {
    fn(this.board);
    this.render();
    this.requestSave();
  }

  private move(from: Status, index: number, to: Status): void {
    this.update((b) => moveCard(b, from, index, to, today()));
  }

  private resetRenderScope(): Component {
    if (this.renderScope) this.removeChild(this.renderScope);
    this.renderScope = this.addChild(new Component());
    return this.renderScope;
  }

  private render(): void {
    const scope = this.resetRenderScope();
    const sourcePath = this.file?.path ?? "";
    this.contentEl.empty();
    const boardEl = this.contentEl.createDiv({ cls: "cards-board" });

    STATUSES.forEach((status, col) => {
      const cards = this.board.cards[status];
      const prev = STATUSES[col - 1];
      const next = STATUSES[col + 1];

      const colEl = boardEl.createDiv({ cls: "cards-column" });
      const header = colEl.createDiv({ cls: "cards-column-header" });
      header.createSpan({ cls: "cards-column-title", text: TITLES[status] });
      header.createSpan({ cls: "cards-column-count", text: String(cards.length) });
      iconButton(header, "plus", "Add card", () =>
        new CardModal(this.app, null, (card) =>
          this.update((b) => b.cards[status].push(stamp(card, status, today())))
        ).open()
      );

      const list = colEl.createDiv({ cls: "cards-list" });
      cards.forEach((card, i) => {
        const cardEl = list.createDiv({ cls: "cards-card" });
        const body = cardEl.createDiv({ cls: "cards-card-body" });
        body.createDiv({ cls: "cards-card-title", text: card.title });
        if (card.done) body.createDiv({ cls: "cards-card-done", text: `\u2705 ${card.done}` });
        const preview = descriptionPreview(card.description);
        if (preview.line) {
          const descEl = body.createDiv({ cls: "cards-card-description markdown-rendered" });
          descEl.toggleClass("has-more", preview.more);
          void MarkdownRenderer.render(this.app, preview.line, descEl, sourcePath, scope);
        }
        body.addEventListener("click", (evt) => {
          const link = (evt.target as HTMLElement).closest("a");
          if (link) {
            if (link.hasClass("internal-link")) {
              evt.preventDefault();
              const href = link.dataset.href ?? link.getAttr("href") ?? "";
              void this.app.workspace.openLinkText(href, sourcePath, Keymap.isModEvent(evt));
            }
            return;
          }
          // Also stops rendered checkboxes toggling; the modal is the one place to edit.
          evt.preventDefault();
          new CardModal(this.app, card, (c) => this.update((b) => (b.cards[status][i] = { ...card, ...c }))).open();
        });

        // Unavailable buttons stay in place but hidden, so buttons line up across cards.
        const order = cardEl.createDiv({ cls: "cards-card-actions cards-card-order" });
        iconButton(order, "arrow-up", "Move up", () => this.update((b) => reorderCard(b, status, i, -1)), i > 0);
        iconButton(order, "arrow-down", "Move down", () => this.update((b) => reorderCard(b, status, i, 1)), i < cards.length - 1);

        const moves = cardEl.createDiv({ cls: "cards-card-actions cards-card-moves" });
        iconButton(moves, "arrow-left", prev ? `Move to ${TITLES[prev]}` : "", () => prev && this.move(status, i, prev), !!prev);
        iconButton(moves, "arrow-right", next ? `Move to ${TITLES[next]}` : "", () => next && this.move(status, i, next), !!next);

        onContextMenu(cardEl, (menu) =>
          menu.addItem((item) =>
            item
              .setTitle("Delete card")
              .setIcon("trash-2")
              .setWarning(true)
              .onClick(() => this.update((b) => b.cards[status].splice(i, 1)))
          )
        );
      });
    });
  }
}

function iconButton(parent: HTMLElement, icon: string, label: string, onClick: () => void, enabled = true): void {
  const button = parent.createEl("button", { cls: "clickable-icon cards-button", attr: { "aria-label": label } });
  setIcon(button, icon);
  button.disabled = !enabled;
  button.addEventListener("click", onClick);
}

const LONG_PRESS_MS = 500;

// Right-click on desktop; long-press on touch, where iOS sends no contextmenu event.
function onContextMenu(el: HTMLElement, build: (menu: Menu) => void): void {
  let lastShown = 0;
  const show = (x: number, y: number) => {
    // Android sends contextmenu on long-press as well, so don't open the menu twice.
    if (Date.now() - lastShown < 1000) return;
    lastShown = Date.now();
    const menu = new Menu();
    build(menu);
    menu.showAtPosition({ x, y });
  };

  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    show(e.clientX, e.clientY);
  });

  let timer: number | null = null;
  let pressed = false;
  const cancel = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  };
  el.addEventListener(
    "touchstart",
    (e) => {
      pressed = false;
      const { clientX, clientY } = e.touches[0];
      cancel();
      timer = window.setTimeout(() => {
        pressed = true;
        show(clientX, clientY);
      }, LONG_PRESS_MS);
    },
    { passive: true }
  );
  el.addEventListener("touchmove", cancel, { passive: true });
  el.addEventListener("touchcancel", cancel);
  el.addEventListener("touchend", (e) => {
    cancel();
    // Swallow the tap that ends a long-press so it doesn't also open the card.
    if (pressed) e.preventDefault();
  });
}

class CardModal extends Modal {
  constructor(app: App, private card: CardText | null, private onSubmit: (card: CardText) => void) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(this.card ? "Edit card" : "New card");
    this.modalEl.addClass("cards-modal");

    const title = this.contentEl.createEl("input", {
      type: "text",
      cls: "cards-modal-title",
      value: this.card?.title ?? "",
      attr: { placeholder: "Title" },
    });
    const description = this.contentEl.createEl("textarea", {
      cls: "cards-modal-description",
      attr: { placeholder: "Description (markdown)", rows: "8" },
    });
    description.value = this.card?.description ?? "";

    const submit = () => {
      const text = title.value.replace(/\s+/g, " ").trim();
      if (text) this.onSubmit({ title: text, description: cleanDescription(description.value) });
      this.close();
    };

    title.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        submit();
      }
    });
    // Enter adds a newline in the description; Cmd/Ctrl+Enter saves from anywhere.
    this.scope.register(["Mod"], "Enter", () => {
      submit();
      return false;
    });
    new Setting(this.contentEl).addButton((b) => b.setButtonText("Save").setCta().onClick(submit));
    title.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

function cleanDescription(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/^(?:[ \t]*\n)+/, "").trimEnd();
}
