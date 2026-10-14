import { Button, Empty, Text } from '@cloudflare/kumo';
import { BookmarksSimple, CloudArrowDown, DownloadSimple, FileArrowUp, Plus } from '@phosphor-icons/react';
import { db } from '@/src/db';
import { skipImport } from '@/src/lib/import/commit';

export default function Welcome({ onImport }: { onImport: () => void }) {
  return (
    <main className="flex min-h-full items-center justify-center p-8">
      <div className="w-full max-w-md">
        <Empty
          size="lg"
          icon={<BookmarksSimple size={48} />}
          title="欢迎使用 Navill"
          description="导入浏览器书签，按「工作区 → 抽屉 → 书签」重新整理。导入只读取浏览器书签，不会改动它们。"
        />
        <div className="mt-6 grid gap-2">
          <Button className="w-full justify-center" variant="primary" size="lg" icon={<DownloadSimple />} onClick={onImport}>
            导入浏览器书签
          </Button>
          <Button className="w-full justify-center" icon={<CloudArrowDown />} disabled title="M5 提供">
            从 Google Drive 恢复
          </Button>
          <Button className="w-full justify-center" icon={<FileArrowUp />} disabled title="M3 提供">
            导入 JSON / HTML 文件
          </Button>
          <Button className="w-full justify-center" icon={<Plus />} disabled title="M2 提供">
            新建工作区
          </Button>
          <Button className="w-full justify-center" variant="ghost" onClick={() => void skipImport(db)}>
            跳过，先用「待整理」收藏
          </Button>
        </div>
        <div className="mt-4 text-center"><Text variant="secondary" as="p">
          灰色按钮为后续版本功能
        </Text></div>
      </div>
    </main>
  );
}
