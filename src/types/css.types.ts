/**
 * CSS @settings 解析相关类型
 * 保留用于向后兼容，未来可移除
 */

export interface CSSSetting {
  id: string;
  title?: string;
  titleZh?: string;
  description?: string;
  descriptionZh?: string;
  type: string;
  default?: any;
  options?: { label: string; value: string }[];
  format?: string;
  min?: number;
  max?: number;
  step?: number;
  level?: number;
  collapsed?: boolean;
  markdown?: boolean;
}

export interface CSSSettingsGroup {
  id: string;
  name: string;
  nameZh?: string;
  settings: CSSSetting[];
}
