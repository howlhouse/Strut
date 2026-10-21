import { Sun, Moon, Monitor } from "lucide-react";
import { PageHeader, Panel } from "../components/ui/Primitives";

export default function SettingsPage({ themeMode, setThemeMode }) {
  return (
    <div>
      <PageHeader title="Settings" subtitle="Appearance" />

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
    </div>
  );
}
