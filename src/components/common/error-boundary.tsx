'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RiRefreshLine } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.logErrorToService(error, errorInfo);
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo) {
    console.error('Error details:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex min-h-dvh items-center justify-center bg-background-full p-4 text-text-primary">
            <div role="alert" className="flex w-full max-w-md flex-col items-start gap-4 rounded-md border border-separator-border bg-background-primary-default p-6">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-title-3-medium text-text-primary">Something went wrong</h2>
                <p className="text-body-2-regular text-text-secondary">
                  This screen stopped working. Reloading usually fixes it; your saved missions are not affected.
                </p>
              </div>
              {this.state.error?.message && (
                <p className="w-full break-words rounded-sm bg-background-secondary-default px-3 py-2 font-mono text-caption-1-regular text-text-secondary">
                  {this.state.error.message}
                </p>
              )}
              <Button variant="secondary" size="small" leadingIcon={RiRefreshLine} onClick={() => window.location.reload()}>
                Reload
              </Button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
