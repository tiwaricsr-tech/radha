import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

class AdminErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif', color: '#441515' }}>
          <h2>Radha Swami Admin Console — Reload Needed</h2>
          <p style={{ marginTop: 8, color: '#7d655d' }}>{String(this.state.error?.message || this.state.error)}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 14,
              padding: '10px 18px',
              background: '#c97a1e',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            Reload Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AdminErrorBoundary>
    <App />
  </AdminErrorBoundary>
);
