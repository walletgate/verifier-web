import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';

import { buildChecks, clampAge } from './lib/demo';

type Status = 'idle' | 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired';

interface SessionResponse {
  id: string;
  status: Status;
  verificationUrl?: string;
  createdAt: string;
  expiresAt: string;
  results?: Record<string, boolean>;
  riskScore?: number;
}

const DEFAULT_INPUT = {
  ageEnabled: true,
  ageValue: 18,
  residencyEnabled: true,
  identityEnabled: false,
};

const API_BASE = (() => {
  const env = import.meta.env?.VITE_DEMO_API_BASE as string | undefined;
  if (env) return env.replace(/\/+$/, '');
  return import.meta.env.DEV ? 'http://localhost:4000' : 'https://api.walletgate.app';
})();

function formatTimeLeft(expiresAt?: string): string {
  if (!expiresAt) return '--:--';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return '00:00';
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatCheckName(key: string): string {
  if (key.startsWith('age_over_')) return `Age ${key.replace('age_over_', '')}+`;
  if (key === 'residency_eu') return 'EU Residency';
  if (key === 'identity_verified') return 'Identity';
  return key;
}

export default function App(): JSX.Element {
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState('--:--');
  const [startTime, setStartTime] = useState<number | null>(null);
  const scanRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const checks = useMemo(() => buildChecks(input), [input]);

  const activeStep = session
    ? status === 'completed' || status === 'failed' ? 3 : 2
    : 1;

  const elapsedSeconds = startTime && (status === 'completed' || status === 'failed')
    ? Math.round((Date.now() - startTime) / 1000)
    : null;

  // Timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (session?.expiresAt && (status === 'pending' || status === 'in_progress')) {
      timer = setInterval(() => setTimeLeft(formatTimeLeft(session.expiresAt)), 1000);
    } else if (session?.expiresAt) {
      setTimeLeft(formatTimeLeft(session.expiresAt));
    }
    return () => { if (timer) clearInterval(timer); };
  }, [session?.expiresAt, status]);

  // QR generation
  useEffect(() => {
    if (!session?.verificationUrl) return;
    void QRCode.toDataURL(session.verificationUrl, {
      margin: 1,
      width: 320,
      color: { dark: '#0f172a', light: '#ffffff' },
    }).then(setQrDataUrl);
  }, [session?.verificationUrl]);

  // Polling
  useEffect(() => {
    if (!session?.id || (status !== 'pending' && status !== 'in_progress')) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/demo/sessions/${session.id}`);
        if (!res.ok) return;
        const payload = await res.json();
        const data = payload?.data as SessionResponse | undefined;
        if (!data) return;
        setSession(data);
        setStatus(data.status);
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [session?.id, status]);

  // Auto-scroll on step change
  useEffect(() => {
    if (activeStep === 2 && scanRef.current) {
      scanRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (activeStep === 3 && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeStep]);

  const startDemo = async () => {
    setError(null);
    if (checks.length === 0) {
      setError('Select at least one check to continue.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/demo/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checks }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || payload?.message || 'Unable to start demo session');
      const data = payload?.data as SessionResponse;
      setSession(data);
      setStatus(data.status || 'pending');
      setStartTime(Date.now());
    } catch (err: any) {
      setError(err?.message || 'Unable to start demo session');
    } finally {
      setLoading(false);
    }
  };

  const simulate = async (outcome: 'pass_all' | 'fail_all') => {
    if (!session?.id) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/demo/sessions/${session.id}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Simulation failed');
      const data = payload?.data as SessionResponse;
      setSession(data);
      setStatus(data.status);
    } catch (err: any) {
      setError(err?.message || 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const resetDemo = () => {
    setSession(null);
    setStatus('idle');
    setQrDataUrl('');
    setError(null);
    setStartTime(null);
    setInput(DEFAULT_INPUT);
  };

  const allPassed = session?.results ? Object.values(session.results).every(Boolean) : false;

  return (
    <div className="page">
      <div className="container">
        {/* Nav */}
        <nav className="nav">
          <a className="nav-brand" href="https://walletgate.app">
            <div className="nav-mark">W</div>
            WalletGate
          </a>
          <div className="nav-links">
            <a className="nav-link" href="https://docs.walletgate.app">Docs</a>
            <a className="nav-link" href="https://walletgate.app#pricing">Pricing</a>
            <a className="nav-link nav-link--primary" href="https://walletgate.app">Get API Key</a>
          </div>
        </nav>

        {/* Hero */}
        <section className="hero">
          <div className="hero-badge">Try the API</div>
          <h1>
            Verify anyone in Europe <span>in seconds</span>
          </h1>
          <p className="hero-sub">
            Pick your checks, hit the API, get a result. This is the same
            integration your users will see in production.
          </p>
        </section>

        <div className="main-content">
        {/* Stepper */}
        <div className="stepper">
          <div className={`stepper-step ${activeStep === 1 ? 'active' : activeStep > 1 ? 'done' : ''}`}>
            <div className="stepper-num">{activeStep > 1 ? '\u2713' : '1'}</div>
            <span>Configure</span>
          </div>
          <div className={`stepper-line ${activeStep > 1 ? 'done' : ''}`} />
          <div className={`stepper-step ${activeStep === 2 ? 'active' : activeStep > 2 ? 'done' : ''}`}>
            <div className="stepper-num">{activeStep > 2 ? '\u2713' : '2'}</div>
            <span>Verify</span>
          </div>
          <div className={`stepper-line ${activeStep > 2 ? 'done' : ''}`} />
          <div className={`stepper-step ${activeStep === 3 ? 'active' : ''}`}>
            <div className="stepper-num">3</div>
            <span>Results</span>
          </div>
        </div>

        {/* Step 1: Configure */}
        {activeStep === 1 && (
          <div className="card configure">
            <h2>Choose verification checks</h2>
            <p className="configure-sub">These map directly to our SDK and REST API parameters.</p>
            <div className="check-list">
              <div className="check-item">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={input.ageEnabled}
                    onChange={(e) => setInput({ ...input, ageEnabled: e.target.checked })}
                  />
                  Age verification
                </label>
                <input
                  className="age-input"
                  type="number"
                  min={13}
                  max={99}
                  value={input.ageValue}
                  onChange={(e) => setInput({ ...input, ageValue: clampAge(Number(e.target.value)) })}
                  disabled={!input.ageEnabled}
                />
              </div>
              <div className="check-item">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={input.residencyEnabled}
                    onChange={(e) => setInput({ ...input, residencyEnabled: e.target.checked })}
                  />
                  EU Residency
                </label>
                <span className="check-tag">eIDAS credential</span>
              </div>
              <div className="check-item">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={input.identityEnabled}
                    onChange={(e) => setInput({ ...input, identityEnabled: e.target.checked })}
                  />
                  Identity verified
                </label>
                <span className="check-tag">KYC proof</span>
              </div>
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button className="btn btn-start" onClick={startDemo} disabled={loading}>
              {loading ? 'Creating session...' : 'Start Verification'}
            </button>
          </div>
        )}

        {/* Step 2: Scan + Simulate */}
        {activeStep === 2 && session && (
          <div className="scan-section" ref={scanRef}>
            <div className="card">
              <div className="scan-layout">
                <div className="phone-frame">
                  <div className="phone-notch" />
                  <div className="phone-screen">
                    {qrDataUrl ? (
                      <>
                        <img src={qrDataUrl} alt="Verification QR" />
                        <span className="phone-label">Scan with EUDI Wallet</span>
                      </>
                    ) : (
                      <span className="phone-label">Generating...</span>
                    )}
                  </div>
                  <div className="phone-pulse" />
                </div>
                <div className="scan-info">
                  <div>
                    <h2>Scan to verify</h2>
                    <p>
                      Your user opens the EUDI Wallet and scans this code.
                      For this demo, simulate the response.
                    </p>
                  </div>
                  <div className="scan-meta">
                    <div className="meta-row">
                      <span className="meta-label">Status</span>
                      <span className={`meta-value status-dot ${status}`}>{status}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Expires</span>
                      <span className="meta-value">{timeLeft}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Checks</span>
                      <span className="meta-value">{checks.length}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="simulate-section">
                <div className="simulate-label">Simulate wallet response</div>
                <div className="btn-group">
                  <button
                    className="btn btn-pass"
                    onClick={() => simulate('pass_all')}
                    disabled={loading}
                  >
                    All checks pass
                  </button>
                  <button
                    className="btn btn-fail"
                    onClick={() => simulate('fail_all')}
                    disabled={loading}
                  >
                    All checks fail
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {activeStep === 3 && session && (
          <div className="results-section" ref={resultRef}>
            <div className="card results-card">
              <div className={`result-icon ${allPassed ? 'success' : 'failure'}`}>
                {allPassed ? '\u2713' : '\u2717'}
              </div>
              <div className="result-title">
                {allPassed ? 'Verification Passed' : 'Verification Failed'}
              </div>
              <p className="result-subtitle">
                {allPassed
                  ? 'All identity checks were verified successfully.'
                  : 'One or more identity checks did not pass.'}
              </p>

              <div className="result-stats">
                <div className="stat">
                  <div className="stat-value">{checks.length}</div>
                  <div className="stat-label">Checks run</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{elapsedSeconds != null ? `${elapsedSeconds}s` : '--'}</div>
                  <div className="stat-label">Total time</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{session.riskScore != null ? `${Math.round(session.riskScore * 100)}%` : '--'}</div>
                  <div className="stat-label">Risk score</div>
                </div>
              </div>

              {session.results && (
                <div className="result-checks">
                  {Object.entries(session.results).map(([key, passed]) => (
                    <div className="result-check-row" key={key}>
                      <span>{formatCheckName(key)}</span>
                      <span className={passed ? 'check-pass' : 'check-fail'}>
                        {passed ? 'Passed' : 'Failed'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button className="btn btn-outline" onClick={resetDemo}>
                Run again
              </button>
            </div>
          </div>
        )}

        {/* Integration pitch */}
        {activeStep === 3 && (
          <section className="pitch">
            <h3>Add this to your app in minutes</h3>
            <p>Everything you just saw is a single API call. Here's the integration:</p>
            <div className="code-block">
              <span className="cm">// npm install @walletgate/eudi</span>{'\n'}
              <span className="kw">const</span> session = <span className="kw">await</span> walletgate.<span className="fn">verify</span>({'{\n'}
              {'  '}checks: [{'{ '}type: <span className="str">'age_over'</span>, value: <span className="str">18</span>{' }'}],{'\n'}
              {'  '}returnUrl: <span className="str">'https://yourapp.com/done'</span>{'\n'}
              {'}'});
            </div>
            <div className="pitch-cta">
              <a className="btn btn-start" href="https://walletgate.app" style={{ textDecoration: 'none' }}>
                Get free API key
              </a>
              <a className="btn btn-outline" href="https://docs.walletgate.app" style={{ textDecoration: 'none' }}>
                Read the docs
              </a>
            </div>
          </section>
        )}

        </div>{/* end main-content */}

        {/* Footer */}
        <footer className="footer">
          Powered by WalletGate test credentials. No personal data is stored.
          {' '}<a href="mailto:hello@walletgate.app">Book a private walkthrough</a>.
        </footer>
      </div>
    </div>
  );
}
