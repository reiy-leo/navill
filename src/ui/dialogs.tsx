import { ShareDialog } from './ShareDialog';
import { Check, Plus, Trash } from '@phosphor-icons/react';
import { limitIcon } from '@/src/lib/emoji';
import { Button, Checkbox, Input, InputArea, Text } from '@cloudflare/kumo';
import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { MODE_DEFAULT, PALETTE, db, type Drawer, type Workspace } from '@/src/db';
import { createTag, setTags, toggleTagOn, updateBookmark, updateDrawer, updateWorkspace } from '@/src/lib/store';
import { BookmarkIcon, WorkspaceIcon } from './icons';
import { Modal } from './Modal';
import { InfoTip } from './InfoTip';
import { ColorPicker, ColorSwatch, IconBox } from './ColorPicker';
import { useTone } from './colors';
import { LucidePicker } from './LucidePicker';
import { useIconStyle } from './iconStyle';
import { HistoryAutocomplete, useHistoryPermission } from './HistoryAutocomplete';

export interface Target { workspaceId: string; drawerId: string | null; name?: string }

interface ConfirmOpts { title: string; description?: ReactNode; okText?: string; danger?: boolean }
interface ChoiceOpts<T extends string> { title: string; description?: ReactNode; choices: Array<{ value: T; label: string; danger?: boolean }> }
interface PickOpts { title: string; allowTop?: boolean; excludeDrawerIds?: string[]; drawersOnly?: boolean; workspacesOnly?: boolean; /** 顶部显示名称输入框，初始值为此；此时列表改为单选 + 底部按钮 */ name?: string; okText?: string }

interface DialogsApi {
  confirm(o: ConfirmOpts): Promise<boolean>;
  choose<T extends string>(o: ChoiceOpts<T>): Promise<T | null>;
  prompt(title: string, initial?: string, placeholder?: string): Promise<string | null>;
  pickTarget(o: PickOpts): Promise<Target | null>;
  /** 新建工作区/抽屉：名称 + 图标框右上角小圆点选颜色 */
  create(what: '工作区' | '抽屉', color: string): Promise<{ name: string; color: string; description: string } | null>;
  drawerColor(drawerId: string): void;
  /** 当前处于非默认场景时，新建项询问可见范围；默认场景直接返回 'all' */
  askVisibility(currentModeId: string, what: string): Promise<'current' | 'all' | null>;
  /** 新建书签：名称 + URL，支持浏览记录补全 */
  newBookmark(): Promise<{ url: string; title: string } | null>;
  editBookmark(bookmarkId: string): void;
  editWorkspace(workspaceId: string): void;
  editTags(bookmarkIds: string[]): void;
  share(kind: 'workspace' | 'drawer', id: string, name: string): void;
}

const Ctx = createContext<DialogsApi | null>(null);
export const useDialogs = () => useContext(Ctx)!;

