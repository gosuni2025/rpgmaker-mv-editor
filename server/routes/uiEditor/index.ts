import express from 'express';
import previewRouter from './preview';
import configRouter from './config';
import skinsRouter from './skins';
import imagesRouter from './images';

const router = express.Router();

router.use('/preview', previewRouter);
router.use('/config', configRouter);
router.use('/skins', skinsRouter);
router.use('/images', imagesRouter);

export default router;
