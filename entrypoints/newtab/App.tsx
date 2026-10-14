import { Loader } from '@cloudflare/kumo';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '@/src/db';
import Browse from './components/Browse';
import ImportPreview from './components/ImportPreview';
import Welcome from './components/Welcome';

type Screen = 'auto' | 'preview';

export default function App() {
  const [screen, setScreen] = useState<Screen>('auto');
  const onboarded = useLiveQuery(async () => {
    const [imported, skipped] = await Promise.all([db.meta.get('importedAt'), db.meta.get('onboardedAt')]);
    return Boolean(imported || skipped);
  });

  if (onboarded === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }
  if (screen === 'preview') {
    return <ImportPreview onCancel={() => setScreen('auto')} onDone={() => setScreen('auto')} />;
  }
  if (!onboarded) return <Welcome onImport={() => setScreen('preview')} />;
  return <Browse onReimport={() => setScreen('preview')} />;
}
