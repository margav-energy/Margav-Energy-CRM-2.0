import React, { useState, useEffect, useCallback } from "react";
import { QualifierLeadsTable } from "./QualifierLeadsTable";
import type { QualifierLead } from "./QualifierKanban";
import { RefreshCw } from "lucide-react";
import { getLeads, syncGoogleSheetsLeads } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

const POLL_MS = 10_000;
const SOURCES = "Rattle,Leadwise";

export function SpecialQualifierSheetsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<QualifierLead[]>([]);
  /** Full skeleton only on first load — background polls stay silent to avoid flicker */
  const [initialLoading, setInitialLoading] = useState(true);
  const [backgroundSyncing, setBackgroundSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const fetchLeadsOnly = useCallback(async () => {
    if (!user?.id) return;
    const res = await getLeads({
      pageSize: 500,
      sources: SOURCES,
    });
    const items = (res.items as QualifierLead[]) ?? [];
    setLeads(items);
  }, [user?.id]);

  const runSyncAndLoad = useCallback(
    async (mode: "initial" | "background" | "manual") => {
      if (!user?.id) return;
      const quiet = mode !== "initial";
      if (quiet) setBackgroundSyncing(true);
      else setInitialLoading(true);
      setSyncError(null);
      try {
        if (user.specialSheetQualifier) {
          try {
            await syncGoogleSheetsLeads();
            setLastSyncAt(new Date());
          } catch (e) {
            setSyncError(e instanceof Error ? e.message : "Sync failed");
          }
        }
        await fetchLeadsOnly();
      } finally {
        if (quiet) setBackgroundSyncing(false);
        else setInitialLoading(false);
      }
    },
    [user?.id, user?.specialSheetQualifier, fetchLeadsOnly],
  );

  useEffect(() => {
    if (!user?.id) return;

    if (user.specialSheetQualifier) {
      void runSyncAndLoad("initial");
    } else {
      void (async () => {
        setInitialLoading(true);
        try {
          await fetchLeadsOnly();
        } finally {
          setInitialLoading(false);
        }
      })();
    }

    const id = window.setInterval(() => {
      if (user.specialSheetQualifier) {
        void runSyncAndLoad("background");
      } else {
        void fetchLeadsOnly();
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [user?.id, user?.specialSheetQualifier, runSyncAndLoad, fetchLeadsOnly]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <RefreshCw
              className={`h-4 w-4 shrink-0 ${backgroundSyncing ? "animate-spin text-emerald-600" : ""}`}
              aria-hidden
            />
            <span>
              {user?.specialSheetQualifier
                ? `Google Sheets sync runs every ${POLL_MS / 1000}s (Rattle · Ver2, Leadwise · Leads). `
                : `List refreshes every ${POLL_MS / 1000}s. Sheet import runs from the designated qualifier account. `}
              Newest leads first.
              {user?.specialSheetQualifier && backgroundSyncing ? (
                <span className="text-emerald-700 font-medium"> Updating…</span>
              ) : null}
            </span>
          </p>
          {user?.specialSheetQualifier && lastSyncAt ? (
            <p className="text-xs text-muted-foreground mt-1">
              Last sheet sync: {lastSyncAt.toLocaleTimeString()}
            </p>
          ) : null}
        </div>
      </div>

      {user?.specialSheetQualifier && syncError ? (
        <Alert variant="destructive">
          <AlertTitle>Sheet sync error</AlertTitle>
          <AlertDescription>{syncError}</AlertDescription>
        </Alert>
      ) : null}

      <QualifierLeadsTable
        leads={leads}
        loading={initialLoading}
        onUpdated={() => {
          if (user?.specialSheetQualifier) void runSyncAndLoad("manual");
          else void fetchLeadsOnly();
        }}
        title="Rattle & Leadwise"
        showSource
        showSourceFilter
        statusStyle="pill"
        showAgent={false}
      />
    </div>
  );
}
