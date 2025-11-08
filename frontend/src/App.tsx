import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import './App.css';

type PaymentStatus = 'idle' | 'processing' | 'success' | 'error';

interface PaymentResponse {
  message: string;
  data?: {
    intentId?: string;
    status?: string;
    approvalUrl?: string;
  };
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

function App() {
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('USD');
  const [userId, setUserId] = useState<string>('');
  const [faceAuthToken, setFaceAuthToken] = useState<string>('');
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [message, setMessage] = useState<string>('');
  const [intentInfo, setIntentInfo] = useState<PaymentResponse['data']>();

  const amountValue = useMemo(() => Number.parseFloat(amount), [amount]);

  const isSubmitDisabled = useMemo(() => {
    return Number.isNaN(amountValue) || amountValue <= 0 || !currency || !userId || !faceAuthToken || status === 'processing';
  }, [amountValue, currency, userId, faceAuthToken, status]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('processing');
    setMessage('');
    setIntentInfo(undefined);

    try {
      const response = await fetch(`${API_BASE_URL}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountValue,
          currency,
          userId,
          faceAuthToken,
        }),
      });

      const payload: PaymentResponse = await response.json();

      if (!response.ok) {
        setStatus('error');
        setMessage(payload.message ?? 'No se pudo procesar el pago.');
        return;
      }

      setStatus('success');
      setMessage(payload.message);
      setIntentInfo(payload.data);
    } catch (error) {
      console.error(error);
      setStatus('error');
      setMessage('Error de red al comunicarse con el backend.');
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>Demo de Pagos con OpenPayments</h1>
        <p>
          Ingresa el monto, selecciona la moneda y verifica al usuario mediante reconocimiento facial antes de procesar el pago.
        </p>
      </header>

      <main className="app__main">
        <form className="payment-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="amount">Monto</label>
            <input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Ej. 49.99"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="currency">Moneda</label>
            <select id="currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="MXN">MXN</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="userId">Usuario</label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="ID del usuario"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="faceAuthToken">Token de Reconocimiento Facial</label>
            <input
              id="faceAuthToken"
              type="text"
              value={faceAuthToken}
              onChange={(event) => setFaceAuthToken(event.target.value)}
              placeholder="Proporcionado por el servicio biométrico"
              required
            />
          </div>

          <button type="submit" disabled={isSubmitDisabled}>
            {status === 'processing' ? 'Procesando...' : 'Procesar Pago'}
          </button>
        </form>

        <section className="payment-feedback" aria-live="polite">
          {status === 'idle' && <p>Completa los campos para iniciar un pago.</p>}
          {status === 'processing' && <p className="info">Validando token biométrico y creando el intento de pago...</p>}
          {status === 'error' && <p className="error">{message}</p>}
          {status === 'success' && (
            <div className="success">
              <p>{message}</p>
              {intentInfo?.intentId && (
                <p>
                  Intento: <strong>{intentInfo.intentId}</strong>
                </p>
              )}
              {intentInfo?.status && (
                <p>
                  Estado: <strong>{intentInfo.status}</strong>
                </p>
              )}
              {intentInfo?.approvalUrl && (
                <p>
                  URL de aprobación:{' '}
                  <a href={intentInfo.approvalUrl} target="_blank" rel="noreferrer">
                    Completar en OpenPayments
                  </a>
                </p>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
