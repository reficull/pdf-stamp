---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 10c40c0461e44d13eedc3f9e3f5fb9bc_79405d41840b11f180b3525400bff409
    ReservedCode1: KiQbUCmpxw7WucgBqpt2saHs4S3C5B21NjM+QIBduSluas2zAZDtcaa8hKCn3bTXD22yiCUUYSc43E9ve3HNe0ZW6VJAAV9i6Zkba7WlaEhNNnVmJ8ETzSmSLvdJ5wq0pfhs+B15NZKmaD73WG6jb/ELl6MwqzWA6f+7lix/+6nk2JVboh4DEd7s99k=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 10c40c0461e44d13eedc3f9e3f5fb9bc_79405d41840b11f180b3525400bff409
    ReservedCode2: KiQbUCmpxw7WucgBqpt2saHs4S3C5B21NjM+QIBduSluas2zAZDtcaa8hKCn3bTXD22yiCUUYSc43E9ve3HNe0ZW6VJAAV9i6Zkba7WlaEhNNnVmJ8ETzSmSLvdJ5wq0pfhs+B15NZKmaD73WG6jb/ELl6MwqzWA6f+7lix/+6nk2JVboh4DEd7s99k=
---

# PDF 盖章工具 MVP 技术文档

## 1. 可行性结论

**完全可用开源工具实现，且推荐纯前端方案，无需后端服务器。**

核心开源库 `pdf-lib`（MIT 协议）已成熟覆盖所有盖章需求：嵌入 PNG/JPG、定位、缩放、旋转、透明度、多页批量盖章。已有多个同类开源项目（如 sign-pdf）验证了该路线的可行性。

---

## 2. 技术选型

| 维度 | 方案 A（推荐） | 方案 B |
|------|:-----------:|:-----:|
| 架构 | 纯前端 SPA | 前后端分离 |
| 核心库 | pdf-lib (JS) | pypdf + Flask/FastAPI |
| 部署 | 静态托管（GitHub Pages / Vercel） | 需服务器 |
| 文件隐私 | PDF 不离开浏览器 | PDF 上传至服务器 |
| 离线可用 | 是（PWA 可选） | 否 |
| 开发成本 | 低 | 中 |
| 用户门槛 | 打开网页即用 | 需服务运行 |

**推荐方案 A**：隐私友好、零运维成本、开发效率高。

---

## 3. 核心依赖

