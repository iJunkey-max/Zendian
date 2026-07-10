/**
 * 统一错误处理工具
 * 提供一致的错误日志、分级和上报机制
 */

/** 错误级别 */
export enum ErrorLevel {
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal",
}

/** 错误上下文 */
export interface ErrorContext {
  module: string;      // 模块名称
  action: string;      // 操作名称
  data?: any;          // 附加数据
}

/**
 * 统一错误处理器
 *
 * 使用示例：
 * ```typescript
 * // 修改前
 * console.error(`[ZENdian] Failed to load module "${id}":`, err);
 *
 * // 修改后
 * ErrorHandler.error("Failed to load module", err, {
 *   module: "ModuleManager",
 *   action: "loadModule",
 *   data: { id }
 * });
 * ```
 */
export class ErrorHandler {
  private static readonly PREFIX = "[ZENdian]";

  /**
   * 记录日志
   * @param level 错误级别
   * @param message 错误消息
   * @param context 错误上下文
   * @param error 错误对象（可选）
   */
  static log(level: ErrorLevel, message: string, context?: ErrorContext, error?: Error): void {
    const prefix = context?.module
      ? `${this.PREFIX}[${context.module}]`
      : this.PREFIX;

    const action = context?.action ? ` ${context.action}:` : "";
    const fullMessage = `${prefix}${action} ${message}`;

    switch (level) {
      case ErrorLevel.INFO:
        console.log(fullMessage, context?.data);
        break;

      case ErrorLevel.WARN:
        console.warn(fullMessage, context?.data);
        break;

      case ErrorLevel.ERROR:
        if (error) {
          console.error(fullMessage, error, context?.data);
        } else {
          console.error(fullMessage, context?.data);
        }
        break;

      case ErrorLevel.FATAL:
        if (error) {
          console.error(`${fullMessage} [FATAL]`, error, context?.data);
        } else {
          console.error(`${fullMessage} [FATAL]`, context?.data);
        }
        break;
    }
  }

  /**
   * 记录信息日志
   * @param message 消息
   * @param context 上下文
   */
  static info(message: string, context?: ErrorContext): void {
    this.log(ErrorLevel.INFO, message, context);
  }

  /**
   * 记录警告日志
   * @param message 消息
   * @param context 上下文
   */
  static warn(message: string, context?: ErrorContext): void {
    this.log(ErrorLevel.WARN, message, context);
  }

  /**
   * 记录错误日志
   * @param message 消息
   * @param error 错误对象
   * @param context 上下文
   */
  static error(message: string, error?: Error, context?: ErrorContext): void {
    this.log(ErrorLevel.ERROR, message, context, error);
  }

  /**
   * 记录致命错误日志
   * @param message 消息
   * @param error 错误对象
   * @param context 上下文
   */
  static fatal(message: string, error?: Error, context?: ErrorContext): void {
    this.log(ErrorLevel.FATAL, message, context, error);
  }

  /**
   * 包装异步函数，自动捕获错误
   * @param fn 异步函数
   * @param context 错误上下文
   * @param onError 自定义错误处理（可选）
   * @returns 包装后的函数
   */
  static wrapAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context: ErrorContext,
    onError?: (error: Error) => void
  ): T {
    return (async (...args: any[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.error(`${context.action} failed`, error as Error, context);
        if (onError) {
          onError(error as Error);
        }
        throw error;
      }
    }) as T;
  }

  /**
   * 包装同步函数，自动捕获错误
   * @param fn 同步函数
   * @param context 错误上下文
   * @param onError 自定义错误处理（可选）
   * @returns 包装后的函数
   */
  static wrap<T extends (...args: any[]) => any>(
    fn: T,
    context: ErrorContext,
    onError?: (error: Error) => void
  ): T {
    return ((...args: any[]) => {
      try {
        return fn(...args);
      } catch (error) {
        this.error(`${context.action} failed`, error as Error, context);
        if (onError) {
          onError(error as Error);
        }
        throw error;
      }
    }) as T;
  }
}
