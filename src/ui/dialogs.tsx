import { ShareDialog } from './ShareDialog';
import { localizeNames } from '@/src/lib/presetNames';
import { Check, Plus, Trash } from '@phosphor-icons/react';
import { iconParts, limitIcon, MAX_ICON_EMOJIS } from '@/src/lib/emoji';
import { clipWidth, NAME_MAX_WIDTH } from '@/src/lib/textWidth';
import { Button, Input, InputArea, Tabs } from '@cloudflare/kumo';
import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { MODE_DEFAULT, PALETTE, db, type Drawer, type Workspace } from '@/src/db';
import { createTag, setTags, toggleTagOn, updateBookmark, updateWorkspace } from '@/src/lib/store';
import { BookmarkIcon, WorkspaceIcon } from './icons';
import { Modal } from './Modal';
import { InfoTip } from './InfoTip';
import { IconBox } from './ColorPicker';
import { useTone } from './colors';
import { LucidePicker } from './LucidePicker';
import { useIconStyle } from './iconStyle';
import { HistoryAutocomplete, HistoryHint, useHistoryPermission } from './HistoryAutocomplete';

import { tr } from '@/src/i18n';
export interface Target { workspaceId: string; drawerId: string | null; name?: string }

interface ConfirmOpts { title: string; description?: ReactNode; okText?: string; danger?: boolean }
interface ChoiceOpts<T extends string> { title: string; description?: ReactNode; choices: Array<{ value: T; label: string; danger?: boolean }> }
interface PickOpts { title: string; allowTop?: boolean; excludeDrawerIds?: string[]; drawersOnly?: boolean; workspacesOnly?: boolean; /** 顶部显示名称输入框，初始值为此；此时列表改为单选 + 底部按钮 */ name?: string; okText?: string }

/** 新建结果；工作区另带图标三件套 */
type CreateResult = { name: string; color: string; description: string; emoji?: string; lucide?: string; glyph?: string };

interface DialogsApi {
  confirm(o: ConfirmOpts): Promise<boolean>;
  choose<T extends string>(o: ChoiceOpts<T>): Promise<T | null>;
  prompt(title: string, initial?: string, placeholder?: string): Promise<string | null>;
  pickTarget(o: PickOpts): Promise<Target | null>;
  /** 新建工作区：名称 + 图标框右上角小圆点选颜色（新建抽屉用 NewDrawerPopover） */
  create(what: string, color: string): Promise<CreateResult | null>;
  /** 当前处于非默认场景时，新建项询问可见范围；默认场景直接返回 'all' */
  askVisibility(currentModeId: string, what: string): Promise<'current' | 'all' | null>;
  /** 新建书签：与编辑书签同一个对话框 */
  newBookmark(): Promise<BookmarkForm | null>;
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
  | { kind: 'create'; what: string; color: string; resolve: (v: CreateResult | null) => void }
  | { kind: 'newBookmark'; resolve: (v: BookmarkForm | null) => void }
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
              title: tr('新建{0}在哪些场景可见？', what),
              description: tr('当前场景是「{0}」。', mode?.name ?? ''),
              choices: [
                { value: 'current', label: tr('仅当前场景') },
                { value: 'all', label: tr('所有场景') },
              ],
            },
            resolve: resolve as (v: string | null) => void,
          }),
        );
      },
      editBookmark: (id) => setP({ kind: 'bookmark', id }),
      editWorkspace: (id) => setP({ kind: 'workspace', id }),
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
              <Button onClick={() => { p.resolve(false); close(); }}>{tr('取消')}</Button>
              <Button variant={p.o.danger ? 'destructive' : 'primary'} onClick={() => { p.resolve(true); close(); }}>
                {p.o.okText ?? tr('确定')}
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
      {p?.kind === 'create' && <WorkspaceDialog title={tr('新建工作区')} okText={tr('确定')} initial={{ name: '', emoji: '', glyph: '', color: p.color, description: '' }} onSubmit={(v) => { p.resolve(v); close(); }} onClose={() => { p.resolve(null); close(); }} />}
      {p?.kind === 'pick' && <PickDialog o={p.o} onDone={(v) => { p.resolve(v); close(); }} />}
      {p?.kind === 'newBookmark' && <BookmarkDialog title={tr('新建书签')} okText={tr('添加')} initial={EMPTY_BOOKMARK} onSubmit={(v) => { p.resolve(v); close(); }} onClose={() => { p.resolve(null); close(); }} />}
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
      form
      size="sm"
      title={title}
      onClose={() => onDone(null)}
      footer={
        <>
          <Button onClick={() => onDone(null)}>{tr('取消')}</Button>
          <Button variant="primary" onClick={() => onDone(v)}>{tr('确定')}</Button>
        </>
      }
    >
      <Input autoFocus value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onDone(v)} />
    </Modal>
  );
}

