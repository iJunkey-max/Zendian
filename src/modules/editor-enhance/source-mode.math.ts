export interface SourceModeRecord {
  originalWasSource: boolean;
  switchedByPlugin: boolean;
  manuallyOverridden: boolean;
  filePathAtSwitch: string | null;
  noticeShown: boolean;
}

export function shouldRestoreSourceMode(record: SourceModeRecord, isSource: boolean): boolean {
  return record.switchedByPlugin && !record.manuallyOverridden && !record.originalWasSource && isSource;
}