type Pending =
  | { kind: 'confirm'; o: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: 'choose'; o: ChoiceOpts<string>; resolve: (v: string | null) => void }
  | { kind: 'prompt'; title: string; initial: string; placeholder?: string; resolve: (v: string | null) => void }
  | { kind: 'pick'; o: PickOpts; resolve: (v: Target | null) => void }
  | { kind: 'create'; what: string; color: string; resolve: (v: { name: string; color: string; description: string } | null) => void }
  | { kind: 'drawer'; id: string }
  | { kind: 'newBookmark'; resolve: (v: { url: string; title: string } | null) => void }
  | { kind: 'bookmark'; id: string }
  | { kind: 'workspace'; id: string }
  | { kind: 'tags'; ids: string[] }
  | { kind: 'share'; what: 'workspace' | 'drawer'; id: string; name: string };

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [p, setP] = useState<Pending | null>(null);
  const close = () => setP(null);

  const api = useMemo<DialogsApi>(
    () => ({
      confirm: (o) => new Promise((resolve) => setP({ kind: 'confirm', o, resolve })),
      choose: <T extends string>(o: ChoiceOpts<T>) =>
        new Promise<T | null>((resolve) => setP({ kind: 'choose', o, resolve: resolve as (v: string | null) => void })),
      prompt: (title, initial = '', placeholder) => new Promise((resolve) => setP({ kind: 'prompt', title, initial, placeholder, resolve })),
      create: (what, color) => new Promise((resolve) => setP({ kind: 'create', what, color, resolve })),
      newBookmark: () => new Promise((resolve) => setP({ kind: 'newBookmark', resolve })),
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
      drawerColor: (id) => setP({ kind: 'drawer', id }),
      editTags: (ids) => setP({ kind: 'tags', ids }),
      share: (what, id, name) => setP({ kind: 'share', what, id, name }),
    }),
    [],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {p?.kind === 'share' && <ShareDialog kind={p.what} sourceId={p.id} name={p.name} onClose={close} />}
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
      {p?.kind === 'create' && <CreateDialog what={p.what} color={p.color} onDone={(v) => { p.resolve(v); close(); }} />}
      {p?.kind === 'pick' && <PickDialog o={p.o} onDone={(v) => { p.resolve(v); close(); }} />}
      {p?.kind === 'newBookmark' && <NewBookmarkDialog onDone={(v) => { p.resolve(v); close(); }} />}
      {p?.kind === 'bookmark' && <EditBookmarkDialog id={p.id} onClose={close} />}
      {p?.kind === 'drawer' && <DrawerColorDialog id={p.id} onClose={close} />}
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
      form
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

/** 名称与说明：两个普通输入框，无 label、无提示小字 */
function NameFields({ name, description, onName, onDescription, what, disabled, onEnter }: { name: string; description: string; onName: (v: string) => void; onDescription: (v: string) => void; what: string; disabled?: boolean; onEnter?: () => void }) {
  return (
    <div className="grid min-w-0 flex-1 gap-2">
      <Input autoFocus value={name} disabled={disabled} placeholder={`${what}名称`} aria-label={`${what}名称`} onChange={(e) => onName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && onEnter?.()} />
      <Input
        size="sm" className="!h-7 !text-xs"
        value={description} maxLength={50} placeholder="说明" aria-label={`${what}说明`}
        onChange={(e) => onDescription(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && onEnter?.()}
      />
    </div>
  );
}

function CreateDialog({ what, color: initColor, onDone }: { what: string; color: string; onDone: (v: { name: string; color: string; description: string } | null) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(initColor);
  const ok = () => onDone({ name, color, description });
  return (
    <Modal open size="sm" form title={`新建${what}`} onClose={() => onDone(null)} footer={<><Button onClick={() => onDone(null)}>取消</Button><Button variant="primary" onClick={ok}>确定</Button></>}>
      <div className="flex items-start gap-3">
        {what === '抽屉' ? <ColorSwatch color={color} onColor={setColor} label="抽屉颜色" /> : (
          <IconBox color={color} onColor={setColor} label={`${what}颜色`}>
            <WorkspaceIcon ws={{ name: name || what, color }} size={36} style="emoji" />
          </IconBox>
        )}
        <NameFields what={what} name={name} description={description} onName={setName} onDescription={setDescription} onEnter={ok} />
      </div>
    </Modal>
  );
}

/** 抽屉菜单「指定颜色」：点一个颜色立即生效；「跟随工作区」清除抽屉自己的颜色 */
function DrawerColorDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const d = useLiveQuery(() => db.drawers.get(id), [id]);
  const set = async (color: string | undefined) => {
    await updateDrawer(db, id, { color });
    onClose();
  };
  return (
    <Modal open size="sm" title="指定颜色" onClose={onClose} footer={<><Button disabled={!d?.color} onClick={() => void set(undefined)}>跟随工作区</Button><Button onClick={onClose}>取消</Button></>}>
      {d && <ColorPicker label="抽屉颜色" value={d.color} onChange={(hex) => void set(hex)} />}
    </Modal>
  );
}

function PickDialog({ o, onDone }: { o: PickOpts; onDone: (v: Target | null) => void }) {
  const [q, setQ] = useState('');
  const [name, setName] = useState(o.name ?? '');
  const hasName = o.name !== undefined;
  const [sel, setSel] = useState<string | null>(null);
  const data = useLiveQuery(async () => {
    const [ws, ds] = await Promise.all([db.workspaces.orderBy('order').toArray(), db.drawers.filter((d) => !d.archivedAt).toArray()]);
    return { ws, ds };
  }, []);
  const selId = sel ?? data?.ws[0]?.id ?? null;
  const ok = () => selId && onDone({ workspaceId: selId, drawerId: null, name: name.trim() || o.name });
  const done = (t: Target) => (hasName ? setSel(t.workspaceId) : onDone(t));
  const exclude = new Set(o.excludeDrawerIds ?? []);
  const match = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());
  return (
    <Modal
      open
      title={o.title}
      onClose={() => onDone(null)}
      footer={hasName ? <><Button onClick={() => onDone(null)}>取消</Button><Button variant="primary" disabled={!selId} onClick={ok}>{o.okText ?? '确定'}</Button></> : undefined}
    >
      {hasName ? (
        <Input autoFocus size="sm" label="抽屉名称" placeholder={o.name} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && ok()} />
      ) : (
        <Input autoFocus size="sm" placeholder="筛选工作区或抽屉" value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      {hasName && <div className="mt-4 mb-1 text-xs text-kumo-subtle">安装到</div>}
      <div className={hasName ? 'flex max-h-[184px] flex-col gap-1 overflow-y-auto [scrollbar-width:thin]' : 'mt-3 flex flex-col gap-1'}>
        {data?.ws.map((w: Workspace) => {
          const drawers = data.ds.filter((d: Drawer) => d.workspaceId === w.id && !exclude.has(d.id)).sort((a, b) => a.order - b.order);
          const shown = drawers.filter((d) => match(d.name) || match(w.name));
          if (!match(w.name) && shown.length === 0) return null;
          const canTop = !o.drawersOnly && (o.allowTop || o.workspacesOnly);
          return (
            <div key={w.id}>
              <button
                disabled={!canTop}
                className={`flex w-full shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-kumo-tint disabled:hover:bg-transparent ${hasName && selId === w.id ? 'bg-kumo-tint' : ''}`}
                onClick={() => done({ workspaceId: w.id, drawerId: null })}
              >
                <WorkspaceIcon ws={w} size={20} />
                <span className="flex-1 truncate">{w.name}</span>
                {hasName && selId === w.id && <Check size={14} className="text-kumo-brand" />}
                {canTop && !o.workspacesOnly && <span className="text-xs text-kumo-subtle">顶层</span>}
              </button>
              {!o.workspacesOnly &&
                shown.map((d) => (
                  <button
                    key={d.id}
                    className="flex w-full items-center gap-2 rounded-md py-1.5 pl-9 pr-2 text-left text-sm hover:bg-kumo-tint"
                    onClick={() => done({ workspaceId: w.id, drawerId: d.id })}
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

function NewBookmarkDialog({ onDone }: { onDone: (v: { url: string; title: string } | null) => void }) {
  const [form, setForm] = useState({ title: '', url: '' });
  const history = useHistoryPermission();
  const ok = form.url.trim().length > 0;
  return (
    <Modal open form title="新建书签" onClose={() => onDone(null)} footer={<><Button onClick={() => onDone(null)}>取消</Button><Button variant="primary" disabled={!ok} onClick={() => onDone(form)}>添加</Button></>}>
      <div className="grid gap-3" onKeyDown={(e) => { if (e.key === 'Enter' && ok && !(e.target as HTMLElement).closest('[aria-expanded=true]')) onDone(form); }}>
        <div className="flex items-end gap-3">
          <div className="flex h-9 shrink-0 items-center"><BookmarkIcon url={form.url || 'https://'} size={32} /></div>
          <div className="min-w-0 flex-1"><HistoryAutocomplete label="名称" placeholder="可留空，用网页标题" enabled={history.granted} value={form.title} onChange={(title) => setForm({ ...form, title })} onPick={(s) => setForm({ title: s.title || form.title, url: s.url })} /></div>
        </div>
        <HistoryAutocomplete label="URL" placeholder="https://" enabled={history.granted} description={history.hint} value={form.url} onChange={(url) => setForm({ ...form, url })} onPick={(s) => setForm({ url: s.url, title: form.title.trim() ? form.title : s.title })} />
      </div>
    </Modal>
  );
}

function EditBookmarkDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const b = useLiveQuery(() => db.bookmarks.get(id), [id]);
  const history = useHistoryPermission();
  const [form, setForm] = useState<{ title: string; url: string; note: string; faviconUrl: string; links: { url: string; title: string }[] } | null>(null);
  if (b && !form) setForm({ title: b.title, url: b.url, note: b.note ?? '', faviconUrl: b.faviconUrl ?? '', links: (b.links ?? []).map((l) => ({ url: l.url, title: l.title ?? '' })) });
  const setLink = (i: number, patch: Partial<{ url: string; title: string }>) =>
    form && setForm({ ...form, links: form.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const save = async () => {
    if (!form) return;
    await updateBookmark(db, id, { title: form.title.trim() || form.url, url: form.url, note: form.note || undefined, faviconUrl: form.faviconUrl || undefined, links: form.links });
    onClose();
  };
  return (
    <Modal open form title={<span className="flex items-center gap-1">编辑书签<InfoTip>改动会同步到这个书签的全部分身。</InfoTip></span>} size="lg" onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={() => void save()}>保存</Button></>}>
      {form && (
        <div className="grid gap-3">
          <div className="flex items-end gap-3">
            <div className="flex h-9 shrink-0 items-center"><BookmarkIcon url={form.url} src={form.faviconUrl} size={32} /></div>
            <div className="min-w-0 flex-1"><HistoryAutocomplete label="名称" enabled={history.granted} value={form.title} onChange={(title) => setForm({ ...form, title })} onPick={(s) => setForm({ ...form, title: s.title || form.title, url: s.url })} /></div>
          </div>
          <HistoryAutocomplete label="URL" enabled={history.granted} description={history.hint} value={form.url} onChange={(url) => setForm({ ...form, url })} onPick={(s) => setForm({ ...form, url: s.url, title: form.title.trim() ? form.title : s.title })} />
          <Input label="图标地址" placeholder="留空用网站图标" value={form.faviconUrl} onChange={(e) => setForm({ ...form, faviconUrl: e.target.value })} />
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-sm font-medium">关联链接<InfoTip>同一个书签的其他地址，如 GitHub、文档、社交账号。添加后图标右上角出现小红点，点击即可展开。</InfoTip></span>
              <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => setForm({ ...form, links: [...form.links, { url: '', title: '' }] })}>添加</Button>
            </div>
            {form.links.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input className="w-32" placeholder="名称" aria-label="关联链接名称" value={l.title} onChange={(e) => setLink(i, { title: e.target.value })} />
                <div className="min-w-0 flex-1"><Input placeholder="https://" aria-label="关联链接地址" value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} /></div>
                <Button size="sm" variant="ghost" shape="square" icon={<Trash />} aria-label="删除关联链接" onClick={() => setForm({ ...form, links: form.links.filter((_, j) => j !== i) })} />
              </div>
            ))}
          </div>
          <InputArea label="备注" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
      )}
    </Modal>
  );
}

/** 字符图标最多 2 个字（输入法组字期间不截断，失焦和保存时再截） */
const limitGlyph = (v: string) => Array.from(v.trim()).slice(0, 2).join('');

const EMOJIS: string[] = Array.from('📁💼🏠🎯📚🧠💡🛠️🧪🎨🎵🎮📷✈️🍜💰📈🗂️📝🔖⭐🔥🌱🧘🏃🎬📺🛒🧾🔒🤖💻🌐📰🗓️❤️🐱🌙☀️🚀'.match(/\p{Extended_Pictographic}\uFE0F?/gu) ?? []);

function EditWorkspaceDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const w = useLiveQuery(() => db.workspaces.get(id), [id]);
  const globalStyle = useIconStyle();
  const [tab, setTab] = useState<'emoji' | 'lucide' | 'char'>(globalStyle);
  const [form, setForm] = useState<{ name: string; emoji: string; lucide?: string; glyph: string; color: string; description: string } | null>(null);
  if (w && !form) setForm({ name: w.name, emoji: w.emoji ?? '', lucide: w.lucide, glyph: w.glyph ?? '', color: w.color ?? PALETTE[0]!, description: w.description ?? '' });
  const isInbox = w?.source === 'inbox';
  const pickTone = useTone(form?.color) ?? '#8d8d86';
  const save = async () => {
    if (!form) return;
    await updateWorkspace(db, id, { name: form.name, emoji: form.emoji || undefined, lucide: form.lucide, glyph: limitGlyph(form.glyph) || undefined, color: form.color, description: form.description || undefined });
    onClose();
  };
  return (
    <Modal open form title="编辑工作区" size="lg" onClose={onClose} footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={() => void save()}>保存</Button></>}>
      {form && (
        <div className="grid gap-4">
          <div className="flex items-start gap-3">
            <IconBox color={form.color} onColor={(color) => setForm({ ...form, color })} label="工作区颜色">
              <WorkspaceIcon ws={{ name: form.name, emoji: form.emoji, lucide: form.lucide, glyph: form.glyph, color: form.color }} size={36} style={tab} />
            </IconBox>
            <NameFields what="工作区" name={form.name} disabled={isInbox} description={form.description} onName={(name) => setForm({ ...form, name })} onDescription={(description) => setForm({ ...form, description })} onEnter={() => void save()} />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="flex gap-1">
                <Button size="xs" variant={tab === 'emoji' ? 'secondary' : 'ghost'} onClick={() => setTab('emoji')}>Emoji</Button>
                <Button size="xs" variant={tab === 'lucide' ? 'secondary' : 'ghost'} onClick={() => setTab('lucide')}>线性图标</Button>
                <Button size="xs" variant={tab === 'char' ? 'secondary' : 'ghost'} onClick={() => setTab('char')}>字符</Button>
              </span>
              <InfoTip>三种都会保存，显示哪种在「设置 → 外观」切换。字符留空时用名称首字。</InfoTip>
            </div>
            {tab === 'char' ? (
              <Input
                className="w-40" placeholder={Array.from(form.name.trim())[0] ?? '字'} aria-label="字符图标" value={form.glyph}
                onChange={(e) => setForm({ ...form, glyph: e.target.value })}
                onBlur={() => setForm({ ...form, glyph: limitGlyph(form.glyph) })}
              />
            ) : tab === 'lucide' ? <LucidePicker color={form.color} value={form.lucide} onChange={(lucide) => setForm({ ...form, lucide })} /> : (
            <div className="flex flex-wrap gap-1">
              {EMOJIS.map((e) => (
                <Button key={e} size="sm" shape="square" variant="ghost" className={`text-lg ${form.emoji === e ? 'nv-pick-on nv-pick-soft' : 'nv-pick'}`} style={{ '--pick': pickTone } as React.CSSProperties} aria-label={e} onClick={() => setForm({ ...form, emoji: form.emoji === e ? '' : e })}>{e}</Button>
              ))}
              <Input size="sm" className="w-24" placeholder="自定义" value={EMOJIS.includes(form.emoji) ? '' : form.emoji} onChange={(e) => setForm({ ...form, emoji: limitIcon(e.target.value) })} aria-label="自定义 emoji" />
            </div>)}
          </div>
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
    <Modal open size="sm" title={single ? '标签' : `为 ${ids.length} 个书签设置标签`} onClose={onClose}>
      <div className="flex flex-wrap gap-2">
        {tags?.map((t) => {
          const s = state(t.id);
          const on = s === true;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => void toggle(t.id, !on)}
              className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-sm transition-colors ${
                on
                  ? 'border-transparent bg-kumo-brand text-white'
                  : s === 'some'
                    ? 'border-dashed border-kumo-brand text-kumo-brand'
                    : 'border-kumo-line text-kumo-default hover:bg-kumo-tint'
              }`}
            >
              {on && <Check size={14} weight="bold" />}
              <span>#{t.name}</span>
            </button>
          );
        })}
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
          onBlur={() => void add()}
          placeholder="+ 新建标签"
          aria-label="新建标签"
          className="h-8 w-28 rounded-full border border-dashed border-kumo-line bg-transparent px-3 text-sm outline-none placeholder:text-kumo-subtle focus:w-40 focus:border-kumo-brand transition-[width,border-color]"
        />
      </div>
    </Modal>
  );
}
