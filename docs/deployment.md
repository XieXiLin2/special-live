# special-live 直播平台部署指南

## 目录

1. [前置要求](#1-前置要求)
2. [配置](#2-配置)
3. [Authentik 配置](#3-authentik-配置)
4. [数据库初始化](#4-数据库初始化)
5. [Docker 部署](#5-docker-部署)
6. [Nginx 配置](#6-nginx-配置)
7. [域名配置](#7-域名配置)
8. [生产环境检查清单](#8-生产环境检查清单)
9. [从 CI 部署](#9-从-ci-部署)

---

## 1. 前置要求

### 系统要求

- Linux 服务器（推荐 Ubuntu 22.04+ 或 Debian 12+）
- Docker Engine 24+ 及 Docker Compose v2+
- 至少 2 核 CPU、4GB 内存
- 开放端口：`80`、`443`、`1935`（RTMP）

### 外部依赖

本系统将以下服务作为外部依赖管理，不包含在 Docker Compose 中：

| 服务 | 版本要求 | 说明 |
|------|---------|------|
| PostgreSQL | 16+ | 主数据库，存储用户、房间、配置等 |
| Redis | 7+ | 缓存层，SRS 回调验证、流状态 |
| Authentik | 2024.2+ | OAuth2 身份提供商（自托管） |

### 域名

准备两个域名并配置 DNS A 记录指向服务器 IP：

| 域名 | 用途 |
|------|------|
| `live.example.com` | 播放域名 — Web 前端、API、FLV/HLS 流 |
| `live-push.example.com` | 推流域名 — RTMP 推流入口 |

> 将 `example.com` 替换为你的实际域名。

---

## 2. 配置

### 环境变量文件

从模板复制生产环境配置文件：

```bash
cp docker/.env.production .env
```

编辑 `.env` 文件，填写所有必填项：

### 变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串。格式：`postgresql://用户名:密码@主机:5432/数据库名` |
| `REDIS_URL` | 是 | Redis 连接字符串。格式：`redis://主机:6379` |
| `AUTH_SECRET` | 是 | NextAuth 加密密钥。生成方式见下方 |
| `AUTH_AUTHENTIK_ID` | 是 | Authentik OAuth2 Client ID |
| `AUTH_AUTHENTIK_SECRET` | 是 | Authentik OAuth2 Client Secret |
| `AUTH_AUTHENTIK_ISSUER` | 是 | Authentik OAuth2 Issuer URL。格式：`https://auth.example.com/application/o/livestream`（末尾无斜杠） |
| `SRS_API_URL` | 是 | SRS HTTP API 地址。Docker 内使用 `http://srs:1985` |
| `SRS_CALLBACK_SECRET` | 是 | SRS 回调共享密钥。用于验证回调请求来源。生成方式见下方 |
| `NEXT_PUBLIC_SITE_URL` | 是 | 网站公开访问地址。如 `https://live.example.com` |

### 密钥生成

```bash
# 生成 AUTH_SECRET（32 字节随机 base64）
openssl rand -base64 32

# 生成 SRS_CALLBACK_SECRET（建议 32 字节以上随机字符串）
openssl rand -base64 32
```

### 使用示例

```bash
# docker/.env.production 包含所有生产环境变量
DATABASE_URL=postgresql://liveuser:securepass@pg.example.com:5432/livestream
REDIS_URL=redis://redis.example.com:6379
AUTH_SECRET=your-generated-secret-here
AUTH_AUTHENTIK_ID=livestream-client-id
AUTH_AUTHENTIK_SECRET=livestream-client-secret
AUTH_AUTHENTIK_ISSUER=https://auth.example.com/application/o/livestream
SRS_API_URL=http://srs:1985
SRS_CALLBACK_SECRET=your-generated-callback-secret
NEXT_PUBLIC_SITE_URL=https://live.example.com
```

---

## 3. Authentik 配置

### 创建 OAuth2 提供商

1. 登录 Authentik 管理面板
2. 进入 **Applications > Providers**
3. 点击 **Create**，选择 **OAuth2/OpenID Provider**
4. 填写以下配置：

| 字段 | 值 |
|------|-----|
| Name | `special-live` |
| Client ID | 自动生成（记录此值作为 `AUTH_AUTHENTIK_ID`） |
| Client Secret | 自动生成（记录此值作为 `AUTH_AUTHENTIK_SECRET`） |
| Redirect URIs | `https://live.example.com/api/auth/callback/authentik` |
| Client Type | **Public** |
| Grant Type | **Authorization Code (PKCE)** |
| Access Code Validity | 5 分钟 |

### 创建应用

1. 进入 **Applications > Applications**
2. 点击 **Create**
3. 填写：

| 字段 | 值 |
|------|-----|
| Name | `special-live` |
| Slug | `livestream` |
| Provider | 选择刚刚创建的 OAuth2 Provider |
| Policy Engine | `any` |

### Issuer URL 格式

`AUTH_AUTHENTIK_ISSUER` 的格式为 Authentik 应用 Slug 拼接：

```
https://auth.example.com/application/o/livestream
```

其中 `livestream` 对应应用 Slug，**末尾不要带斜杠**。

### 作用域（Scopes）

NextAuth v5 默认会请求 `openid`、`profile`、`email` 作用域。如果需要刷新令牌支持，确保 Authentik 配置中允许 `offline_access` 作用域（Authentik 2024.2+ 需要明确授权）。

---

## 4. 数据库初始化

### 前提

确保 PostgreSQL 已运行且 `.env` 中 `DATABASE_URL` 配置正确。

### 执行迁移

使用 Prisma CLI 执行数据库迁移：

```bash
# 安装依赖（首次）
pnpm install

# 运行迁移
pnpm prisma migrate deploy
```

> 使用 `migrate deploy` 而非 `migrate dev`，后者用于开发环境且可能覆盖现有数据。

### 验证迁移

```bash
# 确认所有迁移已应用
pnpm prisma migrate status
```

输出应显示所有迁移文件均处于 `Applied` 状态。

### 可选：初始化 SiteConfig

```bash
# 运行种子脚本创建默认站点配置
pnpm prisma db seed
```

种子脚本会创建一条默认的 `SiteConfig` 记录（`siteTitle: "Live Stream"`、`faviconUrl: "/favicon.ico"`）。如果记录已存在则跳过。

---

## 5. Docker 部署

### 构建镜像

```bash
# 构建所有服务
docker compose build

# 也可单独构建
docker compose build web
```

### 启动服务

```bash
# 启动全部服务（后台运行）
docker compose up -d

# 查看运行状态
docker compose ps
```

预期输出两行 `Up` 状态：

```
NAME                   IMAGE                  STATUS
special-live-srs-1     ossrs/srs:6            Up (healthy)
special-live-web-1     special-live-web       Up (healthy)
```

### 查看日志

```bash
# 查看所有服务日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f web
docker compose logs -f srs
```

### 服务架构

Docker Compose 定义三个服务，运行在 `app-network` 桥接网络中：

| 服务 | 镜像 | 内部端口 | 暴露端口 | 说明 |
|------|------|---------|---------|------|
| `srs` | `ossrs/srs:6` | 1935/1985/8080 | 1935、1985 | SRS v6 流媒体服务器 |
| `web` | 自定义（基于 node:20-alpine） | 3000 | 3000 | Next.js 应用 |

> PostgreSQL、Redis 和 Authentik 不在 Docker Compose 中，需作为外部服务运行。

### 健康检查

```bash
# Web 应用健康检查
curl http://localhost:3000/api/health

# SRS API 健康检查
curl http://localhost:1985/api/v1/versions
```

Web 健康端点返回格式：

```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "srs": "ok",
  "uptime": 12345
}
```

所有服务正常时返回 HTTP 200，任一服务异常时返回 HTTP 503。

### 停止服务

```bash
docker compose down
```

保留数据卷：

```bash
docker compose down --volumes
```

> `--volumes` 会删除 HLS 切片等临时数据。数据库和 Redis 数据不受影响（外部服务）。

---

## 6. Nginx 配置

### 默认方案：外部 OpenResty（推荐）

默认情况下，**不通过 Docker Compose 启动 Nginx**。推荐使用外部已搭建好的 OpenResty/Nginx 服务器。

OpenResty 需要代理以下路由：

| 路径 | 代理目标 | 说明 |
|------|---------|------|
| `/live/*.flv` | SRS HTTP-FLV (端口 8080) | FLV 播放流。必须 `proxy_buffering off`，`proxy_read_timeout 3600s` |
| `/live/*.m3u8` | SRS HLS (端口 8080) | HLS 播放列表 |
| `/live/*.ts` | SRS HLS (端口 8080) | HLS TS 分片 |
| `/api/*`、`/` | Next.js (端口 3000) | API 路由和前端页面 |

### 方式一：手动配置 OpenResty

将 `docker/nginx/nginx.conf` 中的 server 块复制到你的 OpenResty 配置中。

关键配置项：

```nginx
# 上游定义
upstream srs_http {
    server localhost:8080;
}

upstream web_app {
    server localhost:3000;
}

server {
    listen 80;
    server_name live.example.com;

    # FLV 流 — CDN 绕过（长连接）
    location ~ ^/live/.+\.flv$ {
        proxy_pass http://srs_http;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        add_header Cache-Control 'no-cache, no-store, must-revalidate';
        add_header Pragma no-cache;
        add_header Access-Control-Allow-Origin *;
    }

    # HLS 播放列表和分片
    location ~ ^/live/.+\.(m3u8|ts)$ {
        proxy_pass http://srs_http;
        add_header Access-Control-Allow-Origin *;
    }

    # 预检请求
    location ~ ^/live/.+\.flv$ {
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods 'GET, OPTIONS';
            return 204;
        }
    }

    # Web 应用和 API
    location / {
        proxy_pass http://web_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 方式二：1Panel 可视化配置

如果使用 [1Panel](https://1panel.cn/) 管理服务器，按以下步骤配置：

**步骤 1：创建网站**
1. 进入 1Panel → 网站 → 创建网站
2. 选择 **反向代理** 类型
3. 主域名填写 `live.example.com`
4. 代理地址填写 `http://127.0.0.1:3000`（Next.js）
5. 保存

**步骤 2：添加 FLV/HLS 路由**
1. 进入刚创建的网站 → 配置文件
2. 在 `location /` 块之前添加以下内容：

```nginx
    location ~ ^/live/.+\.flv$ {
        proxy_pass http://127.0.0.1:8080;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        add_header Cache-Control 'no-cache, no-store, must-revalidate';
        add_header Pragma no-cache;
        add_header Access-Control-Allow-Origin *;
    }

    location ~ ^/live/.+\.(m3u8|ts)$ {
        proxy_pass http://127.0.0.1:8080;
        add_header Access-Control-Allow-Origin *;
    }
```

**步骤 3：配置 HTTPS（可选）**
1. 在 1Panel 网站列表中点击 **HTTPS**
2. 选择 **Let's Encrypt** 或上传自有证书
3. 开启 **HTTP 自动跳转 HTTPS**
4. 保存

**步骤 4：添加防火墙规则**
1. 进入 1Panel → 安全 → 防火墙
2. 开放端口：`80`、`443`、`1935`
3. 保存

### 方式三：Docker Compose 内置 Nginx（可选）

如果不想使用外部 OpenResty，可以取消注释 `docker-compose.yml` 中的 nginx 服务：

```bash
# 编辑 docker-compose.yml，取消 nginx 服务的注释
# 然后启动

docker compose up -d nginx
```

> ⚠️ 使用内置 Nginx 时，需要将域名 DNS 指向本服务器，并配置 SSL 证书。

### SSL 证书

**外部 CDN（推荐）**

使用 Cloudflare 等 CDN 时，SSL 在 CDN 层终止，OpenResty 只需监听 80 端口。

**Let's Encrypt 直接配置**

在宿主机上使用 certbot：

```bash
certbot certonly --standalone -d live.example.com
```

然后在 OpenResty/1Panel 中配置证书路径。

### CORS 配置

所有流媒体端点必须配置 CORS：

```nginx
add_header Access-Control-Allow-Origin *;
add_header Access-Control-Allow-Methods 'GET, OPTIONS';
```

OPTIONS 预检请求返回 204。

---

## 7. 域名配置

### DNS 记录

在域名管理后台添加以下 A 记录：

| 记录类型 | 主机名 | 值 | TTL |
|---------|--------|-----|-----|
| A | `live` | `服务器公网 IP` | 600 |
| A | `live-push` | `服务器公网 IP` | 600 |

### 端口映射

| 端口 | 协议 | 用途 | 对应域名 |
|------|------|------|---------|
| 80 | TCP | HTTP 播放/API | `live.example.com` |
| 443 | TCP | HTTPS 播放/API | `live.example.com`（如启用 SSL） |
| 1935 | TCP | RTMP 推流 | `live-push.example.com` |

### 防火墙配置

```bash
# 使用 ufw 开放端口
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 1935/tcp
```

### 架构流程图

```
推流 (OBS)
    │
    ▼  rtmp://live-push.example.com:1935/live/<key>
SRS v6 (端口 1935/8080)
    │
    ├── FLV ──► Nginx ──► 播放器 (mpegts.js)
    │          (端口 80)
    └── HLS ──► Nginx ──► 播放器 (iOS 原生/Safari)
                    │
                    └── /api/*, / ──► Next.js (端口 3000)
                                          │
                                          ├── PostgreSQL (用户、房间、配置)
                                          ├── Redis (缓存、回调)
                                          └── Authentik (OAuth2 登录)
```

---

## 8. 生产环境检查清单

使用以下清单验证部署是否完整：

### 环境配置

- [ ] `.env` 文件存在，包含全部必填变量
- [ ] `AUTH_SECRET` 已使用 `openssl rand -base64 32` 生成
- [ ] `SRS_CALLBACK_SECRET` 已配置，且 SRS 配置中的回调 secret 与此一致
  > **注意**: 需要在 `docker/srs/srs.conf` 中的 `on_publish` 和 `on_play` 回调 URL 后手动添加 `?secret=<YOUR_SECRET>`，例如 `http://web:3000/api/srs/publish?secret=<YOUR_SECRET>`。确保此 secret 与 `.env` 中的 `SRS_CALLBACK_SECRET` 一致。
- [ ] `NEXT_PUBLIC_SITE_URL` 为 `https://live.example.com`（实际域名）

### 数据库

- [ ] PostgreSQL 16+ 运行中
- [ ] `pnpm prisma migrate deploy` 成功执行
- [ ] 所有迁移状态为 `Applied`
- [ ] 种子数据已初始化（或确认 SiteConfig 存在）

### Authentik

- [ ] OAuth2 Provider 已创建，Client Type 为 Public
- [ ] Redirect URI 设置为 `https://live.example.com/api/auth/callback/authentik`
- [ ] Grant Type 为 Authorization Code (PKCE)
- [ ] 从 Authentik 复制了 Client ID 和 Client Secret 到 `.env`
- [ ] Issuer URL 末尾无斜杠

### Docker

- [ ] `docker compose build` 成功
- [ ] `docker compose up -d` 启动后 `docker compose ps` 显示两个服务均为 Up 状态
- [ ] SRS 健康检查通过：`curl http://localhost:1985/api/v1/versions`
- [ ] Web 健康检查通过：`curl http://localhost:3000/api/health` 返回 `{"status":"ok",...}`
- [ ] 外部 Nginx/OpenResty 已配置并可达：`curl -H "Host: live.example.com" http://localhost/` 返回页面内容（非 502）
- [ ] SSL 证书已配置（如适用）

### 网络

- [ ] 防火墙已开放端口：`80`、`443`、`1935`
- [ ] DNS A 记录已配置并生效（`dig live.example.com` 返回正确 IP）
- [ ] `live-push.example.com` 可路由到服务器（OBS 推流测试）

### 验证

- [ ] 访问 `https://live.example.com` 看到直播房间选择页
- [ ] 点击登录跳转到 Authentik 登录页
- [ ] 首次登录用户自动获得管理员权限
- [ ] 管理员可以进入 `/admin` 管理面板
- [ ] 管理员创建房间后，OBS 可推流到 `rtmp://live-push.example.com:1935/live/<stream-key>`
- [ ] 播放器可正常播放 FLV（桌面端 Chrome）和 HLS（iOS Safari）
- [ ] 私密房间 needs **访问密钥**或登录后才能访问

---

## 9. 从 CI 部署

### 容器镜像

CI 自动构建并推送 Web 镜像到 GitHub Container Registry：

| 服务 | 镜像路径 |
|------|---------|
| Web | `ghcr.io/xiexilin2/special-live/web` |

### 标签策略

| 标签 | 触发条件 | 使用场景 |
|------|---------|---------|
| `main` | 推送到 main 分支 | 开发/测试环境 |
| `v1.0.0` | 推送 v* 格式标签 | 生产环境 |
| `sha-xxxxxxx` | 每次推送 | 回滚/排查 |
| `pr-123` | PR 推送 | PR 预览 |

### 生产部署用 Compose 文件

创建一个 `docker-compose.prod.yml` 使用预构建镜像：

```yaml
services:
  srs:
    image: ossrs/srs:6
    ports:
      - "1935:1935"
      - "1985:1985"
      - "8080:8080"
    volumes:
      - ./docker/srs/srs.conf:/usr/local/srs/conf/srs.conf:ro
      - srs-hls:/usr/local/srs/objs/nginx/html
    restart: unless-stopped
    networks:
      - app-network

  web:
    image: ghcr.io/xiexilin2/special-live/web:${TAG:-latest}
    env_file: .env
    ports:
      - "3000:3000"
    restart: unless-stopped
    depends_on:
      - srs
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  srs-hls:
```

### 部署流程

```bash
# 1. 登录 GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u xiexilin2 --password-stdin

# 2. 拉取最新镜像
TAG=v1.0.0 docker compose -f docker-compose.prod.yml pull

# 3. 启动服务
TAG=v1.0.0 docker compose -f docker-compose.prod.yml up -d

# 4. 验证
docker compose -f docker-compose.prod.yml ps
curl http://localhost:3000/api/health
```

### 版本回滚

```bash
# 回滚到指定版本
TAG=v0.9.0 docker compose -f docker-compose.prod.yml up -d
```

### 无 Docker Compose 部署（单机脚本）

对于最小化部署，可直接运行容器：

```bash
# 启动 SRS
docker run -d \
  --name srs \
  -p 1935:1935 -p 1985:1985 -p 8080:8080 \
  -v $(pwd)/docker/srs/srs.conf:/usr/local/srs/conf/srs.conf:ro \
  -v srs-hls:/usr/local/srs/objs/nginx/html \
  ossrs/srs:6

# 启动 Web
docker run -d \
  --name web \
  -p 3000:3000 \
  --env-file .env \
  ghcr.io/xiexilin2/special-live/web:latest
```

---

## 附录

### 目录结构参考

```
special-live/
├── docker/
│   ├── .env.production          # 生产环境变量模板
│   ├── nginx/
│   │   └── nginx.conf           # Nginx 反向代理配置（可选，供外部 OpenResty 参考）
│   └── srs/
│       └── srs.conf             # SRS 流媒体服务器配置
├── apps/
│   └── web/
│       ├── Dockerfile           # Next.js 多阶段构建
│       └── .env.example         # 开发环境变量模板
├── docker-compose.yml           # 生产 Docker Compose
└── .env                         # 实际环境变量（不提交到 Git）
```
