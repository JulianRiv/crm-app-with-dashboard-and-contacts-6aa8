import { useEffect, useRef } from 'react'

export default function Drawer({ title, subtitle, onClose, children, actions }) {
  const ref = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay right" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="drawer-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" aria-label="Close panel" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="ico">
              <path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5Z" />
            </svg>
          </button>
        </div>
        {actions && <div className="drawer-actions">{actions}</div>}
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  )
}
