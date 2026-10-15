import { InfoTip } from '@/src/ui/InfoTip';
import { Badge, Banner, Button, Checkbox, Input, Select, Switch, Tabs, Text } from '@cloudflare/kumo';
import { DownloadSimple, FileArrowUp, Plus, Trash, ArrowsClockwise, SignOut, GoogleLogo, LinkBreak, Smiley, ListBullets, Play } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState, type ReactNode } from 'react';
import { MODE_DEFAULT, PALETTE, db, type Mode } from '@/src/db';
import { ModeIcon, modeLook } from '@/src/ui/ModeSwitcher';
import { LucidePicker } from '@/src/ui/LucidePicker';
import { exportBackup, parseBackup, restoreBackup } from '@/src/lib/io/backup';
import { exportNetscapeHtml } from '@/src/lib/io/html';
import type { Settings as S, ToastEvent, ToastPosition, ToastStyle } from '@/src/lib/settings';
import { clearOpenEvents, parseWorkspaceIcons, createMode, createTag, deleteMode, deleteTag, detachAlias, renameMode, renameTag, setModeLook, setShowAdult, setVisible, unmount } from '@/src/lib/store';
import { isConfigured, redirectUri, signOut } from '@/src/lib/sync/auth';
import { deleteRemoteData, signInAndLog } from '@/src/lib/sync/engine';
import { isMac, modKey, syncFromPage } from '@/src/ui/feedback';
import { toast } from '@/src/ui/toast';
import { useDialogs } from '@/src/ui/dialogs';
import { WorkspaceIcon } from '@/src/ui/icons';
import { Modal } from '@/src/ui/Modal';
import { useApp } from '@/src/ui/state';
import { useSyncStatus } from '@/src/ui/useSettings';
import { clearIconCache } from '@/src/lib/icons/fetcher';

export type Tab = 'general' | 'modes' | 'tags' | 'sync' | 'alias' | 'toast' | 'keys' | 'data';

export function SettingsDialog({ open, onClose, onReimport, initialTab = 'general' }: { open: boolean; onClose: () => void; onReimport: (source: 'browser' | 'html') => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <Modal open={open} onClose={onClose} title="设置" size="xl">
      <Tabs
        variant="underline"
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        tabs={[
          { value: 'general', label: '通用' },
          { value: 'modes', label: '场景' },
          { value: 'tags', label: '标签' },
          { value: 'sync', label: '同步' },
          { value: 'alias', label: '分身' },
          { value: 'toast', label: '提醒' },
          { value: 'keys', label: '快捷键' },
          { value: 'data', label: '数据' },
        ]}
      />
      <div className="mt-4 min-h-[50vh]">
        {tab === 'general' && <General />}
        {tab === 'modes' && <Modes />}
        {tab === 'tags' && <Tags />}
        {tab === 'sync' && <Sync />}
        {tab === 'alias' && <Aliases />}
        {tab === 'toast' && <Toasts />}
        {tab === 'keys' && <Shortcuts />}
        {tab === 'data' && <Data onReimport={(s) => { onClose(); onReimport(s); }} />}
      </div>
    </Modal>
  );
}

