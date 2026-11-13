import { configured } from "@/api";
import { RequestsBoard } from "@/features/requests";
import { AppLayout } from "./layout";
import { AppProviders } from "./providers";

export function App() {
  if (!configured()) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 bg-background">
        <div className="max-w-md rounded-lg border border-border bg-card p-6 shadow-sm text-center">
          <h1 className="text-xl font-semibold text-foreground mb-2">Configuration Required</h1>
          <p className="text-sm text-muted-foreground">
            Save <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono font-medium text-foreground">HELPDESK_URL</code> and{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono font-medium text-foreground">HELPDESK_TOKEN</code> in{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono font-medium text-foreground">.env</code>, then restart{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono font-medium text-foreground">npm run dev</code>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <AppProviders>
      <AppLayout>
        <RequestsBoard />
      </AppLayout>
    </AppProviders>
  );
}

export default App;
