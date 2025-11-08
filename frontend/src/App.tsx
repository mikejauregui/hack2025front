import { useEffect, useMemo, useRef, useState } from 'react';
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
const AWS_REGION = import.meta.env.VITE_AWS_REGION ?? 'us-east-1';
const FACE_LIVENESS_RESOURCES_URL =
  import.meta.env.VITE_FACE_LIVENESS_RESOURCES_URL ??
  `https://static.${AWS_REGION}.rekognition.amazonaws.com/FaceLivenessSessionResources/latest/face-liveness-detector.js`;

declare global {
  interface Window {
    AmazonRekognitionStreamingLiveness?: {
      createFaceLivenessDetector: (options: Record<string, unknown>) => Promise<{
        render: (container: HTMLElement) => void;
        start: () => void;
        destroy?: () => void;
      }>;
    };
  }
}

let faceLivenessScriptPromise: Promise<void> | null = null;

const loadFaceLivenessResources = async () => {
  if (window.AmazonRekognitionStreamingLiveness) {
    return;
  }

  if (!faceLivenessScriptPromise) {
    faceLivenessScriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = FACE_LIVENESS_RESOURCES_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`No se pudo cargar el script de Face Liveness desde ${FACE_LIVENESS_RESOURCES_URL}`));
      document.body.appendChild(script);
    });
  }

  await faceLivenessScriptPromise;
};

