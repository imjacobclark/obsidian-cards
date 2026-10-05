import { MarkdownView, Plugin, TFile, WorkspaceLeaf, normalizePath } from "obsidian";
import { BoardView, VIEW_TYPE } from "./BoardView";

const TEMPLATE = "---\ncards: true\n---\n## Todo\n\n## Doing\n\n## Done\n";

export default class CardsPlugin extends Plugin {
  // Leaf -> file path the user explicitly switched to markdown, so auto-open leaves it alone.
  private markdownLeaves = new WeakMap<WorkspaceLeaf, string>();

  async onload(): Promise<void> {
    this.registerView(VIEW_TYPE, (leaf) => new BoardView(leaf, this));

    this.addRibbonIcon("square-kanban", "Create new board", () => this.createBoard());

    this.addCommand({
      id: "create-board",
      name: "Create new board",
      callback: () => this.createBoard(),
    });

    this.addCommand({
      id: "toggle-view",
      name: "Toggle board / markdown view",
      checkCallback: (checking) => {
        const { workspace } = this.app;
        const view = workspace.getActiveViewOfType(BoardView) ?? workspace.getActiveViewOfType(MarkdownView);
        if (!view?.file) return false;
        if (!checking) {
          if (view instanceof BoardView) this.openAsMarkdown(view.leaf);
          else this.openAsBoard(view.leaf, view.file);
        }
        return true;
      },
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file, _source, leaf) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        menu.addItem((item) =>
          item
            .setTitle("Open as board")
            .setIcon("square-kanban")
            .onClick(() => this.openAsBoard(leaf ?? this.app.workspace.getLeaf(false), file))
        );
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (!file || !this.isBoard(file)) return;
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || view.file !== file) return;
        if (this.markdownLeaves.get(view.leaf) === file.path) return;
        this.openAsBoard(view.leaf, file);
      })
    );
  }

  isBoard(file: TFile): boolean {
    return this.app.metadataCache.getFileCache(file)?.frontmatter?.cards === true;
  }

  async openAsBoard(leaf: WorkspaceLeaf, file: TFile): Promise<void> {
    this.markdownLeaves.delete(leaf);
    await leaf.setViewState({ type: VIEW_TYPE, state: { file: file.path }, active: true });
  }

  async openAsMarkdown(leaf: WorkspaceLeaf): Promise<void> {
    const file = leaf.view instanceof BoardView ? leaf.view.file : null;
    if (!file) return;
    this.markdownLeaves.set(leaf, file.path);
    await leaf.setViewState({ type: "markdown", state: { file: file.path }, active: true });
  }

  async createBoard(): Promise<void> {
    const { vault, fileManager, workspace } = this.app;
    const folder = fileManager.getNewFileParent(workspace.getActiveFile()?.path ?? "");
    let path: string;
    let n = 0;
    do {
      path = normalizePath(`${folder.path}/Board${n ? ` ${n}` : ""}.md`);
      n++;
    } while (vault.getAbstractFileByPath(path));

    const file = await vault.create(path, TEMPLATE);
    await this.openAsBoard(workspace.getLeaf("tab"), file);
  }
}
