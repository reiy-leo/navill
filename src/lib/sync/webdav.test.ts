import { describe, expect, it } from 'vitest';
import { normalizeUrl, parseMultistatus } from './webdav';

describe('webdav', () => {
  it('normalizeUrl 补协议和末尾斜杠', () => {
    expect(normalizeUrl('dav.jianguoyun.com/dav')).toBe('https://dav.jianguoyun.com/dav/');
    expect(normalizeUrl('http://nas:5005/')).toBe('http://nas:5005/');
  });

  it('parseMultistatus 兼容不同命名空间前缀和编码', () => {
    const xml = `<?xml version="1.0"?><D:multistatus xmlns:D="DAV:">
      <D:response><D:href>/dav/navill-bookmarks/</D:href><D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop></D:propstat></D:response>
      <D:response><D:href>https://h/dav/navill-bookmarks/state.json.gz</D:href><D:propstat><D:prop><D:getetag>&quot;abc&quot;</D:getetag><D:getlastmodified>Sat, 17 Oct 2026 05:00:00 GMT</D:getlastmodified><D:resourcetype/></D:prop></D:propstat></D:response>
      <d:response xmlns:d="DAV:"><d:href>/dav/navill-bookmarks/events/a%20b-2026-10.jsonl.gz</d:href><d:propstat><d:prop><lp1:getetag xmlns:lp1="DAV:">W/"x1"</lp1:getetag></d:prop></d:propstat></d:response>
    </D:multistatus>`;
    const r = parseMultistatus(xml, 'https://h/dav/');
    expect(r).toEqual([
      { path: '/dav/navill-bookmarks/', etag: undefined, modified: undefined, dir: true },
      { path: '/dav/navill-bookmarks/state.json.gz', etag: '"abc"', modified: 'Sat, 17 Oct 2026 05:00:00 GMT', dir: false },
      { path: '/dav/navill-bookmarks/events/a b-2026-10.jsonl.gz', etag: 'W/"x1"', modified: undefined, dir: false },
    ]);
  });
});
