import { useEffect, useRef, useState } from 'react'
import { ArrowUp, BookOpen, ExternalLink, LogOut, ShieldCheck } from 'lucide-react'
import { api } from './api'
import { screenForPath, toApiHistory } from './publicChat'
import Login from './Login'
import Policies from './Policies'
import { Brand, ErrorBox, Spinner } from './UI'

function Answer({ text }) {
  return <div className="answer-text">{text.split('\n').filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}</div>
}

function PublicChat({ onAdmin }) {
  const [companies, setCompanies] = useState([])
  const [companyId, setCompanyId] = useState('')
  const [company, setCompany] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    api('/public/companies').then(data => {
      setCompanies(data.companies)
      setCompanyId(data.companies[0]?.id || '')
    }).catch(err => setError(err.message)).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!companyId) return
    api(`/public/companies/${companyId}`).then(data => setCompany(data.company)).catch(err => setError(err.message))
  }, [companyId])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, pending])

  async function ask(event) {
    event.preventDefault()
    const question = input.trim()
    if (!question || !companyId || pending) return
    const history = toApiHistory(messages)
    setMessages(current => [...current, { role: 'user', text: question }])
    setInput(''); setPending(true); setError('')
    try {
      const data = await api('/public/ask', { method: 'POST', body: { companyId, question, history } })
      setMessages(current => [...current, data.message])
    } catch (err) { setError(err.message) }
    finally { setPending(false) }
  }

  function selectCompany(id) {
    setCompanyId(id)
    setCompany(null)
    setMessages([])
    setInput('')
    setError('')
  }

  return <div className="public-page">
    <header className="site-header"><Brand/><button className="button secondary" onClick={onAdmin}><ShieldCheck size={17}/> Admin login</button></header>
    <main className="public-layout">
      <aside className="policy-panel">
        <h1>Company policies</h1>
        {loading ? <Spinner/> : companies.length ? <>
          <label className="field-label">Company<select value={companyId} onChange={event => selectCompany(event.target.value)}>{companies.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <div className="policy-name-list"><span>Available policies</span>{company?.policies?.length ? <ul>{company.policies.map(policy => <li key={policy.id}><BookOpen size={16}/>{policy.title}</li>)}</ul> : <p>No policies available.</p>}</div>
        </> : <p className="plain-empty">No companies have published policies yet.</p>}
      </aside>
      <section className="chat-panel">
        <div className="chat-heading"><div><span>Policy chatbot</span><h2>{company?.name || 'Ask about company policies'}</h2></div></div>
        <div className="message-list">
          {!messages.length && !pending && <div className="chat-empty"><BookOpen size={28}/><p>Ask a question about the policies listed here.</p></div>}
          {messages.map((message, index) => <article key={index} className={`chat-message ${message.role}`}>
            <div className="message-label">{message.role === 'user' ? 'You' : 'PolicyDesk'}</div>
            <Answer text={message.text}/>
            {!!message.sources?.length && <div className="message-sources">{message.sources.map((source, sourceIndex) => <span key={`${source.policyId}-${sourceIndex}`}><BookOpen size={13}/>{source.title}</span>)}</div>}
          </article>)}
          {pending && <div className="chat-message assistant"><Spinner label="Checking policies…"/></div>}
          <div ref={endRef}/>
        </div>
        <ErrorBox>{error}</ErrorBox>
        <form className="chat-form" onSubmit={ask}>
          <textarea aria-label="Ask a policy question" placeholder="Type your question…" rows="1" maxLength="2000" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit() } }} disabled={!companyId || pending}/>
          <button aria-label="Send question" disabled={!input.trim() || !companyId || pending}><ArrowUp size={20}/></button>
        </form>
      </section>
    </main>
  </div>
}

function AdminDashboard({ session, onLogout, onPublic }) {
  const [toast, setToast] = useState('')
  function notify(message) { setToast(message); setTimeout(() => setToast(''), 3000) }
  return <div className="admin-page">
    <header className="admin-header"><Brand/><div className="admin-company"><span>Admin</span><strong>{session.company.name}</strong></div><div className="header-actions"><button className="button secondary" onClick={onPublic}><ExternalLink size={16}/> Public chatbot</button><button className="icon-button" aria-label="Sign out" title="Sign out" onClick={onLogout}><LogOut size={19}/></button></div></header>
    <Policies notify={notify}/>
    {toast && <div className="toast">{toast}</div>}
  </div>
}

export default function App() {
  const [session, setSession] = useState(null)
  const [booting, setBooting] = useState(true)
  const [screen, setScreen] = useState(screenForPath(window.location.pathname))

  useEffect(() => {
    api('/auth/me').catch(() => null).then(auth => { setSession(auth); setBooting(false) })
  }, [])

  useEffect(() => {
    const handleBack = () => setScreen(screenForPath(window.location.pathname))
    window.addEventListener('popstate', handleBack)
    return () => window.removeEventListener('popstate', handleBack)
  }, [])

  function navigate(next) {
    window.history.pushState({}, '', next === 'admin' ? '/admin' : '/')
    setScreen(next)
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' })
    setSession(null)
    navigate('public')
  }

  if (booting) return <div className="boot-screen"><Brand/><Spinner/></div>
  if (session && screen === 'admin') return <AdminDashboard session={session} onLogout={logout} onPublic={() => navigate('public')}/>
  if (screen === 'admin') return <Login onLogin={setSession} onBack={() => navigate('public')}/>
  return <PublicChat onAdmin={() => navigate('admin')}/>
}
