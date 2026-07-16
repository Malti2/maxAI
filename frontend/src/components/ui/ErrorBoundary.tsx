import React from 'react';
import { Spark } from './Spark';

interface State {
  hasError: boolean;
}

/* Catches render-time errors anywhere below it and shows a calm fallback
   instead of a blank white screen. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Surface the error for debugging; a real deployment can forward this to a
    // monitoring service.
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        className="min-h-screen flex items-center justify-center p-6 text-center"
        style={{ background: 'var(--bg)' }}
      >
        <div className="max-w-sm">
          <div className="flex justify-center mb-4"><Spark size={40} /></div>
          <h1 className="display text-[24px] mb-2" style={{ color: 'var(--text-1)' }}>
            Something went wrong
          </h1>
          <p className="text-sm mb-5" style={{ color: 'var(--text-2)' }}>
            The app hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
