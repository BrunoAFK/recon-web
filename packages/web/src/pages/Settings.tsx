import { Settings as SettingsIcon } from "lucide-react";
import { usePreferences, type GroupBy, type SortBy, type StatusOrder } from "@/hooks/use-preferences";

interface ConfigItem {
  label: string;
  envVar: string;
  description: string;
}

const schedulerConfig: ConfigItem[] = [
  { label: "Enabled", envVar: "SCHEDULE_ENABLED", description: "Whether scheduled scanning is active" },
  { label: "URLs", envVar: "SCHEDULE_URLS", description: "Comma-separated list of URLs to scan" },
  { label: "Cron Expression", envVar: "SCHEDULE_CRON", description: "Cron schedule (default: daily at midnight)" },
];

const telegramConfig: ConfigItem[] = [
  { label: "Bot Token", envVar: "TELEGRAM_BOT_TOKEN", description: "Telegram Bot API token from @BotFather" },
  { label: "Chat ID", envVar: "TELEGRAM_CHAT_ID", description: "Telegram chat/group to receive alerts" },
];

const emailConfig: ConfigItem[] = [
  { label: "SMTP Host", envVar: "SMTP_HOST", description: "SMTP server (e.g. smtp.gmail.com)" },
  { label: "SMTP Port", envVar: "SMTP_PORT", description: "SMTP port (default: 587)" },
  { label: "SMTP User", envVar: "SMTP_USER", description: "SMTP username/email" },
  { label: "SMTP Password", envVar: "SMTP_PASS", description: "SMTP password or app password" },
  { label: "Notify Email", envVar: "NOTIFY_EMAIL", description: "Email address to receive alerts" },
];

interface ApiKeyItem {
  label: string;
  envVar: string;
  description: string;
  freeLimit: string;
  signupUrl: string;
  infoDate: string;
}

const apiKeysData: ApiKeyItem[] = [
  { label: "Google Cloud", envVar: "GOOGLE_CLOUD_API_KEY", description: "PageSpeed Insights + Safe Browsing", freeLimit: "Generous free tier", signupUrl: "https://console.cloud.google.com/apis/credentials", infoDate: "2025-04" },
  { label: "Cloudmersive", envVar: "CLOUDMERSIVE_API_KEY", description: "Malware scanning", freeLimit: "800 req/month", signupUrl: "https://account.cloudmersive.com/signup", infoDate: "2025-04" },
  { label: "BuiltWith", envVar: "BUILT_WITH_API_KEY", description: "Feature/technology detection", freeLimit: "Limited free tier", signupUrl: "https://api.builtwith.com/", infoDate: "2025-04" },
  { label: "Tranco", envVar: "TRANCO_API_KEY", description: "Domain popularity ranking", freeLimit: "Free with account", signupUrl: "https://tranco-list.eu/", infoDate: "2025-04" },
  { label: "VirusTotal", envVar: "VIRUSTOTAL_API_KEY", description: "URL scan against 70+ AV engines", freeLimit: "500 req/day, 4 req/min", signupUrl: "https://www.virustotal.com/gui/join", infoDate: "2025-04" },
  { label: "AbuseIPDB", envVar: "ABUSEIPDB_API_KEY", description: "IP reputation and abuse reports", freeLimit: "1,000 req/day", signupUrl: "https://www.abuseipdb.com/pricing", infoDate: "2025-04" },
];

const authConfig: ConfigItem[] = [
  { label: "Auth Enabled", envVar: "AUTH_ENABLED", description: "Whether API authentication is required" },
  { label: "Auth Token", envVar: "AUTH_TOKEN", description: "Bearer token for API access" },
];

const GROUP_OPTIONS: { value: GroupBy; label: string; description: string }[] = [
  { value: "none", label: "No grouping", description: "Cards displayed in flat masonry layout" },
  { value: "category", label: "By Category", description: "Group cards by Security, DNS, Network, etc." },
  { value: "status", label: "By Status", description: "Group cards by OK, Issues, Info" },
];

const SORT_OPTIONS: { value: SortBy; label: string; description: string }[] = [
  { value: "name-asc", label: "Name A → Z", description: "Alphabetical order" },
  { value: "name-desc", label: "Name Z → A", description: "Reverse alphabetical order" },
];

const STATUS_ORDER_OPTIONS: { value: StatusOrder; label: string; description: string }[] = [
  { value: "ok-first", label: "OK first", description: "Show successful checks first, issues last" },
  { value: "issues-first", label: "Issues first", description: "Show issues and warnings first" },
];

