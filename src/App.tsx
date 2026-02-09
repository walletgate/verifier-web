import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';

import { clampAge, type DemoCheckPayload } from './lib/demo';

/* ─── Syntax Highlighting (zero-dep) ─── */

function highlightCode(code: string): string {
  // Escape HTML first
  let safe = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Strings (double, single, backtick)
  safe = safe.replace(/(["'`])(?:(?!\1|\\).|\\.)*\1/g, '<span class="hl-str">$&</span>');
  // Comments (// and #)
  safe = safe.replace(/(\/\/.*|#.*)/g, '<span class="hl-cm">$&</span>');
  // Keywords
  safe = safe.replace(/\b(import|from|const|let|var|function|async|await|return|if|else|while|for|break|true|false|null|class|new|throw|try|catch|def|print|require|end|do|func|package|main|public|static|void|val|fun|suspend|using|response|headers)\b/g, '<span class="hl-kw">$&</span>');
  // Numbers
  safe = safe.replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-num">$&</span>');
  return safe;
}

/* ─── Code Tab Config ─── */

type CodeLang = 'node' | 'python' | 'curl' | 'ruby' | 'go' | 'java' | 'kotlin';
const CODE_TABS: { id: CodeLang; label: string }[] = [
  { id: 'node', label: 'Node.js' },
  { id: 'python', label: 'Python' },
  { id: 'curl', label: 'cURL' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'go', label: 'Go' },
  { id: 'java', label: 'Java' },
  { id: 'kotlin', label: 'Kotlin' },
];

/* ─── Types ─── */

type Status = 'idle' | 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired';
type View = 'store' | 'checkout' | 'result';
type Category = 'All' | 'Alcohol' | 'Wellness' | 'Events' | 'Gaming' | 'Finance';

interface SessionResponse {
  id: string;
  status: Status;
  verificationUrl?: string;
  createdAt: string;
  expiresAt: string;
  results?: Record<string, boolean>;
  riskScore?: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: Category;
  emoji: string;
  gradient: string;
  merchant: string;
  fulfillment: string;
  badge: string;
  requires: {
    age?: number;
    residency?: boolean;
    identity?: boolean;
  };
}

/* ─── Product Catalogue ─── */

const PRODUCTS: Product[] = [
  {
    id: 'craft-beer',
    name: 'Bavarian Craft Beer Pack',
    description: 'Curated 12-pack of small-batch lagers and seasonal IPAs from Munich breweries.',
    price: 34,
    category: 'Alcohol',
    emoji: '\uD83C\uDF7A',
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    merchant: 'Nordic Bottle Shop',
    fulfillment: 'Ships in 2 business days',
    badge: '18+',
    requires: { age: 18 },
  },
  {
    id: 'bordeaux-wine',
    name: 'Bordeaux Reserve 2019',
    description: 'Award-winning Ch\u00e2teau Margaux blend. Rich tannins, dark fruit, elegant finish.',
    price: 89,
    category: 'Alcohol',
    emoji: '\uD83C\uDF77',
    gradient: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
    merchant: 'Vino Europa',
    fulfillment: 'Ships in 3-5 business days',
    badge: '18+',
    requires: { age: 18 },
  },
  {
    id: 'cbd-gummies',
    name: 'CBD Wellness Gummies',
    description: 'EU-compliant broad-spectrum CBD gummies. Lab-tested, vegan, traceable sourcing.',
    price: 42,
    category: 'Wellness',
    emoji: '\uD83C\uDF3F',
    gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
    merchant: 'Greenfield Apothecary',
    fulfillment: 'Ships in 1-3 business days',
    badge: '18+ \u00b7 EU only',
    requires: { age: 18, residency: true },
  },
  {
    id: 'festival-vip',
    name: 'Summer Festival VIP Pass',
    description: 'Front-row access, backstage lounge, complimentary drinks. Berlin, Aug 15-17.',
    price: 119,
    category: 'Events',
    emoji: '\uD83C\uDFB5',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
    merchant: 'Aurora Live',
    fulfillment: 'E-ticket delivered instantly',
    badge: '18+ \u00b7 ID required',
    requires: { age: 18, identity: true },
  },
  {
    id: 'concert-tickets',
    name: 'Midnight Concert Tickets',
    description: 'Electronic music showcase at Berghain. Two GA tickets, Saturday night.',
    price: 65,
    category: 'Events',
    emoji: '\uD83C\uDFB6',
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
    merchant: 'NightOwl Tickets',
    fulfillment: 'QR tickets via email',
    badge: '18+ \u00b7 ID required',
    requires: { age: 18, identity: true },
  },
  {
    id: 'racing-game',
    name: 'Racing League Deluxe',
    description: 'PEGI 16 open-world racing simulator. All DLC included. Instant Steam key.',
    price: 59,
    category: 'Gaming',
    emoji: '\uD83C\uDFCE\uFE0F',
    gradient: 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)',
    merchant: 'Pixel Harbor',
    fulfillment: 'Instant digital download',
    badge: '16+',
    requires: { age: 16 },
  },
  {
    id: 'tactical-game',
    name: 'Tactical Ops: Europa',
    description: 'PEGI 18 multiplayer tactical shooter. Season pass + exclusive operator skin.',
    price: 69,
    category: 'Gaming',
    emoji: '\uD83C\uDFAE',
    gradient: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
    merchant: 'Pixel Harbor',
    fulfillment: 'Instant digital download',
    badge: '18+',
    requires: { age: 18 },
  },
  {
    id: 'sportsbet-topup',
    name: 'SportsBet Wallet Top-Up',
    description: 'Fund your regulated sportsbook wallet. Full KYC verification required by EU law.',
    price: 75,
    category: 'Finance',
    emoji: '\u26BD',
    gradient: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
    merchant: 'Summit Sportsbook',
    fulfillment: 'Instant wallet credit',
    badge: '18+ \u00b7 EU \u00b7 ID',
    requires: { age: 18, residency: true, identity: true },
  },
];

const CATEGORIES: Category[] = ['All', 'Alcohol', 'Wellness', 'Events', 'Gaming', 'Finance'];

/* ─── API ─── */

const API_BASE = (() => {
  const env = import.meta.env?.VITE_DEMO_API_BASE as string | undefined;
  if (env) return env.replace(/\/+$/, '');
  return import.meta.env.DEV ? 'http://localhost:4000' : 'https://api.walletgate.app';
})();

/* ─── Helpers ─── */

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
  if (key === 'identity_verified') return 'Identity Verified';
  return key;
}

function buildProductChecks(product: Product): DemoCheckPayload[] {
  const checks: DemoCheckPayload[] = [];
  if (product.requires.age) {
    checks.push({ type: 'age_over', value: clampAge(product.requires.age) });
  }
  if (product.requires.residency) {
    checks.push({ type: 'residency_eu' });
  }
  if (product.requires.identity) {
    checks.push({ type: 'identity_verified' });
  }
  return checks;
}

function generateOrderId(): string {
  return `EU-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/* ─── App ─── */

export default function App(): JSX.Element {
  const [view, setView] = useState<View>('store');
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [orderId, setOrderId] = useState(() => generateOrderId());

  // API state
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState('--:--');
  const [startTime, setStartTime] = useState<number | null>(null);

  // Dark mode
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('walletgate_demo_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  // Latency tracking
  const [createLatency, setCreateLatency] = useState<number | null>(null);
  const [simulateLatency, setSimulateLatency] = useState<number | null>(null);

  // Code snippets
  const [codeTab, setCodeTab] = useState<CodeLang>('node');
  const [codeCopied, setCodeCopied] = useState(false);

  // Share
  const [shareCopied, setShareCopied] = useState(false);

  const topRef = useRef<HTMLDivElement>(null);

  // Persist dark mode
  useEffect(() => {
    localStorage.setItem('walletgate_demo_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const filteredProducts = activeCategory === 'All'
    ? PRODUCTS
    : PRODUCTS.filter((p) => p.category === activeCategory);

  const tax = selectedProduct ? Math.round(selectedProduct.price * 0.19 * 100) / 100 : 0;
  const total = selectedProduct ? Math.round((selectedProduct.price + tax) * 100) / 100 : 0;

  const allPassed = session?.results ? Object.values(session.results).every(Boolean) : false;
  const shortSessionId = session?.id ? session.id.slice(0, 8) : '--------';

  const requirements = useMemo(() => {
    if (!selectedProduct) return [];
    const reqs: { icon: string; label: string; short: string }[] = [];
    if (selectedProduct.requires.age) reqs.push({
      icon: '\uD83D\uDDD3\uFE0F',
      label: `You must be ${selectedProduct.requires.age} or older`,
      short: `${selectedProduct.requires.age}+ age check`,
    });
    if (selectedProduct.requires.residency) reqs.push({
      icon: '\uD83C\uDDEA\uD83C\uDDFA',
      label: 'EU residency is required',
      short: 'EU residency',
    });
    if (selectedProduct.requires.identity) reqs.push({
      icon: '\uD83D\uDCF7',
      label: 'Photo ID will be verified',
      short: 'Identity check',
    });
    return reqs;
  }, [selectedProduct]);

  const elapsedSeconds = startTime && (status === 'completed' || status === 'failed')
    ? Math.round((Date.now() - startTime) / 1000)
    : null;

  /* ─── Reset ─── */
  const resetAll = () => {
    setSession(null);
    setStatus('idle');
    setQrDataUrl('');
    setError(null);
    setStartTime(null);
    setTimeLeft('--:--');
    setShowModal(false);
    setCreateLatency(null);
    setSimulateLatency(null);
    setCodeCopied(false);
    setShareCopied(false);
  };

  const goToStore = () => {
    resetAll();
    setSelectedProduct(null);
    setView('store');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToCheckout = (product: Product) => {
    resetAll();
    setSelectedProduct(product);
    setOrderId(generateOrderId());
    setView('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ─── Timer ─── */
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (session?.expiresAt && (status === 'pending' || status === 'in_progress')) {
      timer = setInterval(() => setTimeLeft(formatTimeLeft(session.expiresAt)), 1000);
    } else if (session?.expiresAt) {
      setTimeLeft(formatTimeLeft(session.expiresAt));
    }
    return () => { if (timer) clearInterval(timer); };
  }, [session?.expiresAt, status]);

  /* ─── QR generation ─── */
  useEffect(() => {
    if (!session?.verificationUrl) return;
    void QRCode.toDataURL(session.verificationUrl, {
      margin: 1,
      width: 300,
      color: { dark: '#0b1220', light: '#ffffff' },
    }).then(setQrDataUrl);
  }, [session?.verificationUrl]);

  /* ─── Polling ─── */
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
    }, 10000);
    return () => clearInterval(interval);
  }, [session?.id, status]);

  /* ─── Body scroll lock when modal is open ─── */
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showModal]);

  /* ─── Auto-transition to result ─── */
  useEffect(() => {
    if (status === 'completed' || status === 'failed') {
      const timer = setTimeout(() => {
        setShowModal(false);
        setView('result');
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [status]);

  /* ─── Scroll to top when result view mounts ─── */
  useEffect(() => {
    if (view === 'result') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [view]);

  /* ─── API calls ─── */
  const startVerification = async () => {
    if (!selectedProduct) return;
    setError(null);
    setCreateLatency(null);
    setSimulateLatency(null);
    const checks = buildProductChecks(selectedProduct);
    if (checks.length === 0) {
      setError('No verification checks for this product.');
      return;
    }
    setLoading(true);
    let timeoutId: number | null = null;
    const t0 = performance.now();
    try {
      const controller = new AbortController();
      timeoutId = window.setTimeout(() => controller.abort(), 12000);
      const response = await fetch(`${API_BASE}/api/demo/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checks }),
        signal: controller.signal,
      });
      const payload = await response.json();
      setCreateLatency(Math.round(performance.now() - t0));
      if (!response.ok) {
        if (response.status === 429) {
          const retryHeader = response.headers.get('Retry-After');
          const retrySeconds = Number(retryHeader || payload?.retryAfterSeconds);
          const retryLabel =
            Number.isFinite(retrySeconds) && retrySeconds > 0
              ? `Try again in ${Math.ceil(retrySeconds)}s.`
              : 'Please wait a moment and try again.';
          throw new Error(`Too many requests. ${retryLabel}`);
        }
        throw new Error(payload?.error || payload?.message || 'Unable to start verification');
      }
      const data = payload?.data as SessionResponse;
      setSession(data);
      setStatus(data.status || 'pending');
      setStartTime(Date.now());
      setShowModal(true);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(err?.message || 'Unable to start verification');
      }
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const simulate = async (outcome: 'pass_all' | 'fail_all' | 'mixed') => {
    if (!session?.id) return;
    setLoading(true);
    const t0 = performance.now();
    try {
      const response = await fetch(`${API_BASE}/api/demo/sessions/${session.id}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome }),
      });
      const payload = await response.json();
      setSimulateLatency(Math.round(performance.now() - t0));
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

  /* ─── Code Snippets ─── */
  const codeSnippets = useMemo<Record<CodeLang, string>>(() => {
    const checks = selectedProduct ? buildProductChecks(selectedProduct) : [];
    const checksStr = checks.map((c) => {
      if (c.type === 'age_over') return `{ type: 'age_over', value: ${c.value ?? 18} }`;
      return `{ type: '${c.type}' }`;
    }).join(',\n    ');
    const pyChecks = checks.map((c) => {
      if (c.type === 'age_over') return `{"type": "age_over", "value": ${c.value ?? 18}}`;
      return `{"type": "${c.type}"}`;
    }).join(', ');
    const curlChecks = JSON.stringify(checks);

    return {
      node: `// npm install @walletgate/eudi
const WalletGate = require('@walletgate/eudi');
const client = new WalletGate('YOUR_API_KEY');

const session = await client.verify({
  checks: [
    ${checksStr}
  ],
  returnUrl: 'https://yourshop.eu/done'
});

console.log(session.verificationUrl);`,

      python: `# pip install walletgate
import requests

response = requests.post(
    'https://api.walletgate.app/v1/sessions',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    json={
        'checks': [${pyChecks}],
        'returnUrl': 'https://yourshop.eu/done'
    }
)

print(response.json())`,

      curl: `curl -X POST https://api.walletgate.app/v1/sessions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"checks": ${curlChecks}, "returnUrl": "https://yourshop.eu/done"}'`,

      ruby: `require 'net/http'
require 'json'

uri = URI('https://api.walletgate.app/v1/sessions')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true

request = Net::HTTP::Post.new(uri)
request['Authorization'] = 'Bearer YOUR_API_KEY'
request['Content-Type'] = 'application/json'
request.body = {
  checks: [${pyChecks}],
  returnUrl: 'https://yourshop.eu/done'
}.to_json

response = http.request(request)
puts response.body`,

      go: `package main

import (
  "bytes"
  "encoding/json"
  "fmt"
  "net/http"
)

func main() {
  body, _ := json.Marshal(map[string]interface{}{
    "checks":    ${curlChecks},
    "returnUrl": "https://yourshop.eu/done",
  })

  req, _ := http.NewRequest("POST",
    "https://api.walletgate.app/v1/sessions",
    bytes.NewBuffer(body))
  req.Header.Set("Authorization", "Bearer YOUR_API_KEY")
  req.Header.Set("Content-Type", "application/json")

  resp, _ := http.DefaultClient.Do(req)
  fmt.Println(resp.Status)
}`,

      java: `import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;

HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.walletgate.app/v1/sessions"))
    .header("Authorization", "Bearer YOUR_API_KEY")
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(
        "{\\"checks\\": ${curlChecks.replace(/"/g, '\\\\"')}, \\"returnUrl\\": \\"https://yourshop.eu/done\\"}"
    ))
    .build();

HttpResponse<String> response = client.send(request,
    HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());`,

      kotlin: `import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.net.URI

fun main() {
    val client = HttpClient.newHttpClient()
    val request = HttpRequest.newBuilder()
        .uri(URI.create("https://api.walletgate.app/v1/sessions"))
        .header("Authorization", "Bearer YOUR_API_KEY")
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString("""
            {"checks": ${curlChecks}, "returnUrl": "https://yourshop.eu/done"}
        """.trimIndent()))
        .build()

    val response = client.send(request,
        HttpResponse.BodyHandlers.ofString())
    println(response.body())
}`,
    };
  }, [selectedProduct]);

  const copyCode = useCallback(() => {
    void navigator.clipboard.writeText(codeSnippets[codeTab]).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  }, [codeSnippets, codeTab]);

  const shareResult = useCallback(() => {
    if (!selectedProduct || !session) return;
    const checks = session.results
      ? Object.entries(session.results).map(([k, v]) => `${formatCheckName(k)} ${v ? '\u2713' : '\u2717'}`).join(', ')
      : '';
    const summary = [
      'WalletGate Demo Result',
      `Product: ${selectedProduct.name}`,
      `Checks: ${checks}`,
      createLatency != null ? `API Latency: ${createLatency}ms` : '',
      session.riskScore != null ? `Risk Score: ${Math.round(session.riskScore * 100)}%` : '',
      elapsedSeconds != null ? `Verified in: ${elapsedSeconds}s` : '',
      '',
      'Try it: https://demo.walletgate.app',
    ].filter(Boolean).join('\n');
    void navigator.clipboard.writeText(summary).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  }, [selectedProduct, session, createLatency, elapsedSeconds]);

  const productCheckCount = selectedProduct ? buildProductChecks(selectedProduct).length : 0;

  /* ─── Render ─── */
  return (
    <div className="page" ref={topRef} data-theme={darkMode ? 'dark' : 'light'}>
      {/* Nav */}
      <nav className="nav">
        <div className="nav-inner">
          <button type="button" className="nav-brand" onClick={goToStore}>
            <span className="nav-logo">ES</span>
            EuroStore
          </button>
          <div className="nav-right">
            <span className="nav-powered">
              Powered by <a href="https://walletgate.app" target="_blank" rel="noreferrer">WalletGate</a>
            </span>
            <a className="nav-link" href="https://docs.walletgate.app" target="_blank" rel="noreferrer">Docs</a>
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setDarkMode((d) => !d)}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Store View ─── */}
      {view === 'store' && (
        <main className="main">
          <header className="store-hero">
            <div className="store-hero-content">
              <span className="store-badge">Demo Storefront</span>
              <h1>Age-verified shopping, powered by EUDI Wallet</h1>
              <p>
                Browse real product categories that require age, residency, or identity checks under EU law.
                Pick any item, go through checkout, and experience EUDI wallet verification in action.
              </p>
            </div>
          </header>

          <section className="store-section">
            <div className="category-tabs">
              {CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  className={`category-tab ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="product-grid">
              {filteredProducts.map((product) => (
                <button
                  type="button"
                  className="product-card"
                  key={product.id}
                  onClick={() => goToCheckout(product)}
                >
                  <div className="product-image" style={{ background: product.gradient }}>
                    <span className="product-emoji">{product.emoji}</span>
                    <span className="product-badge">{product.badge}</span>
                  </div>
                  <div className="product-info">
                    <span className="product-category">{product.category}</span>
                    <h3 className="product-name">{product.name}</h3>
                    <p className="product-desc">{product.description}</p>
                    <div className="product-bottom">
                      <span className="product-price">&euro;{product.price}</span>
                      <span className="btn btn-buy">Buy Now</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="how-it-works">
            <h2>How it works</h2>
            <div className="steps-grid">
              <div className="step-card">
                <span className="step-num">1</span>
                <h3>Choose a product</h3>
                <p>Browse age-restricted items across alcohol, events, gaming, and more.</p>
              </div>
              <div className="step-card">
                <span className="step-num">2</span>
                <h3>Checkout &amp; verify</h3>
                <p>At checkout, scan the QR code with your EUDI Wallet to prove eligibility.</p>
              </div>
              <div className="step-card">
                <span className="step-num">3</span>
                <h3>Get your order</h3>
                <p>Verification takes seconds. No personal data is stored by the merchant.</p>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ─── Checkout View ─── */}
      {view === 'checkout' && selectedProduct && (
        <main className="main">
          <div className="checkout-header">
            <button type="button" className="back-link" onClick={goToStore}>
              &larr; Back to store
            </button>
            <h1>Checkout</h1>
          </div>

          <div className="checkout-grid">
            {/* Left: Form */}
            <div className="checkout-form">
              <div className="form-section">
                <h3>Shipping Information</h3>
                <div className="form-row">
                  <div className="form-field">
                    <label>First name</label>
                    <input type="text" defaultValue="Max" readOnly />
                  </div>
                  <div className="form-field">
                    <label>Last name</label>
                    <input type="text" defaultValue="Mustermann" readOnly />
                  </div>
                </div>
                <div className="form-field">
                  <label>Email</label>
                  <input type="email" defaultValue="max@example.eu" readOnly />
                </div>
                <div className="form-field">
                  <label>Address</label>
                  <input type="text" defaultValue="Friedrichstra\u00dfe 123, 10117 Berlin" readOnly />
                </div>
                <p className="form-note">
                  This is a demo. Shipping details are pre-filled and not submitted anywhere.
                </p>
              </div>

              <div className="form-section">
                <h3>Payment Method</h3>
                <div className="payment-options">
                  <label className="payment-option selected">
                    <input type="radio" name="payment" defaultChecked readOnly />
                    <span className="payment-label">
                      <strong>Credit Card</strong>
                      <span>&bull;&bull;&bull;&bull; 4242</span>
                    </span>
                  </label>
                  <label className="payment-option">
                    <input type="radio" name="payment" readOnly />
                    <span className="payment-label">
                      <strong>SEPA Direct Debit</strong>
                      <span>DE89 &bull;&bull;&bull;&bull; 0005</span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="verification-notice">
                <div className="notice-header">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 1L2 6v4c0 4.42 3.4 8.56 8 9.6 4.6-1.04 8-5.18 8-9.6V6l-8-5z" fill="#2563eb" fillOpacity="0.1" stroke="#2563eb" strokeWidth="1.5"/>
                    <path d="M7 10l2 2 4-4" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <strong>Identity check before payment</strong>
                </div>
                <div className="notice-reqs">
                  {requirements.map((req) => (
                    <div className="notice-req" key={req.short}>
                      <span className="notice-req-icon">{req.icon}</span>
                      <span>{req.label}</span>
                    </div>
                  ))}
                </div>
                <p className="notice-explain">You&apos;ll scan a QR code with your EU Digital Identity Wallet. No personal data is stored.</p>
              </div>

              {error && <p className="error-msg">{error}</p>}

              <button
                type="button"
                className="btn btn-verify"
                onClick={startVerification}
                disabled={loading}
              >
                {loading ? (
                  <span className="btn-loading">Creating session&hellip;</span>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <path d="M10 1L2 6v4c0 4.42 3.4 8.56 8 9.6 4.6-1.04 8-5.18 8-9.6V6l-8-5z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Verify &amp; Pay &euro;{total.toFixed(2)}
                  </>
                )}
              </button>
            </div>

            {/* Right: Order Summary */}
            <div className="order-summary">
              <h3>Order Summary</h3>
              <div className="summary-product">
                <div className="summary-image" style={{ background: selectedProduct.gradient }}>
                  <span>{selectedProduct.emoji}</span>
                </div>
                <div className="summary-details">
                  <strong>{selectedProduct.name}</strong>
                  <span>{selectedProduct.merchant}</span>
                </div>
              </div>
              <div className="summary-lines">
                <div className="summary-line">
                  <span>Subtotal</span>
                  <span>&euro;{selectedProduct.price.toFixed(2)}</span>
                </div>
                <div className="summary-line">
                  <span>VAT (19%)</span>
                  <span>&euro;{tax.toFixed(2)}</span>
                </div>
                <div className="summary-line">
                  <span>Shipping</span>
                  <span className="free-label">Free</span>
                </div>
                <div className="summary-line summary-total">
                  <span>Total</span>
                  <strong>&euro;{total.toFixed(2)}</strong>
                </div>
              </div>
              <div className="summary-fulfillment">
                {selectedProduct.fulfillment}
              </div>
              <div className="summary-checks">
                <span className="checks-label">Before you can pay</span>
                <div className="checks-items">
                  {requirements.map((req) => (
                    <div className="checks-item" key={req.short}>
                      <span className="checks-item-icon">{req.icon}</span>
                      <span className="checks-item-text">{req.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ─── Result View ─── */}
      {view === 'result' && selectedProduct && session && (
        <main className="main">
          <div className="result-container">
            <div className={`result-icon ${allPassed ? 'success' : 'failure'}`}>
              {allPassed ? (
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="24" fill="currentColor" fillOpacity="0.1"/>
                  <path d="M15 24l6 6 12-12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="24" fill="currentColor" fillOpacity="0.1"/>
                  <path d="M17 17l14 14M31 17L17 31" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              )}
            </div>

            <h1>{allPassed ? 'Order Confirmed!' : 'Verification Failed'}</h1>
            <p className="result-subtitle">
              {allPassed
                ? 'Your identity has been verified and payment processed successfully.'
                : 'Your EUDI wallet verification was declined. The order has not been placed.'}
            </p>

            {allPassed && (
              <div className="result-order-box">
                <div className="result-row">
                  <span>Order number</span>
                  <strong>{orderId}</strong>
                </div>
                <div className="result-row">
                  <span>Product</span>
                  <strong>{selectedProduct.name}</strong>
                </div>
                <div className="result-row">
                  <span>Total charged</span>
                  <strong>&euro;{total.toFixed(2)}</strong>
                </div>
                <div className="result-row">
                  <span>Delivery</span>
                  <strong>{selectedProduct.fulfillment}</strong>
                </div>
                <div className="result-row">
                  <span>Verification time</span>
                  <strong>{elapsedSeconds != null ? `${elapsedSeconds}s` : '--'}</strong>
                </div>
                <div className="result-row">
                  <span>API response</span>
                  <strong>
                    {createLatency != null && (
                      <span className="latency-badge">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                        {createLatency}ms
                      </span>
                    )}
                  </strong>
                </div>
                <div className="result-row">
                  <span>Session</span>
                  <strong>{shortSessionId}</strong>
                </div>
              </div>
            )}

            {session.results && (
              <div className="result-checks">
                <h3>Verification Results</h3>
                {Object.entries(session.results).map(([key, passed]) => (
                  <div className="result-check-row" key={key}>
                    <span className="result-check-name">{formatCheckName(key)}</span>
                    <span className={`result-check-status ${passed ? 'pass' : 'fail'}`}>
                      {passed ? (
                        <><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> Passed</>
                      ) : (
                        <><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> Failed</>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {session.riskScore != null && (
              <div className="result-risk">
                Risk score: <strong>{Math.round(session.riskScore * 100)}%</strong>
              </div>
            )}

            <div className="result-actions">
              <button type="button" className="btn btn-primary" onClick={goToStore}>
                Back to Store
              </button>
              <button type="button" className="btn btn-outline" onClick={() => {
                resetAll();
                setOrderId(generateOrderId());
                setView('checkout');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}>
                Try Again
              </button>
              <button type="button" className="btn btn-share" onClick={shareResult}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
                {shareCopied ? 'Copied!' : 'Share'}
              </button>
            </div>

            <div className="result-sdk code-section">
              <h3>Add this flow to your app</h3>
              <p>Everything you just experienced is a single API call:</p>
              <div className="code-header">
                <div className="code-tabs">
                  {CODE_TABS.map((tab) => (
                    <button
                      type="button"
                      key={tab.id}
                      className={`code-tab ${codeTab === tab.id ? 'active' : ''}`}
                      onClick={() => setCodeTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <button type="button" className={`code-copy-btn ${codeCopied ? 'copied' : ''}`} onClick={copyCode}>
                  {codeCopied ? (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied</>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
                  )}
                </button>
              </div>
              <div className="code-block">
                <pre dangerouslySetInnerHTML={{ __html: highlightCode(codeSnippets[codeTab]) }} />
              </div>
              <div className="sdk-links">
                <a href="https://walletgate.app" target="_blank" rel="noreferrer" className="btn btn-primary">
                  Get free API key
                </a>
                <a href="https://docs.walletgate.app" target="_blank" rel="noreferrer" className="btn btn-outline">
                  Read the docs
                </a>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ─── Verification Modal ─── */}
      {showModal && selectedProduct && (
        <div className="modal-backdrop" onClick={(e) => {
          if (e.target === e.currentTarget && status !== 'pending' && status !== 'in_progress') {
            setShowModal(false);
          }
        }}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2>Identity Verification</h2>
                <p>Scan with your EUDI Wallet to continue</p>
              </div>
              <span className={`modal-status ${status}`}>
                {status === 'pending' && 'Waiting for scan'}
                {status === 'in_progress' && 'Verifying...'}
                {status === 'completed' && allPassed && 'Verified!'}
                {status === 'completed' && !allPassed && 'Declined'}
                {status === 'failed' && 'Declined'}
                {status === 'expired' && 'Expired'}
                {status === 'idle' && 'Ready'}
              </span>
            </div>

            <div className="modal-requirements">
              {requirements.map((req) => (
                <span className="req-chip" key={req.short}>
                  <span className="req-chip-icon">{req.icon}</span> {req.short}
                </span>
              ))}
            </div>

            <div className="modal-body">
              <div className="modal-qr-section">
                <div className="modal-qr">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="Verification QR code" />
                  ) : (
                    <div className="qr-placeholder">
                      <div className="qr-spinner" />
                      Generating...
                    </div>
                  )}
                </div>
                {session?.verificationUrl && (
                  <a
                    className="btn btn-deeplink"
                    href={session.verificationUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in EUDI Wallet
                  </a>
                )}
              </div>

              <div className="modal-wallet">
                <div className="wallet-phone">
                  <div className="wallet-notch" />
                  <div className="wallet-screen">
                    <div className="wallet-app-header">
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                        <path d="M10 1L2 6v4c0 4.42 3.4 8.56 8 9.6 4.6-1.04 8-5.18 8-9.6V6l-8-5z" fill="#60a5fa" fillOpacity="0.3" stroke="#60a5fa" strokeWidth="1.5"/>
                      </svg>
                      <span>EUDI Wallet</span>
                    </div>
                    <div className="wallet-merchant-name">{selectedProduct.merchant}</div>
                    <div className="wallet-request">requests verification</div>
                    <div className="wallet-check-list">
                      {buildProductChecks(selectedProduct).map((check, i) => {
                        const resultKey = check.type === 'age_over' ? `age_over_${check.value ?? 18}` : check.type;
                        const checkResult = session?.results?.[resultKey];
                        let dotClass = 'pending';
                        if (status === 'completed' || status === 'failed') {
                          dotClass = checkResult === true ? 'pass' : checkResult === false ? 'fail' : (allPassed ? 'pass' : 'fail');
                        }
                        return (
                          <div className="wallet-check-item" key={i}>
                            <span className="wallet-check-label">
                              {check.type === 'age_over' ? `Age ${check.value ?? 18}+` : formatCheckName(check.type)}
                            </span>
                            <span className={`wallet-check-dot ${dotClass}`} />
                          </div>
                        );
                      })}
                    </div>
                    <div className={`wallet-actions ${productCheckCount >= 2 ? 'three-btns' : ''}`}>
                      <button
                        className="wallet-btn wallet-btn-approve"
                        onClick={() => simulate('pass_all')}
                        disabled={!session || loading || status === 'completed' || status === 'failed'}
                      >
                        Approve
                      </button>
                      {productCheckCount >= 2 && (
                        <button
                          className="wallet-btn wallet-btn-mixed"
                          onClick={() => simulate('mixed')}
                          disabled={!session || loading || status === 'completed' || status === 'failed'}
                        >
                          Mixed
                        </button>
                      )}
                      <button
                        className="wallet-btn wallet-btn-decline"
                        onClick={() => simulate('fail_all')}
                        disabled={!session || loading || status === 'completed' || status === 'failed'}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-meta">
              <div>
                <span>Session</span>
                <strong>{shortSessionId}</strong>
              </div>
              <div>
                <span>Expires in</span>
                <strong>{timeLeft}</strong>
              </div>
              <div>
                <span>Checks</span>
                <strong>{productCheckCount}</strong>
              </div>
              <div>
                <span>Latency</span>
                <strong>{createLatency != null ? <span className="latency-badge">{createLatency}ms</span> : '--'}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <span>Demo storefront powered by <a href="https://walletgate.app" target="_blank" rel="noreferrer">WalletGate</a>. No real transactions. No personal data stored.</span>
      </footer>
    </div>
  );
}
