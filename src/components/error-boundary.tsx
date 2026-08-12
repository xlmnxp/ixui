import { Component } from "react";
import type { ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    console.error("UI error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center" data-testid="error-boundary">
          <h1 className="text-base font-semibold text-danger">Something went wrong</h1>
          <pre className="max-w-xl overflow-auto rounded border border-border bg-surface-800 p-3 text-xs text-text-primary">
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
          <button
            type="button"
            className="rounded border border-border bg-surface-700 px-3 py-1.5 text-xs text-text-primary hover:bg-surface-600"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
