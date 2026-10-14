import { Button, Empty, Surface, Text } from '@cloudflare/kumo';
import { ArrowsClockwise, Tray } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db, type Bookmark, type Drawer, type Placement } from '@/src/db';
import { faviconUrl } from '@/src/lib/favicon';

// M1 只读浏览视图，用于验证导入结果；M2 替换为完整的新标签页
export default function Browse({ onReimport }: { onReimport: () => void }) {
  const workspaces = useLiveQuery(() => db.workspaces.orderBy('order').toArray(), []);
  const [selected, setSelected] = useState<string | null>(null);
  const current = workspaces?.find((w) => w.id === selected) ?? workspaces?.[0];

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-kumo-line p-3">
        <div className="px-2 pb-2"><Text variant="heading" as="h1">
          Navill
        </Text></div>
        {workspaces?.map((w) => (
          <Button
            key={w.id}
            variant={w.id === current?.id ? 'secondary' : 'ghost'}
            className="w-full justify-start"
            icon={w.source === 'inbox' ? <Tray /> : undefined}
            onClick={() => setSelected(w.id)}
          >
            {w.name}
          </Button>
        ))}
        <div className="mt-auto pt-3">
          <Button variant="ghost" size="sm" icon={<ArrowsClockwise />} onClick={onReimport}>
            再次导入
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{current && <WorkspaceView workspaceId={current.id} />}</main>
    </div>
  );
}

function WorkspaceView({ workspaceId }: { workspaceId: string }) {
  const data = useLiveQuery(async () => {
    const [drawers, placements] = await Promise.all([
      db.drawers.where('workspaceId').equals(workspaceId).sortBy('order'),
      db.placements.where('workspaceId').equals(workspaceId).sortBy('order'),
    ]);
    const bookmarks = await db.bookmarks.bulkGet(placements.map((p) => p.bookmarkId));
    const byId = new Map(bookmarks.filter(Boolean).map((b) => [b!.id, b!]));
    return { drawers, placements, byId };
  }, [workspaceId]);

  if (!data) return null;
  const { drawers, placements, byId } = data;
  const top = placements.filter((p) => p.drawerId === null);

  if (top.length === 0 && drawers.length === 0) {
    return <Empty icon={<Tray size={40} />} title="都整理好了" description="这里还没有书签。" />;
  }

  return (
    <div className="flex flex-col gap-6">
      {top.length > 0 && <BookmarkGrid placements={top} byId={byId} />}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {drawers.map((d) => (
          <DrawerCard key={d.id} drawer={d} placements={placements.filter((p) => p.drawerId === d.id)} byId={byId} />
        ))}
      </div>
    </div>
  );
}

function DrawerCard({ drawer, placements, byId }: { drawer: Drawer; placements: Placement[]; byId: Map<string, Bookmark> }) {
  return (
    <Surface className="flex flex-col gap-2 rounded-lg p-3">
      <div className="flex items-baseline justify-between gap-2">
        <Text variant="heading" as="h2" truncate>
          {drawer.name}
        </Text>
        <Text variant="secondary" as="span">
          {placements.length}
        </Text>
      </div>
      <BookmarkGrid placements={placements} byId={byId} />
    </Surface>
  );
}

function BookmarkGrid({ placements, byId }: { placements: Placement[]; byId: Map<string, Bookmark> }) {
  return (
    <ul className="flex flex-col">
      {placements.map((p) => {
        const b = byId.get(p.bookmarkId);
        if (!b) return null;
        return (
          <li key={p.id}>
            <a
              href={b.url}
              title={b.url}
              className="flex items-center gap-2 rounded px-2 py-1 text-kumo-default no-underline hover:bg-kumo-tint"
            >
              <img src={faviconUrl(b.url)} alt="" width={16} height={16} className="shrink-0" />
              <span className="truncate">{b.title}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
