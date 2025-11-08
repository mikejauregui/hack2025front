import {
  CreateFaceLivenessSessionCommand,
  type CreateFaceLivenessSessionCommandOutput,
  GetFaceLivenessSessionResultsCommand,
  type GetFaceLivenessSessionResultsCommandOutput,
  RekognitionClient,
  type RekognitionClientConfig,
} from '@aws-sdk/client-rekognition';
import type { AwsCredentialIdentity } from '@aws-sdk/types';

import { getEnvironmentConfig } from '../config/environment';

interface FaceLivenessSessionResult {
  sessionId: string;
  confidence: number;
  status: string;
}

/**
 * FaceAuthService
 *
 * Encapsula la integración con Amazon Rekognition Face Liveness.
 * Si no se detecta una configuración válida de AWS, se mantiene un modo "stub"
 * para permitir el desarrollo local con tokens prefijados en `valid-`.
 */
export class FaceAuthService {
  private readonly rekognitionClient: RekognitionClient | null;

  private readonly confidenceThreshold: number;

  constructor() {
    const {
      aws: {
        region,
        accessKeyId,
        secretAccessKey,
        sessionToken,
        rekognition: { minConfidence },
      },
    } = getEnvironmentConfig();

    this.confidenceThreshold = minConfidence;

    if (!region) {
      this.rekognitionClient = null;
      return;
    }

    try {
      const clientConfig: RekognitionClientConfig = {
        region,
      };

      if (accessKeyId && secretAccessKey) {
        const credentials: AwsCredentialIdentity = sessionToken
          ? {
              accessKeyId,
              secretAccessKey,
              sessionToken,
            }
          : {
              accessKeyId,
              secretAccessKey,
            };

        clientConfig.credentials = credentials;
      }

      this.rekognitionClient = new RekognitionClient(clientConfig);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('No se pudo inicializar RekognitionClient:', error);
      this.rekognitionClient = null;
    }
  }

  async createFaceLivenessSession(): Promise<{ sessionId: string }> {
    if (!this.rekognitionClient) {
      throw new Error('Amazon Rekognition no está configurado. Revisa las variables de entorno de AWS.');
    }

    const command = new CreateFaceLivenessSessionCommand({});
    const response = (await this.rekognitionClient.send(
      command,
    )) as CreateFaceLivenessSessionCommandOutput;

    if (!response.SessionId) {
      throw new Error('La respuesta de Rekognition no incluyó SessionId.');
    }

    return {
      sessionId: response.SessionId,
    };
  }

  async verifyFaceAuthToken(userId: string, token: string): Promise<boolean> {
    if (!userId || !token) {
      return false;
    }

    if (!this.rekognitionClient) {
      // eslint-disable-next-line no-console
      console.warn(
        'Amazon Rekognition no está configurado. Se utilizará el modo de verificación simulado (tokens "valid-").',
      );
      return token.startsWith('valid-');
    }

    try {
      const result = await this.getFaceLivenessSessionResult(token);
      return result.status === 'SUCCEEDED' && result.confidence >= this.confidenceThreshold;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error al verificar la sesión de Face Liveness:', error);
      return false;
    }
  }

  private async getFaceLivenessSessionResult(sessionId: string): Promise<FaceLivenessSessionResult> {
    if (!this.rekognitionClient) {
      throw new Error('Amazon Rekognition no está configurado.');
    }

    const command = new GetFaceLivenessSessionResultsCommand({
      SessionId: sessionId,
    });

    const response = (await this.rekognitionClient.send(
      command,
    )) as GetFaceLivenessSessionResultsCommandOutput;

    return {
      sessionId,
      confidence: response.Confidence ?? 0,
      status: response.Status ?? 'UNKNOWN',
    };
  }
}


