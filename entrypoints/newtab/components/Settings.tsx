import { InfoTip } from '@/src/ui/InfoTip';
import { Badge, Banner, Button, Checkbox, Input, Select, Switch, Tabs, Text } from '@cloudflare/kumo';
import { DownloadSimple, FileArrowUp, Plus, Trash, ArrowsClockwise, SignOut, GoogleLogo, LinkBreak, Smiley, ListBullets, Play } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, CloudCog, Database, Keyboard, Layers, Palette, Settings2, Tag, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MODE_DEFAULT, PALETTE, db, type Mode } from '@/src/db';
import { ModeIcon, modeLook } from '@/src/ui/ModeSwitcher';
import { hasBingPermission, requestBingPermission } from '@/src/lib/bing';
import { IconBox } from '@/src/ui/ColorPicker';
import { LucidePicker } from '@/src/ui/LucidePicker';
import { exportBackup, parseBackup, restoreBackup } from '@/src/lib/io/backup';
import { exportNetscapeHtml } from '@/src/lib/io/html';
import type { Settings as S, ToastEvent, ToastPosition, ToastStyle } from '@/src/lib/settings';
import { clearOpenEvents, clearVisits, seedFromHistory, parseWorkspaceIcons, createMode, createTag, deleteMode, deleteTag, renameMode, renameTag, setModeLook, setShowAdult, setVisible } from '@/src/lib/store';
import { isConfigured, redirectUri } from '@/src/lib/sync/auth';
import { connectWebdavAndLog, deleteRemoteData, disconnectSync, signInAndLog } from '@/src/lib/sync/engine';
import { syncProviderItem, type SyncProvider } from '@/src/lib/sync/backend';
import { normalizeUrl, originPattern, webdavConfigItem, WEBDAV_DIR, type WebdavConfig } from '@/src/lib/sync/webdav';
import { isMac, modKey, syncFromPage } from '@/src/ui/feedback';
import { toast } from '@/src/ui/toast';
import { useDialogs } from '@/src/ui/dialogs';
import { WorkspaceIcon } from '@/src/ui/icons';
import { Modal } from '@/src/ui/Modal';
import { useApp } from '@/src/ui/state';
import { useSyncStatus } from '@/src/ui/useSettings';
import { clearIconCache } from '@/src/lib/icons/fetcher';
import { hasHistory, removeHistory, requestHistory } from '@/src/lib/suggest';

import { dateLocale, getLangSetting, setLanguage, tr } from '@/src/i18n';
export type Tab = 'general' | 'look' | 'modes' | 'tags' | 'sync' | 'toast' | 'keys' | 'data';

const TABS: Tab[] = ['general', 'look', 'modes', 'tags', 'sync', 'toast', 'keys', 'data'];
const TAB_KEY = 'navill-settings-tab';
/** 上次打开的设置页签（按设备，存 localStorage） */
export function lastSettingsTab(): Tab {
  const t = localStorage.getItem(TAB_KEY) as Tab | null;
  return t && TABS.includes(t) ? t : 'general';
}

export function SettingsDialog({ open, onClose, onReimport, initialTab = 'general' }: { open: boolean; onClose: () => void; onReimport: (source: 'browser' | 'html') => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <Modal open={open} onClose={onClose} title={tr('设置')} size="xl">
      <div className="overflow-x-auto [scrollbar-width:none]">
      <Tabs
        variant="underline"
        value={tab}
        onValueChange={(v) => { setTab(v as Tab); localStorage.setItem(TAB_KEY, v as string); }}
        tabs={[
          ['general', tr('通用'), Settings2], ['look', tr('外观'), Palette], ['modes', tr('场景'), Layers], ['tags', tr('标签'), Tag],
          ['sync', tr('同步'), CloudCog], ['toast', tr('提醒'), Bell], ['keys', tr('快捷键'), Keyboard], ['data', tr('数据'), Database],
        ].map(([value, label, Icon]) => ({ value: value as string, label: <TabLabel icon={Icon as LucideIcon} text={label as string} /> }))}
      />
      </div>
      <div className="mt-4 min-h-[50vh]">
        {tab === 'general' && <General />}
        {tab === 'look' && <Look />}
        {tab === 'modes' && <Modes />}
        {tab === 'tags' && <Tags />}
        {tab === 'sync' && <Sync />}
        {tab === 'toast' && <Toasts />}
        {tab === 'keys' && <Shortcuts />}
        {tab === 'data' && <Data onReimport={(s) => { onClose(); onReimport(s); }} />}
      </div>
    </Modal>
  );
}

