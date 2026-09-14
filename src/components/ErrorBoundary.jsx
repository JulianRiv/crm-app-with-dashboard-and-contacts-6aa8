import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="boundary" role="alert">
        <h1>Something went wrong loading your pipeline</h1>
        <p>
          The saved data in this browser could not be read. Reloading usually fixes it. If it keeps
          happening, clear the stored data and start again from the sample dataset.
        </p>
        <p className="boundary-detail">{String(this.state.error?.message || this.state.error)}</p>
        <div className="boundary-actions">
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              try {
                localStorage.removeItem('pipeline-crm.v2')
              } catch {
                /* ignore */
              }
              window.location.reload()
            }}
          >
            Clear stored data
          </button>
        </div>
      </div>
    )
  }
}