/** 名称与说明：两个普通输入框，无 label、无提示小字 */
function NameFields({ name, description, onName, onDescription, what, disabled, onEnter, maxWidth }: { name: string; description: string; onName: (v: string) => void; onDescription: (v: string) => void; what: string; disabled?: boolean; onEnter?: () => void; maxWidth?: number }) {
  // 按显示宽度限长；输入法组字时不截，避免打断拼音
  const limit = (v: string, composing: boolean) => (maxWidth && !composing ? clipWidth(v, maxWidth) : v);
  return (
    <div className="grid min-w-0 flex-1 gap-2">
      <Input autoFocus value={name} disabled={disabled} placeholder={tr('{0}名称', what)} aria-label={tr('{0}名称', what)} onChange={(e) => onName(limit(e.target.value, (e.nativeEvent as InputEvent).isComposing))} onCompositionEnd={(e) => onName(limit(e.currentTarget.value, false))} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && onEnter?.()} />
      <Input
        size="sm" className="!h-7 !text-xs"
        value={description} maxLength={50} placeholder={tr('说明')} aria-label={tr('{0}说明', what)}
        onChange={(e) => onDescription(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && onEnter?.()}
      />
    </div>
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
      footer={hasName ? <><Button onClick={() => onDone(null)}>{tr('取消')}</Button><Button variant="primary" disabled={!selId} onClick={ok}>{o.okText ?? tr('确定')}</Button></> : undefined}
    >
      {hasName ? (
        <Input autoFocus size="sm" label={tr('抽屉名称')} placeholder={o.name} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && ok()} />
      ) : (
        <Input autoFocus size="sm" placeholder={tr('筛选工作区或抽屉')} value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      {hasName && <div className="mt-4 mb-1 text-xs text-kumo-subtle">{tr('安装到')}</div>}
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
                {canTop && !o.workspacesOnly && <span className="text-xs text-kumo-subtle">{tr('顶层')}</span>}
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

export type BookmarkForm = { title: string; url: string; note: string; faviconUrl: string; links: { url: string; title: string }[] };
const EMPTY_BOOKMARK: BookmarkForm = { title: '', url: '', note: '', faviconUrl: '', links: [] };

/** 新建 / 编辑书签共用的对话框 */
function BookmarkDialog({ title, okText, initial, onSubmit, onClose }: { title: ReactNode; okText: string; initial: BookmarkForm | undefined; onSubmit: (f: BookmarkForm) => void | Promise<void>; onClose: () => void }) {
  const history = useHistoryPermission();
  const [form, setForm] = useState<BookmarkForm | null>(null);
  if (initial && !form) setForm(initial);
  const setLink = (i: number, patch: Partial<{ url: string; title: string }>) =>
    form && setForm({ ...form, links: form.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const ok = !!form && form.url.trim().length > 0;
  const submit = () => { if (form && ok) void onSubmit(form); };
  return (
    <Modal open form title={title} size="lg" onClose={onClose} footer={<><Button onClick={onClose}>{tr('取消')}</Button><Button variant="primary" disabled={!ok} onClick={submit}>{okText}</Button></>}>
      {form && (
        <div className="grid gap-3">
          <div className="flex items-end gap-3">
            <div className="flex h-9 shrink-0 items-center"><BookmarkIcon url={form.url || 'https://'} src={form.faviconUrl} size={32} /></div>
            <div className="min-w-0 flex-1"><HistoryAutocomplete label={tr('名称')} placeholder={tr('可留空，用网页标题')} enabled={history.granted} value={form.title} onChange={(title) => setForm({ ...form, title })} onPick={(s) => setForm({ ...form, title: s.title || form.title, url: s.url })} /></div>
          </div>
          <HistoryAutocomplete label="URL" placeholder="https://" enabled={history.granted} value={form.url} onChange={(url) => setForm({ ...form, url })} onPick={(s) => setForm({ ...form, url: s.url, title: form.title.trim() ? form.title : s.title })} />
          <HistoryHint>{tr('开启「读取浏览记录」，输入时可从浏览记录补全')}</HistoryHint>
          <Input label={tr('图标地址')} placeholder={tr('留空用网站图标')} value={form.faviconUrl} onChange={(e) => setForm({ ...form, faviconUrl: e.target.value })} />
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-sm font-medium">{tr('关联链接')}<InfoTip>{tr('同一个书签的其他地址，如 GitHub、文档、社交账号。添加后悬停书签会滑出它们的图标，点击即可打开。')}</InfoTip></span>
              <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => setForm({ ...form, links: [...form.links, { url: '', title: '' }] })}>{tr('添加')}</Button>
            </div>
            {form.links.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1">
                  <div className="w-32 shrink-0"><HistoryAutocomplete enabled={history.granted} className="rounded-r-none focus-within:z-10" placeholder={tr('名称')} ariaLabel={tr('关联链接名称')} value={l.title} onChange={(title) => setLink(i, { title })} onPick={(s) => setLink(i, { url: s.url, title: s.title || l.title })} /></div>
                  <div className="-ml-px min-w-0 flex-1"><HistoryAutocomplete enabled={history.granted} className="rounded-l-none focus-within:z-10" placeholder="https://" ariaLabel={tr('关联链接地址')} value={l.url} onChange={(url) => setLink(i, { url })} onPick={(s) => setLink(i, { url: s.url, title: l.title.trim() ? l.title : s.title })} /></div>
                </div>
                <Button size="sm" variant="ghost" shape="square" icon={<Trash />} aria-label={tr('删除关联链接')} onClick={() => setForm({ ...form, links: form.links.filter((_, j) => j !== i) })} />
              </div>
            ))}
          </div>
          <InputArea label={tr('备注')} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
      )}
    </Modal>
  );
}

function EditBookmarkDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const b = useLiveQuery(() => db.bookmarks.get(id), [id]);
  const initial = b && { title: b.title, url: b.url, note: b.note ?? '', faviconUrl: b.faviconUrl ?? '', links: (b.links ?? []).map((l) => ({ url: l.url, title: l.title ?? '' })) };
  return (
    <BookmarkDialog
      title={<span className="flex items-center gap-1">{tr('编辑书签')}<InfoTip>{tr('改动会同步到这个书签的全部分身。')}</InfoTip></span>}
      okText={tr('保存')} initial={initial} onClose={onClose}
      onSubmit={async (f) => { await updateBookmark(db, id, { title: f.title.trim() || f.url, url: f.url, note: f.note || undefined, faviconUrl: f.faviconUrl || undefined, links: f.links }); onClose(); }}
    />
  );
}

/** 字符图标最多 2 个字（输入法组字期间不截断，失焦和保存时再截） */
/** emoji 多选：再点取消；已满两个时去掉最早的 */
const toggleEmoji = (picked: string[], e: string) =>
  (picked.includes(e) ? picked.filter((x) => x !== e) : [...picked, e].slice(-MAX_ICON_EMOJIS)).join('');

const limitGlyph = (v: string) => Array.from(v.trim()).slice(0, 2).join('');

const EMOJIS: string[] = Array.from('📁💼🏠🎯📚🧠💡🛠️🧪🎨🎵🎮📷✈️🍜💰📈🗂️📝🔖⭐🔥🌱🧘🏃🎬📺🛒🧾🔒🤖💻🌐📰🗓️❤️🐱🌙☀️🚀'.match(/\p{Extended_Pictographic}\uFE0F?/gu) ?? []);

export type WorkspaceForm = { name: string; emoji: string; lucide?: string; glyph: string; color: string; description: string };

function EditWorkspaceDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const w = useLiveQuery(() => db.workspaces.get(id), [id]);
  const initial = w && { name: w.name, emoji: w.emoji ?? '', lucide: w.lucide, glyph: w.glyph ?? '', color: w.color ?? PALETTE[0]!, description: w.description ?? '' };
  return (
    <WorkspaceDialog
      title={tr('编辑工作区')} okText={tr('保存')} initial={initial} isInbox={w?.source === 'inbox'} onClose={onClose}
      onSubmit={async (f) => { await updateWorkspace(db, id, { name: f.name, emoji: f.emoji || undefined, lucide: f.lucide, glyph: limitGlyph(f.glyph) || undefined, color: f.color, description: f.description || undefined }); onClose(); }}
    />
  );
}