/** hint：状态类短文字（常显）；info：说明类文字（收进 ⓘ） */
function Row({ label, children, hint, info }: { label: string; children: ReactNode; hint?: string; info?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-kumo-line py-3 last:border-0">
      <div>
        <div className="flex items-center gap-1 text-sm font-medium">{label}{info && <InfoTip label={`${label}说明`}>{info}</InfoTip>}</div>
        {hint && <div className="text-xs text-kumo-subtle">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Pick<K extends string>({ value, items, onChange, label }: { value: K; items: Record<K, string>; onChange: (v: K) => void; label: string }) {
  return <Select aria-label={label} className="w-44" value={value} items={items} onValueChange={(v) => v && onChange(v as K)} />;
}

function IconRows() {
  const pageGranted = useLiveQuery(() => browser.permissions.contains({ origins: ['<all_urls>'] }).catch(() => false), []);
  const [granted, setGranted] = useState<boolean | undefined>(undefined);
  const has = granted ?? pageGranted;
  const cached = useLiveQuery(() => db.icons.filter((i) => !!i.blob).count(), []) ?? 0;
  const [msg, setMsg] = useState('');
  return (
    <>
      <Row label="读取网页自带的高清图标" info="授权后优先用网站自己的 apple-touch-icon / manifest 图标，最清晰；不授权则用 icon.horse 与 Google 图标服务">
        {has ? (
          <Button size="sm" onClick={async () => { await browser.permissions.remove({ origins: ['<all_urls>'] }); setGranted(false); }}>撤销授权</Button>
        ) : (
          <Button size="sm" variant="primary" onClick={async () => { const ok = await browser.permissions.request({ origins: ['<all_urls>'] }); setGranted(ok); if (ok) { await clearIconCache(db); setMsg('已授权，图标将重新获取'); } }}>授权</Button>
        )}
      </Row>
      <Row label="高清图标缓存" hint={msg || `已缓存 ${cached} 个网站，只存本机、不同步`}>
        <Button size="sm" icon={<ArrowsClockwise />} onClick={async () => { const n = await clearIconCache(db); setMsg(`已清除 ${n} 条，打开页面时会重新获取`); }}>重新获取</Button>
      </Row>
    </>
  );
}

function General() {
  const { settings, updateSettings } = useApp();
  const workspaces = useLiveQuery(() => db.workspaces.orderBy('order').toArray(), []) ?? [];
  const set = (p: Partial<S>) => void updateSettings(p);
  const wsItems = Object.fromEntries([['last', '上次打开的'], ...workspaces.map((w) => [w.id, w.name])]) as Record<string, string>;
  return (
    <div>
      <Row label="主题"><Pick label="主题" value={settings.theme} items={{ system: '跟随系统', light: '浅色', dark: '深色' }} onChange={(theme) => set({ theme })} /></Row>
      <Row label="书签打开方式" info="Ctrl/⌘ 或中键点击始终在后台新标签打开"><Pick label="打开方式" value={settings.openMode} items={{ current: '当前标签', new: '新标签', background: '后台新标签' }} onChange={(openMode) => set({ openMode })} /></Row>
      <Row label="工作区导航"><Pick label="工作区导航" value={settings.navLayout} items={{ sidebar: '侧边栏', top: '顶部横铺' }} onChange={(navLayout) => set({ navLayout })} /></Row>
      <Row label="工作区显示" info="侧边栏收起时只显示图标"><Pick label="工作区显示" value={settings.navLabel} items={{ both: '图标 + 名称', icon: '只显示图标', name: '只显示名称' }} onChange={(navLabel) => set({ navLabel })} /></Row>
      <Row label="工作区图标" info="两种图标都会保存，在编辑工作区里分别设置"><Pick label="工作区图标" value={settings.workspaceIconStyle} items={{ emoji: 'Emoji', lucide: '线性图标（Lucide）' }} onChange={(workspaceIconStyle) => set({ workspaceIconStyle })} /></Row>
      <Row label="卡片风格"><Pick label="卡片风格" value={settings.surface} items={{ tint: '色调卡片', glass: '磨砂玻璃', bare: '无框漂浮' }} onChange={(surface) => set({ surface })} /></Row>
      <Row label="抽屉名显示"><Pick label="抽屉名显示" value={settings.drawerName} items={{ full: '完整路径', last: '仅末级' }} onChange={(drawerName) => set({ drawerName })} /></Row>
      <Row label="默认进入的工作区"><Pick label="默认工作区" value={settings.startWorkspace} items={wsItems} onChange={(startWorkspace) => set({ startWorkspace })} /></Row>
      <IconRows />
      <Row label="新标签页" info="Navill 接管新标签页；如需关闭，请在浏览器扩展管理中停用或改用弹窗"><Badge variant="neutral">已接管</Badge></Row>
    </div>
  );
}

function Modes() {
  const modes = useLiveQuery(() => db.modes.orderBy('order').toArray(), []) ?? [];
  const [sel, setSel] = useState(MODE_DEFAULT);
  const [fresh, setFresh] = useState<string>();
  const mode = modes.find((m) => m.id === sel) ?? modes[0];
  return (
    <div className="grid grid-cols-[180px_1fr] gap-6">
      <div className="flex flex-col gap-1">
        {modes.map((m) => (
          <button key={m.id} className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm ${m.id === mode?.id ? 'bg-kumo-tint font-medium' : 'hover:bg-kumo-tint'}`} onClick={() => setSel(m.id)}>
            <ModeIcon mode={m} />{m.name}
          </button>
        ))}
        <Button size="sm" variant="ghost" icon={<Plus />} onClick={async () => { const m = await createMode(db, '新场景'); setFresh(m.id); setSel(m.id); }}>新建场景</Button>
      </div>
      {mode && <ModeEditor key={mode.id} mode={mode} autoFocus={mode.id === fresh} onDeleted={() => setSel(MODE_DEFAULT)} />}
    </div>
  );
}

function ModeEditor({ mode, onDeleted, autoFocus }: { mode: Mode; onDeleted: () => void; autoFocus?: boolean }) {
  const dialogs = useDialogs();
  const data = useLiveQuery(async () => ({ ws: await db.workspaces.orderBy('order').toArray(), ds: await db.drawers.toArray() }), []);
  const isDefault = mode.id === MODE_DEFAULT;
  const hiddenW = new Set(mode.hiddenWorkspaceIds);
  const hiddenD = new Set(mode.hiddenDrawerIds);
  const [name, setName] = useState(mode.name);
  const look = modeLook(mode);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Input size="sm" className="flex-1" value={name} disabled={isDefault} autoFocus={autoFocus} onFocus={(e) => autoFocus && e.currentTarget.select()} onChange={(e) => { setName(e.target.value); void renameMode(db, mode.id, e.target.value); }} aria-label="场景名称" />
        {!isDefault && (
          <Button size="sm" variant="secondary-destructive" icon={<Trash />} onClick={async () => {
            if (await dialogs.confirm({ title: `删除场景「${mode.name}」？`, okText: '删除', danger: true })) {
              await deleteMode(db, mode.id);
              onDeleted();
            }
          }}>删除</Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="场景颜色">
        {PALETTE.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={look.color === c} aria-label={c} className={`size-6 rounded-full ring-offset-2 ring-offset-kumo-base ${look.color === c ? 'ring-2' : ''}`} style={{ background: c, ['--tw-ring-color' as string]: c }} onClick={() => void setModeLook(db, mode.id, { color: c })} />
        ))}
      </div>
      <LucidePicker allowNone={false} value={look.icon} onChange={(icon) => icon && void setModeLook(db, mode.id, { icon })} />
      <Switch label="显示 18+ 内容" checked={mode.showAdult} onClick={() => void setShowAdult(db, mode.id, !mode.showAdult)} />
      {isDefault ? (
        <div><InfoTip text="可见性">「默认」场景显示全部工作区与抽屉，可见性不可编辑。</InfoTip></div>
      ) : (
        <div>
          <div className="mb-2 text-sm font-medium">在此场景中可见的工作区与抽屉</div>
          <div className="flex max-h-[45vh] flex-col gap-1 overflow-y-auto rounded-lg border border-kumo-line p-2">
            {data?.ws.map((w) => {
              const wVisible = !hiddenW.has(w.id);
              return (
                <div key={w.id}>
                  <div className="flex items-center gap-2 py-1">
                    <Checkbox checked={wVisible} onCheckedChange={(v) => void setVisible(db, mode.id, 'workspace', w.id, Boolean(v))} aria-label={w.name} />
                    <WorkspaceIcon ws={w} size={18} />
                    <span className="text-sm">{w.name}</span>
                  </div>
                  {data.ds.filter((d) => d.workspaceId === w.id).sort((a, b) => a.order - b.order).map((d) => (
                    <div key={d.id} className={`flex items-center gap-2 py-0.5 pl-8 ${wVisible ? '' : 'opacity-40'}`}>
                      <Checkbox checked={!hiddenD.has(d.id)} disabled={!wVisible} onCheckedChange={(v) => void setVisible(db, mode.id, 'drawer', d.id, Boolean(v))} aria-label={d.name} />
                      <span className="text-sm">{d.name}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Tags() {
  const tags = useLiveQuery(() => db.tags.orderBy('order').toArray(), []) ?? [];
  const counts = useLiveQuery(async () => {
    const m = new Map<string, number>();
    for (const b of await db.bookmarks.toArray()) for (const t of b.tagIds) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  }, []);
  const [name, setName] = useState('');
  const dialogs = useDialogs();
  return (
    <div className="flex flex-col gap-2">
      <div><InfoTip text="说明">标签只用于书签，一个书签可以有多个标签。搜索时输入 #标签名 筛选。</InfoTip></div>
      {tags.map((t) => (
        <div key={t.id} className="flex items-center gap-2 rounded-md border border-kumo-line px-3 py-2">
          {t.builtin ? <span className="flex-1 text-sm">#{t.name} <Badge variant="neutral">内置</Badge></span> : (
            <Input size="sm" className="flex-1" value={t.name} onChange={(e) => void renameTag(db, t.id, e.target.value)} aria-label="标签名" />
          )}
          <span className="w-16 text-right text-xs text-kumo-subtle">{counts?.get(t.id) ?? 0} 个书签</span>
          {!t.builtin && (
            <Button size="xs" variant="ghost" shape="square" icon={<Trash />} aria-label="删除标签" onClick={async () => {
              if (await dialogs.confirm({ title: `删除标签「${t.name}」？`, description: '会从所有书签上移除。', okText: '删除', danger: true })) await deleteTag(db, t.id);
            }} />
          )}
        </div>
      ))}
      <div className="mt-2 flex gap-2">
        <Input size="sm" className="flex-1" placeholder="新标签名" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={async (e) => { if (e.key === 'Enter' && name.trim()) { await createTag(db, name); setName(''); } }} />
        <Button size="sm" icon={<Plus />} onClick={async () => { if (name.trim()) { await createTag(db, name); setName(''); } }}>添加</Button>
      </div>
    </div>
  );
}

function Sync() {
  const { settings, updateSettings } = useApp();
  const status = useSyncStatus();
  const dialogs = useDialogs();
  const [busy, setBusy] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  if (!isConfigured()) {
    return (
      <div className="flex flex-col gap-1">
        <Banner variant="alert" title="未配置 Google OAuth 客户端 ID" description={`构建时在 .env 中设置 WXT_GOOGLE_CLIENT_ID。Google Cloud 中为本扩展登记回调地址：${redirectUri()}`} />
        <Row label="日志"><Button size="sm" icon={<ListBullets />} onClick={() => setLogsOpen(true)}>查看日志</Button></Row>
        {logsOpen && <LogViewer onClose={() => setLogsOpen(false)} />}
      </div>
    );
  }
  const signedIn = status.state !== 'signed-out';
  return (
    <div className="flex flex-col gap-1">
      <div><InfoTip text="数据存在哪">数据保存在你自己 Google Drive 的隐藏应用目录（appDataFolder），只申请 drive.appdata 权限，看不到你的其他文件。</InfoTip></div>
      {err && <Banner variant="error" description={err} />}
      {status.state === 'error' && status.message && <Banner variant="error" title="上次同步失败" description={status.message} />}
      <Row label="Google 账号" hint={signedIn ? '已授权' : '未登录'}>
        {signedIn ? (
          <Button size="sm" icon={<SignOut />} onClick={() => void run(async () => { await signOut(); await updateSettings({ sync: { ...settings.sync, enabled: false } }); })}>退出登录</Button>
        ) : (
          <Button size="sm" variant="primary" icon={<GoogleLogo />} loading={busy} onClick={() => void run(async () => { await signInAndLog(db); const next = await updateSettings({ sync: { ...settings.sync, enabled: true } }); await syncFromPage(db, next); })}>登录 Google</Button>
        )}
      </Row>
      <Row label="自动同步"><Switch checked={settings.sync.enabled} disabled={!signedIn} onClick={() => void updateSettings({ sync: { ...settings.sync, enabled: !settings.sync.enabled } })} /></Row>
      <Row label="同步频率" info="只在有改动时上传"><Select aria-label="同步频率" className="w-44" value={String(settings.sync.intervalMinutes)} items={{ '5': '每 5 分钟', '15': '每 15 分钟', '60': '每 60 分钟', '0': '仅手动' }} onValueChange={(v) => v && void updateSettings({ sync: { ...settings.sync, intervalMinutes: Number(v) as 0 | 5 | 15 | 60 } })} /></Row>
      <Row label="立即同步" hint={status.lastSyncAt ? `上次同步：${new Date(status.lastSyncAt).toLocaleString('zh-CN')}` : '尚未同步'}>
        <Button size="sm" icon={<ArrowsClockwise />} disabled={!signedIn} loading={busy || status.state === 'syncing'} onClick={() => void run(() => syncFromPage(db, settings))}>立即同步</Button>
      </Row>
      <Row label="核心数据" info="工作区、抽屉、书签、分身、场景、标签和删除记录始终同步"><Badge variant="neutral">始终同步</Badge></Row>
      <Row label="日志" info="新建、改名、编辑、删除、移动、归档、分身等操作的记录。本机始终记录；开启后上传到 Drive，并合并其他设备的日志">
        <div className="flex items-center gap-2">
          <Button size="sm" icon={<ListBullets />} onClick={() => setLogsOpen(true)}>查看日志</Button>
          <Switch checked={settings.sync.logs} aria-label="同步日志" onClick={() => void updateSettings({ sync: { ...settings.sync, logs: !settings.sync.logs } })} />
        </div>
      </Row>
      {logsOpen && <LogViewer onClose={() => setLogsOpen(false)} />}
      <Row label="冲突策略" info="按条目合并，修改时间新的一方胜出"><Badge variant="neutral">按条目合并</Badge></Row>
      <Row label="删除云端数据" info="只删除 Drive 中的 Navill 数据，本地不受影响">
        <Button size="sm" variant="secondary-destructive" icon={<Trash />} disabled={!signedIn} onClick={async () => {
          if (await dialogs.confirm({ title: '删除云端的 Navill 数据？', okText: '删除', danger: true })) await run(() => deleteRemoteData(db));
        }}>删除</Button>
      </Row>
    </div>
  );
}

function LogViewer({ onClose }: { onClose: () => void }) {
  const data = useLiveQuery(async () => ({
    logs: await db.logs.orderBy('at').reverse().limit(500).toArray(),
    total: await db.logs.count(),
    me: (await db.meta.get('deviceId'))?.value as string | undefined,
  }), []);
  return (
    <Modal open size="lg" title="日志" onClose={onClose}>
      {!data ? null : data.logs.length === 0 ? <p className="py-8 text-center text-sm text-kumo-subtle">还没有日志</p> : (
        <div className="flex flex-col">
          {data.logs.map((l) => (
            <div key={l.id} className="flex items-baseline gap-3 border-b border-kumo-line py-2 text-sm last:border-0">
              <span className="w-32 shrink-0 tabular-nums text-kumo-subtle">{new Date(l.at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              <span className="w-28 shrink-0 truncate text-kumo-subtle">{l.deviceId === data.me ? '本机' : l.device ?? '其他设备'}</span>
              <span className="min-w-0 flex-1 break-words">{l.summary}</span>
            </div>
          ))}
          {data.total > data.logs.length && <p className="pt-3 text-center text-xs text-kumo-subtle">只显示最近 {data.logs.length} 条，共 {data.total} 条</p>}
        </div>
      )}
    </Modal>
  );
}

const POSITIONS: Record<ToastPosition, string> = {
  'top-center': '中顶', 'top-right': '右上', 'bottom-right': '右下', 'top-left': '左上', 'bottom-left': '左下', 'bottom-center': '中底',
};
const STYLES: Record<ToastStyle, string> = { plain: '简洁', tinted: '彩色', dark: '深色', pill: '胶囊' };
const EVENTS: Array<[ToastEvent, string]> = [
  ['sync', '同步完成'], ['create', '新建书签'], ['edit', '修改书签'], ['delete', '删除书签'], ['move', '移动书签'],
];

function Toasts() {
  const { settings, updateSettings } = useApp();
  const t = settings.toast;
  const set = (p: Partial<S['toast']>) => void updateSettings({ toast: { ...t, ...p } });
  return (
    <div className="flex flex-col gap-1">
      <div><InfoTip text="说明">提醒设置只对本机生效。按 {modKey()}S 时「已跳过」这类直接反馈总是显示。</InfoTip></div>
      <Row label="位置"><Pick label="位置" value={t.position} items={POSITIONS} onChange={(position) => set({ position })} /></Row>
      <Row label="样式">
        <div className="flex items-center gap-2">
          <Pick label="样式" value={t.style} items={STYLES} onChange={(style) => set({ style })} />
          <Button size="sm" icon={<Play />} onClick={() => toast('新建书签「Navill 示例」')}>预览</Button>
        </div>
      </Row>
      <h3 className="mt-4 text-sm font-semibold">提醒内容</h3>
      {EVENTS.map(([k, label]) => (
        <Row key={k} label={label}>
          <Switch checked={t.show[k]} aria-label={label} onClick={() => set({ show: { ...t.show, [k]: !t.show[k] } })} />
        </Row>
      ))}
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-kumo-line bg-kumo-recessed px-2 py-0.5 font-mono text-sm">{children}</kbd>;
}

function Shortcuts() {
  const mod = isMac() ? '⌘' : 'Ctrl';
  const combo = (k: string) => (isMac() ? `${mod}${k}` : `${mod}+${k}`);
  return (
    <div className="flex flex-col gap-1">
      <Row label="立即同步" info="3 分钟内同步过，或没有需要上传的改动时跳过并提醒；同步未开启或未登录时也会提醒"><Kbd>{combo('S')}</Kbd></Row>
      <Row label="搜索" info={`焦点在地址栏时，浏览器会先处理 ${combo('L')}；在 Navill 页面里按才会打开搜索`}><Kbd>{combo('L')}</Kbd></Row>
      <Row label="搜索"><Kbd>/</Kbd></Row>
    </div>
  );
}

function Aliases() {
  const data = useLiveQuery(async () => {
    const [aliases, groups, drawers, workspaces] = await Promise.all([
      db.placements.filter((p) => p.isAlias).toArray(), db.aliasGroups.toArray(), db.drawers.toArray(), db.workspaces.toArray(),
    ]);
    const bookmarks = new Map((await db.bookmarks.bulkGet([...new Set(aliases.map((a) => a.bookmarkId))])).filter(Boolean).map((b) => [b!.id, b!]));
    const dr = new Map(drawers.map((d) => [d.id, d]));
    const ws = new Map(workspaces.map((w) => [w.id, w]));
    const where = (wid: string, did: string | null) => `${ws.get(wid)?.name ?? '?'}${did ? ` / ${dr.get(did)?.name ?? '?'}` : ''}`;
    return {
      aliases: aliases.map((a) => ({ a, b: bookmarks.get(a.bookmarkId), where: where(a.workspaceId, a.drawerId) })),
      groups: groups.map((g) => {
        const s = dr.get(g.sourceDrawerId);
        const t = dr.get(g.targetDrawerId);
        return { g, from: s ? where(s.workspaceId, s.id) : '?', to: t ? where(t.workspaceId, t.id) : '?' };
      }),
    };
  }, []);
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">分身书签组<span className="font-normal text-kumo-subtle">{data?.groups.length ?? 0}</span><InfoTip>在抽屉 ⋯ 菜单里选「创建分身」，把整个抽屉挂载到另一个抽屉。</InfoTip></h3>
        {data?.groups.map(({ g, from, to }) => (
          <div key={g.id} className="flex items-center gap-2 border-b border-kumo-line py-2 text-sm">
            <span className="flex-1">{from} <span className="text-kumo-subtle">→ 挂载到 →</span> {to}</span>
            <Button size="xs" icon={<LinkBreak />} onClick={() => void unmount(db, g.id)}>解除挂载</Button>
          </div>
        ))}
      </section>
      <section>
        <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">分身<span className="font-normal text-kumo-subtle">{data?.aliases.length ?? 0}</span></h3>
        {data?.aliases.map(({ a, b, where }) => (
          <div key={a.id} className="flex items-center gap-2 border-b border-kumo-line py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{b?.title}</span>
            <span className="text-xs text-kumo-subtle">{where}</span>
            <Button size="xs" icon={<LinkBreak />} onClick={() => void detachAlias(db, a.id)}>转为独立书签</Button>
          </div>
        ))}
      </section>
    </div>
  );
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const stamp = () => new Date().toISOString().slice(0, 10);

function Data({ onReimport }: { onReimport: (source: 'browser' | 'html') => void }) {
  const dialogs = useDialogs();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const restore = async (f: File) => {
    try {
      const backup = parseBackup(await f.text());
      const mode = await dialogs.choose({
        title: '恢复 Navill 备份',
        description: `备份时间：${new Date(backup.exportedAt).toLocaleString('zh-CN')}`,
        choices: [
          { value: 'merge', label: '合并到现有数据' },
          { value: 'replace', label: '覆盖现有数据，先自动下载当前备份', danger: true },
        ],
      });
      if (!mode) return;
      if (mode === 'replace') download(`navill-自动备份-${stamp()}.json`, JSON.stringify(await exportBackup(db)), 'application/json');
      await restoreBackup(db, backup, mode as 'merge' | 'replace');
      setMsg({ ok: true, text: '已恢复' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };
  return (
    <div className="flex flex-col gap-1">
      {msg && <Banner variant={msg.ok ? "default" : "error"} description={msg.text} />}
      <Row label="重新导入浏览器书签" info="默认追加并按 URL 去重，不影响已整理的内容"><Button size="sm" icon={<ArrowsClockwise />} onClick={() => onReimport('browser')}>重新导入</Button></Row>
      <Row label="导入书签 HTML 文件" info="浏览器导出的标准书签文件，规则同书签栏"><Button size="sm" icon={<FileArrowUp />} onClick={() => onReimport('html')}>选择文件</Button></Row>
      <Row label="从名称解析工作区图标" info="把工作区名称里的 emoji 去掉，前两个 emoji 作为图标，每次启动也会自动执行">
        <Button size="sm" icon={<Smiley />} onClick={async () => {
          const n = await parseWorkspaceIcons(db);
          setMsg({ ok: true, text: n ? `已处理 ${n} 个工作区` : '没有名称里带 emoji 的工作区' });
        }}>解析</Button>
      </Row>
      <Row label="导出 Navill 备份" info="JSON 文件，包含工作区、抽屉、书签、分身、场景、标签和使用统计">
        <Button size="sm" icon={<DownloadSimple />} onClick={async () => download(`navill-${stamp()}.json`, JSON.stringify(await exportBackup(db)), 'application/json')}>导出</Button>
      </Row>
      <Row label="恢复 Navill 备份">
        <Button size="sm" icon={<FileArrowUp />} onClick={() => file.current?.click()}>选择文件</Button>
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = ''; }} />
      </Row>
      <Row label="导出为浏览器书签 HTML" info="工作区 → 文件夹，抽屉 → 子文件夹">
        <Button size="sm" icon={<DownloadSimple />} onClick={async () => download(`navill-bookmarks-${stamp()}.html`, await exportNetscapeHtml(db), 'text/html')}>导出</Button>
      </Row>
      <Row label="清空使用统计" info="清除全部打开记录与次数">
        <Button size="sm" variant="secondary-destructive" icon={<Trash />} onClick={async () => {
          if (await dialogs.confirm({ title: '清空使用统计？', okText: '清空', danger: true })) await clearOpenEvents(db);
        }}>清空</Button>
      </Row>
    </div>
  );
}
