import React, { Component, ErrorInfo, ReactNode } from 'react';

interface SafeBoundaryProps {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface SafeBoundaryState {
  hasError: boolean;
}

export class SafeBoundary extends Component<SafeBoundaryProps, SafeBoundaryState> {
  public state: SafeBoundaryState = { hasError: false };
  
  // Explicitly declare props to satisfy TypeScript if it fails to infer from Component
  declare props: Readonly<SafeBoundaryProps>;

  static getDerivedStateFromError(_error: Error): SafeBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("SafeBoundary caught an error:", error, errorInfo);
  }

  render(): ReactNode {
    const { hasError } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      return fallback ?? (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md border border-red-200 shadow-sm my-4">
          <p className="font-semibold">Algo salió mal en esta sección.</p>
          <p className="text-sm mt-1">Intenta recargar la página o volver al paso anterior.</p>
        </div>
      );
    }

    return children;
  }
}
