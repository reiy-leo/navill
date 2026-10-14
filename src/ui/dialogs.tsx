import { limitIcon } from '@/src/lib/emoji';
import { Button, Checkbox, Input, InputArea, Text } from '@cloudflare/kumo';
import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { MODE_DEFAULT, PALETTE, db, type Drawer, type Workspace } from '@/src/db';
import { createTag, setTags, toggleTagOn, updateBookmark, updateWorkspace } from '@/src/lib/store';
import { BookmarkIcon, WorkspaceIcon } from './icons';
import { Modal } from './Modal';

export interface Target { workspaceId: string; drawerId: string | null }

interface ConfirmOpts { title: string; description?: ReactNode; okText?: string; danger?: boolean }
interface ChoiceOpts<T extends string> { title: string; description?: ReactNode; choices: Array<{ value: T; label: string; danger?: boolean }> }
interface PickOpts { title: string; allowTop?: boolean; excludeDrawerIds?: string[]; drawersOnly?: boolean; workspacesOnly?: boolean }

interface DialogsApi {
  confirm(o: ConfirmOpts): Promise<boolean>;
  choose<T extends string>(o: ChoiceOpts<T>): Promise<T | null>;
  prompt(title: string, initial?: string, placeholder?: string): Promise<string | null>;
  pickTarget(o: PickOpts): Promise<Target | null>;
  /** 当前处于非默认场景时，新建项询问可见范围；默认场景直接返回 'all' */
  askVisibility(currentModeId: string, what: string): Promise<'current' | 'all' | null>;
  editBookmark(bookmarkId: string): void;
  editWorkspace(workspaceId: string): void;
  editTags(bookmarkIds: string[]): void;
}

const Ctx = createContext<DialogsApi | null>(null);
export const useDialogs = () => useContext(Ctx)!;

type Pending =
  | { kind: 'confirm'; o: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: 'choose'; o: ChoiceOpts<string>; resolve: (v: string | null) => void }
  | { kind: 'prompt'; title: string; initial: string; placeholder?: string; resolve: (v: string | null) => void }
  | { kind: 'pick'; o: PickOpts; resolve: (v: Target | null) => void }
  | { kind: 'bookmark'; id: string }
  | { kind: 'workspace'; id: string }
  | { kind: 'tags'; ids: string[] };

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [p, setP] = useState<Pending | null>(null);
  const close = () => setP(null);

  const api = useMemo<DialogsApi>(
    () => ({
      confirm: (o) => new Promise((resolve) => setP({ kind: 'confirm', o, resolve })),
      choose: <T extends string>(o: ChoiceOpts<T>) =>
        new Promise<T | null>((resolve) => setP({ kind: 'choose', o, resolve: resolve as (v: string | null) => void })),
      prompt: (title, initial = '', placeholder) => new Promise((resolve) => setP({ kind: 'prompt', title, initial, placeholder, resolve })),
      pickTarget: (o) => new Promise((resolve) => setP({ kind: 'pick', o, resolve })),
      askVisibility: async (modeId, what) => {
        if (modeId === MODE_DEFAULT) return 'all';
        const mode = await db.modes.get(modeId);
        return new Promise((resolve) =>
          setP({
            kind: 'choose',
            o: {
              title: `新建${what}在哪些场景可见？`,
              description: `当前场景是「${mode?.name ?? ''}」。`,
              choices: [
                { value: 'current', label: '仅当前场景' },
                { value: 'all', label: '所有场景' },
              ],
            },
            resolve: resolve as (v: string | null) => void,
          }),
        );
      },
      editBookmark: (id) => setP({ kind: 'bookmark', id }),
      editWorkspace: (id) => setP({ kind: 'workspace', id }),
      editTags: (ids) => setP({ kind: 'tags', ids }),
    }),
    [],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {p?.kind === 'confirm' && (
        <Modal
          open
          size="sm"
          title={p.o.title}
          onClose={() => { p.resolve(false); close(); }}
          footer={
            <>
              <Button onClick={() => { p.resolve(false); close(); }}>取消</Button>
              <Button variant={p.o.danger ? 'destructive' : 'primary'} onClick={() => { p.resolve(true); close(); }}>
                {p.o.okText ?? '确定'}
              </Button>
            </>
          }
        >
          {p.o.description && <div className="text-sm text-kumo-subtle">{p.o.description}</div>}
        </Modal>
      )}
      {p?.kind === 'choose' && (
        <Modal open size="sm" title={p.o.title} onClose={() => { p.resolve(null); close(); }}>
          {p.o.description && <div className="mb-4 text-sm text-kumo-subtle">{p.o.description}</div>}
          <div className="grid gap-2">
            {p.o.choices.map((c) => (
              <Button key={c.value} className="w-full justify-center" variant={c.danger ? 'secondary-destructive' : 'secondary'} onClick={() => { p.resolve(c.value); close(); }}>
                {c.label}
              </Button>
            ))}
          </div>
        </Modal>
      )}
      {p?.kind === 'prompt' && <PromptDialog {...p} onDone={(v) => { p.resolve(v); close(); }} />}
      {p?.kind === 'pick' && <PickDialog o={p.o} onDone={(v) => { p.resolve(v); close(); }} />}
      {p?.kind === 'bookmark' && <EditBookmarkDialog id={p.id} onClose={close} />}
      {p?.kind === 'workspace' && <EditWorkspaceDialog id={p.id} onClose={close} />}
      {p?.kind === 'tags' && <TagsDialog ids={p.ids} onClose={close} />}
    </Ctx.Provider>
  );
}

