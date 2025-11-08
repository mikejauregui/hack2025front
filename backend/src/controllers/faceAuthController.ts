import { Request, Response } from 'express';

import { FaceAuthService } from '../services/faceAuthService';

const faceAuthService = new FaceAuthService();

export const startFaceAuthSessionController = async (_req: Request, res: Response) => {
  try {
    const session = await faceAuthService.createFaceLivenessSession();
    return res.status(201).json({
      message: 'Sesión de Face Liveness creada correctamente.',
      data: session,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error desconocido al crear la sesión de Face Liveness.';
    return res.status(500).json({ message });
  }
};


