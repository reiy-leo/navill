import { Button, Tooltip } from '@cloudflare/kumo';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, ChevronRight, Circle, CircleCheck, PartyPopper, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { db } from '@/src/db';
import { allDone, doneCount, hideOnboarding, markDone, ONBOARDING_TASKS, showOnboarding, type OnboardingTask } from '@/src/lib/onboarding';
import { modKey } from './feedback';
import { useApp, useSelection } from './state';

import { tr } from '@/src/i18n';

const COLLAPSED_KEY = 'navill-onboarding-collapsed';

interface Props {
  onSearch: (prefill?: string) => void;
  onSyncSettings: () => void;
  className?: string;
}

/** 主页右下角浮动的新手任务卡片：任务完成由检测自动勾选，点击任务跳转或展开说明；全部完成后不再显示 */
export function OnboardingCard({ onSearch, onSyncSettings, className = '' }: Props) {
  const { settings, ready } = useApp();
  const { setOrganize } = useSelection();
  const state = settings.onboarding;
  const visible = ready && showOnboarding(state);
  const [celebrate, setCelebrate] = useState(false);
  const wasVisible = useRef(false);
  useEffect(() => {
    // 卡片显示期间完成了最后一项：显示一下「全部完成」再消失
    if (ready && wasVisible.current && !visible && allDone(state) && !state.hidden) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 2500);
      wasVisible.current = visible;
      return () => clearTimeout(t);
    }
    wasVisible.current = visible;
  }, [ready, visible, state]);

  if (celebrate) {
    return (
      <div className={`nv-onboarding flex items-center gap-2 rounded-xl border border-kumo-line bg-kumo-base px-3 py-2 text-sm shadow-lg ${className}`}>
        <PartyPopper size={16} className="text-kumo-brand" />{tr('新手任务全部完成')}
      </div>
    );
  }
  if (!visible) return null;
  return <Card state={state} onSearch={onSearch} onSyncSettings={onSyncSettings} onOrganize={() => setOrganize(true)} className={className} />;
}

