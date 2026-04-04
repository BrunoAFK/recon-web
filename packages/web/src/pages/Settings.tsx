import { Settings as SettingsIcon } from "lucide-react";

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

const notificationConfig: ConfigItem[] = [
  { label: "Telegram Bot Token", envVar: "TELEGRAM_BOT_TOKEN", description: "Telegram Bot API token" },
  { label: "Telegram Chat ID", envVar: "TELEGRAM_CHAT_ID", description: "Telegram chat to receive notifications" },
  { label: "SMTP Host", envVar: "SMTP_HOST", description: "SMTP server host for email notifications" },
  { label: "Notify Email", envVar: "NOTIFY_EMAIL", description: "Email address to receive notifications" },
];

const authConfig: ConfigItem[] = [
  { label: "Auth Enabled", envVar: "AUTH_ENABLED", description: "Whether API authentication is required" },
  { label: "Auth Token", envVar: "AUTH_TOKEN", description: "Bearer token for API access" },
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
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon className="h-6 w-6 text-accent" />
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>

      <p className="text-muted text-sm mb-8">
        Configuration is managed via environment variables. The sections below show available options.
      </p>

      <div className="space-y-6">
        <ConfigSection title="Authentication" items={authConfig} />
        <ConfigSection title="Scheduled Scans" items={schedulerConfig} />
        <ConfigSection title="Notifications" items={notificationConfig} />
      </div>
    </div>
  );
}
