import { useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard } from 'lucide-react'
import { api } from './api'
import { changeAdminStep } from './adminSignupFlow'
import { Brand, ErrorBox, Spinner } from './UI'

export default function Login({ onLogin, onBack }) {
  const [step, setStep] = useState('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    const body = Object.fromEntries(new FormData(event.currentTarget))
    try { onLogin(await api(`/auth/${step}`, { method: 'POST', body })) }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return <main className="auth-page">
    <section className="auth-hero"><h1>Less searching.<br/>More <em>knowing.</em></h1></section>
    <section className="auth-panel">
      <div className="auth-wrap">
        <button className="back-button" onClick={onBack}><ArrowLeft size={17}/> Back to chatbot</button>
        <Brand/>
        <div className="auth-title"><h2>{step === 'login' ? 'Admin login' : step === 'payment' ? 'Admin plan' : 'Create admin account'}</h2></div>
        <ErrorBox>{error}</ErrorBox>
        {step === 'payment' ? <div className="payment-step">
          <div className="payment-card"><span className="payment-icon"><CreditCard size={22}/></span><div><strong>$10</strong><span>One-time admin access</span></div></div>
          <p className="payment-note">Admin account activation</p>
          <button className="button primary full" onClick={() => { setStep(changeAdminStep(step, 'payment-success')); setError('') }}>Pay $10 <ArrowRight size={17}/></button>
          <button className="payment-back" onClick={() => setStep(changeAdminStep(step, 'back'))}>Back to login</button>
        </div> : <>
          {step === 'signup' && <div className="payment-success"><CheckCircle2 size={18}/> Payment successful</div>}
          <form className="auth-form" onSubmit={submit}>
            {step === 'signup' && <><label>Your name<input name="name" required autoComplete="name" placeholder="Your name" maxLength="80"/></label><label>Company name<input name="companyName" required placeholder="Company name" maxLength="100"/></label></>}
            <label>Email<input name="email" type="email" required autoComplete="email" placeholder="you@company.com" maxLength="254"/></label>
            <label>Password<input name="password" type="password" required minLength={step === 'signup' ? 10 : 1} maxLength="72" autoComplete={step === 'signup' ? 'new-password' : 'current-password'} placeholder={step === 'signup' ? 'At least 10 characters' : 'Your password'}/></label>
            <button className="button primary full" disabled={busy}>{busy ? <Spinner/> : <>{step === 'login' ? 'Sign in' : 'Create account'}<ArrowRight size={17}/></>}</button>
          </form>
          <p className="auth-switch">{step === 'login' ? 'New admin?' : 'Already have an account?'} <button onClick={() => { setStep(changeAdminStep(step, step === 'login' ? 'create-account' : 'back')); setError('') }}>{step === 'login' ? 'Create admin account — $10' : 'Sign in'}</button></p>
        </>}
      </div>
    </section>
  </main>
}
