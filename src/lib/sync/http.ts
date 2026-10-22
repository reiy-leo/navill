import { tr } from '@/src/i18n';
/** HTTP 状态码中文释义（Rei 的约定：状态码出现时都带中文说明） */
const GLOSS: Record<number, string> = {
  400: tr('请求错误'), 401: tr('未授权'), 403: tr('禁止访问'), 404: tr('未找到'), 408: tr('请求超时'), 409: tr('冲突'),
  412: tr('前提条件失败'), 413: tr('内容过大'), 422: tr('无法处理'), 429: tr('请求过多'), 500: tr('服务器内部错误'), 502: tr('网关错误'),
  503: tr('服务不可用'), 504: tr('网关超时'),
};
export const httpGloss = (status: number) => `${status} ${GLOSS[status] ?? (status >= 500 ? tr('服务器错误') : tr('请求失败'))}`;

export class HttpError extends Error {
  constructor(public status: number, detail?: string) {
    super(`${httpGloss(status)}${detail ? `：${detail}` : ''}`);
  }
}
