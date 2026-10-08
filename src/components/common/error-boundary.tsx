'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    // Log to error reporting service
    this.logErrorToService(error, errorInfo);
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo) {
    // Implement your error logging service here
    console.error('Error details:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="max-w-md rounded-lg border border-red/40 bg-bg-panel p-8 text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-red/40 bg-red-bg text-red">
              <TriangleAlert size={20} />
            </div>
            <h2 className="mb-2 font-sans text-lg font-semibold text-text">Something went wrong</h2>
            <p className="mb-5 font-mono text-[12px] text-text-dim">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <Button variant="primary" className="mx-auto font-sans" onClick={() => window.location.reload()}>
              Reload Application
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}