import express from 'express';
import fs from 'fs';
import path from 'path';
import projectManager from '../../services/projectManager';

const router = express.Router();

/**
 * GET /api/ui-editor/expression-templates
 * 프로젝트 플러그인 파일에서 @UITemplates 블록을 파싱하여 반환
 *
 * 플러그인 파일에 다음 형식으로 작성하면 자동으로 픽커에 추가됨:
 * ─────────────────────────────────────
 * /* @UITemplates
 * [
 *   {
 *     "group": "그룹 이름",
 *     "pluginLabel": "플러그인명",
 *     "items": [
 *       { "label": "표시 이름", "code": "삽입 코드", "desc": "설명", "modes": ["text"] }
 *     ]
 *   }
 * ]
 * *\/
 * ─────────────────────────────────────
 * modes: "text" | "bitmap" | "srcRect" | "js"
 */
router.get('/', (req, res) => {
  const projectPath = projectManager.currentPath;
  if (!projectPath) return res.json({ groups: [] });

  const pluginsDir = path.join(projectPath, 'js', 'plugins');
  if (!fs.existsSync(pluginsDir)) return res.json({ groups: [] });

  const groups: unknown[] = [];

  let files: string[];
  try {
    files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'));
  } catch {
    return res.json({ groups: [] });
  }

  // /* @UITemplates ... */ 블록 파싱
  const BLOCK_RE = /\/\*\s*@UITemplates\s*\n([\s\S]*?)\*\//g;

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(path.join(pluginsDir, file), 'utf8');
    } catch {
      continue;
    }

    let match: RegExpExecArray | null;
    // Reset lastIndex for each file
    BLOCK_RE.lastIndex = 0;
    while ((match = BLOCK_RE.exec(content)) !== null) {
      try {
        const json = match[1].trim();
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
          groups.push(...parsed);
        } else if (parsed && typeof parsed === 'object') {
          groups.push(parsed);
        }
      } catch {
        // parse 실패 무시
      }
    }
  }

  res.json({ groups });
});

export default router;
