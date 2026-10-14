import { splitEmoji } from '@/src/lib/emoji';
import { Badge, Banner, Button, Checkbox, Input, Loader, Surface, Text } from '@cloudflare/kumo';
import { ArrowLeft, Check } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { MAX_WORKSPACES, db } from '@/src/db';
import { useLiveQuery } from 'dexie-react-hooks';
import type { BookmarkNode } from '@/src/lib/edge-workspace';
import { commitImport } from '@/src/lib/import/commit';
import { buildImportPlan, planStats, type ImportPlan, type PlanSource } from '@/src/lib/import/plan';

const SOURCE_LABEL: Record<PlanSource, string> = {
  bookmark_bar: '书签栏',
  other: '其他书签',
  mobile: '移动设备书签',
  edge_workspace: 'Edge 工作区',
};

export default function ImportPreview({
  onCancel, onDone, sourceTree, dedupe = false,
}: { onCancel: () => void; onDone: () => void; sourceTree?: BookmarkNode; dedupe?: boolean }) {
  const [tree, setTree] = useState<BookmarkNode[] | null>(null);
  const [includeOther, setIncludeOther] = useState(false);
  const [includeMobile, setIncludeMobile] = useState(false);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sourceTree) setTree([sourceTree]);
    else browser.bookmarks.getTree().then(setTree, (e: unknown) => setError(`读取浏览器书签失败：${String(e)}`));
  }, [sourceTree]);

  useEffect(() => {
    if (!tree?.[0]) return;
    setPlan((prev) => {
      const next = buildImportPlan(tree[0]!, { includeOther, includeMobile });
      // 保留用户已改的名称和勾选
      for (const w of next.workspaces) {
        const old = prev?.workspaces.find((p) => p.key === w.key);
        if (old) Object.assign(w, { name: old.name, emoji: old.emoji, include: old.include });
      }
      return next;
    });
  }, [tree, includeOther, includeMobile]);

  const stats = useMemo(() => (plan ? planStats(plan) : null), [plan]);
  // 工作区上限：还能新建多少个（「待整理」尚不存在时也要给它留一个位置）
  const existing = useLiveQuery(async () => ({ n: await db.workspaces.count(), inbox: (await db.workspaces.where('source').equals('inbox').count()) > 0 }), []);
  const room = existing ? Math.max(0, MAX_WORKSPACES - existing.n - (existing.inbox ? 0 : 1)) : MAX_WORKSPACES;
  const over = plan ? plan.workspaces.length > room : false;
  // 超出上限时，默认只勾选前 room 个
  useEffect(() => {
    if (!existing) return;
    setPlan((p) => {
      if (!p) return p;
      let n = 0;
      const ws = p.workspaces.map((w) => (w.include && n < room ? (n++, w) : w.include ? { ...w, include: false } : w));
      return ws.some((w, i) => w !== p.workspaces[i]) ? { ...p, workspaces: ws } : p;
    });
  }, [room, existing, plan?.workspaces.length]);

  const update = (key: string, patch: { name?: string; include?: boolean }) =>
    setPlan((p) => p && { ...p, workspaces: p.workspaces.map((w) => {
      if (w.key !== key) return w;
      if (patch.name === undefined) return { ...w, ...patch };
      // 名称里输入的 emoji 移到图标位，名称不保留 emoji
      const parsed = splitEmoji(patch.name);
      return { ...w, ...patch, name: parsed.emoji ? parsed.name : patch.name, emoji: parsed.emoji ?? w.emoji };
    }) });

  const confirm = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const res = await commitImport(db, plan, { dedupe });
      if (dedupe) window.alert(`导入完成：新增 ${res.bookmarks} 个书签，跳过 ${res.skipped} 个重复`);
      onDone();
    } catch (e) {
      setError(`写入本地数据失败：${String(e)}`);
      setBusy(false);
    }
  };

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <Banner variant="error" description={error} />
        <Button className="mt-4" icon={<ArrowLeft />} onClick={onCancel}>
          返回
        </Button>
      </main>
    );
  }
  if (!plan || !stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-8">
      <div className="flex items-center gap-2">
        <Button variant="ghost" shape="square" icon={<ArrowLeft />} onClick={onCancel} aria-label="返回" />
        <Text variant="heading" size="lg" as="h1">
          {dedupe ? '重新导入预览' : '导入预览'}
        </Text>
      </div>
      <Text variant="secondary" as="p">
        将导入 {stats.workspaces} 个工作区、{stats.drawers} 个抽屉、{stats.bookmarks} 个书签。子文件夹已全部拍平为抽屉；
        书签栏根目录的散放书签放进「待整理」。可以在这里改工作区名称或取消勾选。{dedupe ? '已存在的 URL 会自动跳过。' : ''}
      </Text>
      {over && (
        <Banner variant="alert" description={`最多 ${MAX_WORKSPACES} 个工作区，这次最多还能导入 ${room} 个，超出的已取消勾选。取消勾选别的，就能换成想要的。`} />
      )}

      {(plan.available.other > 0 || plan.available.mobile > 0 || includeOther || includeMobile) && (
        <Surface className="flex flex-col gap-2 rounded-lg p-4">
          {(includeOther || plan.available.other > 0) && <Checkbox
            label={`同时导入「其他书签」${includeOther ? '' : `（${plan.available.other} 个）`}`}
            checked={includeOther}
            onCheckedChange={(v) => setIncludeOther(Boolean(v))}
          />}
          {(includeMobile || plan.available.mobile > 0) && <Checkbox
            label={`同时导入「移动设备书签」${includeMobile ? '' : `（${plan.available.mobile} 个）`}`}
            checked={includeMobile}
            onCheckedChange={(v) => setIncludeMobile(Boolean(v))}
          />}
        </Surface>
      )}

      <div className="flex flex-col gap-2">
        {plan.workspaces.map((w) => {
          const count = w.topLevel.length + w.drawers.reduce((s, d) => s + d.bookmarks.length, 0);
          return (
            <Surface key={w.key} className={`flex items-center gap-3 rounded-lg p-3 ${w.include ? '' : 'opacity-50'}`}>
              <Checkbox
                checked={w.include}
                disabled={!w.include && stats.workspaces >= room}
                onCheckedChange={(v) => update(w.key, { include: Boolean(v) })}
                aria-label={`导入 ${w.name}`}
              />
              <span className="min-w-6 shrink-0 text-center text-lg" title="工作区图标（从名称中的 emoji 解析）">{w.emoji ?? ''}</span>
              <Input
                className="flex-1"
                size="sm"
                value={w.name}
                onChange={(e) => update(w.key, { name: e.target.value })}
                aria-label="工作区名称"
              />
              <Badge variant={w.source === 'edge_workspace' ? 'blue' : 'neutral'}>{SOURCE_LABEL[w.source]}</Badge>
              <div className="w-36 shrink-0 text-right"><Text variant="secondary" as="span">
                {w.drawers.length} 个抽屉 · {count} 个书签
              </Text></div>
            </Surface>
          );
        })}
        {plan.inbox.length > 0 && (
          <Surface className="flex items-center gap-3 rounded-lg p-3">
            <div className="flex-1"><Text as="span">
              待整理
            </Text></div>
            <Badge variant="orange">系统</Badge>
            <div className="text-right"><Text variant="secondary" as="span">
              {plan.inbox.map((d) => `${d.name} ${d.bookmarks.length}`).join(' · ')}
            </Text></div>
          </Surface>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>取消</Button>
        <Button variant="primary" icon={<Check />} loading={busy} onClick={() => void confirm()} disabled={stats.bookmarks === 0}>
          确认导入
        </Button>
      </div>
    </main>
  );
}
