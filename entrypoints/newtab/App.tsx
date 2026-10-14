import { Button, Empty, Surface } from '@cloudflare/kumo';
import { BookmarksSimple, DownloadSimple, Plus } from '@phosphor-icons/react';

// M0 空壳：M1 接入首次导入，M2 渲染工作区 → 抽屉 → 书签
export default function App() {
  return (
    <main className="flex min-h-full items-center justify-center p-8">
      <Surface className="w-full max-w-xl rounded-xl p-8">
        <Empty
          size="lg"
          icon={<BookmarksSimple size={48} />}
          title="欢迎使用 Navill"
          description="导入浏览器书签，按「工作区 → 抽屉 → 书签」重新整理。"
        />
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="primary" icon={<DownloadSimple />} disabled>
            导入浏览器书签
          </Button>
          <Button icon={<Plus />} disabled>
            新建工作区
          </Button>
        </div>
      </Surface>
    </main>
  );
}
