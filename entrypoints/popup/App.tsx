import { Button, Text } from '@cloudflare/kumo';
import { BookmarkSimple } from '@phosphor-icons/react';

// M0 空壳：M2 实现「收藏当前页到待整理」与快速搜索
export default function App() {
  return (
    <main className="flex w-80 flex-col gap-3 p-4">
      <Text variant="heading" size="lg" as="h1">Navill</Text>
      <Button variant="primary" icon={<BookmarkSimple />} disabled>
        收藏当前页到「待整理」
      </Button>
    </main>
  );
}
