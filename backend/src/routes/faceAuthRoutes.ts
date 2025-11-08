import { Router } from 'express';

import { startFaceAuthSessionController } from '../controllers/faceAuthController';

const router = Router();

router.post('/session', startFaceAuthSessionController);

export const faceAuthRouter = router;


