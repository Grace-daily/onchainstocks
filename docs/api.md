# ONCHAIN STOCKS GUIDE Content API

这是一个公开、只读、无需认证的轻量内容发现接口，用于帮助搜索引擎、AI Agent 和其他客户端理解本站结构。

## 端点

### `GET /api/site.json`

返回站点名称、描述、语言、更新时间、主要页面和主题标签。

### `GET /api/status.json`

返回内容 API 的静态状态与版本。

## 机器可读描述

- OpenAPI 3.1：`/openapi.json`
- RFC 9727 API Catalog：`/.well-known/api-catalog`

## 使用限制

接口无需认证，内容仅供发现与引用。本站内容不构成税务、法律或投资建议。
