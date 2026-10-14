import { getToken, invalidateToken } from './auth';
import { HttpError } from './http';

/** Google Drive appDataFolder 的最小客户端 */
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export interface DriveFile { id: string; name: string; modifiedTime: string; size?: string }

async function call(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = await getToken();
  const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
  if (res.status === 401 && retry) {
    await invalidateToken();
    return call(url, init, false);
  }
  if (!res.ok) {
    let detail = '';
    try {
      detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? '';
    } catch { /* 忽略 */ }
    throw new HttpError(res.status, detail);
  }
  return res;
}

export async function listFiles(prefix?: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken = '';
  do {
    const u = new URL(`${API}/files`);
    u.searchParams.set('spaces', 'appDataFolder');
    u.searchParams.set('fields', 'nextPageToken, files(id, name, modifiedTime, size)');
    u.searchParams.set('pageSize', '1000');
    if (prefix) u.searchParams.set('q', `name contains '${prefix.replace(/'/g, "\\'")}'`);
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const data = (await (await call(u.toString())).json()) as { files: DriveFile[]; nextPageToken?: string };
    out.push(...data.files);
    pageToken = data.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

export async function download(id: string): Promise<ArrayBuffer> {
  return (await call(`${API}/files/${id}?alt=media`)).arrayBuffer();
}

export async function upload(name: string, body: Blob, existingId?: string): Promise<DriveFile> {
  const meta = existingId ? {} : { name, parents: ['appDataFolder'] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', body);
  const url = existingId
    ? `${UPLOAD}/files/${existingId}?uploadType=multipart&fields=id,name,modifiedTime`
    : `${UPLOAD}/files?uploadType=multipart&fields=id,name,modifiedTime`;
  return (await (await call(url, { method: existingId ? 'PATCH' : 'POST', body: form })).json()) as DriveFile;
}

export async function remove(id: string): Promise<void> {
  await call(`${API}/files/${id}`, { method: 'DELETE' });
}

export async function gzip(text: string): Promise<Blob> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

export async function gunzip(buf: ArrayBuffer): Promise<string> {
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}
