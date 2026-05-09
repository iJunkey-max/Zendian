import { TFile, WorkspaceLeaf } from 'obsidian';

export class BannerModule {
    id = "banner";
    name = "页眉图片";
    ctx: any;
    eventRefs: any[] = [];
    pollTimer: any = null;

    async load(ctx: any) {
        this.ctx = ctx;
        if (!ctx.getSettings().banner.enabled) return;

        // 绑定环境事件
        this.eventRefs.push(
            ctx.app.workspace.on('file-open', () => this.renderAllBanners()),
            ctx.app.workspace.on('layout-change', () => this.renderAllBanners()),
            ctx.app.metadataCache.on('changed', (file: TFile) => {
                const activeFile = this.ctx.app.workspace.getActiveFile();
                if (file === activeFile) {
                    setTimeout(() => this.renderAllBanners(), 150);
                }
            })
        );

        // 心跳守护：暴力且最有效的抗阅读模式销毁机制
        this.pollTimer = setInterval(() => {
            this.renderAllBanners();
        }, 1000);

        this.renderAllBanners();
    }

    unload() {
        this.eventRefs.forEach(ref => this.ctx.app.workspace.offref(ref));
        this.eventRefs = [];
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.cleanup();
        this.ctx = null;
    }

    onSettingsChanged(changedKeys: string[], settings: any) {
        if (changedKeys.includes("banner")) {
            if (settings.banner.enabled) {
                this.renderAllBanners();
            } else {
                this.cleanup();
            }
        }
    }

    renderAllBanners() {
        if (!this.ctx) return;
        const settings = this.ctx.getSettings().banner;
        if (!settings.enabled) return;

        // 全局遍历，确保左右分屏、阅读/编辑模式同步刷新
        const leaves = this.ctx.app.workspace.getLeavesOfType("markdown");
        leaves.forEach(leaf => {
            const file = (leaf.view as any).file;
            if (file) {
                const cache = this.ctx.app.metadataCache.getFileCache(file);
                const bannerUrl = cache?.frontmatter?.[settings.yamlKey];
                if (bannerUrl) {
                    const resolvedUrl = this.resolveUrl(bannerUrl, file);
                    this.injectBanner(leaf, resolvedUrl, settings);
                } else {
                    this.removeBannerFromLeaf(leaf);
                }
            }
        });
    }

    resolveUrl(url: string, file: TFile) {
        if (/^https?:\/\//i.test(url)) return url;
        const cleanStr = url.replace(/^\[\[|\]\]$/g, "");
        const dest = this.ctx.app.metadataCache.getFirstLinkpathDest(cleanStr, file.path);
        if (dest) {
            return this.ctx.app.vault.getResourcePath(dest);
        }
        return url;
    }

    injectBanner(leaf: WorkspaceLeaf, imgUrl: string, settings: any) {
        const container = leaf.view.containerEl.closest(".workspace-leaf-content");
        if (!container) return;

        container.setAttribute("data-zendian-banner", "");
        (container as HTMLElement).style.setProperty("--zendian-banner-height", `${settings.height}px`);
        (container as HTMLElement).style.setProperty("--zendian-banner-position", settings.position || "center");

        // ★ 核心修复：严格判断当前视图模式，绝不使用宽泛的 querySelector
        const mode = (leaf.view as any).getMode ? (leaf.view as any).getMode() : "source";

        let scroller: HTMLElement | null = null;
        if (mode === "preview") {
            scroller = container.querySelector(".markdown-preview-view");
        } else {
            scroller = container.querySelector(".cm-scroller");
        }

        if (!scroller) return;

        let wrapper = scroller.querySelector(".zendian-banner-wrapper");
        if (wrapper) {
            const img = wrapper.querySelector(".zendian-banner-img") as HTMLImageElement;
            if (img && img.src !== imgUrl) {
                img.src = imgUrl;
            }
            // 防吞噬机制：如果存在但不在最前，则强制置顶
            if (scroller.firstChild !== wrapper) {
                scroller.prepend(wrapper);
            }
            return;
        }

        wrapper = document.createElement("div");
        wrapper.className = "zendian-banner-wrapper";
        const img = document.createElement("img");
        img.className = "zendian-banner-img";
        img.src = imgUrl;
        wrapper.appendChild(img);

        scroller.prepend(wrapper);
    }

    removeBannerFromLeaf(leaf: WorkspaceLeaf) {
        const container = leaf.view.containerEl.closest(".workspace-leaf-content");
        if (container) {
            container.removeAttribute("data-zendian-banner");
            (container as HTMLElement).style.removeProperty("--zendian-banner-height");
            (container as HTMLElement).style.removeProperty("--zendian-banner-position");
            const wrapper = container.querySelector(".zendian-banner-wrapper");
            if (wrapper) wrapper.remove();
        }
    }

    cleanup() {
        document.querySelectorAll(".zendian-banner-wrapper").forEach(el => el.remove());
        document.querySelectorAll("[data-zendian-banner]").forEach(el => {
            el.removeAttribute("data-zendian-banner");
            (el as HTMLElement).style.removeProperty("--zendian-banner-height");
            (el as HTMLElement).style.removeProperty("--zendian-banner-position");
        });
    }
}
