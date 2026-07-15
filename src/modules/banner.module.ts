import { TFile, WorkspaceLeaf } from 'obsidian';
import type { IFeatureModule, ModuleContext } from '../types/module.types';
import type { BannerSettings, PluginSettings } from '../types/settings.types';

type BannerFit = 'cover' | 'hybrid' | 'contain';

export class BannerModule implements IFeatureModule {
    readonly id = 'banner';
    readonly name = '页眉图片';
    private ctx!: ModuleContext;
    private eventRefs: any[] = [];
    private renderTimer: ReturnType<typeof setTimeout> | null = null;
    private failedUrls = new Map<string, number>();
    private resizeObservers = new Map<HTMLElement, ResizeObserver>();

    async load(ctx: ModuleContext): Promise<void> {
        this.ctx = ctx;
        if (ctx.getSettings().banner.enabled) this.start();
    }

    private start(): void {
        if (this.eventRefs.length > 0) {
            this.scheduleRender(0);
            return;
        }

        this.eventRefs.push(
            this.ctx.app.workspace.on('file-open', () => this.scheduleRender()),
            this.ctx.app.workspace.on('layout-change', () => this.scheduleRender()),
            this.ctx.app.metadataCache.on('changed', (file: TFile) => {
                if (file === this.ctx.app.workspace.getActiveFile()) this.scheduleRender();
            }),
        );

        this.scheduleRender(0);
    }

    private scheduleRender(delay = 100): void {
        if (this.renderTimer) clearTimeout(this.renderTimer);
        this.renderTimer = setTimeout(() => {
            this.renderTimer = null;
            this.renderAllBanners();
        }, delay);
    }

    private stop(): void {
        this.eventRefs.forEach(ref => this.ctx.app.workspace.offref(ref));
        this.eventRefs = [];
        if (this.renderTimer) clearTimeout(this.renderTimer);
        this.renderTimer = null;
        this.failedUrls.clear();
        this.cleanup();
    }

    unload(): void {
        this.stop();
    }

    onSettingsChanged(changedKeys: string[], settings: PluginSettings): void {
        if (changedKeys.includes('banner')) {
            if (settings.banner.enabled) this.start();
            else this.stop();
        }
    }

