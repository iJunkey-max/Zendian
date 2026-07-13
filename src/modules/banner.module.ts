import { TFile, WorkspaceLeaf } from 'obsidian';
import type { IFeatureModule, ModuleContext } from '../types/module.types';
import type { PluginSettings } from '../types/settings.types';

export class BannerModule implements IFeatureModule {
    readonly id = "banner";
    readonly name = "页眉图片";
    private ctx!: ModuleContext;
    private eventRefs: any[] = [];
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private failedUrls: Set<string> = new Set();
    private needsUpdate = false;

    async load(ctx: ModuleContext): Promise<void> {
        this.ctx = ctx;
        if (ctx.getSettings().banner.enabled) this.start();
    }

    private start(): void {
        if (this.eventRefs.length > 0) {
            this.renderAllBanners();
            return;
        }
        this.eventRefs.push(
            this.ctx.app.workspace.on('file-open', () => {
                this.needsUpdate = true;
            }),
            this.ctx.app.workspace.on('layout-change', () => {
                this.needsUpdate = true;
            }),
            this.ctx.app.metadataCache.on('changed', (file: TFile) => {
                const activeFile = this.ctx.app.workspace.getActiveFile();
                if (file === activeFile) {
                    this.needsUpdate = true;
                }
            })
        );

        this.pollTimer = setInterval(() => {
            if (this.needsUpdate) {
                this.renderAllBanners();
                this.needsUpdate = false;
            }
        }, 5000);

        this.renderAllBanners();
    }

    private stop(): void {
        this.eventRefs.forEach(ref => this.ctx.app.workspace.offref(ref));
        this.eventRefs = [];
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.failedUrls.clear();
        this.cleanup();
    }

    unload(): void {
        this.stop();
    }

    onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
        if (changedKeys.includes("banner")) {
            if (settings.banner.enabled) {
                this.start();
            } else {
                this.stop();
            }
        }
    }

    private renderAllBanners(): void {
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

    private resolveUrl(url: string, file: TFile): string {
        if (/^https?:\/\//i.test(url)) return url;
        const cleanStr = url.replace(/^\[\[|\]\]$/g, "");
        const dest = this.ctx.app.metadataCache.getFirstLinkpathDest(cleanStr, file.path);
        if (dest) {
            return this.ctx.app.vault.getResourcePath(dest);
        }
        return url;
    }

    private injectBanner(leaf: WorkspaceLeaf, imgUrl: string, settings: PluginSettings["banner"]): void {
        if (this.failedUrls.has(imgUrl)) {
            this.removeBannerFromLeaf(leaf);
            return;
        }

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
        img.onerror = () => {
            this.failedUrls.add(imgUrl);
            this.removeBannerFromLeaf(leaf);
        };
        wrapper.appendChild(img);

        scroller.prepend(wrapper);
    }

    private removeBannerFromLeaf(leaf: WorkspaceLeaf): void {
        const container = leaf.view.containerEl.closest(".workspace-leaf-content");
        if (container) {
            container.removeAttribute("data-zendian-banner");
            (container as HTMLElement).style.removeProperty("--zendian-banner-height");
            (container as HTMLElement).style.removeProperty("--zendian-banner-position");
            const wrapper = container.querySelector(".zendian-banner-wrapper");
            if (wrapper) wrapper.remove();
        }
    }

    private cleanup(): void {
        document.querySelectorAll(".zendian-banner-wrapper").forEach(el => el.remove());
        document.querySelectorAll("[data-zendian-banner]").forEach(el => {
            el.removeAttribute("data-zendian-banner");
            (el as HTMLElement).style.removeProperty("--zendian-banner-height");
            (el as HTMLElement).style.removeProperty("--zendian-banner-position");
        });
    }
}
