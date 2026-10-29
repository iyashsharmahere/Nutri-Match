import { Component } from 'react';

/** Last line of defence: a bug in one view shows a recovery screen, not a blank page. */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error, info) {
    // Hook for a real error tracker (Sentry etc.) in production.
    console.error('NutriMatch view crashed:', error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-lg px-5 py-20 text-center">
        <h1 className="text-3xl">Something went wrong on this page</h1>
        <p className="mt-3 text-soft">Your saved plan is safe. Go back to the start and try again.</p>
        <button className="btn-primary mt-6" onClick={() => { this.setState({ failed: false }); this.props.onReset?.(); }}>Back to home</button>
      </div>
    );
  }
}
