import { useEffect, useRef } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useSettings, useUpdateSetting } from "@/hooks/use-settings";
import { AppShell } from "@/components/app-shell";
import { AppLoadingPage } from "@/components/app-loading-page";

/** Keeps the `app_url` setting in sync with the current origin (used for email links). */
function useSyncAppUrl() {
  const currentValue = useSettings("app_url");
  const updateSetting = useUpdateSetting();
  const synced = useRef(false);

  useEffect(() => {
    if (synced.current || currentValue === undefined) return;
    const origin = window.location.origin;
    if (currentValue !== origin) {
      synced.current = true;
      updateSetting({ key: "app_url", value: origin }).catch(() => {});
    } else {
      synced.current = true;
    }
  }, [currentValue, updateSetting]);
}

export function AuthGuard() {
  const { isAuthenticated, isLoading } = useAuth();
  useSyncAppUrl();

  if (isLoading) {
    return <AppLoadingPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return <AppShell />;
}
