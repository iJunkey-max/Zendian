/**
 * HomepageWeatherService — Open-Meteo 天气服务
 *
 * 免费 API，无需 key
 * 文档：https://open-meteo.com/en/docs
 */

import type { HomepageWeatherData } from "./types";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

// WMO 天气代码映射
const WEATHER_CODES: Record<number, { description: string; icon: string }> = {
  0: { description: "晴", icon: "☀️" },
  1: { description: "大部晴朗", icon: "🌤️" },
  2: { description: "多云", icon: "⛅" },
  3: { description: "阴天", icon: "☁️" },
  45: { description: "雾", icon: "🌫️" },
  48: { description: "雾凇", icon: "🌫️" },
  51: { description: "小毛毛雨", icon: "🌦️" },
  53: { description: "毛毛雨", icon: "🌦️" },
  55: { description: "大毛毛雨", icon: "🌧️" },
  61: { description: "小雨", icon: "🌧️" },
  63: { description: "中雨", icon: "🌧️" },
  65: { description: "大雨", icon: "🌧️" },
  66: { description: "冻雨", icon: "🌨️" },
  67: { description: "大冻雨", icon: "🌨️" },
  71: { description: "小雪", icon: "🌨️" },
  73: { description: "中雪", icon: "❄️" },
  75: { description: "大雪", icon: "❄️" },
  77: { description: "雪粒", icon: "❄️" },
  80: { description: "阵雨", icon: "🌦️" },
  81: { description: "中阵雨", icon: "🌧️" },
  82: { description: "大阵雨", icon: "⛈️" },
  85: { description: "小阵雪", icon: "🌨️" },
  86: { description: "大阵雪", icon: "❄️" },
  95: { description: "雷暴", icon: "⛈️" },
  96: { description: "雷暴+小冰雹", icon: "⛈️" },
  99: { description: "雷暴+大冰雹", icon: "⛈️" },
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
      const weatherInfo = WEATHER_CODES[weatherCode] ?? { description: "未知", icon: "🌡️" };

      const data: HomepageWeatherData = {
        temperature: Math.round(current.temperature_2m),
        weatherCode,
        description: weatherInfo.description,
        icon: weatherInfo.icon,
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
