#!/usr/bin/env bash
# 用 Chrome Web Store API v2 上传新包并提交审核。
# 需要环境变量：CWS_TOKEN（chromewebstore 范围的访问令牌）、CWS_PUBLISHER_ID、CWS_EXTENSION_ID。
# 用法：scripts/cws-publish.sh <zip>
set -euo pipefail
ZIP="$1"
ITEM="publishers/$CWS_PUBLISHER_ID/items/$CWS_EXTENSION_ID"
BASE="https://chromewebstore.googleapis.com"
AUTH=(-H "Authorization: Bearer $CWS_TOKEN")
field() { node -e 'const j=JSON.parse(process.argv[1]);console.log(process.argv[2].split(".").reduce((o,k)=>o?.[k],j)??"")' "$1" "$2"; }

# 发请求；HTTP 非 2xx 时打印响应并退出
call() {
  local out code
  out="$(mktemp)"
  code="$(curl -sS -o "$out" -w '%{http_code}' "${AUTH[@]}" "$@")"
  if [ "${code:0:1}" != "2" ]; then echo "请求失败：HTTP $code" >&2; cat "$out" >&2; exit 1; fi
  cat "$out"
}

echo "上传 $ZIP …"
RES="$(call -X POST -H 'Content-Type: application/zip' -T "$ZIP" "$BASE/upload/v2/$ITEM:upload")"
echo "$RES"
STATE="$(field "$RES" uploadState)"
for _ in $(seq 1 30); do
  case "$STATE" in
    SUCCEEDED) break ;;
    IN_PROGRESS|UPLOAD_IN_PROGRESS) sleep 10
      RES="$(call "$BASE/v2/$ITEM:fetchStatus")"
      STATE="$(field "$RES" lastAsyncUploadState)" ;;
    *) echo "上传失败：$STATE" >&2; echo "$RES" >&2; exit 1 ;;
  esac
done
[ "$STATE" = "SUCCEEDED" ] || { echo "上传等待超时" >&2; exit 1; }

echo "提交审核 …"
call -X POST -H 'Content-Type: application/json' -d '{}' "$BASE/v2/$ITEM:publish"
echo
echo "已提交 Chrome Web Store 审核"
