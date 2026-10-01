#!/bin/sh
# 建置多架構 image 並推上 Docker Hub，同時打上 :<package.json 的 version> 與 :latest。
#
# 版本號 tag 的用途是讓 Cloud Run 部署時有一個「永遠只指向一份內容」的名字：
# Cloud Run 透過 mirror.gcr.io 拉 Docker Hub 的 image，而 mirror 會快取 tag 對應到
# 哪個 digest，對 :latest 這種一直被覆蓋的 tag 會回舊的那份（部署卻顯示成功，見
# docs/cloud-run-deployment.md）。一個從沒推過的版本號沒有舊對應可以快取，所以安全——
# 前提是每個版本號只推一次。下面的檢查就是在守這個前提：版本號已經存在就拒絕推送，
# 免得忘記改版本又推一次，把它變成跟 :latest 一樣會被覆蓋的 tag。
set -e

IMAGE=aruminiya/authentik-react-demo-app
VERSION=$(node -p "require('./package.json').version")

if docker buildx imagetools inspect "$IMAGE:$VERSION" >/dev/null 2>&1; then
  echo "❌ $IMAGE:$VERSION 已經在 Docker Hub 上了，版本號 tag 不能覆蓋。"
  echo "   先把 package.json 的 version 往上加，例如：npm version patch --no-git-tag-version"
  exit 1
fi

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t "$IMAGE:$VERSION" \
  -t "$IMAGE:latest" \
  --push .

echo
echo "✅ 已推送 $IMAGE:$VERSION（同時更新 :latest）"
docker buildx imagetools inspect "$IMAGE:$VERSION" | grep -m1 Digest
