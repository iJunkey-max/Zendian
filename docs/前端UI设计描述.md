# Obsidian Dashboard UI Design System（V2.0）

> 本文档用于指导 AI（Claude Code / Cursor / Trae / Augment 等）100% 还原
> Obsidian 首页 Dashboard 的 UI 设计。

------------------------------------------------------------------------

# 一、设计定位

这是一个面向知识工作者（Knowledge Worker）的 Obsidian 首页 Dashboard。

设计关键词：

-   Linear
-   Notion
-   Raycast
-   Arc Browser
-   Vercel Dashboard

整体风格：

-   现代 SaaS Dashboard
-   大面积留白
-   圆角卡片
-   极轻阴影
-   蓝紫色品牌色
-   科技感但不过度炫技
-   信息层级清晰
-   卡片化布局
-   与 Obsidian 原生主题融合

避免：

-   重阴影
-   拟物设计
-   赛博朋克
-   Material Design
-   Fluent Design
-   花哨渐变

------------------------------------------------------------------------

# 二、页面尺寸

设计稿尺寸：

    1440 × 1024

背景色：

    #F7F9FC

页面四周：

    32px Padding

------------------------------------------------------------------------

# 三、布局

    Sidebar（220px）
    │
    ├── Header（88px）
    ├── Greeting Hero（180px）
    ├── Dashboard Grid
    └── Footer

Main 区域采用 CSS Grid。

------------------------------------------------------------------------

# 四、Sidebar

-   宽度：220px
-   背景：#FFFFFF
-   右侧 1px Border (#ECEEF5)
-   Logo 高度：72px
-   菜单高度：44\~48px
-   圆角：12px
-   Active：
    -   背景：#EEF2FF
    -   左侧 4px 紫色指示条
    -   字体：#5B5CEB
-   Hover：
    -   #F5F7FB

底部：

-   Vault 信息
-   同步状态
-   夜间模式

------------------------------------------------------------------------

# 五、Header

左侧：

    👋 Good Morning, Alex
    Thursday, June 25
    Today is a good day to build.

右侧：

-   Search（280×44）
-   Notification
-   Theme
-   Avatar

Input：

-   Radius：12px
-   Border：#ECEEF5

------------------------------------------------------------------------

# 六、Greeting Hero

高度：180px

左侧：

    Hello Alex 👋

    72%

    3 Projects
    12 Tasks
    4 Notes

72%：

-   56px
-   ExtraBold
-   Purple

右侧：

-   紫蓝渐变圆形
-   三层发光圆环
-   极简科技风

------------------------------------------------------------------------

# 七、Dashboard Grid

-   两列
-   Gap：24px
-   左列：60%
-   右列：40%

------------------------------------------------------------------------

# 八、Daily Review

620×280

左：

120px Progress Ring

右：

-   Finish Homepage UI
-   Review Notes
-   Write Journal
-   Sync Vault

底部：

+3 completed

------------------------------------------------------------------------

# 九、Current Projects

每项：

72px 高

包含：

-   Icon
-   Title
-   Description
-   Progress
-   Status

------------------------------------------------------------------------

# 十、Today's Tasks

Tabs：

-   Today
-   Upcoming
-   Done

Checkbox：

18px

Tag：

-   Plugin
-   UI
-   Docs

------------------------------------------------------------------------

# 十一、Sticky Notes

三张：

-   浅黄
-   浅蓝
-   浅绿

圆角：

14px

非拟物设计。

------------------------------------------------------------------------

# 十二、Heatmap

GitHub Contribution 风格。

规格：

-   53 列
-   7 行
-   Cell：10×10
-   Gap：3px

颜色：

    #F4F5FB
    #E2E4FF
    #C9CBFF
    #989BFF
    #6C63FF

Hover：

Tooltip：

    June 25

    5 Notes
    2 Tasks
    432 words

------------------------------------------------------------------------

# 十三、Statistics

2×2 Grid

数字：

32px

Bold

下方：

紫色折线图

------------------------------------------------------------------------

# 十四、Recent Notes

每项：

56px

包含：

-   Icon
-   Title
-   Tag
-   Last Edited

Hover：

#F8FAFD

------------------------------------------------------------------------

# 十五、Quick Actions

按钮：

-   New Note
-   Daily Note
-   Task
-   Canvas

高度：

44px

Radius：

12px

------------------------------------------------------------------------

# 十六、颜色

Primary：

    #6C63FF

Hover：

    #5B5CEB

Blue：

    #4EA4FF

Green：

    #38C976

Yellow：

    #FFD76A

Red：

    #F97066

Background：

    #F7F9FC

Card：

    #FFFFFF

Border：

    #ECEEF5

Text：

    #1F2937

Muted：

    #7A869A

------------------------------------------------------------------------

# 十七、Design Tokens

圆角：

-   Card：18px
-   Button：12px
-   Input：12px
-   Tag：999px

阴影：

``` css
box-shadow: 0 8px 24px rgba(15,23,42,.04);
```

Hover：

``` css
transform: translateY(-2px);
```

------------------------------------------------------------------------

# 十八、Typography

推荐字体：

-   Inter
-   SF Pro Display
-   HarmonyOS Sans
-   MiSans

字号：

-   H1：40px
-   H2：32px
-   H3：22px
-   Body：15px
-   Caption：13px

------------------------------------------------------------------------

# 十九、Grid System

严格采用：

    8px Grid

允许：

    4
    8
    12
    16
    24
    32
    40
    48
    64

------------------------------------------------------------------------

# 二十、动画

统一：

    200ms ease

仅允许：

-   translateY(-2px)
-   box-shadow
-   background-color
-   progress width

禁止：

-   Bounce
-   Spring
-   Rotate

------------------------------------------------------------------------

# 二十一、响应式

> 1400：四列

1200：三列

900：两列

700：单列

Sidebar 自动折叠。

------------------------------------------------------------------------

# 二十二、图标

统一使用：

-   Lucide Icons

------------------------------------------------------------------------

# 二十三、CSS Variables

``` css
--home-primary
--home-bg
--home-card
--home-border
--home-text
--home-muted
--home-success
--home-warning
```

同时兼容：

``` css
--background-primary
--background-secondary
--interactive-accent
```

------------------------------------------------------------------------

# 二十四、Claude Code Prompt

    你是一名资深 SaaS 产品设计工程师。

    目标：100% 还原设计稿，而不是完成 Demo。

    要求：

    1. 优先视觉一致性。
    2. 使用 CSS Grid。
    3. 所有颜色使用 Design Tokens。
    4. 不允许 Magic Number。
    5. 所有组件可复用。
    6. 页面风格接近 Linear、Raycast、Vercel、Notion。
    7. 卡片统一 Hover。
    8. 页面具有呼吸感。
    9. 输出生产级代码。
    10. 不擅自修改布局、比例、颜色、圆角、间距。

------------------------------------------------------------------------

# 最终视觉目标

首页整体应具备：

-   Apple 的克制
-   Linear 的精致
-   Notion 的留白
-   Vercel 的秩序
-   Obsidian 的知识管理体验

让用户一打开首页，就能立即了解今天的任务、项目、知识积累和创作状态。