function PromptDialog({ title, initial, placeholder, onDone }: { title: string; initial: string; placeholder?: string; onDone: (v: string | null) => void }) {
  const [v, setV] = useState(initial);
  return (
    <Modal
      open
      size="sm"
      title={title}
      onClose={() => onDone(null)}
      footer={
        <>
          <Button onClick={() => onDone(null)}>取消</Button>
          <Button variant="primary" onClick={() => onDone(v)}>确定</Button>
        </>
      }
    >
      <Input autoFocus value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onDone(v)} />
    </Modal>
  );
}

function PickDialog({ o, onDone }: { o: PickOpts; onDone: (v: Target | null) => void }) {
  const [q, setQ] = useState('');
  const data = useLiveQuery(async () => {
    const [ws, ds] = await Promise.all([db.workspaces.orderBy('order').toArray(), db.drawers.toArray()]);
    return { ws, ds };
  }, []);
  const exclude = new Set(o.excludeDrawerIds ?? []);
  const match = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());
  return (
    <Modal open title={o.title} onClose={() => onDone(null)}>
      <Input autoFocus size="sm" placeholder="筛选工作区或抽屉" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-3 flex flex-col gap-1">
        {data?.ws.map((w: Workspace) => {
          const drawers = data.ds.filter((d: Drawer) => d.workspaceId === w.id && !exclude.has(d.id)).sort((a, b) => a.order - b.order);
          const shown = drawers.filter((d) => match(d.name) || match(w.name));
          if (!match(w.name) && shown.length === 0) return null;
          const canTop = !o.drawersOnly && (o.allowTop || o.workspacesOnly);
          return (
            <div key={w.id}>
              <button
                disabled={!canTop}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-kumo-tint disabled:hover:bg-transparent"
                onClick={() => onDone({ workspaceId: w.id, drawerId: null })}
              >
                <WorkspaceIcon ws={w} size={20} />
                <span className="flex-1 truncate">{w.name}</span>
                {canTop && !o.workspacesOnly && <span className="text-xs text-kumo-subtle">顶层</span>}
              </button>
              {!o.workspacesOnly &&
                shown.map((d) => (
                  <button
                    key={d.id}
                    className="flex w-full items-center gap-2 rounded-md py-1.5 pl-9 pr-2 text-left text-sm hover:bg-kumo-tint"
                    onClick={() => onDone({ workspaceId: w.id, drawerId: d.id })}
                  >
                    <span className="truncate">{d.name}</span>
                  </button>
                ))}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function EditBookmarkDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const b = useLiveQuery(() => db.bookmarks.get(id), [id]);
  const [form, setForm] = useState<{ title: string; url: string; note: string; faviconUrl: string } | null>(null);
  if (b && !form) setForm({ title: b.title, url: b.url, note: b.note ?? '', faviconUrl: b.faviconUrl ?? '' });
  const save = async () => {
    if (!form) return;
    await updateBookmark(db, id, { title: form.title.trim() || form.url, url: form.url, note: form.note || undefined, faviconUrl: form.faviconUrl || undefined });
    onClose();
  };
  return (
    <Modal open title="编辑书签" size="lg" onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={() => void save()}>保存</Button></>}>
      {form && (
        <div className="grid gap-3">
          <div className="flex items-center gap-3">
            <BookmarkIcon url={form.url} src={form.faviconUrl} size={32} />
            <div className="flex-1"><Input label="名称" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          </div>
          <Input label="URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <Input label="图标地址（可选，留空用网站图标）" value={form.faviconUrl} onChange={(e) => setForm({ ...form, faviconUrl: e.target.value })} />
          <InputArea label="备注" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <Text variant="secondary" as="p">改动会同步到这个书签的全部分身。</Text>
        </div>
      )}
    </Modal>
  );
}

const EMOJIS: string[] = Array.from('📁💼🏠🎯📚🧠💡🛠️🧪🎨🎵🎮📷✈️🍜💰📈🗂️📝🔖⭐🔥🌱🧘🏃🎬📺🛒🧾🔒🤖💻🌐📰🗓️❤️🐱🌙☀️🚀'.match(/\p{Extended_Pictographic}\uFE0F?/gu) ?? []);

function EditWorkspaceDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const w = useLiveQuery(() => db.workspaces.get(id), [id]);
  const [form, setForm] = useState<{ name: string; emoji: string; color: string; description: string } | null>(null);
  if (w && !form) setForm({ name: w.name, emoji: w.emoji ?? '', color: w.color ?? PALETTE[0]!, description: w.description ?? '' });
  const isInbox = w?.source === 'inbox';
  const save = async () => {
    if (!form) return;
    await updateWorkspace(db, id, { name: form.name, emoji: form.emoji || undefined, color: form.color, description: form.description || undefined });
    onClose();
  };
  return (
    <Modal open title="编辑工作区" size="lg" onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={() => void save()}>保存</Button></>}>
      {form && (
        <div className="grid gap-4">
          <div className="flex items-end gap-3">
            <WorkspaceIcon ws={{ name: form.name, emoji: form.emoji, color: form.color }} size={40} />
            <div className="flex-1">
              <Input label="名称" value={form.name} disabled={isInbox} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">图标</div>
            <div className="flex flex-wrap gap-1">
              <button className={`h-8 rounded-md border px-2 text-xs ${!form.emoji ? 'border-kumo-brand' : 'border-kumo-line'}`} onClick={() => setForm({ ...form, emoji: '' })}>首字</button>
              {EMOJIS.map((e) => (
                <button key={e} className={`h-8 w-8 rounded-md border text-lg ${form.emoji === e ? 'border-kumo-brand' : 'border-transparent hover:bg-kumo-tint'}`} onClick={() => setForm({ ...form, emoji: e })}>{e}</button>
              ))}
              <Input size="sm" className="w-24" placeholder="自定义（≤2）" value={EMOJIS.includes(form.emoji) ? '' : form.emoji} onChange={(e) => setForm({ ...form, emoji: limitIcon(e.target.value) })} aria-label="自定义 emoji" />
            </div>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">颜色</div>
            <div className="flex gap-2">
              {PALETTE.map((c) => (
                <button key={c} aria-label={c} className={`h-7 w-7 rounded-full ring-offset-2 ${form.color === c ? 'ring-2 ring-kumo-brand' : ''}`} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} />
              ))}
            </div>
          </div>
          <Input label="说明（悬停提示，最多 50 字）" value={form.description} maxLength={50} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
      )}
    </Modal>
  );
}