function TabLabel({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return <span className="inline-flex items-center gap-1.5"><Icon size={15} strokeWidth={1.75} />{text}</span>;
}

/** hint：状态类短文字（常显）；info：说明类文字（收进 ⓘ） */
function Row({ label, children, hint, info }: { label: string; children: ReactNode; hint?: string; info?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-kumo-line py-3 last:border-0">
      <div>
        <div className="flex items-center gap-1 text-sm font-medium">{label}{info && <InfoTip label={tr('{0}说明', label)}>{info}</InfoTip>}</div>
        {hint && <div className="text-xs text-kumo-subtle">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** 设置分组：小标题 + 一张卡片包住若干行 */
function Section({ title, info, children }: { title: string; /** 紧跟在小标题后的说明气泡 */ info?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-5 last:mb-0">
      <h3 className="mb-1.5 flex items-center gap-0.5 px-1 text-xs font-medium text-kumo-subtle">{title}{info}</h3>
      <div className="rounded-lg border border-kumo-line bg-kumo-base px-4">{children}</div>
    </section>
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
      <Row label={tr('读取网页自带的高清图标')} info={tr('授权后优先用网站自己的 apple-touch-icon / manifest 图标，最清晰；不授权则用 icon.horse 与 Google 图标服务')}>
        {has ? (
          <Button size="sm" onClick={async () => { await browser.permissions.remove({ origins: ['<all_urls>'] }); setGranted(false); }}>{tr('撤销授权')}</Button>
        ) : (
          <Button size="sm" variant="primary" onClick={async () => { const ok = await browser.permissions.request({ origins: ['<all_urls>'] }); setGranted(ok); if (ok) { await clearIconCache(db); setMsg(tr('已授权，图标将重新获取')); } }}>{tr('授权')}</Button>
        )}
      </Row>
      <Row label={tr('高清图标缓存')} hint={msg || tr('已缓存 {0} 个网站，只存本机、不同步', cached)}>
        <Button size="sm" icon={<ArrowsClockwise />} onClick={async () => { const n = await clearIconCache(db); setMsg(tr('已清除 {0} 条，打开页面时会重新获取', n)); }}>{tr('重新获取')}</Button>
      </Row>
    </>
  );
}

function HistoryRow() {
  const initial = useLiveQuery(() => hasHistory(), []);
  const [granted, setGranted] = useState<boolean | undefined>(undefined);
  const on = granted ?? initial ?? false;
  return (
    <Row label={tr('读取浏览记录')} info={tr('新建或编辑书签时，输入名称或网址会从本机浏览记录里补全；书签的打开次数也会参考本机访问次数，让「最常用」和智能排序更准。浏览记录只在本机读取，不上传。关闭即撤销授权')}>
      <Switch checked={on} aria-label={tr('读取浏览记录')} onClick={async () => {
        if (on) { const off = await removeHistory(); setGranted(!off); if (off) await clearVisits(db); }
        else { const ok = await requestHistory(); setGranted(ok); if (ok) await seedFromHistory(db, true); }
      }} />
    </Row>
  );
}

function General() {
  const { settings, updateSettings } = useApp();
  const workspaces = useLiveQuery(() => db.workspaces.orderBy('order').toArray(), []) ?? [];
  const set = (p: Partial<S>) => void updateSettings(p);
  const wsItems = Object.fromEntries([['last', tr('上次打开的')], ['home', tr('主页')], ...workspaces.map((w) => [w.id, w.name])]) as Record<string, string>;
  return (
    <div>
      <Section title={tr('语言')}>
      <Row label={tr('界面语言')}><Pick label={tr('界面语言')} value={getLangSetting()} items={{ auto: tr('跟随浏览器'), zh: '中文', en: 'English' }} onChange={(v) => void setLanguage(v)} /></Row>
      </Section>
      <Section title={tr('打开')}>
      <Row label={tr('默认进入的工作区')}><Pick label={tr('默认工作区')} value={settings.startWorkspace} items={wsItems} onChange={(startWorkspace) => set({ startWorkspace })} /></Row>
      <Row label={tr('书签打开方式')} info={tr('Ctrl/⌘ 或中键点击始终在后台新标签打开')}><Pick label={tr('打开方式')} value={settings.openMode} items={{ current: tr('当前标签'), new: tr('新标签'), background: tr('后台新标签') }} onChange={(openMode) => set({ openMode })} /></Row>
      </Section>
      <Section title={tr('书签编辑')}>
      <HistoryRow />
      </Section>
      <Section title={tr('网站图标')}>
      <IconRows />
      </Section>
      <Section title={tr('新标签页')}>
      <Row label={tr('新标签页')} info={tr('Navill 接管新标签页；如需关闭，请在浏览器扩展管理中停用或改用弹窗')}><Badge variant="neutral">{tr('已接管')}</Badge></Row>
      </Section>
    </div>
  );
}

function Look() {
  const { settings, updateSettings } = useApp();
  const set = (p: Partial<S>) => void updateSettings(p);
  // Bing 图片需要访问 bing.com：选择时申请权限，被拒绝就不切换
  const pickBackground = async (background: S['background']) => {
    if (background === 'bing' && !(await hasBingPermission()) && !(await requestBingPermission())) return;
    set({ background });
  };
  return (
    <div>
      <Section title={tr('主题')}>
      <Row label={tr('主题')}><Pick label={tr('主题')} value={settings.theme} items={{ system: tr('跟随系统'), light: tr('浅色'), dark: tr('深色') }} onChange={(theme) => set({ theme })} /></Row>
      <Row label={tr('卡片风格')}><Pick label={tr('卡片风格')} value={settings.surface} items={{ tint: tr('色调卡片'), glass: tr('磨砂玻璃'), bare: tr('无框漂浮') }} onChange={(surface) => set({ surface })} /></Row>
      </Section>
      <Section title={tr('背景')}>
      <Row label={tr('背景')}><Pick label={tr('背景')} value={settings.background} items={{ plain: tr('纯色'), gradient: tr('颜色渐变'), bing: tr('Bing 每日图片') }} onChange={(background) => void pickBackground(background)} /></Row>
      {settings.background === 'bing' && (
        <Row label={tr('磨砂模糊')}><Pick label={tr('磨砂模糊')} value={String(settings.backgroundBlur) as '0' | '8' | '24'} items={{ '0': tr('不模糊'), '8': tr('轻度'), '24': tr('强') }} onChange={(v) => set({ backgroundBlur: Number(v) as 0 | 8 | 24 })} /></Row>
      )}
      </Section>
      <Section title={tr('工作区导航')}>
      <Row label={tr('导航位置')}><Pick label={tr('导航位置')} value={settings.navPosition} items={{ left: tr('左侧'), right: tr('右侧'), top: tr('顶部'), bottom: tr('底部') }} onChange={(navPosition) => set({ navPosition })} /></Row>
      <Row label={tr('工作区显示')} info={tr('侧边栏收起时只显示图标')}><Pick label={tr('工作区显示')} value={settings.navLabel} items={{ both: tr('图标 + 名称'), icon: tr('只显示图标'), name: tr('只显示名称') }} onChange={(navLabel) => set({ navLabel })} /></Row>
      <Row label={tr('工作区图标')} info={tr('Emoji、线性图标、字符三种都会保存，在编辑工作区里分别设置')}><Pick label={tr('工作区图标')} value={settings.workspaceIconStyle} items={{ emoji: 'Emoji', lucide: tr('线性图标'), char: tr('字符') }} onChange={(workspaceIconStyle) => set({ workspaceIconStyle })} /></Row>
      </Section>
      <Section title={tr('抽屉')}>
      <Row label={tr('抽屉名显示')}><Pick label={tr('抽屉名显示')} value={settings.drawerName} items={{ full: tr('完整路径'), last: tr('仅末级') }} onChange={(drawerName) => set({ drawerName })} /></Row>
      <Row label={tr('抽屉标题栏')}><Pick label={tr('抽屉标题栏')} value={settings.drawerHead} items={{ peek: tr('悬停显示'), show: tr('始终显示') }} onChange={(drawerHead) => set({ drawerHead })} /></Row>
      </Section>
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
        <Button size="sm" variant="ghost" icon={<Plus />} onClick={async () => { const m = await createMode(db, tr('新场景')); setFresh(m.id); setSel(m.id); }}>{tr('新建场景')}</Button>
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
        <IconBox color={look.color} onColor={(color) => void setModeLook(db, mode.id, { color })} label={tr('场景颜色')}>
          <span className="inline-flex size-8 items-center justify-center rounded-md border border-kumo-line"><ModeIcon mode={mode} size={20} /></span>
        </IconBox>
        <Input size="sm" className="flex-1" value={name} disabled={isDefault} autoFocus={autoFocus} onFocus={(e) => autoFocus && e.currentTarget.select()} onChange={(e) => { setName(e.target.value); void renameMode(db, mode.id, e.target.value); }} aria-label={tr('场景名称')} />
        {!isDefault && (
          <Button size="sm" variant="secondary-destructive" icon={<Trash />} onClick={async () => {
            if (await dialogs.confirm({ title: tr('删除场景「{0}」？', mode.name), okText: tr('删除'), danger: true })) {
              await deleteMode(db, mode.id);
              onDeleted();
            }
          }}>{tr('删除')}</Button>
        )}
      </div>
      <LucidePicker allowNone={false} value={look.icon} onChange={(icon) => icon && void setModeLook(db, mode.id, { icon })} />
      <Switch label={tr('显示 18+ 内容')} checked={mode.showAdult} onClick={() => void setShowAdult(db, mode.id, !mode.showAdult)} />
      {isDefault ? (
        <div><InfoTip text={tr('可见性')}>{tr('「默认」场景显示全部工作区与抽屉，可见性不可编辑。')}</InfoTip></div>
      ) : (
        <div>
          <div className="mb-2 text-sm font-medium">{tr('在此场景中可见的工作区与抽屉')}</div>
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
  const add = async () => { if (name.trim()) { await createTag(db, name); setName(''); } };
  const count = (id: string) => <span className="shrink-0 text-xs text-kumo-subtle">{counts?.get(id) ?? 0} {tr('个书签')}</span>;
  return (
    <div>
      <Section title={tr('内置')} info={<InfoTip>{tr('标签只用于书签，一个书签可以有多个标签。搜索时输入 #标签名 筛选。')}</InfoTip>}>
        {tags.filter((t) => t.builtin).map((t) => (
          <div key={t.id} className="flex items-center gap-2 border-b border-kumo-line py-2.5 last:border-b-0">
            <span className="flex-1 text-sm">#{t.name}</span>
            {count(t.id)}
          </div>
        ))}
      </Section>
      <Section title={tr('自定义')}>
        {tags.filter((t) => !t.builtin).map((t) => (
          <div key={t.id} className="flex items-center gap-2 border-b border-kumo-line py-2">
            <Input size="sm" className="flex-1" value={t.name} onChange={(e) => void renameTag(db, t.id, e.target.value)} aria-label={tr('标签名')} />
            {count(t.id)}
            <Button size="xs" variant="ghost" shape="square" icon={<Trash />} aria-label={tr('删除标签')} onClick={async () => {
              if (await dialogs.confirm({ title: tr('删除标签「{0}」？', t.name), description: tr('会从所有书签上移除。'), okText: tr('删除'), danger: true })) await deleteTag(db, t.id);
            }} />
          </div>
        ))}
        <div className="flex items-center gap-2 py-3">
          <Input className="!h-8 flex-1" placeholder={tr('新标签名')} aria-label={tr('新标签名')} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
          <Button className="!h-8" icon={<Plus />} onClick={() => void add()}>{tr('添加')}</Button>
        </div>
      </Section>
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
  const provider = useStored(syncProviderItem, 'google');
  const webdav = useStored(webdavConfigItem, null);
  const [form, setForm] = useState({ url: '', username: '', password: '' });
  const signedIn = status.state !== 'signed-out';
  const googleMissing = provider === 'google' && !isConfigured();
  const connectWebdav = () => {
    let url: string;
    try {
      url = normalizeUrl(form.url);
    } catch {
      setErr(tr('服务器地址不正确'));
      return;
    }
    // 授权请求必须在点击后立即发起
    const granted = browser.permissions.request({ origins: [originPattern(url)] });
    void run(async () => {
      if (!(await granted)) throw new Error(tr('需要授权 Navill 访问这个服务器'));
      const cfg: WebdavConfig = { url, username: form.username.trim(), password: form.password };
      await connectWebdavAndLog(db, cfg);
      setForm({ url: '', username: '', password: '' });
      const next = await updateSettings({ sync: { ...settings.sync, enabled: true } });
      await syncFromPage(db, next);
    });
  };
  const disconnectBtn = (text: string) => (
    <Button size="sm" icon={<SignOut />} onClick={() => void run(async () => { await disconnectSync(db); await updateSettings({ sync: { ...settings.sync, enabled: false } }); })}>{text}</Button>
  );
  return (
    <div className="flex flex-col gap-1">
      {err && <Banner variant="error" description={err} />}
      {status.state === 'error' && status.message && <Banner variant="error" title={tr('上次同步失败')} description={status.message} />}
      <Section title={tr('账号')} info={<InfoTip label={tr('数据存在哪')}>{provider === 'webdav'
        ? tr('数据保存在你的 WebDAV 服务器根目录下的 {0} 文件夹里，账号和应用密码只保存在本机。', WEBDAV_DIR)
        : tr('数据保存在你自己 Google Drive 的隐藏应用目录（appDataFolder），只申请 drive.appdata 权限，看不到你的其他文件。')}</InfoTip>}>
      <Row label={tr('同步方式')} info={signedIn ? tr('断开当前账号后才能切换') : tr('二选一')}>
        <Select aria-label={tr('同步方式')} className="w-44" value={provider} disabled={signedIn} items={{ google: 'Google Drive', webdav: 'WebDAV' }} onValueChange={(v) => v && void syncProviderItem.setValue(v as SyncProvider)} />
      </Row>
      {provider === 'google' && (googleMissing ? (
        <Banner variant="alert" title={tr('未配置 Google OAuth 客户端 ID')} description={tr('构建时在 .env 中设置 WXT_GOOGLE_CLIENT_ID。Google Cloud 中为本扩展登记回调地址：{0}', redirectUri())} />
      ) : (
      <Row label={tr('Google 账号')} hint={signedIn ? tr('已授权') : tr('未登录')}>
        {signedIn ? disconnectBtn(tr('退出登录')) : (
          <Button size="sm" variant="primary" icon={<GoogleLogo />} loading={busy} onClick={() => void run(async () => { await signInAndLog(db); const next = await updateSettings({ sync: { ...settings.sync, enabled: true } }); await syncFromPage(db, next); })}>{tr('登录 Google')}</Button>
        )}
      </Row>
      ))}
      {provider === 'webdav' && (webdav && signedIn ? (
        <Row label="WebDAV" hint={`${webdav.username} · ${new URL(webdav.url).host}`}>{disconnectBtn(tr('断开连接'))}</Row>
      ) : (
        <form className="flex flex-col gap-2 py-2" onSubmit={(e) => { e.preventDefault(); connectWebdav(); }}>
          <Input size="sm" placeholder={tr('服务器地址，如 https://dav.jianguoyun.com/dav/')} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} aria-label={tr('服务器地址')} />
          <div className="flex gap-2">
            <Input size="sm" className="flex-1" placeholder={tr('用户名')} autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} aria-label={tr('用户名')} />
            <Input size="sm" className="flex-1" type="password" placeholder={tr('应用密码')} autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} aria-label={tr('应用密码')} />
          </div>
          <div className="flex justify-end"><Button size="sm" variant="primary" type="submit" loading={busy} disabled={!form.url.trim() || !form.username.trim() || !form.password}>{tr('连接')}</Button></div>
        </form>
      ))}
      </Section>
      <Section title={tr('同步')}>
      <Row label={tr('自动同步')}><Switch checked={settings.sync.enabled} disabled={!signedIn} onClick={() => void updateSettings({ sync: { ...settings.sync, enabled: !settings.sync.enabled } })} /></Row>
      <Row label={tr('同步频率')} info={tr('只在有改动时上传')}><Select aria-label={tr('同步频率')} className="w-44" value={String(settings.sync.intervalMinutes)} items={{ '5': tr('每 5 分钟'), '15': tr('每 15 分钟'), '60': tr('每 60 分钟'), '0': tr('仅手动') }} onValueChange={(v) => v && void updateSettings({ sync: { ...settings.sync, intervalMinutes: Number(v) as 0 | 5 | 15 | 60 } })} /></Row>
      <Row label={tr('立即同步')} hint={status.lastSyncAt ? tr('上次同步：{0}', new Date(status.lastSyncAt).toLocaleString(dateLocale)) : tr('尚未同步')}>
        <Button size="sm" icon={<ArrowsClockwise />} disabled={!signedIn} loading={busy || status.state === 'syncing'} onClick={() => void run(() => syncFromPage(db, settings))}>{tr('立即同步')}</Button>
      </Row>
      <Row label={tr('核心数据')} info={tr('工作区、抽屉、书签、分身、场景、标签和删除记录始终同步')}><Badge variant="neutral">{tr('始终同步')}</Badge></Row>
      <Row label={tr('冲突策略')} info={tr('按条目合并，修改时间新的一方胜出')}><Badge variant="neutral">{tr('按条目合并')}</Badge></Row>
      </Section>
      <Section title={tr('日志')}>
      <Row label={tr('日志')}><Button size="sm" icon={<ListBullets />} onClick={() => setLogsOpen(true)}>{tr('查看日志')}</Button></Row>
      </Section>
      {logsOpen && <LogViewer onClose={() => setLogsOpen(false)} />}
      <Section title={tr('云端数据')}>
      <Row label={tr('删除云端数据')} info={tr('只删除云端的 Navill 数据，本地不受影响')}>
        <Button size="sm" variant="secondary-destructive" icon={<Trash />} disabled={!signedIn} onClick={async () => {
          if (await dialogs.confirm({ title: tr('删除云端的 Navill 数据？'), okText: tr('删除'), danger: true })) await run(() => deleteRemoteData(db));
        }}>{tr('删除')}</Button>
      </Row>
      </Section>
    </div>
  );
}

/** 读取并订阅一个 storage 项 */
function useStored<T>(item: { getValue(): Promise<T>; watch(cb: (v: T | null) => void): () => void }, fallback: T): T {
  const [v, setV] = useState<T>(fallback);
  useEffect(() => {
    void item.getValue().then(setV);
    return item.watch((n) => setV((n ?? fallback) as T));
  }, [item]);
  return v;
}

function LogViewer({ onClose }: { onClose: () => void }) {
  const data = useLiveQuery(async () => ({
    logs: await db.logs.orderBy('at').reverse().limit(500).toArray(),
    total: await db.logs.count(),
    me: (await db.meta.get('deviceId'))?.value as string | undefined,
  }), []);
  return (
    <Modal open size="lg" title={tr('日志')} onClose={onClose}>
      {!data ? null : data.logs.length === 0 ? <p className="py-8 text-center text-sm text-kumo-subtle">{tr('还没有日志')}</p> : (
        <div className="flex flex-col">
          {data.logs.map((l) => (
            <div key={l.id} className="flex items-baseline gap-3 border-b border-kumo-line py-2 text-sm last:border-0">
              <span className="w-32 shrink-0 tabular-nums text-kumo-subtle">{new Date(l.at).toLocaleString(dateLocale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              <span className="w-28 shrink-0 truncate text-kumo-subtle">{l.deviceId === data.me ? tr('本机') : l.device ?? tr('其他设备')}</span>
              <span className="min-w-0 flex-1 break-words">{l.summary}</span>
            </div>
          ))}
          {data.total > data.logs.length && <p className="pt-3 text-center text-xs text-kumo-subtle">{tr('只显示最近')} {data.logs.length} {tr('条，共')} {data.total} {tr('条')}</p>}
        </div>
      )}
    </Modal>
  );
}

const POSITIONS: Record<ToastPosition, string> = {
  'top-center': tr('中顶'), 'top-right': tr('右上'), 'bottom-right': tr('右下'), 'top-left': tr('左上'), 'bottom-left': tr('左下'), 'bottom-center': tr('中底'),
};
const STYLES: Record<ToastStyle, string> = { plain: tr('简洁'), tinted: tr('彩色'), dark: tr('深色'), pill: tr('胶囊') };
const EVENTS: Array<[ToastEvent, string]> = [
  ['sync', tr('同步完成')], ['create', tr('新建书签')], ['edit', tr('修改书签')], ['delete', tr('删除书签')], ['move', tr('移动书签')],
];

function Toasts() {
  const { settings, updateSettings } = useApp();
  const t = settings.toast;
  const set = (p: Partial<S['toast']>) => void updateSettings({ toast: { ...t, ...p } });
  return (
    <div className="flex flex-col gap-1">
      <Section title={tr('外观')} info={<InfoTip>{tr('提醒设置只对本机生效。按')} {modKey()}{tr('S 时「已跳过」这类直接反馈总是显示。')}</InfoTip>}>
      <Row label={tr('位置')}><Pick label={tr('位置')} value={t.position} items={POSITIONS} onChange={(position) => set({ position })} /></Row>
      <Row label={tr('样式')}>
        <div className="flex items-center gap-2">
          <Pick label={tr('样式')} value={t.style} items={STYLES} onChange={(style) => set({ style })} />
          <Button size="sm" icon={<Play />} onClick={() => toast(tr('新建书签「Navill 示例」'))}>{tr('预览')}</Button>
        </div>
      </Row>
      </Section>
      <Section title={tr('提醒内容')}>
      {EVENTS.map(([k, label]) => (
        <Row key={k} label={label}>
          <Switch checked={t.show[k]} aria-label={label} onClick={() => set({ show: { ...t.show, [k]: !t.show[k] } })} />
        </Row>
      ))}
      </Section>
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
      <Section title={tr('同步')}>
      <Row label={tr('立即同步')} info={tr('3 分钟内同步过，或没有需要上传的改动时跳过并提醒；同步未开启或未登录时也会提醒')}><Kbd>{combo('S')}</Kbd></Row>
      </Section>
      <Section title={tr('搜索')}>
      <Row label={tr('搜索')} info={tr('焦点在地址栏时，浏览器会先处理 {0}；在 Navill 页面里按才会打开搜索', combo('L'))}><Kbd>{combo('L')}</Kbd></Row>
      <Row label={tr('搜索')}><Kbd>/</Kbd></Row>
      </Section>
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
        title: tr('恢复 Navill 备份'),
        description: tr('备份时间：{0}', new Date(backup.exportedAt).toLocaleString(dateLocale)),
        choices: [
          { value: 'merge', label: tr('合并到现有数据') },
          { value: 'replace', label: tr('覆盖现有数据，先自动下载当前备份'), danger: true },
        ],
      });
      if (!mode) return;
      if (mode === 'replace') download(tr('navill-自动备份-{0}.json', stamp()), JSON.stringify(await exportBackup(db)), 'application/json');
      await restoreBackup(db, backup, mode as 'merge' | 'replace');
      setMsg({ ok: true, text: tr('已恢复') });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };
  return (
    <div className="flex flex-col gap-1">
      {msg && <Banner variant={msg.ok ? "default" : "error"} description={msg.text} />}
      <Section title={tr('导入')}>
      <Row label={tr('重新导入浏览器书签')} info={tr('默认追加并按 URL 去重，不影响已整理的内容')}><Button size="sm" icon={<ArrowsClockwise />} onClick={() => onReimport('browser')}>{tr('重新导入')}</Button></Row>
      <Row label={tr('导入书签 HTML 文件')} info={tr('浏览器导出的标准书签文件，规则同书签栏')}><Button size="sm" icon={<FileArrowUp />} onClick={() => onReimport('html')}>{tr('选择文件')}</Button></Row>
      </Section>
      <Section title={tr('备份与导出')}>
      <Row label={tr('导出 Navill 备份')} info={tr('JSON 文件，包含工作区、抽屉、书签、分身、场景、标签和使用统计')}>
        <Button size="sm" icon={<DownloadSimple />} onClick={async () => download(`navill-${stamp()}.json`, JSON.stringify(await exportBackup(db)), 'application/json')}>{tr('导出')}</Button>
      </Row>
      <Row label={tr('恢复 Navill 备份')}>
        <Button size="sm" icon={<FileArrowUp />} onClick={() => file.current?.click()}>{tr('选择文件')}</Button>
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = ''; }} />
      </Row>
      <Row label={tr('导出为浏览器书签 HTML')} info={tr('工作区 → 文件夹，抽屉 → 子文件夹')}>
        <Button size="sm" icon={<DownloadSimple />} onClick={async () => download(`navill-bookmarks-${stamp()}.html`, await exportNetscapeHtml(db), 'text/html')}>{tr('导出')}</Button>
      </Row>
      </Section>
      <Section title={tr('维护')}>
      <Row label={tr('从名称解析工作区图标')} info={tr('把工作区名称里的 emoji 去掉，前两个 emoji 作为图标，每次启动也会自动执行')}>
        <Button size="sm" icon={<Smiley />} onClick={async () => {
          const n = await parseWorkspaceIcons(db);
          setMsg({ ok: true, text: n ? tr('已处理 {0} 个工作区', n) : tr('没有名称里带 emoji 的工作区') });
        }}>{tr('解析')}</Button>
      </Row>
      <Row label={tr('清空使用统计')} info={tr('清除全部打开记录与次数')}>
        <Button size="sm" variant="secondary-destructive" icon={<Trash />} onClick={async () => {
          if (await dialogs.confirm({ title: tr('清空使用统计？'), okText: tr('清空'), danger: true })) await clearOpenEvents(db);
        }}>{tr('清空')}</Button>
      </Row>
      </Section>
    </div>
  );
}
