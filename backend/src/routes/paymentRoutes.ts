import { Router } from 'express';

import { createPaymentIntentController } from '../controllers/paymentController';

const router = Router();

router.post('/', createPaymentIntentController);

export const paymentRouter = router;

