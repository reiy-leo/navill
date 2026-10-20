import { tr } from '@/src/i18n';

/** 扩展介绍：首屏欢迎页与「关于本扩展」共用 */
export const INTRO = [
  '把浏览器书签导入后，重新整理成不同的工作区，例如影视、AI、工作、软件安装、数据分析、色彩管理等。工作区中可用零个或多个抽屉细化，抽屉可用多种布局组织。',
  '可以把工作区、抽屉分成不同的使用场景，例如演讲模式、娱乐模式。',
  '书签、抽屉支持分身到不同抽屉、工作区，对于一些难归类到一个抽屉、工作区的书签非常友好。',
  '可以把书签和配置同步到 Google Drive 或 WebDAV 中，这样可以在多个浏览器中同步。',
  '此外，如果你想把自己整理好的抽屉或工作区共享给其他人安装使用，也是一件很好的事情。',
];

export function Intro({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-2 text-left text-sm leading-relaxed text-kumo-subtle ${className}`}>
      {INTRO.map((p) => <p key={p}>{tr(p)}</p>)}
    </div>
  );
}
