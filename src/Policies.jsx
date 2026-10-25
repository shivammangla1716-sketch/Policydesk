import { useCallback, useEffect, useState } from 'react'
import { BookOpen, FileText, Plus, RefreshCw, Trash2, Upload } from 'lucide-react'
import { api } from './api'
import { Badge, ErrorBox, Modal, Spinner } from './UI'
import { dateLabel } from './format'

const categories = ['People', 'Workplace', 'Benefits', 'Security', 'General']

function PolicyDetails({ policyId, onClose }) {
  const [policy, setPolicy] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api(`/policies/${policyId}`).then(data => setPolicy(data.policy)).catch(err => setError(err.message)) }, [policyId])
  return <Modal title="Policy details" onClose={onClose} wide><ErrorBox>{error}</ErrorBox>{policy ? <div className="policy-details"><div className="policy-details-head"><div><h3>{policy.title}</h3><p>{policy.category} · Updated {dateLabel(policy.updatedAt)}</p></div><Badge status={policy.status}/></div><div className="policy-content">{policy.content || 'This policy is still processing.'}</div></div> : !error && <Spinner/>}</Modal>
}

function PolicyForm({ existing, onClose, onSaved }) {
  const [method, setMethod] = useState('file')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault(); setError('')
    const body = new FormData(event.currentTarget)
    if (method === 'file' && !file) { setError('Choose a PDF, DOCX, or TXT file.'); return }
    if (method === 'file') body.set('file', file)
    setBusy(true)
    try { await api(existing ? `/policies/${existing.id}/replace` : '/policies', { method: 'POST', body }); onSaved(existing ? 'Policy replaced' : 'Policy added') }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return <Modal title={existing ? 'Replace policy' : 'Add policy'} onClose={onClose}>
    <form className="stack-form" onSubmit={submit}>
      <label>Policy title<input name="title" required maxLength="150" defaultValue={existing?.title || ''} placeholder="Leave policy"/></label>
      <label>Category<select name="category" defaultValue={existing?.category || 'General'}>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
      <div className="content-tabs"><button type="button" className={method === 'file' ? 'active' : ''} onClick={() => setMethod('file')}>Upload file</button><button type="button" className={method === 'text' ? 'active' : ''} onClick={() => setMethod('text')}>Paste text</button></div>
      {method === 'file' ? <label className="file-input"><Upload size={22}/><span>{file?.name || 'Choose PDF, DOCX, or TXT'}</span><input type="file" accept=".pdf,.docx,.txt" onChange={event => setFile(event.target.files[0] || null)}/></label> : <label>Policy text<textarea name="content" required minLength="20" rows="9" placeholder="Paste the policy text here"/></label>}
      <ErrorBox>{error}</ErrorBox>
      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy ? <Spinner/> : existing ? 'Replace' : 'Add policy'}</button></div>
    </form>
  </Modal>
}

export default function Policies({ notify }) {
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formPolicy, setFormPolicy] = useState(undefined)
  const [details, setDetails] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => api('/policies').then(data => { setPolicies(data.policies); setError('') }).catch(err => setError(err.message)).finally(() => setLoading(false)), [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!policies.some(policy => ['queued', 'processing'].includes(policy.status))) return
    const timer = setInterval(load, 2500)
    return () => clearInterval(timer)
  }, [policies, load])

  async function remove() {
    setBusy(true)
    try { await api(`/policies/${deleting.id}`, { method: 'DELETE' }); setDeleting(null); await load(); notify('Policy deleted') }
    catch (err) { setError(err.message); setDeleting(null) }
    finally { setBusy(false) }
  }

  async function retry(policy) {
    try { await api(`/policies/${policy.id}/retry`, { method: 'POST' }); await load(); notify('Processing restarted') }
    catch (err) { setError(err.message) }
  }

  return <main className="admin-content">
    <div className="admin-title"><div><h1>Policies</h1><p>{policies.length} {policies.length === 1 ? 'policy' : 'policies'}</p></div><button className="button primary" onClick={() => setFormPolicy(null)}><Plus size={17}/> Add policy</button></div>
    <ErrorBox>{error}</ErrorBox>
    {loading ? <div className="center-loading"><Spinner/></div> : policies.length ? <div className="admin-policy-list">{policies.map(policy => <article className="admin-policy-card" key={policy.id}>
      <button className="policy-open" onClick={() => setDetails(policy.id)}><span className="document-icon"><FileText size={21}/></span><span><strong>{policy.title}</strong><small>{policy.category} · {policy.sourceName}</small></span></button>
      <div className="policy-card-meta"><Badge status={policy.status}/><span>Updated {dateLabel(policy.updatedAt)}</span></div>
      <div className="policy-actions">{policy.status === 'failed' ? <button className="icon-button" aria-label={`Retry ${policy.title}`} onClick={() => retry(policy)}><RefreshCw size={17}/></button> : <button className="icon-button" aria-label={`Replace ${policy.title}`} onClick={() => setFormPolicy(policy)}><Upload size={17}/></button>}<button className="icon-button danger" aria-label={`Delete ${policy.title}`} onClick={() => setDeleting(policy)}><Trash2 size={17}/></button></div>
    </article>)}</div> : <div className="admin-empty"><BookOpen size={28}/><h2>No policies added</h2></div>}
    {formPolicy !== undefined && <PolicyForm existing={formPolicy} onClose={() => setFormPolicy(undefined)} onSaved={message => { setFormPolicy(undefined); load(); notify(message) }}/>} 
    {details && <PolicyDetails policyId={details} onClose={() => setDetails(null)}/>} 
    {deleting && <Modal title="Delete policy" onClose={() => setDeleting(null)}><p className="confirm-text">Delete “{deleting.title}”?</p><div className="modal-actions"><button className="button secondary" onClick={() => setDeleting(null)}>Cancel</button><button className="button danger-button" disabled={busy} onClick={remove}>{busy ? <Spinner/> : 'Delete'}</button></div></Modal>}
  </main>
}
