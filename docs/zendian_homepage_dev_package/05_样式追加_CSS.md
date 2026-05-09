# 05 样式追加 CSS

将下面 CSS 追加到 `styles.css` 末尾，或作为独立 `styles/homepage.css` 引入构建。

重点：所有选择器都限定在 `.workspace-leaf-content[data-type="zendian-homepage-view"]` 下，避免污染现有 empty tab 样式。

```css
.workspace-leaf-content[data-type="zendian-homepage-view"] {
  --zendian-homepage-max-width: 1120px;
}

.workspace-leaf-content[data-type="zendian-homepage-view"] .view-content {
  padding: 0;
  overflow: auto;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--interactive-accent) 18%, transparent), transparent 32rem),
    var(--background-primary);
}

.zendian-homepage {
  width: min(100%, var(--zendian-homepage-max-width));
  margin: 0 auto;
  padding: 56px 32px 64px;
}

.zendian-homepage-hero {
  position: relative;
  margin-bottom: 24px;
}

.zendian-homepage-kicker {
  display: inline-flex;
  align-items: center;
  margin-bottom: 8px;
  padding: 3px 8px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 999px;
  color: var(--text-muted);
  background: var(--background-secondary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.zendian-homepage-title {
  margin: 0;
  color: var(--text-normal);
  font-size: clamp(36px, 6vw, 72px);
  font-weight: 760;
  letter-spacing: -0.05em;
  line-height: 0.95;
}

.zendian-homepage-subtitle {
  margin: 12px 0 28px;
  max-width: 680px;
  color: var(--text-muted);
  font-size: 16px;
  line-height: 1.7;
}

.zendian-homepage-search {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 54px;
  padding: 0 16px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 18px;
  background: color-mix(in srgb, var(--background-secondary) 88%, transparent);
  box-shadow: var(--shadow-s);
}

.zendian-homepage-search-icon {
  display: flex;
  width: 22px;
  height: 22px;
  color: var(--text-muted);
}

.zendian-homepage-search-input {
  flex: 1;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
  background: transparent !important;
  color: var(--text-normal);
  font-size: 16px;
}

.zendian-homepage-results {
  display: none;
  margin-top: 10px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 16px;
  overflow: hidden;
  background: var(--background-secondary);
  box-shadow: var(--shadow-s);
}

.zendian-homepage-results.is-active {
  display: block;
}

.zendian-homepage-result-item,
.zendian-homepage-recent-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--background-modifier-border);
}

.zendian-homepage-result-item:last-child,
.zendian-homepage-recent-item:last-child {
  border-bottom: none;
}

.zendian-homepage-result-item:hover,
.zendian-homepage-recent-item:hover {
  background: var(--background-modifier-hover);
}

.zendian-homepage-result-icon,
.zendian-homepage-recent-icon,
.zendian-homepage-stat-icon,
.zendian-homepage-action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.zendian-homepage-result-main,
.zendian-homepage-recent-main {
  min-width: 0;
  flex: 1;
}

.zendian-homepage-result-title,
.zendian-homepage-recent-title {
  color: var(--text-normal);
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zendian-homepage-result-path,
.zendian-homepage-recent-path,
.zendian-homepage-recent-time {
  color: var(--text-muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zendian-homepage-result-empty {
  padding: 14px 16px;
  color: var(--text-muted);
  font-size: 13px;
}

.zendian-homepage-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 22px 0 24px;
}

.zendian-homepage-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 46px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 14px;
  background: var(--background-secondary);
  color: var(--text-normal);
  cursor: pointer;
}

.zendian-homepage-action:hover {
  background: var(--background-modifier-hover);
}

.zendian-homepage-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 16px;
}

.zendian-homepage-panel {
  min-width: 0;
  border: 1px solid var(--background-modifier-border);
  border-radius: 20px;
  background: color-mix(in srgb, var(--background-secondary) 92%, transparent);
  box-shadow: var(--shadow-s);
  overflow: hidden;
}

.zendian-homepage-panel-title {
  margin: 0;
  padding: 16px 18px;
  border-bottom: 1px solid var(--background-modifier-border);
  color: var(--text-normal);
  font-size: 15px;
  font-weight: 700;
}

.zendian-homepage-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 14px;
}

.zendian-homepage-stat-card {
  padding: 14px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 14px;
  background: var(--background-primary);
}

.zendian-homepage-stat-icon {
  width: 20px;
  height: 20px;
  margin-bottom: 10px;
}

.zendian-homepage-stat-value {
  color: var(--text-normal);
  font-size: 22px;
  font-weight: 760;
  line-height: 1.1;
}

.zendian-homepage-stat-label {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
}

.zendian-homepage-recent-list {
  padding: 6px;
}

@media (max-width: 780px) {
  .zendian-homepage {
    padding: 32px 18px 48px;
  }

  .zendian-homepage-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .zendian-homepage-grid {
    grid-template-columns: 1fr;
  }
}
```
