/** HTTP 状态码中文释义（Rei 的约定：状态码出现时都带中文说明） */
const GLOSS: Record<number, string> = {
  400: '请求错误', 401: '未授权', 403: '禁止访问', 404: '未找到', 408: '请求超时', 409: '冲突',
  412: '前提条件失败', 413: '内容过大', 429: '请求过多', 500: '服务器内部错误', 502: '网关错误',
  503: '服务不可用', 504: '网关超时',
};
export const httpGloss = (status: number) => `${status} ${GLOSS[status] ?? (status >= 500 ? '服务器错误' : '请求失败')}`;

export class HttpError extends Error {
  constructor(public status: number, detail?: string) {
    super(`${httpGloss(status)}${detail ? `：${detail}` : ''}`);
  }
}
