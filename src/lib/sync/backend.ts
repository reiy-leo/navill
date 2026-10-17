import { storage } from 'wxt/utils/storage';
import { isConfigured, isSignedIn, signOut } from './auth';
import * as drive from './drive';
import * as webdav from './webdav';
import { syncStatusItem } from '../settings';

/** 同步目标二选一：Google Drive 或 WebDAV（本机项，不随设置同步） */
export type SyncProvider = 'google' | 'webdav';
export const syncProviderItem = storage.defineItem<SyncProvider>('local:syncProvider', { fallback: 'google' });

export interface RemoteFile { id: string; name: string; modifiedTime: string; etag?: string }

export interface Backend {
  listFiles(): Promise<RemoteFile[]>;
  download(f: RemoteFile): Promise<ArrayBuffer>;
  upload(name: string, body: Blob, existing?: RemoteFile): Promise<RemoteFile>;
  remove(f: RemoteFile): Promise<void>;
}

const driveBackend: Backend = {
  listFiles: () => drive.listFiles(),
  download: (f) => drive.download(f.id),
  upload: (name, body, existing) => drive.upload(name, body, existing?.id),
  remove: (f) => drive.remove(f.id),
};
const webdavBackend: Backend = webdav;

export async function backend(): Promise<Backend> {
  return (await syncProviderItem.getValue()) === 'webdav' ? webdavBackend : driveBackend;
}

/** 当前同步目标是否已连接 */
export async function isConnected(): Promise<boolean> {
  if ((await syncProviderItem.getValue()) === 'webdav') return Boolean(await webdav.webdavConfigItem.getValue());
  return isConfigured() && (await isSignedIn());
}

/** 连接 WebDAV：测试账号、创建 navill-bookmarks/，成功后保存为同步目标 */
export async function connectWebdav(cfg: webdav.WebdavConfig): Promise<void> {
  await webdav.testConnection(cfg);
  await webdav.webdavConfigItem.setValue(cfg);
  await syncProviderItem.setValue('webdav');
  await syncStatusItem.setValue({ state: 'idle' });
}

/** 断开当前同步目标（Google 退出登录 / 清除本机 WebDAV 凭据） */
export async function disconnect(): Promise<void> {
  if ((await syncProviderItem.getValue()) === 'webdav') {
    await webdav.webdavConfigItem.setValue(null);
    await syncStatusItem.setValue({ state: 'signed-out' });
  } else {
    await signOut();
  }
}
