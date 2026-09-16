import { useState } from "react";
import { Sun, Moon, Monitor, Bell, Sparkles, Eraser } from "lucide-react";
import { PageHeader, Panel } from "../components/ui/Primitives";

export default function SettingsPage({ settings, updateSettings, themeMode, setThemeMode, canLoadDemoData, loadDemo, clearAll }) {
  const [reminderDaysDraft, setReminderDaysDraft] = useState(settings.reminderDays);

  const saveReminderDays = () => {
    const v = Math.min(60, Math.max(1, Number(reminderDaysDraft) || 14));
    setReminderDaysDraft(v);
    updateSettings({ reminderDays: v });
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Appearance, reminders and data" />

      <Panel title="Appearance">
        <div className="setting-row">
          <div>
            <div className="setting-row-label">Theme</div>
            <div className="setting-row-desc">Choose light, dark, or match your device's setting.</div>
          </div>
          <div className="segmented">
            <button className={"segment" + (themeMode === "light" ? " active" : "")} onClick={() => setThemeMode("light")}><Sun size={13} /> Light</button>
            <button className={"segment" + (themeMode === "dark" ? " active" : "")} onClick={() => setThemeMode("dark")}><Moon size={13} /> Dark</button>
            <button className={"segment" + (themeMode === "system" ? " active" : "")} onClick={() => setThemeMode("system")}><Monitor size={13} /> System</button>
          </div>
        </div>
      </Panel>

      <Panel title="Reminders">
        <div className="setting-row">
          <div>
            <div className="setting-row-label">Dashboard due-soon reminders</div>
            <div className="setting-row-desc">Show a list of upcoming bills and layaway payments on the dashboard.</div>
          </div>
          <div className="setting-row-control">
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.remindersEnabled !== false}
                onChange={(e) => updateSettings({ remindersEnabled: e.target.checked })}
              />
              <span className="switch-track" />
            </label>
          </div>
        </div>
        {settings.remindersEnabled !== false && (
          <div className="setting-row">
            <div>
              <div className="setting-row-label">Remind me this many days ahead</div>
              <div className="setting-row-desc">How far out counts as "due soon" on the dashboard.</div>
            </div>
            <div className="setting-row-control">
              <input
                className="input input-small col-amount-input"
                type="number"
                min="1"
                max="60"
                value={reminderDaysDraft}
                onChange={(e) => setReminderDaysDraft(e.target.value)}
                onBlur={saveReminderDays}
              />
              <span className="muted-text">days</span>
            </div>
          </div>
        )}
        <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
          <Bell size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
          These are in-app reminders shown on the dashboard, not push or email notifications.
        </p>
      </Panel>

      <Panel title="Data">
        <div className="setting-row" style={{ flexWrap: "wrap" }}>
          <div>
            <div className="setting-row-label">Sample content</div>
            <div className="setting-row-desc">Load example bills, cards and layaway plans to explore the app.</div>
          </div>
          {canLoadDemoData ? (
            <button className="btn btn-ghost btn-small" onClick={loadDemo}><Sparkles size={13} /> Load demo data</button>
          ) : (
            <span className="muted-text">Not available on this account.</span>
          )}
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-row-label">Reset everything</div>
            <div className="setting-row-desc">Permanently clear all bills, cards, layaways and accounts.</div>
          </div>
          <button className="btn btn-ghost btn-small" onClick={clearAll}><Eraser size={13} /> Clear all data</button>
        </div>
      </Panel>
    </div>
  );
}