function Card({ state, onSearch, onSyncSettings, onOrganize, className }: Props & { state: ReturnType<typeof useApp>['settings']['onboarding']; onOrganize: () => void }) {
  const { settings } = useApp();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1');
  // 默认展开第一个未完成的任务，让人一眼看到任务要做什么
  const [open, setOpen] = useState<OnboardingTask | null>(() => ONBOARDING_TASKS.find((t) => !state.done[t]) ?? null);
  const toggle = (v: boolean) => { setCollapsed(v); localStorage.setItem(COLLAPSED_KEY, v ? '1' : '0'); };
  useDataDetection(state.done);
  const n = doneCount(state);
  const total = ONBOARDING_TASKS.length;
  const mod = modKey();

  const TASKS: Record<OnboardingTask, { title: string; hint: string; go?: () => void }> = {
    searchKey: { title: tr('按 / 打开搜索'), hint: tr('在新标签页按 / 或 {0}L 打开搜索。', mod) },
    omnibox: { title: tr('地址栏输入 nv 搜索'), hint: tr('在地址栏输入 nv 加空格，再输入关键词，直接搜索 Navill 里的书签。') },
    tagSearch: { title: tr('用 #标签 筛选'), hint: tr('在搜索框输入 # 和标签名，只看带这个标签的书签。'), go: () => onSearch('#') },
    tagBookmark: { title: tr('给一个书签加标签'), hint: tr('右键书签选「标签…」，或在整理模式里批量设置。') },
    bgOpen: { title: tr('{0}+点击，后台打开书签', mod.replace(/\+$/, '')), hint: tr('按住 {0} 点击书签，或用鼠标中键，在后台新标签打开，可以连开几个。', mod.replace(/\+$/, '')) },
    organize: { title: tr('用整理模式批量移动'), hint: tr('在整理模式里多选书签，批量移动或创建分身。'), go: onOrganize },
    alias: { title: tr('创建一个分身'), hint: tr('同一个书签放进多个抽屉，改一处处处生效。右键书签选「分身到…」。') },
    syncKey: settings.sync.enabled
      ? { title: tr('用 {0}S 手动同步', mod), hint: tr('同步已开启，按 {0}S 立即同步一次。', mod) }
      : { title: tr('用 {0}S 手动同步', mod), hint: tr('先在设置里开启同步，之后按 {0}S 立即同步。', mod), go: onSyncSettings },
  };

  if (collapsed) {
    return (
      <button type="button" onClick={() => toggle(false)} className={`nv-onboarding flex items-center gap-1.5 rounded-full border border-kumo-line bg-kumo-base px-3 py-1.5 text-xs shadow-md hover:bg-kumo-tint ${className}`}>
        <CircleCheck size={14} className="text-kumo-brand" />{tr('新手任务')}<span className="text-kumo-subtle">{n}/{total}</span>
      </button>
    );
  }
  return (
    <section aria-label={tr('新手任务')} className={`nv-onboarding w-72 rounded-xl border border-kumo-line bg-kumo-base shadow-lg ${className}`}>
      <header className="flex items-center gap-1 px-3 pb-1 pt-2.5">
        <h2 className="text-sm font-semibold">{tr('新手任务')}</h2>
        <span className="text-xs text-kumo-subtle">{n}/{total}</span>
        <span className="flex-1" />
        <Tooltip content={tr('收起')} side="top" asChild>
          <Button variant="ghost" size="xs" shape="square" icon={<ChevronDown size="1em" />} aria-label={tr('收起')} onClick={() => toggle(true)} />
        </Tooltip>
        <Tooltip content={tr('不再显示')} side="top" asChild>
          <Button variant="ghost" size="xs" shape="square" icon={<X size="1em" />} aria-label={tr('不再显示')} onClick={() => void hideOnboarding()} />
        </Tooltip>
      </header>
      <div className="mx-3 mb-1 h-1 overflow-hidden rounded-full bg-kumo-tint">
        <div className="h-full rounded-full bg-kumo-brand transition-[width] duration-500" style={{ width: `${(n / total) * 100}%` }} />
      </div>
      <ul className="max-h-[50vh] overflow-y-auto px-1.5 pb-1.5">
        {ONBOARDING_TASKS.map((id) => {
          const t = TASKS[id];
          const done = Boolean(state.done[id]);
          const expanded = open === id && !done;
          return (
            <li key={id}>
              <button
                type="button" disabled={done} aria-expanded={expanded}
                className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm ${done ? 'text-kumo-subtle line-through' : 'hover:bg-kumo-tint'}`}
                onClick={() => { setOpen(expanded ? null : id); if (!expanded) t.go?.(); }}
              >
                {done ? <CircleCheck size={16} className="shrink-0 text-kumo-brand" aria-label={tr('已完成')} /> : <Circle size={16} className="shrink-0 text-kumo-subtle" />}
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                {!done && <ChevronRight size={14} className={`shrink-0 text-kumo-subtle transition-transform ${expanded ? 'rotate-90' : ''}`} />}
              </button>
              {expanded && <p className="pb-1.5 pl-8 pr-2 text-xs leading-relaxed text-kumo-subtle">{t.hint}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** 靠数据判断的任务：有带标签的书签、有分身 */
function useDataDetection(done: Record<string, number>) {
  const needTag = !done.tagBookmark;
  const needAlias = !done.alias;
  const found = useLiveQuery(async () => ({
    tag: needTag ? Boolean(await db.bookmarks.filter((b) => !b.archivedAt && b.tagIds.length > 0).first()) : false,
    alias: needAlias ? (await db.aliasGroups.count()) > 0 || Boolean(await db.placements.filter((p) => p.isAlias).first()) : false,
  }), [needTag, needAlias]);
  useEffect(() => {
    if (found?.tag) void markDone('tagBookmark');
    if (found?.alias) void markDone('alias');
  }, [found?.tag, found?.alias]);
}