/** 新建 / 编辑工作区共用的对话框 */
function WorkspaceDialog({ title, okText, initial, isInbox, onSubmit, onClose }: { title: string; okText: string; initial: WorkspaceForm | undefined; isInbox?: boolean; onSubmit: (f: WorkspaceForm) => void | Promise<void>; onClose: () => void }) {
  const globalStyle = useIconStyle();
  const [tab, setTab] = useState<'emoji' | 'lucide' | 'char'>(globalStyle);
  const [form, setForm] = useState<WorkspaceForm | null>(null);
  if (initial && !form) setForm(initial);
  const pickTone = useTone(form?.color) ?? '#8d8d86';
  const picked = iconParts(form?.emoji ?? '');
  const save = async () => { if (form) await onSubmit({ ...form, glyph: limitGlyph(form.glyph) }); };
  return (
    <Modal open form title={title} size="lg" onClose={onClose} footer={<><Button onClick={onClose}>{tr('取消')}</Button><Button variant="primary" onClick={() => void save()}>{okText}</Button></>}>
      {form && (
        <div className="grid gap-4">
          <div className="flex items-start gap-3">
            <IconBox color={form.color} onColor={(color) => setForm({ ...form, color })} label={tr('工作区颜色')}>
              <WorkspaceIcon ws={{ name: form.name || tr('工作区'), emoji: form.emoji, lucide: form.lucide, glyph: form.glyph, color: form.color }} size={36} style={tab} />
            </IconBox>
            <NameFields what={tr('工作区')} maxWidth={NAME_MAX_WIDTH} name={form.name} disabled={isInbox} description={form.description} onName={(name) => setForm({ ...form, name })} onDescription={(description) => setForm({ ...form, description })} onEnter={() => void save()} />
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm text-kumo-subtle">{tr('图标')}</span>
              <InfoTip>{tr('三种都会保存，显示哪种在「设置 → 外观」切换。字符留空时用名称首字。')}</InfoTip>
              <span className="ml-auto">
                <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}
                  tabs={[{ value: 'emoji', label: 'Emoji' }, { value: 'lucide', label: tr('线性图标') }, { value: 'char', label: tr('字符') }]} />
              </span>
            </div>
            {tab === 'char' ? (
              <Input
                className="w-full" placeholder={Array.from(form.name.trim())[0] ?? tr('字')} aria-label={tr('字符图标')} value={form.glyph}
                onChange={(e) => setForm({ ...form, glyph: e.target.value })}
                onBlur={() => setForm({ ...form, glyph: limitGlyph(form.glyph) })}
              />
            ) : tab === 'lucide' ? <LucidePicker search={false} color={form.color} value={form.lucide} onChange={(lucide) => setForm({ ...form, lucide })} /> : (
            <div className="flex flex-wrap gap-1">
              {EMOJIS.map((e) => (
                <Button key={e} size="sm" shape="square" variant="ghost" className={`text-lg ${picked.includes(e) ? 'nv-pick-on nv-pick-soft' : 'nv-pick'}`} style={{ '--pick': pickTone } as React.CSSProperties} aria-label={e} onClick={() => setForm({ ...form, emoji: toggleEmoji(picked, e) })}>{e}</Button>
              ))}
              <Input className="w-28" placeholder={tr('自定义')} value={picked.every((x) => EMOJIS.includes(x)) ? '' : form.emoji} onChange={(e) => setForm({ ...form, emoji: limitIcon(e.target.value) })} aria-label={tr('自定义 emoji')} />
            </div>)}
          </div>
        </div>
      )}
    </Modal>
  );
}

function TagsDialog({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const tags = useLiveQuery(async () => localizeNames(await db.tags.orderBy('order').toArray()), []);
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
    <Modal open size="sm" title={single ? tr('标签') : tr('为 {0} 个书签设置标签', ids.length)} onClose={onClose}>
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
          placeholder={tr('+ 新建标签')}
          aria-label={tr('新建标签')}
          className="h-8 w-28 rounded-full border border-dashed border-kumo-line bg-transparent px-3 text-sm outline-none placeholder:text-kumo-subtle focus:w-40 focus:border-kumo-brand transition-[width,border-color]"
        />
      </div>
    </Modal>
  );
}
