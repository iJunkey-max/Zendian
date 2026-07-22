import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const failures = [];

function requireMatch(path, pattern, message) {
  if (!pattern.test(read(path))) failures.push(`${path}: ${message}`);
}

function forbidMatch(path, pattern, message) {
  if (pattern.test(read(path))) failures.push(`${path}: ${message}`);
}

for (const path of [
  "src/services/ActivityLogService.ts",
  "src/homepage/HomepageDataService.ts",
  "src/homepage/services/ProjectSnapshotService.ts",
  "src/modules/icon-system.module.ts",
  "src/ui/icon-picker-modal.ts",
]) {
  forbidMatch(path, /\.obsidian\/plugins\/zendian/, "不得硬编码 .obsidian 配置目录");
}

requireMatch(
  "src/services/ActivityLogService.ts",
  /vault\.adapter/,
  "隐藏配置数据必须通过 Adapter API 访问",
);
requireMatch(
  "src/homepage/HomepageView.ts",
  /vault\.trash\(file,\s*false\)/,
  "真实速记笔记必须移入可恢复的 Vault 回收站",
);
forbidMatch(
  "src/homepage/HomepageView.ts",
  /vault\.delete\(file\)/,
  "主页不得永久删除真实笔记",
);
requireMatch(
  "src/modules/icon-system.module.ts",
  /parseSafeSvg\(svgText\)/,
  "第三方 SVG 必须经过白名单净化",
);
requireMatch(
  "src/homepage/services/ProjectHomeStore.ts",
  /mutateProjectHome[\s\S]*enqueueProjectWrite/,
  "项目数据修改必须通过按项目串行写入",
);
forbidMatch(
  "src/homepage/services/CacheManager.ts",
  /new RegExp\(pattern\.replace/,
  "缓存通配符不得把未转义的项目路径直接编译为正则",
);
requireMatch(
  "src/homepage/services/CacheManager.ts",
  /return structuredClone\(entry\.data\)/,
  "缓存读取必须隔离可变对象引用",
);
requireMatch(
  "src/homepage/HomepageWeatherService.ts",
  /this\.cache\.location === cacheKey/,
  "天气缓存必须按位置区分",
);
requireMatch(
  "src/homepage/services/ServiceManager.ts",
  /async destroy\(\): Promise<void>[\s\S]*await this\.snapshots\.completeEditSession/,
  "服务销毁必须等待编辑会话收尾",
);
forbidMatch(
  "src/homepage/HomepageView.ts",
  /new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/,
  "用户日期不得用 UTC 日期代替本地日期",
);

if (failures.length) {
  console.error("安全契约检查失败：");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("✓ 安全契约检查通过");
