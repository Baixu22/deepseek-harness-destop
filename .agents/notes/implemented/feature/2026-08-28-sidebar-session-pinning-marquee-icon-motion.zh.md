# Agent Note: 侧边栏会话置顶、悬停标题跑马灯与图标悬停动效

Status: implemented

[English](2026-08-28-sidebar-session-pinning-marquee-icon-motion.md) | 中文

## 问题

工作区侧边栏积累了四处粗糙体验。会话无法置顶，用户反复回到的会话只能停留在其工作区分组与最近排序决定的位置。过长的会话标题被省略号截断，隐藏的部分无法查看。侧边栏、列表头部与设置页的图标缺少悬停反馈或反馈不一致，悬停无法确认控件的行为。设置页 About 区的项目主页悬停卡片不再渲染：其预览图来自远程截图服务（microlink），桌面应用运行的环境中该请求永远无法返回，卡片整体失效而不是降级。

## 决策

**置顶是工作区 store 的视图状态，经推导过滤落地。** `pinnedSessionIds: string[]` 按 pin 顺序记录在 workspace view store（`packages/client/ui-workspace/src/client/stores.ts`）；持久化形态改变，存储键从 `dsh.workspace.view.v5` 移到 `v6` —— `attachPersistence` 整包替换持久化状态而非合并字段，同键新增字段会把旧形态复活成 `undefined`。`derivePinned`（`tree.ts`）对照活节点过滤 id 列表，剔除已归档会话、失效 subagent 行以及非当前会话的空白会话；`deriveGroups` 把已置顶 id 从其工作区分组中移除。两个列表渲染器（`SessionTree`、`FlatList`）都在分组上方绘制带独立标题与分隔线的置顶分区；置顶行退出拖拽（其 `::before`/`::after` 槽位归卡片分层使用），空白会话在行菜单中不暴露 pin 动词。

**置顶卡片是堆叠层，不是单纯的 z-index 提升。** 置顶行保持 `position: relative; z-index: 1` 覆盖分区背景，并携带两层伪元素下垫层（`::before`、`::after`，均为 `z-index: -1`），悬停时展开 —— 即 pin-list 的层叠卡片外观。置顶分区内部 10px 的行距为下垫层预留空间，使其永不与下一张卡片或第一个工作区标题重叠。置顶行的 pin 徽标与行动作（pin、省略号）常显，时间戳隐藏并由动作取代 —— 没有任何元素与标题重叠。

**跑马灯在裁剪盒内移动精确测得的溢出量。** `titleMarquee`（`rows/Rows.tsx`）在指针进入时测量 `scrollWidth - clientWidth`，连同时长（40px/s，下限 1.2s）以 `--marquee-shift`/`--marquee-duration` 存到行上。标题渲染为外层 `.title`（原有省略号盒）包裹内层 `.titleText` inline-block span；悬停（或行菜单打开）仅在内层 span 上启动 `title-marquee` alternate-infinite CSS 动画，300ms 延迟避免掠过的光标触发。悬停时外层盒切换为 `text-overflow: clip`，因此无论位移值多大，移动的文字都不可能越出自身裁剪盒。

**每个动效图标都有一个明确的 from→to 变换。** 搜索按钮图标放大到 1.12，头部图标按钮上移 1px，视图选项与设置齿轮旋转 90°，新建会话加号旋转 90°，shell 栏图标放大到 1.08，折叠栏面板图标在切换时播放缩放加淡入的 pop（`WorkspaceBrowser.module.css`、`SidebarRoot.module.css`、`SettingsRoot.module.css`，全部在 `prefers-reduced-motion` 下禁用）。

**About 项目卡片完全本地化。** HoverCard 以代码字体渲染完整仓库 URL 加复制提示，卡片自身通过 `copyText`/`copyLabel` 支持点击复制。全程没有网络请求参与，卡片在应用运行的任何环境中都渲染。

## 已考虑的替代方案

**纯 CSS 跑马灯配合固定位移（如 `translateX(-100%)`）。** 否决：百分比位移让 span 移动自身整个宽度，对短溢出过头、对长溢出不足；只有实测像素差才能恰好移动被隐藏的量。

**JS `requestAnimationFrame` 跑马灯循环。** 否决：同一测量驱动 CSS `@keyframes` 动画，循环只会为每行每帧增加主线程开销而无视觉差异；reduced-motion 与菜单打开场景保持纯 CSS。

**仅用 `z-index` 加阴影分层。** 否决：平面抬升读不出层叠卡片，而层叠卡片正是需求点名的观感；伪元素恰好空闲，正是因为置顶行不参与拖拽 —— 这也是该约束的来源。

**保留 microlink 预览并加优雅降级。** 否决：降级产物本来就是本地 URL 卡片，远程一跳只增加故障模式与显示延迟。

**持久化加载时合并新 store 字段。** 否决：`attachPersistence` 整体赋值持久化状态；仓库的预发布立场（`AGENTS.md`）对磁盘格式不做兼容承诺，版本键迁移是获准的重置路径。

## 后果

pin 顺序即执行顺序；取消置顶的会话回到其工作区分组的常规排序位置。置顶分区即使只有一行也保留纵向空间，且下垫层约束该分区的最小间距。跑马灯仅在悬停或行菜单打开时运行，往复而非循环，任何位移值下都不会绘制到标题盒之外；测量在每次指针进入时执行一次，而非每帧。`prefers-reduced-motion` 用户得到静态的置顶卡片与图标。持久化的工作区视图在 v5→v6 键迁移时重置一次（侧边栏展开状态与搜索历史是涉及的内容）。About 卡片不再依赖网络，`aboutPreview`/`aboutPreviewImg` 样式与 `REPO_PREVIEW` 常量已删除。

## 测试

`tree.client.spec.ts` 钉住 `derivePinned` 过滤、`deriveGroups` 剔除与 store 的 toggle 顺序；`rows.client.spec.tsx` 钉住 `titleMarquee` 测量、pin/unpin 菜单动词、徽标、无 wiring 与空白会话场景；`browser-styles.client.spec.ts` 钉住跑马灯 CSS（实测位移变量、仅内层 span 动画、悬停 clip）、置顶卡片分层、置顶分区分隔与 reduced-motion 块；`workspace-browser.client.spec.tsx` 挂载列表、经 store 置顶会话，断言分区渲染在分组上方且取消置顶后行归位。`SidebarRoot.module.css` 与 `SettingsRoot.module.css` 的图标动效及 About 本地卡片由桌面构建的真机截图评审覆盖。