| 库 | 用途 | License |
|----|------|---------|
| [pdf-lib](https://github.com/Hopding/pdf-lib) | PDF 读写、图片嵌入、页面操作 | MIT |
| [FileReader API](https://developer.mozilla.org/en-US/docs/Web/API/FileReader) | 浏览器原生，读取用户上传文件 | 内置 |
| （可选）[sortablejs](https://github.com/SortableJS/SortableJS) | 拖拽调整盖章顺序 | MIT |

**pdf-lib 关键 API**：
- `PDFDocument.load(bytes)` — 加载 PDF
- `pdf.embedPng(pngBytes)` / `pdf.embedJpg(jpgBytes)` — 嵌入图片
- `page.drawImage(image, { x, y, width, height, rotate, opacity })` — 定位盖章
- `pdf.save()` — 导出 PDF

---

## 4. MVP 功能范围

### 4.1 第一期（核心闭环，约 3~5 天）

| 功能 | 描述 |
|------|------|
| 上传 PDF | 拖拽或点击上传，前端解析页数 |
| 上传印章图片 | 支持 PNG / JPG，PNG 透明背景效果最佳 |
| 选择盖章页 | 指定全部页或特定页码范围 |
| 定位盖章 | 预设 6 个常用位置（左上/中上/右上/左下/中下/右下），支持微调坐标 |
| 缩放印章 | 按比例缩放（50%~200%） |
| 透明度控制 | 滑块 0.1~1.0，模拟真实盖章效果 |
| 旋转角度 | -45° ~ +45°，模拟手工盖章的轻微倾斜 |
| 预览 | 第一页渲染预览（Canvas），所见即所得 |
| 下载 | 一键下载盖章后的 PDF |

### 4.2 第二期（体验增强）

| 功能 | 描述 |
|------|------|
| 自由拖拽定位 | 预览区直接拖拽印章到任意位置 |
| 多印章 | 一次操作加盖多枚不同印章 |
| 批量处理 | 同时上传多个 PDF 批量盖章 |
| 历史记录 | 本地存储最近操作配置 |
| PWA 支持 | 离线可用，桌面快捷方式 |

---

## 5. 架构设计

```
┌────────────────────────────────────────┐
│              浏览器（用户侧）              │
│                                         │
│  ┌─────────┐  ┌──────────┐  ┌────────┐ │
│  │ 上传模块  │  │ 预览模块  │  │ 参数面板 │ │
│  │ PDF+图片  │  │ pdf.js   │  │ 位置/   │ │
│  │          │  │ 渲染预览  │  │ 缩放/   │ │
│  └────┬─────┘  └────┬─────┘  │ 透明度  │ │
│       │              │        └───┬────┘ │
│       ▼              ▼            ▼      │
│  ┌───────────────────────────────────┐  │
│  │         pdf-lib 处理引擎            │  │
│  │  · 加载 PDF  · 嵌入图片            │  │
│  │  · 逐页盖章  · 导出 Blob           │  │
│  └───────────────────────────────────┘  │
│                    │                     │
│                    ▼                     │
│            ┌──────────────┐              │
│            │  下载模块      │              │
│            │  Blob → 文件   │              │
│            └──────────────┘              │
└────────────────────────────────────────┘
```

**数据流**：
1. 用户选择 PDF 文件 + 印章图片 → FileReader 读取为 ArrayBuffer
2. pdf-lib 解析 PDF，embedPng/embedJpg 将印章图片嵌入 PDF 文档对象
3. 根据用户选择（页码范围、位置参数）逐页调用 `page.drawImage()`
4. `pdf.save()` 生成新 PDF 的 Uint8Array → 转 Blob → 触发浏览器下载

---

## 6. 关键实现要点

### 6.1 印章定位坐标计算

pdf-lib 的坐标系原点在页面**左下角**，单位是 PDF 内部单位（1 pt = 1/72 英寸）：

```javascript
// 六个预设位置的坐标计算
const POSITIONS = {
  'top-left':     (pw, ph, iw, ih) => ({ x: 40, y: ph - ih - 40 }),
  'top-center':   (pw, ph, iw, ih) => ({ x: (pw - iw) / 2, y: ph - ih - 40 }),
  'top-right':    (pw, ph, iw, ih) => ({ x: pw - iw - 40, y: ph - ih - 40 }),
  'bottom-left':  (pw, ph, iw, ih) => ({ x: 40, y: 40 }),
  'bottom-center':(pw, ph, iw, ih) => ({ x: (pw - iw) / 2, y: 40 }),
  'bottom-right': (pw, ph, iw, ih) => ({ x: pw - iw - 40, y: 40 }),
};
```

### 6.2 PNG 透明通道处理

- pdf-lib 的 `embedPng` 原生保留 Alpha 通道，无需额外处理
- JPG 无透明通道，印章背景为白色不透明，建议引导用户使用 PNG
- 若用户只有 JPG 印章，可用 Canvas 预处理去除白色背景（可选功能）

### 6.3 大文件处理

- pdf-lib 在浏览器主线程运行，超大 PDF（>50MB/200页）可能卡顿
- 优化策略：使用 Web Worker 将 pdf-lib 操作移出主线程
- MVP 阶段可先限制文件大小（如 30MB），后续迭代引入 Worker

---

## 7. 技术栈建议

| 层 | 选择 | 理由 |
|----|------|------|
| 框架 | Vue 3 / React（按团队偏好） | 社区成熟，生态丰富 |
| 构建 | Vite | 极速 HMR，开箱即用 |
| UI 库 | Element Plus / Ant Design / Naive UI | 提供上传、滑块、输入等组件 |
| PDF 渲染预览 | pdfjs-dist (pdf.js) | 在 Canvas 上渲染 PDF 页面用于预览 |
| 部署 | Vercel / GitHub Pages / Cloudflare Pages | 免费，全球 CDN |

---

## 8. 开发路线图

| 阶段 | 时间 | 交付物 |
|------|------|--------|
| 项目初始化 | 0.5 天 | Vite + Vue/React 脚手架，UI 框架集成 |
| PDF 上传与解析 | 0.5 天 | 上传组件，pdf-lib 加载 PDF，显示页数 |
| 印章嵌入核心 | 1 天 | 图片上传、6 位置预设、缩放/透明度/旋转 |
| 预览功能 | 1 天 | pdf.js 渲染预览，参数实时反映 |
| 下载导出 | 0.5 天 | 导出按钮，文件命名，下载触发 |
| 调优 & 测试 | 0.5 天 | 边界测试、移动端适配、文档 |
| **合计** | **4 天** | MVP 可上线 |

---

## 9. 已有开源参考项目

| 项目 | 地址 | 技术栈 |
|------|------|--------|
| sign-pdf | https://github.com/lonestriker/sign-pdf | Python + 纯前端双版本 |
| pdf-lib 官方示例 | https://github.com/Hopding/pdf-lib#embed-png-and-jpg-images | 纯 JS |
| 掘金实战教程 | https://juejin.cn/post/7655624648048230419 | Vue 3 + pdf-lib |

可以直接参考 sign-pdf 的浏览器版实现思路，在其基础上扩展盖章（而非仅签名）的场景。

---

## 10. 风险与对策

| 风险 | 应对 |
|------|------|
| 超大 PDF 浏览器卡顿 | MVP 限制 30MB；后续引入 Web Worker |
| 某些 PDF 字体/编码兼容性差 | pdf-lib 对标准 PDF 支持良好；异常文件提示用户用 Acrobat 重新导出 |
| 印章图片尺寸不匹配 | 提供缩放滑块，默认缩放到页面宽度的 20% |
| 移动端体验差 | MVP 以桌面端为主，移动端做基本适配 |
*（内容由AI生成，仅供参考）*
