/**
 * FaceAuthService
 *
 * Esta clase representa el punto de integración con el proveedor externo de reconocimiento facial.
 * Más adelante se reemplazarán los métodos stub por llamadas reales al SDK/API que se defina.
 */
export class FaceAuthService {
  async verifyFaceAuthToken(userId: string, token: string): Promise<boolean> {
    // TODO: integrar con el servicio real de reconocimiento facial.
    // La implementación concreta dependerá del proveedor que se agregue.
    // Por ahora simplemente validamos formatos básicos.
    if (!userId || !token) {
      return false;
    }

    // Simulación temporal: tokens que empiezan por "valid-" se aceptan.
    return token.startsWith('valid-');
  }
}

