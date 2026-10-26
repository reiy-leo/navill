# Getting Started

## First import

The welcome screen reads your browser bookmarks and shows a preview: how many workspaces, drawers and bookmarks it will create. You can rename workspaces or uncheck the ones you don't want.

How bookmarks map to Navill:

- Each top-level folder in the bookmarks bar becomes a **workspace**.
- Each Edge workspace becomes a workspace too, named after its first item.
- Every folder below that is **flattened into a drawer**. The drawer name keeps the path, such as `Frontend / React`.
- Bookmarks sitting directly in a top-level folder stay at the top of that workspace, above its drawers.
- Loose bookmarks in the bookmarks bar root go to **Inbox**.
- "Other bookmarks" and "Mobile bookmarks" are skipped unless you check them. Empty folders are skipped.

The import happens once. After that, Navill and the browser's bookmarks don't affect each other. You can run **Re-import** later from Settings → Data; it appends and skips URLs you already have.

## Starting without bookmarks

If the browser has no bookmarks, the welcome screen offers:

1. Restore from Google Drive (a new device with existing sync data)
2. Import a file (Navill JSON backup or a standard bookmarks HTML)
3. Create your first workspace
4. Skip and start with an empty Inbox

## Inbox

Inbox always exists and sits at the end of the workspace list. It can't be renamed or deleted. **Save current page** in the toolbar popup puts pages here.

## Getting-started tasks

A small card on the Home page lists eight things worth trying, such as searching with `/` or creating an alias. Each item ticks itself when you actually do it. Close the card with × if you don't need it; progress syncs across devices.
