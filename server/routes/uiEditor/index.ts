import express from 'express';
import previewRouter from './preview';
import configRouter from './config';
import skinsRouter from './skins';

const router = express.Router();

router.use('/preview', previewRouter);
router.use('/config', configRouter);
router.use('/skins', skinsRouter);

export default router;
