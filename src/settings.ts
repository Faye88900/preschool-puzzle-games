export type Settings = { music: boolean; effects: boolean };

export function readSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem('gummy-rush-settings') ?? 'null');
    return { music: typeof saved?.music === 'boolean' ? saved.music : true, effects: typeof saved?.effects === 'boolean' ? saved.effects : true };
  } catch { return { music: true, effects: true }; }
}

export function saveSettings(settings: Settings) {
  try { localStorage.setItem('gummy-rush-settings', JSON.stringify(settings)); } catch { /* Storage may be disabled. */ }
}
