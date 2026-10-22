#!/usr/bin/env bash
# 用 Edge Add-ons REST API v1.1 上传新包并提交审核。
# 需要环境变量：EDGE_CLIENT_ID、EDGE_API_KEY、EDGE_PRODUCT_ID（Partner Center → Publish API / 扩展概览页）。
# 用法：scripts/edge-publish.sh <zip> [审核备注]
set -euo pipefail
ZIP="$1"; NOTES="${2:-}"
API="https://api.addons.microsoftedge.microsoft.com/v1/products/$EDGE_PRODUCT_ID/submissions"
AUTH=(-H "Authorization: ApiKey $EDGE_API_KEY" -H "X-ClientID: $EDGE_CLIENT_ID")

# 发请求，期望 202（已接受），从 Location 头取 operationID
start() {
  local hdr; hdr="$(mktemp)"
  local code; code="$(curl -sS -o /dev/stderr -D "$hdr" -w '%{http_code}' "${AUTH[@]}" "$@")"
  if [ "$code" != "202" ]; then echo "请求失败：HTTP $code（期望 202 已接受）" >&2; exit 1; fi
  grep -i '^location:' "$hdr" | tr -d '\r' | sed 's#.*/##; s/^location: *//I'
}

# 轮询操作状态直到 Succeeded / Failed
wait_op() {
  local url="$1" body status
  for _ in $(seq 1 60); do
    body="$(curl -sS "${AUTH[@]}" "$url")"
    status="$(node -e 'const j=JSON.parse(process.argv[1]);console.log(j.status||"")' "$body")"
    case "$status" in
      Succeeded) echo "$body"; return 0 ;;
      InProgress|"") sleep 10 ;;
      *) echo "$body" >&2; return 1 ;;
    esac
  done
  echo "等待超时：$url" >&2; return 1
}

echo "上传 $ZIP …"
OP="$(start -X POST -H 'Content-Type: application/zip' -T "$ZIP" "$API/draft/package")"
wait_op "$API/draft/package/operations/$OP"

echo "提交审核 …"
PAYLOAD="$(node -e 'console.log(JSON.stringify({notes: process.argv[1]}))' "$NOTES")"
OP="$(start -X POST -H 'Content-Type: application/json' -d "$PAYLOAD" "$API")"
wait_op "$API/operations/$OP"
echo "已提交 Edge Add-ons 审核"
