import { tr } from '@/src/i18n';

/** 扩展介绍：首屏欢迎页与「关于本扩展」共用；改动时同步 docs/STORE.md */
export const INTRO = [
  '导入浏览器书签后，你可以按用途把它们重新整理成多个工作区，例如影视、AI、工作、软件安装、数据分析、色彩管理。工作区内可以再用抽屉细分，也可以不分；抽屉支持多种布局。',
  '工作区和抽屉可以按使用场景分组，例如演讲模式、娱乐模式。切换场景后，只显示当下需要的内容。',
  '书签和抽屉可以“分身”到其他抽屉或工作区，同一份内容出现在多处。遇到难以只归到一处的书签，不必再纠结放在哪里。',
  '书签和设置可以同步到 Google Drive 或 WebDAV，在多个浏览器之间保持一致。',
  '你还可以把整理好的抽屉或工作区分享出去，别人一键就能安装使用。',
];

export function Intro({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-2 text-left text-sm leading-relaxed text-kumo-subtle ${className}`}>
      {INTRO.map((p) => <p key={p}>{tr(p)}</p>)}
    </div>
  );
}
