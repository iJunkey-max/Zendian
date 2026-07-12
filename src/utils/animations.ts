/**
 * Animations — 微交互动画库
 *
 * 功能：
 * - 元素进入动画
 * - 交互反馈动画
 * - 状态切换动画
 * - 加载动画
 * - 工具函数
 */

// ============================================================
// 动画类型定义
// ============================================================

export type AnimationType =
  | "fade-in"
  | "fade-in-up"
  | "fade-in-down"
  | "fade-in-left"
  | "fade-in-right"
  | "scale-in"
  | "slide-in-up"
  | "slide-in-down"
  | "slide-in-left"
  | "slide-in-right"
  | "bounce-in"
  | "rotate-in"
  | "flip-in";

export type EasingType =
  | "linear"
  | "ease"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "cubic-bezier"
  | `cubic-bezier(${string})`;

export interface AnimationOptions {
  duration?: number;      // 动画时长（ms）
  delay?: number;         // 延迟（ms）
  easing?: EasingType;    // 缓动函数
  iterations?: number;    // 迭代次数
  direction?: "normal" | "reverse" | "alternate" | "alternate-reverse";
  fillMode?: "none" | "forwards" | "backwards" | "both";
}

export interface SpringOptions {
  stiffness?: number;     // 弹簧刚度
  damping?: number;       // 阻尼系数
  mass?: number;          // 质量
  velocity?: number;      // 初始速度
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_OPTIONS: Required<AnimationOptions> = {
  duration: 300,
  delay: 0,
  easing: "ease-out",
  iterations: 1,
  direction: "normal",
  fillMode: "both",
};

const DEFAULT_SPRING_OPTIONS: Required<SpringOptions> = {
  stiffness: 100,
  damping: 10,
  mass: 1,
  velocity: 0,
};

// ============================================================
// CSS 动画
// ============================================================

/**
 * 应用 CSS 动画
 */
export function animateCSS(
  element: HTMLElement,
  animation: AnimationType,
  options: AnimationOptions = {}
): Promise<void> {
  return new Promise((resolve) => {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // 设置动画样式
    element.style.animationName = animation;
    element.style.animationDuration = `${opts.duration}ms`;
    element.style.animationDelay = `${opts.delay}ms`;
    element.style.animationTimingFunction = getEasingFunction(opts.easing);
    element.style.animationIterationCount = String(opts.iterations);
    element.style.animationDirection = opts.direction;
    element.style.animationFillMode = opts.fillMode;

    // 监听动画结束
    const handleAnimationEnd = () => {
      element.removeEventListener("animationend", handleAnimationEnd);
      // 清除动画样式
      element.style.animationName = "";
      element.style.animationDuration = "";
      element.style.animationDelay = "";
      element.style.animationTimingFunction = "";
      element.style.animationIterationCount = "";
      element.style.animationDirection = "";
      element.style.animationFillMode = "";
      resolve();
    };

    element.addEventListener("animationend", handleAnimationEnd);
  });
}

/**
 * 批量应用动画
 */
export function animateStagger(
  elements: HTMLElement[],
  animation: AnimationType,
  options: AnimationOptions = {}
): Promise<void[]> {
  const promises = elements.map((element, index) => {
    return animateCSS(element, animation, {
      ...options,
      delay: (options.delay || 0) + index * 50, // 交错延迟
    });
  });

  return Promise.all(promises);
}

/**
 * 序列动画
 */
export async function animateSequence(
  animations: Array<{
    element: HTMLElement;
    animation: AnimationType;
    options?: AnimationOptions;
  }>
): Promise<void> {
  for (const { element, animation, options } of animations) {
    await animateCSS(element, animation, options);
  }
}

// ============================================================
// JavaScript 动画
// ============================================================

/**
 * 数值动画
 */
export function animateValue(
  from: number,
  to: number,
  options: AnimationOptions & {
    onUpdate: (value: number) => void;
    onComplete?: () => void;
  }
): () => void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = performance.now();
  let animationFrame: number;

  const update = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / opts.duration, 1);

    // 应用缓动函数
    const easedProgress = applyEasing(progress, opts.easing);
    const currentValue = from + (to - from) * easedProgress;

    options.onUpdate(currentValue);

    if (progress < 1) {
      animationFrame = requestAnimationFrame(update);
    } else {
      options.onComplete?.();
    }
  };

  animationFrame = requestAnimationFrame(update);

  // 返回取消函数
  return () => {
    cancelAnimationFrame(animationFrame);
  };
}

/**
 * 弹簧动画
 */
export function animateSpring(
  from: number,
  to: number,
  options: SpringOptions & {
    onUpdate: (value: number) => void;
    onComplete?: () => void;
  }
): () => void {
  const opts = { ...DEFAULT_SPRING_OPTIONS, ...options };
  let animationFrame: number;
  let position = from;
  let velocity = opts.velocity;

  const update = () => {
    const springForce = -opts.stiffness * (position - to);
    const dampingForce = -opts.damping * velocity;
    const acceleration = (springForce + dampingForce) / opts.mass;

    velocity += acceleration * 0.016; // 假设 60fps
    position += velocity * 0.016;

    options.onUpdate(position);

    // 检查是否到达目标
    if (Math.abs(position - to) < 0.01 && Math.abs(velocity) < 0.01) {
      position = to;
      options.onUpdate(position);
      options.onComplete?.();
      return;
    }

    animationFrame = requestAnimationFrame(update);
  };

  animationFrame = requestAnimationFrame(update);

  // 返回取消函数
  return () => {
    cancelAnimationFrame(animationFrame);
  };
}

// ============================================================
// 预设动画
// ============================================================

