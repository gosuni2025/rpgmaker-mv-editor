import express from 'express';
import projectManager from '../../services/projectManager';
import { detectWebp, buildPreviewHTML } from './previewTemplate';

const router = express.Router();

/** GET /api/ui-editor/preview — iframe 내에서 게임 런타임을 구동하는 HTML */
router.get('/', (req, res) => {
  if (!projectManager.isOpen()) {
    return res.status(404).send('<h2>프로젝트가 열려있지 않습니다</h2>');
  }
  res.type('html').send(buildPreviewHTML(detectWebp()));
});

export default router;
