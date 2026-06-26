/**
 * HomepageWeatherService — Open-Meteo 天气服务
 *
 * 免费 API，无需 key
 * 文档：https://open-meteo.com/en/docs
 */

import type { HomepageWeatherData } from "./types";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

/** 天气图标类型 */
type WeatherIconType = "sun" | "partly-cloudy" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "storm";

// WMO 天气代码映射
const WEATHER_CODES: Record<number, { description: string; icon: WeatherIconType }> = {
  0: { description: "晴", icon: "sun" },
  1: { description: "大部晴朗", icon: "partly-cloudy" },
  2: { description: "多云", icon: "cloud" },
  3: { description: "阴天", icon: "cloud" },
  45: { description: "雾", icon: "fog" },
  48: { description: "雾凇", icon: "fog" },
  51: { description: "小毛毛雨", icon: "drizzle" },
  53: { description: "毛毛雨", icon: "drizzle" },
  55: { description: "大毛毛雨", icon: "rain" },
  61: { description: "小雨", icon: "rain" },
  63: { description: "中雨", icon: "rain" },
  65: { description: "大雨", icon: "rain" },
  66: { description: "冻雨", icon: "snow" },
  67: { description: "大冻雨", icon: "snow" },
  71: { description: "小雪", icon: "snow" },
  73: { description: "中雪", icon: "snow" },
  75: { description: "大雪", icon: "snow" },
  77: { description: "雪粒", icon: "snow" },
  80: { description: "阵雨", icon: "drizzle" },
  81: { description: "中阵雨", icon: "rain" },
  82: { description: "大阵雨", icon: "storm" },
  85: { description: "小阵雪", icon: "snow" },
  86: { description: "大阵雪", icon: "snow" },
  95: { description: "雷暴", icon: "storm" },
  96: { description: "雷暴+小冰雹", icon: "storm" },
  99: { description: "雷暴+大冰雹", icon: "storm" },
};

/** 天气图标 SVG（Lucide 风格 18x18） */
const WEATHER_SVGS: Record<WeatherIconType, string> = {
  sun: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  "partly-cloudy": `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m17.66 17.66 1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.94 9.06A5 5 0 0 0 9.5 6.5"/><path d="M12.5 2.5a2.5 2.5 0 0 0-2 .5"/><path d="M17 15a4.5 4.5 0 1 0-3.5-7.5L7 14h10.5a3 3 0 0 1 0 6H7"/></svg>`,
  cloud: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`,
  fog: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M12 2v2"/></svg>`,
  drizzle: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M8 19v1"/><path d="M8 14v1"/><path d="M16 19v1"/><path d="M16 14v1"/><path d="M12 21v1"/><path d="M12 16v1"/></svg>`,
  rain: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>`,
  snow: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M8 15h.01"/><path d="M8 19h.01"/><path d="M12 17h.01"/><path d="M12 21h.01"/><path d="M16 15h.01"/><path d="M16 19h.01"/></svg>`,
  storm: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M13 12l-2 4h4l-2 4"/></svg>`,
};

/** 天气图标背景色 */
const WEATHER_BG_COLORS: Record<WeatherIconType, { light: string; dark: string }> = {
  sun: { light: "#fefce8", dark: "rgba(254,252,232,0.08)" },
  "partly-cloudy": { light: "#fefce8", dark: "rgba(254,252,232,0.08)" },
  cloud: { light: "#f0f9ff", dark: "rgba(240,249,255,0.08)" },
  fog: { light: "#f5f5f5", dark: "rgba(245,245,245,0.08)" },
  drizzle: { light: "#eff6ff", dark: "rgba(239,246,255,0.08)" },
  rain: { light: "#eff6ff", dark: "rgba(239,246,255,0.08)" },
  snow: { light: "#f0f9ff", dark: "rgba(240,249,255,0.08)" },
  storm: { light: "#fef2f2", dark: "rgba(254,242,242,0.08)" },
};

/** 天气图标前景色 */
const WEATHER_FG_COLORS: Record<WeatherIconType, { light: string; dark: string }> = {
  sun: { light: "#eab308", dark: "#facc15" },
  "partly-cloudy": { light: "#eab308", dark: "#facc15" },
  cloud: { light: "#64748b", dark: "#94a3b8" },
  fog: { light: "#9ca3af", dark: "#9ca3af" },
  drizzle: { light: "#3b82f6", dark: "#60a5fa" },
  rain: { light: "#3b82f6", dark: "#60a5fa" },
  snow: { light: "#38bdf8", dark: "#7dd3fc" },
  storm: { light: "#f59e0b", dark: "#fbbf24" },
};

interface GeoResult {
  latitude: number;
  longitude: number;
  name: string;
}

interface CacheEntry {
  data: HomepageWeatherData;
  timestamp: number;
}

export class HomepageWeatherService {
  private cache: CacheEntry | null = null;
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 分钟

  /**
   * 获取天气数据
   * @param location 城市名或 "纬度,经度"
   */
  async getWeather(location: string): Promise<HomepageWeatherData | null> {
    // 检查缓存
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache.data;
    }

    try {
      const coords = await this.resolveLocation(location);
      if (!coords) return null;

      const url = `${WEATHER_URL}?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,weather_code&timezone=auto`;
      const response = await fetch(url);

      if (!response.ok) return null;

      const json = await response.json();
      const current = json.current;

      if (!current) return null;

      const weatherCode = current.weather_code;
      const weatherInfo = WEATHER_CODES[weatherCode] ?? { description: "未知", icon: "cloud" as WeatherIconType };
      const iconType = weatherInfo.icon;

      const data: HomepageWeatherData = {
        temperature: Math.round(current.temperature_2m),
        weatherCode,
        description: weatherInfo.description,
        icon: iconType,
        iconSvg: WEATHER_SVGS[iconType],
        iconBgLight: WEATHER_BG_COLORS[iconType].light,
        iconBgDark: WEATHER_BG_COLORS[iconType].dark,
        iconColorLight: WEATHER_FG_COLORS[iconType].light,
        iconColorDark: WEATHER_FG_COLORS[iconType].dark,
        location: coords.name || location,
        updatedAt: Date.now(),
      };

      this.cache = { data, timestamp: Date.now() };
      return data;
    } catch (e) {
      console.error("[ZENdian] Weather fetch error:", e);
      return null;
    }
  }

  /**
   * 解析位置：城市名 → 坐标
   */
  private async resolveLocation(location: string): Promise<GeoResult | null> {
    // 如果是 "纬度,经度" 格式
    const coordMatch = location.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      return {
        latitude: parseFloat(coordMatch[1]),
        longitude: parseFloat(coordMatch[2]),
        name: location,
      };
    }

    // 城市名搜索
    try {
      const url = `${GEOCODING_URL}?name=${encodeURIComponent(location)}&count=1&language=zh`;
      const response = await fetch(url);
      if (!response.ok) return null;

      const json = await response.json();
      if (!json.results || json.results.length === 0) return null;

      const first = json.results[0];
      return {
        latitude: first.latitude,
        longitude: first.longitude,
        name: first.name || location,
      };
    } catch {
      return null;
    }
  }
}
