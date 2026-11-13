import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { formatSyncTime, LiveSyncStatusView } from "./live-sync-status";
import type { LiveUpdatesState } from "../hooks/use-live-updates";

function renderWithProviders(element: React.ReactElement): string {
  return renderToStaticMarkup(
    React.createElement(TooltipProvider, null, element),
  );
}

describe("LiveSyncStatus UI & Accessibility", () => {
  it("formats sync time into HH:mm:ss without exploding", () => {
    const fixedDate = new Date("2026-10-15T14:30:45Z");
    const formatted = formatSyncTime(fixedDate);
    expect(formatted).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it("renders active syncing state with aria-live and role='status'", () => {
    const mockState: LiveUpdatesState = {
      isSyncing: true,
      isError: false,
      error: null,
      lastSyncedAt: new Date("2026-10-15T10:00:00Z"),
      processedCount: 0,
      refetch: async () => {},
    };

    const html = renderWithProviders(
      React.createElement(LiveSyncStatusView, { state: mockState }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Syncing…");
    expect(html).toContain("animate-spin");
  });

  it("renders error state without claiming success or up-to-date, while preserving last synced time", () => {
    const mockState: LiveUpdatesState = {
      isSyncing: false,
      isError: true,
      error: new Error("Network disconnection"),
      lastSyncedAt: new Date("2026-10-15T10:00:00Z"),
      processedCount: 0,
      refetch: async () => {},
    };

    const html = renderWithProviders(
      React.createElement(LiveSyncStatusView, { state: mockState }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Sync error");

    // Critical: must not claim "Live" or successful status when active error exists
    expect(html).not.toContain("<span>Live</span>");

    // Must preserve previous successful sync time
    const expectedTime = formatSyncTime(mockState.lastSyncedAt!);
    expect(html).toContain(`Last: ${expectedTime}`);
  });

  it("renders live connected state with last synced time when successful", () => {
    const mockDate = new Date("2026-10-15T12:00:00Z");
    const mockState: LiveUpdatesState = {
      isSyncing: false,
      isError: false,
      error: null,
      lastSyncedAt: mockDate,
      processedCount: 3,
      refetch: async () => {},
    };

    const html = renderWithProviders(
      React.createElement(LiveSyncStatusView, { state: mockState }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Live");
    expect(html).toContain(formatSyncTime(mockDate));
  });
});