function App() {
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('USD');
  const [faceAuthToken, setFaceAuthToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [faceAuthStatus, setFaceAuthStatus] = useState<'idle' | 'loading' | 'capturing' | 'verified' | 'error'>('idle');
  const [faceAuthMessage, setFaceAuthMessage] = useState<string>('');
  const [detectorMode, setDetectorMode] = useState<'idle' | 'loading' | 'ready' | 'unsupported'>('idle');
  const detectorContainerRef = useRef<HTMLDivElement | null>(null);
  const detectorInstanceRef = useRef<{ destroy?: () => void } | null>(null);
  const [status, setStatus] = useState<PaymentStatus>('idle');

  const userId = 'demo-user';

  const amountValue = useMemo(() => Number.parseFloat(amount), [amount]);

  const isSubmitDisabled = useMemo(() => {
    return Number.isNaN(amountValue) || amountValue <= 0 || !currency || !faceAuthToken || status === 'processing';
  }, [amountValue, currency, faceAuthToken, status]);

  useEffect(() => {
    return () => {
      detectorInstanceRef.current?.destroy?.();
    };
  }, []);

  const resetFaceAuthState = () => {
    detectorInstanceRef.current?.destroy?.();
    detectorInstanceRef.current = null;
    setSessionId(null);
    setDetectorMode('idle');
  };

  const handleStartFaceAuth = async () => {
    setFaceAuthStatus('loading');
    setFaceAuthMessage('Preparando la sesión de reconocimiento facial...');
    setDetectorMode('loading');
    setFaceAuthToken(null);

    try {
      const response = await fetch(`${API_BASE_URL}/face-auth/session`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('No fue posible inicializar la sesión de Face Liveness.');
      }

      const payload = await response.json();
      const newSessionId: string | undefined = payload?.data?.sessionId;

      if (!newSessionId) {
        throw new Error('La respuesta del backend no incluyó un sessionId.');
      }

      setSessionId(newSessionId);
      setFaceAuthStatus('capturing');
      setFaceAuthMessage('Sigue las instrucciones en pantalla para completar la verificación facial.');

      try {
        await loadFaceLivenessResources();
        const detectorFactory = window.AmazonRekognitionStreamingLiveness?.createFaceLivenessDetector;

        if (!detectorFactory) {
          throw new Error('El recurso de Amazon Rekognition Face Liveness no está disponible en la ventana.');
        }

        if (!detectorContainerRef.current) {
          throw new Error('No se encontró el contenedor del detector.');
        }

        const detector = await detectorFactory({
          sessionId: newSessionId,
          region: AWS_REGION,
          // Los callbacks reales dependerán del SDK. Se incluyen valores por defecto con nombres comunes.
          onComplete: (event: { sessionId?: string }) => {
            const verifiedSession = event?.sessionId ?? newSessionId;
            setFaceAuthToken(verifiedSession);
            setFaceAuthStatus('verified');
            setFaceAuthMessage('Identidad verificada correctamente.');
            setDetectorMode('ready');
            detectorInstanceRef.current?.destroy?.();
            detectorInstanceRef.current = null;
          },
          onError: (error: unknown) => {
            console.error('Error desde el detector de Face Liveness:', error);
            setFaceAuthStatus('error');
            setFaceAuthMessage('Ocurrió un error durante la verificación facial. Intenta nuevamente.');
            resetFaceAuthState();
          },
        });

        detector.render(detectorContainerRef.current);

        if (typeof detector.start === 'function') {
          detector.start();
        }

        detectorInstanceRef.current = detector;
        setDetectorMode('ready');
      } catch (detectorError) {
        console.warn('Modo Face Liveness no disponible. Se habilitará la verificación simulada.', detectorError);
        setDetectorMode('unsupported');
      }
    } catch (error) {
      console.error(error);
      setFaceAuthStatus('error');
      setFaceAuthMessage(
        error instanceof Error ? error.message : 'Ocurrió un error inesperado. Intenta iniciar nuevamente la verificación.',
      );
      resetFaceAuthState();
    }
  };

  const handleSimulateFaceAuth = () => {
    if (!sessionId) {
      setFaceAuthStatus('error');
      setFaceAuthMessage('No hay una sesión válida para simular la verificación.');
      return;
    }

    setFaceAuthToken(sessionId);
    setFaceAuthStatus('verified');
    setFaceAuthMessage(
      'Modo simulado activo: se asumió una verificación facial correcta. Configura el SDK oficial para un flujo real.',
    );
    resetFaceAuthState();
  };

  const handleCancelFaceAuth = () => {
    resetFaceAuthState();
    setFaceAuthStatus('idle');
    setFaceAuthToken(null);
    setFaceAuthMessage('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('processing');

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
        console.error(payload.message ?? 'No se pudo procesar el pago.');
        return;
      }

      setStatus('success');
      console.info(payload.message, payload.data);
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>Demo de Pagos con OpenPayments</h1>
        <p>Ingresa el monto, selecciona la moneda y verifica al usuario mediante reconocimiento facial para procesar el pago.</p>
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

          <div className="face-auth">
            <div className="face-auth__content">
              <h2>Verificación facial</h2>
              <p>
                Necesitamos validar tu identidad mediante reconocimiento facial. Presiona el botón inferior para iniciar la
                verificación con Amazon Rekognition Face Liveness.
              </p>
            </div>

            {faceAuthStatus === 'capturing' ? (
              <div className="face-auth__capture">
                <div ref={detectorContainerRef} className="face-auth__detector" />
                {detectorMode === 'unsupported' && (
                  <div className="face-auth__fallback">
                    <p>
                      No se pudo cargar el componente oficial de Face Liveness en este entorno. Puedes continuar con una
                      verificación simulada para pruebas locales.
                    </p>
                    <button type="button" onClick={handleSimulateFaceAuth}>
                      Simular verificación facial
                    </button>
                  </div>
                )}
                <div className="face-auth__actions">
                  <button type="button" className="secondary" onClick={handleCancelFaceAuth}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="primary"
                onClick={handleStartFaceAuth}
                disabled={faceAuthStatus === 'loading'}
              >
                {faceAuthStatus === 'verified' ? 'Reiniciar verificación facial' : 'Iniciar verificación facial'}
              </button>
            )}

            {faceAuthMessage && (
              <p
                className={`face-auth__status ${
                  faceAuthStatus === 'error' ? 'error' : faceAuthStatus === 'verified' ? 'success' : 'info'
                }`}
              >
                {faceAuthMessage}
              </p>
            )}
          </div>

          <button type="submit" disabled={isSubmitDisabled}>
            {status === 'processing' ? 'Procesando...' : 'Procesar Pago'}
          </button>
        </form>

      </main>
    </div>
  );
}

export default App;
