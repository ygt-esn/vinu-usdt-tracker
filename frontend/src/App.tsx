import { useEffect, useState } from 'react';
import { Bell, Check, Copy, ExternalLink, Radio } from 'lucide-react';
import { requestFcmToken, subscribeForegroundMessages } from './firebase';

interface TransferEvent {
  id: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  txHash: string;
  timestamp: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function shortenAddress(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function formatUsdt(amount: string) {
  const num = Number(amount);
  if (Number.isNaN(num)) return amount;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function App() {
  const [transfers, setTransfers] = useState<TransferEvent[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleConnect = async () => {
    setStatus('connecting');
    setErrorMsg('');

    try {
      const token = await requestFcmToken();
      const res = await fetch(`${API_URL}/notifications/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        throw new Error('Backend topic aboneliği başarısız oldu.');
      }

      setStatus('connected');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Bağlantı hatası oluştu.');
    }
  };

  useEffect(() => {
    // Daha önce izin verilmişse sayfa açılır açılmaz otomatik bağlan
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      handleConnect();
    }

    const unsubscribe = subscribeForegroundMessages((payload) => {
      const data = payload.data;
      if (!data?.txHash) return;
      console.log('FCM MESAJI GELDİ:', payload);

      const newTransfer: TransferEvent = {
        id: `${data.txHash}-${Date.now()}`,
        fromAddress: data.fromAddress || '',
        toAddress: data.toAddress || '',
        amount: data.amount || '0',
        txHash: data.txHash,
        timestamp: data.timestamp || new Date().toISOString(),
      };

      setTransfers((prev) => [newTransfer, ...prev].slice(0, 50));
    });

    return () => unsubscribe();
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="layout">
      <header className="topbar">
        <div className="brand">
          <span className="brand-title">USDT Mainnet Monitor</span>
          <span className="contract-badge">ERC-20 · 0xdAC1...1ec7</span>
        </div>

        <div className="actions">
          {status === 'connected' ? (
            <div className="status-pill live">
              <span className="dot" />
              FCM Canlı Dinleme Aktif
            </div>
          ) : (
            <button
              className="btn-primary"
              onClick={handleConnect}
              disabled={status === 'connecting'}
            >
              <Bell size={15} />
              {status === 'connecting' ? 'Bağlanıyor...' : 'Bildirimleri Etkinleştir'}
            </button>
          )}
        </div>
      </header>

      {errorMsg && <div className="error-banner">{errorMsg}</div>}

      <main className="content">
        <div className="section-header">
          <div>
            <h1>Gerçek Zamanlı Transfer Akışı</h1>
            <p className="subtitle">
              Ethereum Mainnet üzerindeki yüksek hacimli USDT transferleri FCM üzerinden anlık listelenir.
            </p>
          </div>
          <div className="counter">
            Yakalanan İşlem: <strong>{transfers.length}</strong>
          </div>
        </div>

        {transfers.length === 0 ? (
          <div className="empty-state">
            <Radio size={24} className="empty-icon" />
            <p className="empty-title">
              {status === 'connected'
                ? 'Ethereum Mainnet dinleniyor, yeni transfer bekleniyor...'
                : 'Canlı akışı başlatmak için sağ üstten bildirim izni verin.'}
            </p>
            <span className="empty-sub">
              Eşik değeri üzerindeki transferler gerçekleştiği anda bu tabloya düşer.
            </span>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="tx-table">
              <thead>
                <tr>
                  <th>Saat</th>
                  <th>Miktar (USDT)</th>
                  <th>Gönderen Adres</th>
                  <th>Alıcı Adres</th>
                  <th>İşlem Hash</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((tx) => (
                  <tr key={tx.id}>
                    <td className="mono muted">{formatTime(tx.timestamp)}</td>
                    <td className="mono amount">
                      {formatUsdt(tx.amount)} <span className="currency">USDT</span>
                    </td>
                    <td className="mono">
                      <button
                        className="addr-btn"
                        onClick={() => copyToClipboard(tx.fromAddress, `from-${tx.id}`)}
                        title={tx.fromAddress}
                      >
                        {shortenAddress(tx.fromAddress)}
                        {copiedId === `from-${tx.id}` ? (
                          <Check size={13} className="icon-ok" />
                        ) : (
                          <Copy size={13} className="icon-muted" />
                        )}
                      </button>
                    </td>
                    <td className="mono">
                      <button
                        className="addr-btn"
                        onClick={() => copyToClipboard(tx.toAddress, `to-${tx.id}`)}
                        title={tx.toAddress}
                      >
                        {shortenAddress(tx.toAddress)}
                        {copiedId === `to-${tx.id}` ? (
                          <Check size={13} className="icon-ok" />
                        ) : (
                          <Copy size={13} className="icon-muted" />
                        )}
                      </button>
                    </td>
                    <td className="mono">
                      <a
                        href={`https://etherscan.io/tx/${tx.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="tx-link"
                        title={tx.txHash}
                      >
                        {shortenAddress(tx.txHash)}
                        <ExternalLink size={13} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}