import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { api } from "@repo/convex";
import { useSettings, useUpdateSetting } from "@/hooks/use-settings";
import { useAuthToken } from "@/lib/auth";
import { useTheme } from "@/hooks/use-theme";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Key,
  MessageCircle,
  Mail,
  Bell,
  DollarSign,
  Lock,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Check,
  Send,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Settings"
        description="Configure API keys, notifications, and preferences"
      />
      <div className="flex flex-col gap-6 px-4 pb-4 md:px-6">
        <ApiKeysSection />
        <TelegramSection />
        <EmailSection />
        <NotificationTogglesSection />
        <BudgetSection />
        <PasswordSection />
        <ThemeSection />
      </div>
    </div>
  );
}

function SettingField({
  settingKey,
  label,
  placeholder,
  type = "text",
}: {
  settingKey: string;
  label: string;
  placeholder: string;
  type?: string;
}) {
  const currentValue = useSettings(settingKey);
  const updateSetting = useUpdateSetting();
  const [value, setValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showValue, setShowValue] = useState(false);

  const isSecret = type === "password";
  const displayValue = value ?? currentValue ?? "";
  const hasChanged = value !== null && value !== (currentValue ?? "");

  async function handleSave() {
    if (!hasChanged) return;
    setSaving(true);
    try {
      await updateSetting({ key: settingKey, value: value! });
      setValue(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (currentValue === undefined) {
    return (
      <div className="flex flex-col gap-2">
        <Label>{label}</Label>
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={isSecret && !showValue ? "password" : "text"}
            placeholder={placeholder}
            value={displayValue}
            onChange={(e) => setValue(e.target.value)}
            className={isSecret ? "pr-9" : ""}
          />
          {isSecret && (
            <button
              type="button"
              onClick={() => setShowValue(!showValue)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showValue ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!hasChanged || saving}
          className="shrink-0"
        >
          {saved ? <Check className="size-4" /> : saving ? "..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

function ToggleField({
  settingKey,
  label,
  description,
}: {
  settingKey: string;
  label: string;
  description: string;
}) {
  const currentValue = useSettings(settingKey);
  const updateSetting = useUpdateSetting();
  const [saving, setSaving] = useState(false);

  const isEnabled = currentValue === "true";

  async function handleToggle() {
    setSaving(true);
    try {
      await updateSetting({ key: settingKey, value: isEnabled ? "false" : "true" });
    } finally {
      setSaving(false);
    }
  }

  if (currentValue === undefined) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">{description}</span>
        </div>
        <Skeleton className="h-6 w-11" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isEnabled}
        disabled={saving}
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors disabled:opacity-50 ${
          isEnabled ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`pointer-events-none block size-5 rounded-full bg-background shadow-sm ring-0 transition-transform ${
            isEnabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function ApiKeysSection() {
  return (
    <Card className="py-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Key className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">API Keys</CardTitle>
        </div>
        <CardDescription>
          Configure your AI provider API keys
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <SettingField
            settingKey="openai_api_key"
            label="OpenAI API Key"
            placeholder="sk-..."
            type="password"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function TelegramSection() {
  return (
    <Card className="py-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Telegram</CardTitle>
        </div>
        <CardDescription>
          Get notified via Telegram when research completes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <SettingField
            settingKey="telegram_bot_token"
            label="Bot Token"
            placeholder="123456789:ABC..."
            type="password"
          />
          <SettingField
            settingKey="telegram_chat_id"
            label="Chat ID"
            placeholder="Your chat ID"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function EmailSection() {
  const token = useAuthToken();
  const sendTestEmail = useAction(api.notifications.sendTestEmail);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function handleTestEmail() {
    if (!token) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await sendTestEmail({ token });
      if (result.sent) {
        setTestResult({ type: "success", message: "Test email sent! Check your inbox." });
      } else {
        setTestResult({
          type: "error",
          message: result.reason === "not_configured"
            ? "Email not configured. Please set your Resend API key and notification email above."
            : `Failed to send: ${result.reason}`,
        });
      }
    } catch (err) {
      setTestResult({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to send test email",
      });
    } finally {
      setTesting(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  }

  return (
    <Card className="py-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Email</CardTitle>
        </div>
        <CardDescription>
          Get notified via email when research completes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <SettingField
            settingKey="resend_api_key"
            label="Resend API Key"
            placeholder="re_..."
            type="password"
          />
          <SettingField
            settingKey="notification_email"
            label="Notification Email"
            placeholder="you@example.com"
          />
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestEmail}
              disabled={testing || !token}
              className="self-start"
            >
              <Send className="mr-2 size-4" />
              {testing ? "Sending..." : "Send Test Email"}
            </Button>
            {testResult && (
              <p
                className={`text-sm ${
                  testResult.type === "success"
                    ? "text-green-600 dark:text-green-400"
                    : "text-destructive"
                }`}
              >
                {testResult.message}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationTogglesSection() {
  return (
    <Card className="py-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Notification Channels</CardTitle>
        </div>
        <CardDescription>
          Choose which notification channels are active
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <ToggleField
            settingKey="notification_telegram_enabled"
            label="Telegram"
            description="Send notifications via Telegram bot"
          />
          <ToggleField
            settingKey="notification_email_enabled"
            label="Email"
            description="Send notifications via email"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function BudgetSection() {
  return (
    <Card className="py-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <DollarSign className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Budget</CardTitle>
        </div>
        <CardDescription>
          Set a monthly spending threshold for budget alerts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SettingField
          settingKey="budget_threshold"
          label="Monthly Budget (USD)"
          placeholder="30.00"
        />
      </CardContent>
    </Card>
  );
}

function PasswordSection() {
  const changePassword = useAction(api.auth.changePassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="py-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Password</CardTitle>
        </div>
        <CardDescription>Change your login password</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
            />
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && (
            <p className="text-sm text-green-600 dark:text-green-400">
              Password changed successfully
            </p>
          )}
          <Button type="submit" disabled={!canSubmit} className="self-start">
            {saving ? "Changing..." : "Change Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ThemeSection() {
  const { theme, setTheme, isLoading } = useTheme();

  return (
    <Card className="py-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sun className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Theme</CardTitle>
        </div>
        <CardDescription>
          Choose your preferred appearance. &quot;System&quot; follows your device settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: "light" as const, label: "Light", icon: Sun },
              { value: "dark" as const, label: "Dark", icon: Moon },
              { value: "system" as const, label: "System", icon: Sun },
            ]
          ).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              disabled={isLoading}
              onClick={() => setTheme(value)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                theme === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
