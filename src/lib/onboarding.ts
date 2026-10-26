import { getSettings, updateSettings, type OnboardingState } from './settings';

/**
 * 新手任务：主页右下角的浮动清单。不阻断使用，完成状态只由检测自动勾选（不能手动勾），
 * 进度随设置同步，多台设备的完成记录取并集；全部完成后卡片不再显示。
 */
export const ONBOARDING_TASKS = ['searchKey', 'omnibox', 'tagSearch', 'tagBookmark', 'bgOpen', 'organize', 'alias', 'syncKey', 'savePage', 'dataOwn'] as const;
export type OnboardingTask = (typeof ONBOARDING_TASKS)[number];

export const EMPTY_ONBOARDING: OnboardingState = { done: {}, hidden: false };

export const doneCount = (s: OnboardingState) => ONBOARDING_TASKS.filter((t) => s.done[t]).length;
export const allDone = (s: OnboardingState) => doneCount(s) === ONBOARDING_TASKS.length;
/** 卡片是否显示：没关掉且没全部完成 */
export const showOnboarding = (s: OnboardingState) => !s.hidden && !allDone(s);

/** 合并两台设备的进度：完成记录取并集（保留较早的完成时间），关闭任一处即关闭 */
export function mergeOnboarding(a: OnboardingState | undefined, b: OnboardingState | undefined): OnboardingState {
  const x = a ?? EMPTY_ONBOARDING;
  const y = b ?? EMPTY_ONBOARDING;
  const done: Record<string, number> = { ...x.done };
  for (const [k, at] of Object.entries(y.done)) done[k] = done[k] ? Math.min(done[k], at) : at;
  return { done, hidden: x.hidden || y.hidden };
}

export const sameOnboarding = (a: OnboardingState | undefined, b: OnboardingState | undefined) =>
  JSON.stringify(mergeOnboarding(a, undefined)) === JSON.stringify(mergeOnboarding(b, undefined));

/** 检测到用户完成了某项任务时调用；已完成或已全部完成则不写设置 */
export async function markDone(task: OnboardingTask): Promise<void> {
  try {
    const s = await getSettings();
    if (s.onboarding.done[task]) return;
    await updateSettings({ onboarding: { ...s.onboarding, done: { ...s.onboarding.done, [task]: Date.now() } } });
  } catch (e) {
    console.warn('[Navill] 记录新手任务失败', e);
  }
}

/** 关闭整个新手任务卡片（唯一的手动操作） */
export async function hideOnboarding(): Promise<void> {
  const s = await getSettings();
  await updateSettings({ onboarding: { ...s.onboarding, hidden: true } });
}

/** 「你的数据你负责」说明页，lang 用当前界面语言（ydiyr 支持的语言和 Navill 一致） */
export const dataOwnUrl = (lang: string) => `https://your-data-is-your-responsibility.rei8t.dev/?lang=${encodeURIComponent(lang)}`;

/** 搜索词里带 #标签 */
export const isTagQuery = (q: string) => /(^|\s)#\S/.test(q);
