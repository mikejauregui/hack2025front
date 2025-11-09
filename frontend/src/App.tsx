import { useEffect, useMemo, useRef, useState } from 'react';

import './App.css';

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onerror: ((event: unknown) => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  0: SpeechRecognitionAlternative;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionResultList {
  length: number;
  item: (index: number) => SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResultEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type PaymentStatus = 'idle' | 'processing' | 'success' | 'error';

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  store: number;
  timestamp: string;
  snapshot: string;
  transcript: string | null;
}

function App() {
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('USD');
  const [faceAuthStatus, setFaceAuthStatus] = useState<'idle' | 'capturing' | 'verified' | 'error'>('idle');
  const [faceAuthMessage, setFaceAuthMessage] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isRecognitionActive, setIsRecognitionActive] = useState<boolean>(false);
  const [speechTranscript, setSpeechTranscript] = useState<string>('');
  const [speechInterim, setSpeechInterim] = useState<string>('');
  const [transactionsStatus, setTransactionsStatus] = useState<PaymentStatus>('idle');
  const [activeTab, setActiveTab] = useState<'verification' | 'transactions'>('verification');
  const [paymentDialog, setPaymentDialog] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioMimeTypeRef = useRef<string>('audio/webm');
  const speechRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsError, setTransactionsError] = useState<string>('');

  const amountValue = useMemo(() => Number.parseFloat(amount), [amount]);
  const isLoadingTransactions = transactionsStatus === 'processing';

  const stopAllStreams = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopSpeechRecognition();
    audioStreamRef.current?.getTracks().forEach((track, index) => {
      console.log('[FaceAuth] Deteniendo track de audio interno', { index, kind: track.kind, readyState: track.readyState });
      track.stop();
    });
    audioStreamRef.current = null;
    mediaStream?.getTracks().forEach((track, index) => {
      // eslint-disable-next-line no-console
      console.log('[FaceAuth] Deteniendo track', { index, kind: track.kind, readyState: track.readyState });
      track.stop();
    });
    setMediaStream(null);
    setIsCameraActive(false);
    setIsRecording(false);
    mediaRecorderRef.current = null;
  };

  const stopSpeechRecognition = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (error) {
        console.warn('[FaceAuth] Error al detener SpeechRecognition', error);
      }
      speechRecognitionRef.current = null;
    }
    setIsRecognitionActive(false);
    setSpeechInterim('');
  };

  useEffect(() => {
    return () => {
      stopAllStreams();
      // eslint-disable-next-line no-console
      console.log('[FaceAuth] Componente desmontado: recursos liberados');
    };
  }, []);

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

  const handleStartFaceAuth = async () => {
    console.log('[FaceAuth] Iniciando verificación facial');
    if (!navigator.mediaDevices?.getUserMedia) {
      setFaceAuthStatus('error');
      setFaceAuthMessage('Tu navegador no soporta acceso a la cámara y micrófono.');
      console.error('[FaceAuth] getUserMedia no disponible');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      const message =
        'Tu navegador no soporta la grabación de audio necesaria para la validación por voz. Prueba con Chrome o Edge.';
      console.error('[FaceAuth] MediaRecorder no disponible');
      setFaceAuthStatus('error');
      setFaceAuthMessage(message);
      return;
    }

    const SpeechRecognitionCtor =
      (window.SpeechRecognition || window.webkitSpeechRecognition) as SpeechRecognitionConstructor | undefined;

    if (!SpeechRecognitionCtor) {
      const message =
        'Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge actualizado para completar la validación.';
      console.error('[FaceAuth] SpeechRecognition no disponible');
      setFaceAuthStatus('error');
      setFaceAuthMessage(message);
      return;
    }

    setPaymentDialog(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('[FaceAuth] Stream de cámara y audio obtenido');
      setMediaStream(stream);
      setIsCameraActive(true);
      setFaceAuthStatus('capturing');
      const expectedSpeech = `Acepto el cargo por $${Number.isNaN(amountValue) ? 'XX.XX' : amountValue.toFixed(2)} ${currency}`;
      setFaceAuthMessage(`Apunta tu rostro a la cámara y di: "${expectedSpeech}". Cuando termines, pulsa "Detener y validar".`);

      stopSpeechRecognition();
      setSpeechTranscript('');
      setSpeechInterim('');

      const recognition = new SpeechRecognitionCtor();
      recognition.lang = 'es-MX';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log('[FaceAuth] Reconocimiento de voz iniciado');
        setIsRecognitionActive(true);
      };

      recognition.onerror = (event) => {
        console.error('[FaceAuth] Error en SpeechRecognition', event);
      };

      recognition.onresult = (event) => {
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const alternative = result[0];
          const transcript = alternative?.transcript?.trim() ?? '';
          if (!transcript) {
            continue;
          }

          if (result.isFinal) {
            setSpeechTranscript((prev) => `${prev} ${transcript}`.trim());
          } else {
            interimText += `${transcript} `;
          }
        }
        setSpeechInterim(interimText.trim());
      };

      recognition.onend = () => {
        console.log('[FaceAuth] Reconocimiento de voz finalizado');
        setIsRecognitionActive(false);
        setSpeechInterim('');
      };

      speechRecognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (error) {
        console.warn('[FaceAuth] No se pudo iniciar SpeechRecognition', error);
      }

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No se detectó micrófono. Revisa los permisos de audio.');
      }

      audioChunksRef.current = [];

      const audioStream = new MediaStream();
      audioTracks.forEach((track: MediaStreamTrack) => {
        audioStream.addTrack(track.clone ? track.clone() : track);
      });
      audioStreamRef.current = audioStream;

      const candidateMimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', ''];

      let recorder: MediaRecorder | null = null;
      for (const mimeType of candidateMimeTypes) {
        if (mimeType && !MediaRecorder.isTypeSupported(mimeType)) {
          continue;
        }
        try {
          recorder = mimeType ? new MediaRecorder(audioStream, { mimeType }) : new MediaRecorder(audioStream);
          console.log('[FaceAuth] MediaRecorder inicializado con mimeType', mimeType || 'por defecto');
          break;
        } catch (error) {
          console.warn('[FaceAuth] No se pudo usar mimeType', mimeType || 'default', error);
          recorder = null;
        }
      }

      if (!recorder) {
        throw new Error('No fue posible iniciar la grabación de audio en este navegador.');
      }

      audioMimeTypeRef.current = recorder.mimeType || audioMimeTypeRef.current;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstart = () => {
        // eslint-disable-next-line no-console
        console.log('[FaceAuth] Grabación iniciada');
        setIsRecording(true);
      };
      recorder.onstop = () => {
        // eslint-disable-next-line no-console
        console.log('[FaceAuth] Grabación detenida', { chunks: audioChunksRef.current.length });
      };
      recorder.onerror = (event) => {
        console.error('[FaceAuth] Error en MediaRecorder', event);
        setFaceAuthStatus('error');
        setFaceAuthMessage('Hubo un problema al grabar el audio. Intenta nuevamente.');
      };

      mediaRecorderRef.current = recorder;
      try {
        mediaRecorderRef.current.start();
      } catch (error) {
        throw new Error(
          error instanceof Error
            ? `No se pudo iniciar la grabación de audio: ${error.message}`
            : 'No se pudo iniciar la grabación de audio.',
        );
      }
    } catch (error) {
      console.error('[FaceAuth] Error al iniciar la cámara o micrófono', error);
      setFaceAuthStatus('error');
      setFaceAuthMessage(
        error instanceof Error ? `Error al iniciar la cámara o micrófono: ${error.message}` : 'Ocurrió un error inesperado.',
      );
    }
  };

  const captureAndSendEvidence = async () => {
    if (!videoRef.current) {
      setFaceAuthStatus('error');
      setFaceAuthMessage('No se encontró el video para capturar la imagen.');
      stopAllStreams();
      return;
    }

    const video = videoRef.current;

    try {
      setFaceAuthMessage('Procesando captura...');

      const canvas = document.createElement('canvas');
      const sourceWidth = video.videoWidth || 640;
      const sourceHeight = video.videoHeight || 480;
      const targetWidth = 320;
      const targetHeight = Math.round((sourceHeight / sourceWidth) * targetWidth) || 240;
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('No se pudo preparar el contexto del lienzo.');
      }

      context.drawImage(video, 0, 0, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);

      const snapshotBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error('No se pudo obtener la imagen capturada.'));
          }
        }, 'image/png');
      });

      let audioBlob: Blob | null = null;
      if (audioChunksRef.current.length > 0) {
        const audioMimeType = audioMimeTypeRef.current || 'audio/webm';
        audioBlob = new Blob(audioChunksRef.current, { type: audioMimeType });
      } else {
        console.warn('[FaceAuth] No se capturó audio; se enviará únicamente la imagen y datos del pago.');
      }

      const formData = new FormData();
      formData.append('snapshot', snapshotBlob, `face-${Date.now()}.png`);
      formData.append('amount', String(amountValue));
      formData.append('currency', currency);
      if (audioBlob) {
        formData.append('voice', audioBlob, `voice-${Date.now()}.webm`);
      }

       const transcriptToSend = `${speechTranscript || ''} ${speechInterim || ''}`.trim();
       if (transcriptToSend) {
         formData.append('transcript', transcriptToSend);
       } else {
         console.warn('[FaceAuth] No se obtuvo transcripción; se enviará sin texto.');
       }

      console.log('[FaceAuth] Enviando POST con evidencia', {
        amount: amountValue,
        currency,
        hasAudio: Boolean(audioBlob),
        transcriptPresent: Boolean(transcriptToSend),
        formEntries: Array.from(formData.keys()),
      });

      const response = await fetch('https://squad-eos-therefore-musical.trycloudflare.com/api/upload', {
        method: 'POST',
        mode: 'cors',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`El servidor respondió con estado ${response.status}`);
      }

      if (Number.isNaN(amountValue) || amountValue <= 0) {
        setPaymentDialog({
          type: 'error',
          message: 'Validación completada, pero no se proporcionó un monto válido para registrar la transacción.',
        });
      } else {
        const formattedAmount = new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency,
        }).format(amountValue);
        const timestamp = new Date().toLocaleString('es-MX');
        setPaymentDialog({
          type: 'success',
          message: `Validación y envío completados. Se solicitó procesar ${formattedAmount} el ${timestamp}.`,
        });
      }
    } catch (error) {
      console.error('[FaceAuth] Error al capturar o enviar la evidencia', error);
      setFaceAuthStatus('error');
      setFaceAuthMessage(
        error instanceof Error ? `Error al enviar la evidencia: ${error.message}` : 'Ocurrió un error inesperado.',
      );
      const errorMessage =
        error instanceof Error ? `No se pudo notificar al servidor: ${error.message}` : 'Error desconocido al contactar al servidor.';
      setPaymentDialog({ type: 'error', message: errorMessage });
    } finally {
      stopAllStreams();
      audioChunksRef.current = [];
      setSpeechTranscript('');
      setSpeechInterim('');
    }
  };

  const handleStopAndValidate = () => {
    if (!isRecording) {
      console.warn('[FaceAuth] Se intentó detener la captura sin estar grabando.');
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    stopSpeechRecognition();
    void captureAndSendEvidence();
  };

  const handleCancelFaceAuth = () => {
    setFaceAuthStatus('idle');
    setFaceAuthMessage('');
    stopAllStreams();
    audioChunksRef.current = [];
    setSpeechTranscript('');
    setSpeechInterim('');
    setPaymentDialog(null);
    console.log('[FaceAuth] Verificación cancelada por el usuario');
  };

  const handleFetchTransactions = async () => {
    setTransactionsStatus('processing');
    setTransactionsError('');
    try {
      const response = await fetch('https://squad-eos-therefore-musical.trycloudflare.com/api/transactions', {
        method: 'GET',
        mode: 'cors',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`El servidor respondió con estado ${response.status}`);
      }

      const data: Transaction[] = await response.json();
      setTransactions(data);
      setTransactionsStatus('success');
    } catch (error) {
      console.error('[FaceAuth] Error al consultar transacciones', error);
      setTransactionsStatus('error');
      setTransactions([]);
      setTransactionsError(
        error instanceof Error ? `No se pudieron obtener las transacciones: ${error.message}` : 'Error desconocido',
      );
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>Demo de Pagos con OpenPayments</h1>
        <p>Ingresa el monto, selecciona la moneda y verifica al usuario mediante reconocimiento facial para procesar el pago.</p>
      </header>

      <main className="app__main">
        {paymentDialog && (
          <div className="dialog-overlay" role="alertdialog" aria-modal="true">
            <div className={`dialog dialog--${paymentDialog.type}`}>
              <h3>{paymentDialog.type === 'success' ? 'Pago exitoso' : 'Pago no procesado'}</h3>
              <p>{paymentDialog.message}</p>
              <button type="button" onClick={() => setPaymentDialog(null)}>
                Cerrar
              </button>
            </div>
          </div>
        )}

        <div className="tabs">
          <button
            type="button"
            className={`tabs__button ${activeTab === 'verification' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('verification')}
          >
            Validación biométrica
          </button>
          <button
            type="button"
            className={`tabs__button ${activeTab === 'transactions' ? 'is-active' : ''}`}
            onClick={() => {
              setActiveTab('transactions');
              if (transactions.length === 0 && transactionsStatus !== 'processing') {
                void handleFetchTransactions();
              }
            }}
          >
            Pagos recibidos
          </button>
        </div>

        {activeTab === 'verification' && (
          <form className="payment-form" onSubmit={(event) => event.preventDefault()}>
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
                <h2>Verificación facial y de voz</h2>
                <p>
                  Inicia la cámara, pronuncia la frase solicitada y detén la captura para enviar evidencia facial, de voz y
                  confirmar el monto.
                </p>
              </div>

              {isCameraActive ? (
                <div className="face-auth__capture">
                  <video ref={videoRef} autoPlay playsInline muted className="face-auth__video" />
                  <div className="face-auth__actions">
                    <button type="button" className="secondary" onClick={handleCancelFaceAuth}>
                      Cancelar
                    </button>
                    <button type="button" onClick={handleStopAndValidate} disabled={!isRecording}>
                      {isRecording ? 'Detener y validar' : 'Procesando...'}
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

              {(speechInterim || speechTranscript) && (
                <div className="face-auth__transcript">
                  <span className="face-auth__transcript-label">Texto detectado:</span>
                  <p className="face-auth__transcript-text">{speechInterim || speechTranscript}</p>
                  {isRecognitionActive && <span className="face-auth__transcript-badge">Escuchando…</span>}
                </div>
              )}
            </div>
          </form>
        )}

        {activeTab === 'transactions' && (
        <section className="transactions">
          <header className="transactions__header">
            <h2>Historial de transacciones recibidas</h2>
            <div className="transactions__header-actions">
              <p>Consulta los pagos capturados junto con el identificador de evidencia facial y transcriptos registrados.</p>
              <button
                type="button"
                className="transactions__refresh"
                onClick={() => void handleFetchTransactions()}
                disabled={isLoadingTransactions}
              >
                {isLoadingTransactions ? 'Actualizando…' : 'Actualizar listado'}
              </button>
            </div>
          </header>

          {transactionsError && <p className="transactions__error">{transactionsError}</p>}

          {!transactionsError && transactions.length === 0 && !isLoadingTransactions && (
            <div className="transactions__placeholder">
              <p>No hay transacciones cargadas todavía. Presiona "Consultar pagos recibidos" para actualizar la información.</p>
              <button
                type="button"
                className="transactions__refresh"
                onClick={() => void handleFetchTransactions()}
                disabled={isLoadingTransactions}
              >
                Volver a intentar
              </button>
            </div>
          )}

          {isLoadingTransactions && (
            <div className="transactions__loading">
              <span className="transactions__spinner" aria-hidden="true" />
              <p>Consultando transacciones…</p>
            </div>
          )}

          {transactions.length > 0 && !isLoadingTransactions && (
            <div className="transactions__table-wrapper">
              <table className="transactions__table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Monto</th>
                    <th>Moneda</th>
                    <th>Tienda</th>
                    <th>Fecha y hora</th>
                    <th>Snapshot</th>
                    <th>Transcripción</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="transactions__id">{transaction.id}</td>
                      <td>{new Intl.NumberFormat('es-MX', { style: 'currency', currency: transaction.currency }).format(transaction.amount)}</td>
                      <td>{transaction.currency}</td>
                      <td>{transaction.store}</td>
                      <td>{new Date(transaction.timestamp).toLocaleString('es-MX')}</td>
                      <td className="transactions__snapshot">{transaction.snapshot}</td>
                      <td className="transactions__transcript">
                        {transaction.transcript ? transaction.transcript : <span className="transactions__transcript-empty">Sin transcripción</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        )}

      </main>
    </div>
  );
}

export default App;

