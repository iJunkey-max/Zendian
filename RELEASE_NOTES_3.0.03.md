# ZENdian V3.0.03

## Release highlights

### Banner image improvements

- Added smart banner rendering with cover, contain, and hybrid presentation modes.
- Images now scale to the available interface width without horizontal cropping.
- Banner height adapts to the selected preferred height and the image's natural aspect ratio.
- Removed layout gaps caused by hidden scrollbars, split panes, and nested content padding.
- Added a smoother bottom fade so header images blend into the document background.
- Titles and metadata can overlap the lower banner area for a denser reading layout.
- Synchronized banner height sliders and numeric inputs in the settings panel.

### Reliability

- Debounced banner refreshes and added responsive resize handling.
- Added frontmatter validation, bounded failed-image retries, and complete DOM cleanup.
- Verified with TypeScript checks, settings contract checks, CSS build, and production JS build.

## Compatibility

- Minimum Obsidian version: `1.12.7`
- Existing `banner` frontmatter image fields remain compatible.