function ConfigSection({ title, items }: { title: string; items: ConfigItem[] }) {
  return (
    <div className="rounded-xl border border-border/50 bg-surface/50 p-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.envVar} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <span className="text-sm font-medium text-foreground min-w-[10rem]">{item.label}</span>
            <code className="text-sm text-accent bg-background/50 px-2 py-1 rounded">{item.envVar}</code>
            <span className="text-sm text-muted ml-auto hidden sm:block">{item.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Settings() {
  const { prefs, update } = usePreferences();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon className="h-6 w-6 text-accent" />
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>

      {/* Client-side preferences */}
      <div className="space-y-6 mb-12">
        <div className="rounded-xl border border-border/50 bg-surface/50 p-6">
          <h2 className="text-lg font-semibold mb-4">Display Preferences</h2>
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              Default result grouping
            </label>
            <div className="space-y-2">
              {GROUP_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                    prefs.defaultGroupBy === opt.value
                      ? "border-accent/50 bg-accent/5"
                      : "border-border/30 hover:border-border/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="defaultGroupBy"
                    value={opt.value}
                    checked={prefs.defaultGroupBy === opt.value}
                    onChange={() => update({ defaultGroupBy: opt.value })}
                    className="accent-accent"
                  />
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted">{opt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <label className="text-sm font-medium text-foreground block mb-2">
              Default sorting
            </label>
            <div className="space-y-2">
              {SORT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                    prefs.defaultSortBy === opt.value
                      ? "border-accent/50 bg-accent/5"
                      : "border-border/30 hover:border-border/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="defaultSortBy"
                    value={opt.value}
                    checked={prefs.defaultSortBy === opt.value}
                    onChange={() => update({ defaultSortBy: opt.value })}
                    className="accent-accent"
                  />
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted">{opt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <label className="text-sm font-medium text-foreground block mb-2">
              Status group order
            </label>
            <p className="text-xs text-muted mb-2">When grouped by status, which groups appear first.</p>
            <div className="space-y-2">
              {STATUS_ORDER_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                    prefs.defaultStatusOrder === opt.value
                      ? "border-accent/50 bg-accent/5"
                      : "border-border/30 hover:border-border/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="defaultStatusOrder"
                    value={opt.value}
                    checked={prefs.defaultStatusOrder === opt.value}
                    onChange={() => update({ defaultStatusOrder: opt.value })}
                    className="accent-accent"
                  />
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted">{opt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Server-side config docs */}
      <p className="text-muted text-sm mb-6">
        Server configuration is managed via environment variables.
      </p>

      <div className="space-y-6">
        <ConfigSection title="Authentication" items={authConfig} />

        {/* API Keys — rich display */}
        <div className="rounded-xl border border-border/50 bg-surface/50 p-6">
          <h2 className="text-lg font-semibold mb-4">API Keys (optional)</h2>
          <p className="text-sm text-muted mb-4">
            Handlers that require API keys will be skipped if the key is not set. All keys below have free tiers.
          </p>
          <div className="space-y-4">
            {apiKeysData.map((item) => (
              <div key={item.envVar} className="rounded-lg border border-border/30 p-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  <code className="text-xs text-accent bg-background/50 px-1.5 py-0.5 rounded">{item.envVar}</code>
                  <span className="text-xs text-muted sm:ml-auto">{item.freeLimit}</span>
                </div>
                <p className="text-xs text-muted mt-1">{item.description}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <a
                    href={item.signupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline"
                  >
                    Get free API key
                  </a>
                  <span className="text-[10px] text-muted/50">Limits as of {item.infoDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <ConfigSection title="Scheduled Scans" items={schedulerConfig} />

        {/* Notifications */}
        <div className="rounded-xl border border-border/50 bg-surface/50 p-6">
          <h2 className="text-lg font-semibold mb-4">Notifications</h2>
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <span className="text-sm font-medium text-foreground min-w-[10rem]">Method</span>
              <code className="text-sm text-accent bg-background/50 px-2 py-1 rounded">NOTIFY_METHOD</code>
              <span className="text-sm text-muted ml-auto hidden sm:block">telegram, email, or both (default: both)</span>
            </div>
          </div>
          <h3 className="text-sm font-semibold text-muted mb-2 mt-4">Telegram</h3>
          <div className="space-y-2 mb-4">
            {telegramConfig.map((item) => (
              <div key={item.envVar} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-sm font-medium text-foreground min-w-[10rem]">{item.label}</span>
                <code className="text-sm text-accent bg-background/50 px-2 py-1 rounded">{item.envVar}</code>
                <span className="text-sm text-muted ml-auto hidden sm:block">{item.description}</span>
              </div>
            ))}
          </div>
          <h3 className="text-sm font-semibold text-muted mb-2">Email (SMTP)</h3>
          <div className="space-y-2">
            {emailConfig.map((item) => (
              <div key={item.envVar} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-sm font-medium text-foreground min-w-[10rem]">{item.label}</span>
                <code className="text-sm text-accent bg-background/50 px-2 py-1 rounded">{item.envVar}</code>
                <span className="text-sm text-muted ml-auto hidden sm:block">{item.description}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-4 border-t border-border/30 pt-3">
            Notifications are sent when scheduled scans complete or detect issues.
            Set <code className="text-accent">NOTIFY_METHOD</code> to control delivery: <code className="text-accent">telegram</code>, <code className="text-accent">email</code>, or <code className="text-accent">both</code> (default).
          </p>
        </div>
      </div>
    </div>
  );
}