/**
 * 按钮点击反馈
 */
export function buttonPress(element: HTMLElement): void {
  element.style.transform = "scale(0.95)";
  element.style.transition = "transform 0.1s ease";

  setTimeout(() => {
    element.style.transform = "scale(1)";
    setTimeout(() => {
      element.style.transition = "";
    }, 100);
  }, 100);
}

/**
 * 卡片悬浮
 */
export function cardHover(element: HTMLElement, isHover: boolean): void {
  if (isHover) {
    element.style.transform = "translateY(-2px)";
    element.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
  } else {
    element.style.transform = "translateY(0)";
    element.style.boxShadow = "";
  }
}

/**
 * 列表项进入
 */
export function listItemEnter(element: HTMLElement, index: number): void {
  animateCSS(element, "fade-in-up", {
    delay: index * 50,
    duration: 300,
  });
}

/**
 * 模态框进入
 */
export function modalEnter(overlay: HTMLElement, modal: HTMLElement): Promise<void> {
  return Promise.all([
    animateCSS(overlay, "fade-in", { duration: 200 }),
    animateCSS(modal, "scale-in", { duration: 300, delay: 100 }),
  ]).then(() => {});
}

/**
 * 模态框退出
 */
export function modalExit(overlay: HTMLElement, modal: HTMLElement): Promise<void> {
  return Promise.all([
    animateCSS(overlay, "fade-in", { duration: 200, direction: "reverse" }),
    animateCSS(modal, "scale-in", { duration: 200, direction: "reverse" }),
  ]).then(() => {});
}

/**
 * Toast 通知
 */
export function toastEnter(element: HTMLElement): Promise<void> {
  return animateCSS(element, "slide-in-right", {
    duration: 300,
    easing: "ease-out",
  });
}

/**
 * Toast 退出
 */
export function toastExit(element: HTMLElement): Promise<void> {
  return animateCSS(element, "slide-in-right", {
    duration: 200,
    direction: "reverse",
  });
}

/**
 * 加载旋转
 */
export function loadingSpin(element: HTMLElement): () => void {
  element.style.animation = "zd-spin 1s linear infinite";

  return () => {
    element.style.animation = "";
  };
}

/**
 * 脉冲效果
 */
export function pulse(element: HTMLElement, duration = 2000): () => void {
  element.style.animation = `zd-pulse ${duration}ms ease-in-out infinite`;

  return () => {
    element.style.animation = "";
  };
}

/**
 * 弹跳效果
 */
export function bounce(element: HTMLElement): Promise<void> {
  return animateCSS(element, "bounce-in", {
    duration: 500,
    easing: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
  });
}

/**
 * 摇晃效果
 */
export function shake(element: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    element.style.animation = "shake 0.5s ease";

    const handleAnimationEnd = () => {
      element.removeEventListener("animationend", handleAnimationEnd);
      element.style.animation = "";
      resolve();
    };

    element.addEventListener("animationend", handleAnimationEnd);
  });
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 获取缓动函数
 */
function getEasingFunction(easing: EasingType): string {
  switch (easing) {
    case "linear":
      return "linear";
    case "ease":
      return "ease";
    case "ease-in":
      return "ease-in";
    case "ease-out":
      return "ease-out";
    case "ease-in-out":
      return "ease-in-out";
    case "cubic-bezier":
      return "cubic-bezier(0.4, 0, 0.2, 1)";
    default:
      return "ease-out";
  }
}

/**
 * 应用缓动函数
 */
function applyEasing(t: number, easing: EasingType): number {
  switch (easing) {
    case "linear":
      return t;
    case "ease-in":
      return t * t;
    case "ease-out":
      return t * (2 - t);
    case "ease-in-out":
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    default:
      return t * (2 - t); // ease-out
  }
}

/**
 * 检查是否支持动画
 */
export function supportsAnimation(): boolean {
  return (
    typeof window !== "undefined" &&
    "animate" in document.createElement("div")
  );
}

/**
 * 检查用户是否偏好减少动画
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 安全地应用动画（考虑用户偏好）
 */
export function safeAnimate(
  element: HTMLElement,
  animation: AnimationType,
  options: AnimationOptions = {}
): Promise<void> {
  if (prefersReducedMotion()) {
    // 直接应用最终状态，不播放动画
    return Promise.resolve();
  }

  return animateCSS(element, animation, options);
}

// ============================================================
// 关键帧定义
// ============================================================

/**
 * 注册自定义关键帧
 */
export function registerKeyframes(
  name: string,
  keyframes: Record<string, Record<string, string>>
): void {
  const style = document.createElement("style");
  let css = `@keyframes ${name} {\n`;

  for (const [key, values] of Object.entries(keyframes)) {
    css += `  ${key} {\n`;
    for (const [property, value] of Object.entries(values)) {
      css += `    ${property}: ${value};\n`;
    }
    css += `  }\n`;
  }

  css += `}\n`;
  style.textContent = css;
  document.head.appendChild(style);
}

// ============================================================
// 预设关键帧
// ============================================================

// 注册常用关键帧
if (typeof document !== "undefined") {
  registerKeyframes("shake", {
    "0%, 100%": { transform: "translateX(0)" },
    "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-5px)" },
    "20%, 40%, 60%, 80%": { transform: "translateX(5px)" },
  });

  registerKeyframes("wiggle", {
    "0%, 100%": { transform: "rotate(-3deg)" },
    "50%": { transform: "rotate(3deg)" },
  });

  registerKeyframes("float", {
    "0%, 100%": { transform: "translateY(0)" },
    "50%": { transform: "translateY(-10px)" },
  });
}
