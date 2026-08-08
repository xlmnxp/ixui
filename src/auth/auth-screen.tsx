import { Button } from "../components/button";
import { startOidcLogin } from "./login";

export interface AuthScreenProps {
  onRetry?: () => void;
}

export function AuthScreen({ onRetry }: AuthScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 p-4" data-testid="auth-screen">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface-900 p-6 shadow-xl">
        <h1 className="mb-2 text-lg font-semibold text-text-primary">Authentication required</h1>
        <p className="mb-4 text-sm text-text-secondary">
          Sign in to the Incus server. If you have a client certificate installed in your browser, you
          are already authenticated — otherwise use OIDC.
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={startOidcLogin} data-testid="oidc-login">Sign in with OIDC</Button>
          {onRetry && <Button variant="secondary" onClick={onRetry} data-testid="auth-retry">Retry</Button>}
        </div>
      </div>
    </div>
  );
}
