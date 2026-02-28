import express from 'express';
import previewRouter from './preview';
import configRouter from './config';
import skinsRouter from './skins';
import imagesRouter from './images';
import fontsRouter from './fonts';
import scenesRouter from './scenes';
import expressionTemplatesRouter from './expressionTemplates';
import templatesRouter from './templates';

const router = express.Router();

router.use('/preview', previewRouter);
router.use('/config', configRouter);
router.use('/skins', skinsRouter);
router.use('/images', imagesRouter);
router.use('/fonts', fontsRouter);
router.use('/scenes', scenesRouter);
router.use('/expression-templates', expressionTemplatesRouter);
router.use('/templates', templatesRouter);

export default router;
