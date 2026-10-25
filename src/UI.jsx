import { useEffect, useEffectEvent, useId, useRef } from 'react'
import { BookOpen, LoaderCircle, X } from 'lucide-react'

export function Brand() {
  return <div className="brand"><span className="brand-mark"><BookOpen size={21}/></span><span>PolicyDesk</span></div>
}

export function Spinner({ label = 'Loading…' }) {
  return <span className="loading"><LoaderCircle className="spin" size={17}/>{label}</span>
}

export function ErrorBox({ children }) {
  return children ? <div className="error-box" role="alert">{children}</div> : null
}

export function Badge({ status }) {
  return <span className={`badge status-${status}`}>{({ ready: 'Ready', queued: 'Queued', processing: 'Processing', failed: 'Failed' })[status] || status}</span>
}

export function Modal({ title, children, onClose, wide = false }) {
  const id = useId()
  const ref = useRef(null)
  const close = useEffectEvent(onClose)
  useEffect(() => {
    const previous = document.activeElement
    const element = ref.current
    const focusable = () => [...element.querySelectorAll('button, input, select, textarea')].filter(item => !item.disabled)
    focusable()[0]?.focus()
    function handle(event) {
      if (event.key === 'Escape') close()
      if (event.key !== 'Tab') return
      const items = focusable(), first = items[0], last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', handle)
    return () => { document.removeEventListener('keydown', handle); previous?.focus() }
  }, [])
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className={`modal ${wide ? 'wide' : ''}`} ref={ref} role="dialog" aria-modal="true" aria-labelledby={id}><div className="modal-heading"><h2 id={id}>{title}</h2><button className="icon-button" aria-label="Close" onClick={onClose}><X size={20}/></button></div>{children}</section></div>
}
