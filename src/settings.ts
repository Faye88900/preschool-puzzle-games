export type Settings = { music: boolean; effects: boolean; assist: boolean };

export function readSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem('gummy-rush-settings') ?? 'null');
    return { music: typeof saved?.music === 'boolean' ? saved.music : true, effects: typeof saved?.effects === 'boolean' ? saved.effects : true, assist: saved?.assist === true };
  } catch { return { music: true, effects: true, assist: false }; }
}

export function saveSettings(settings: Settings) {
  try { localStorage.setItem('gummy-rush-settings', JSON.stringify(settings)); } catch { /* Storage may be disabled. */ }
}