function TagsDialog({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const tags = useLiveQuery(() => db.tags.orderBy('order').toArray(), []);
  const bookmarks = useLiveQuery(() => db.bookmarks.bulkGet(ids), [ids.join()]);
  const [name, setName] = useState('');
  const busy = useRef(false);
  const single = ids.length === 1;
  const state = useCallback(
    (tagId: string) => {
      const list = (bookmarks ?? []).filter(Boolean);
      const n = list.filter((b) => b!.tagIds.includes(tagId)).length;
      return n === 0 ? false : n === list.length ? true : 'some';
    },
    [bookmarks],
  );
  const toggle = async (tagId: string, on: boolean) => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (single) {
        const b = bookmarks?.[0];
        if (b) await setTags(db, b.id, on ? [...b.tagIds, tagId] : b.tagIds.filter((x) => x !== tagId));
      } else {
        await toggleTagOn(db, ids, tagId, on);
      }
    } finally {
      busy.current = false;
    }
  };
  const add = async () => {
    if (!name.trim()) return;
    const t = await createTag(db, name);
    setName('');
    await toggle(t.id, true);
  };
  return (
    <Modal open title={single ? '标签' : `为 ${ids.length} 个书签设置标签`} onClose={onClose} footer={<Button variant="primary" onClick={onClose}>完成</Button>}>
      <div className="grid gap-2">
        {tags?.map((t) => {
          const s = state(t.id);
          return (
            <Checkbox key={t.id} label={`#${t.name}`} checked={s === true} indeterminate={s === 'some'} onCheckedChange={(v) => void toggle(t.id, Boolean(v))} />
          );
        })}
        <div className="mt-2 flex gap-2">
          <Input size="sm" className="flex-1" placeholder="新建标签" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void add()} />
          <Button size="sm" onClick={() => void add()}>添加</Button>
        </div>
      </div>
    </Modal>
  );
}