    private renderAllBanners(): void {
        if (!this.ctx) return;
        const settings = this.ctx.getSettings().banner;
        if (!settings.enabled) return;

        this.ctx.app.workspace.getLeavesOfType('markdown').forEach(leaf => {
            const file = (leaf.view as any).file as TFile | undefined;
            if (!file) return;

            const rawUrl = this.ctx.app.metadataCache.getFileCache(file)?.frontmatter?.[settings.yamlKey];
            if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
                this.removeBannerFromLeaf(leaf);
                return;
            }

            this.injectBanner(leaf, this.resolveUrl(rawUrl.trim(), file), settings);
        });
    }

    private resolveUrl(url: string, file: TFile): string {
        if (/^https?:\/\//i.test(url)) return url;
        const clean = url.replace(/^\[\[|\]\]$/g, '');
        const dest = this.ctx.app.metadataCache.getFirstLinkpathDest(clean, file.path);
        return dest ? this.ctx.app.vault.getResourcePath(dest) : url;
    }

    private injectBanner(leaf: WorkspaceLeaf, imgUrl: string, settings: BannerSettings): void {
        const retryAt = this.failedUrls.get(imgUrl);
        if (retryAt && retryAt > Date.now()) {
            this.removeBannerFromLeaf(leaf);
            return;
        }
        if (retryAt) this.failedUrls.delete(imgUrl);

        const container = leaf.view.containerEl.closest('.workspace-leaf-content') as HTMLElement | null;
        if (!container) return;
        const mode = (leaf.view as any).getMode ? (leaf.view as any).getMode() : 'source';
        const scroller = container.querySelector(mode === 'preview' ? '.markdown-preview-view' : '.cm-scroller') as HTMLElement | null;
        if (!scroller) return;

        let wrapper = scroller.querySelector('.zendian-banner-wrapper') as HTMLElement | null;
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'zendian-banner-wrapper';

            const background = document.createElement('img');
            background.className = 'zendian-banner-background';
            background.alt = '';
            background.setAttribute('aria-hidden', 'true');

            const foreground = document.createElement('img');
            foreground.className = 'zendian-banner-img';
            foreground.alt = '';
            foreground.onload = () => this.applyLayout(container, wrapper!, foreground, settings);
            foreground.onerror = () => {
                this.failedUrls.set(foreground.dataset.bannerUrl || '', Date.now() + 30_000);
                this.removeBannerFromLeaf(leaf);
            };

            wrapper.append(background, foreground);
        }

        const background = wrapper.querySelector('.zendian-banner-background') as HTMLImageElement;
        const foreground = wrapper.querySelector('.zendian-banner-img') as HTMLImageElement;
        foreground.dataset.bannerUrl = imgUrl;
        if (foreground.src !== imgUrl) {
            background.src = imgUrl;
            foreground.src = imgUrl;
        }

        if (scroller.firstChild !== wrapper) scroller.prepend(wrapper);
        this.applyLayout(container, wrapper, foreground, settings);

        container.setAttribute('data-zendian-banner', '');
        this.observeResize(container);
    }

    private applyLayout(container: HTMLElement, wrapper: HTMLElement, image: HTMLImageElement, settings: BannerSettings): void {
        const scroller = wrapper.parentElement as HTMLElement | null;
        const width = Math.max(1, container.clientWidth);
        const preferred = Math.max(150, Math.min(1000, Number(settings.height) || 250));
        const aspect = image.naturalWidth > 0 && image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 0;
        const naturalHeight = aspect > 0 ? width / aspect : preferred;
        // The requested height is the upper bound. The image is always scaled to
        // the available width first, so horizontal content is never cropped.
        const height = aspect > 0 ? Math.max(120, Math.min(preferred, naturalHeight)) : preferred;
        const containerAspect = width / height;
        const cropRatio = aspect > 0 ? Math.min(aspect / containerAspect, containerAspect / aspect) : 1;
        let fit: BannerFit = settings.displayMode === 'contain' ? 'contain' : 'cover';

        if (settings.displayMode === 'smart' && cropRatio < 0.8) {
            fit = 'hybrid';
        }

        if (settings.displayMode === 'cover') fit = 'cover';
        if (settings.displayMode === 'contain') fit = 'contain';

        const overlap = Math.min(Math.max(0, Number(settings.contentOverlap) || 0), height * 0.45);
        if (scroller) {
            const containerRect = container.getBoundingClientRect();
            const scrollerRect = scroller.getBoundingClientRect();
            wrapper.style.setProperty('--zendian-banner-left', `${containerRect.left - scrollerRect.left}px`);
            wrapper.style.setProperty('--zendian-banner-width', `${containerRect.width}px`);
        }
        container.style.setProperty('--zendian-banner-height', `${Math.round(height)}px`);
        container.style.setProperty('--zendian-banner-overlap', `${Math.round(overlap)}px`);
        container.style.setProperty('--zendian-banner-position', settings.position || 'center');
        wrapper.dataset.fit = fit;

        if (!this.resizeObservers.has(container)) this.observeResize(container);
    }

    private observeResize(container: HTMLElement): void {
        if (this.resizeObservers.has(container) || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => this.scheduleRender());
        observer.observe(container);
        this.resizeObservers.set(container, observer);
    }

    private removeBannerFromLeaf(leaf: WorkspaceLeaf): void {
        const container = leaf.view.containerEl.closest('.workspace-leaf-content') as HTMLElement | null;
        if (!container) return;
        const observer = this.resizeObservers.get(container);
        observer?.disconnect();
        this.resizeObservers.delete(container);
        container.removeAttribute('data-zendian-banner');
        container.style.removeProperty('--zendian-banner-height');
        container.style.removeProperty('--zendian-banner-overlap');
        container.style.removeProperty('--zendian-banner-position');
        container.querySelector('.zendian-banner-wrapper')?.remove();
    }

    private cleanup(): void {
        this.resizeObservers.forEach(observer => observer.disconnect());
        this.resizeObservers.clear();
        document.querySelectorAll('.zendian-banner-wrapper').forEach(el => el.remove());
        document.querySelectorAll('[data-zendian-banner]').forEach(el => {
            el.removeAttribute('data-zendian-banner');
            const html = el as HTMLElement;
            html.style.removeProperty('--zendian-banner-height');
            html.style.removeProperty('--zendian-banner-overlap');
            html.style.removeProperty('--zendian-banner-position');
        });
    }
}
