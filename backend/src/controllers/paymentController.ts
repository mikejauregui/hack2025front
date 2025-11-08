import { Request, Response } from 'express';

import { OpenPaymentsService } from '../services/openPaymentsService';
import { FaceAuthService } from '../services/faceAuthService';

const openPaymentsService = new OpenPaymentsService();
const faceAuthService = new FaceAuthService();

export const createPaymentIntentController = async (req: Request, res: Response) => {
  try {
    const { amount, currency, userId, faceAuthToken } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({ message: 'amount y currency son obligatorios' });
    }

    if (!userId) {
      return res.status(400).json({ message: 'userId es obligatorio para iniciar el pago' });
    }

    if (!faceAuthToken) {
      return res.status(400).json({ message: 'faceAuthToken faltante. Debe validarse con el servicio de reconocimiento facial.' });
    }

    const isFaceAuthValid = await faceAuthService.verifyFaceAuthToken(userId, faceAuthToken);

    if (!isFaceAuthValid) {
      return res.status(401).json({ message: 'La validación biométrica falló. No se procesó el pago.' });
    }

    const paymentIntent = await openPaymentsService.createPaymentIntent({
      amount,
      currency,
      userId,
    });

    return res.status(201).json({
      message: 'Intento de pago creado',
      data: paymentIntent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido al crear el pago';
    return res.status(500).json({ message });
  }
};

