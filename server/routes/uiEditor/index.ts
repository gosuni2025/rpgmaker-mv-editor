import express from 'express';
import previewRouter from './preview';
import configRouter from './config';
import skinsRouter from './skins';
import imagesRouter from './images';
import fontsRouter from './fonts';

const router = express.Router();

router.use('/preview', previewRouter);
router.use('/config', configRouter);
router.use('/skins', skinsRouter);
router.use('/images', imagesRouter);
router.use('/fonts', fontsRouter);

export default router;
