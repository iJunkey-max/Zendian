export interface FocusModeRuntimeState {
  persistent: boolean;
  clockTemporary: boolean;
  active: boolean;
  typewriterActive: boolean;
}

export function resolveFocusModeRuntime(
  persistent: boolean,
  clockTemporary: boolean,
  typewriterEnabled: boolean,
): FocusModeRuntimeState {
  const active = persistent || clockTemporary;
  return {
    persistent,
    clockTemporary,
    active,
    typewriterActive: active && typewriterEnabled,
  };
}
