import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: 'var(--tg-viewport-stable-height, 100dvh)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            backgroundColor: '#111',
            color: '#fff',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</p>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>
            Something went wrong loading the app.
          </p>
          <p style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '1.5rem' }}>
            Please refresh or reopen from Telegram.
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
