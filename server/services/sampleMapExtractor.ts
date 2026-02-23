import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

/**
 * RPG Maker MV 바이너리에서 샘플 맵 데이터를 런타임에 추출하는 서비스
 *
 * RPG Maker MV는 Qt 기반 에디터로, 샘플 맵이 바이너리 내 Qt 리소스로 내장되어 있음.
 * Qt 리소스 형식: tree table + name table + data table
 * - name table: len(2, BE) + hash(4, BE) + UTF-16BE string
 * - tree entry: name_offset(4, BE) + flags(2, BE) + country(2) + lang(2) + data_offset(4, BE)
 * - data entry: total_size(4, BE) + [uncomp_size(4, BE) + zlib_data] or raw_data
 */

// 맵 이름 목록 (QML Dialog_MapLoader에서 추출)
const MAP_NAMES: Array<{ name: string; category: 'Fantasy' | 'Cyberpunk' }> = [
  { name: 'World 1', category: 'Fantasy' },
  { name: 'World 2', category: 'Fantasy' },
  { name: 'World 3', category: 'Fantasy' },
  { name: 'World 4', category: 'Fantasy' },
  { name: 'World 5', category: 'Fantasy' },
  { name: 'Normal Town', category: 'Fantasy' },
  { name: 'Forest Town', category: 'Fantasy' },
  { name: 'Abandoned Town', category: 'Fantasy' },
  { name: 'Snow Town', category: 'Fantasy' },
  { name: 'Floating Temple', category: 'Fantasy' },
  { name: 'Mining City', category: 'Fantasy' },
  { name: 'Market', category: 'Fantasy' },
  { name: 'Fishing Village', category: 'Fantasy' },
  { name: 'Oasis', category: 'Fantasy' },
  { name: 'Slum', category: 'Fantasy' },
  { name: 'Mountain Village', category: 'Fantasy' },
  { name: 'Nomad Camp', category: 'Fantasy' },
  { name: 'Castle', category: 'Fantasy' },
  { name: 'Snow Castle', category: 'Fantasy' },
  { name: 'Demon Castle', category: 'Fantasy' },
  { name: 'Fortress', category: 'Fantasy' },
  { name: 'Snow Fortress', category: 'Fantasy' },
  { name: 'Forest', category: 'Fantasy' },
  { name: 'Ruins', category: 'Fantasy' },
  { name: 'Deserted Meadow', category: 'Fantasy' },
  { name: 'Deserted Desert', category: 'Fantasy' },
  { name: 'Forest of Decay', category: 'Fantasy' },
  { name: 'Lost Forest', category: 'Fantasy' },
  { name: 'Swamp', category: 'Fantasy' },
  { name: 'Seacoast', category: 'Fantasy' },
  { name: 'Waterfall Forest', category: 'Fantasy' },
  { name: 'House 1', category: 'Fantasy' },
  { name: 'House 2', category: 'Fantasy' },
  { name: 'Mansion', category: 'Fantasy' },
  { name: 'Village House 1F', category: 'Fantasy' },
  { name: 'Village House 2F', category: 'Fantasy' },
  { name: 'Abandoned House', category: 'Fantasy' },
  { name: 'Weapon Shop', category: 'Fantasy' },
  { name: 'Armor Shop', category: 'Fantasy' },
  { name: 'Item Shop', category: 'Fantasy' },
  { name: 'Inn 1F', category: 'Fantasy' },
  { name: 'Inn 2F', category: 'Fantasy' },
  { name: 'Castle 1F', category: 'Fantasy' },
  { name: 'Castle 2F', category: 'Fantasy' },
  { name: 'Castle 3F', category: 'Fantasy' },
  { name: 'Demon Castle 1F', category: 'Fantasy' },
  { name: 'Demon Castle 2', category: 'Fantasy' },
  { name: 'Demon Castle 3', category: 'Fantasy' },
  { name: 'Hall of Transference', category: 'Fantasy' },
  { name: 'Tower 1F', category: 'Fantasy' },
  { name: 'Stone Cave', category: 'Fantasy' },
  { name: 'Ice Cave', category: 'Fantasy' },
  { name: 'Cursed Cave', category: 'Fantasy' },
  { name: 'Lava Cave', category: 'Fantasy' },
  { name: 'Small Town', category: 'Cyberpunk' },
  { name: 'Big City', category: 'Cyberpunk' },
  { name: 'Trading City', category: 'Cyberpunk' },
  { name: 'Slum', category: 'Cyberpunk' },
  { name: 'Underground Town', category: 'Cyberpunk' },
  { name: 'Floating City', category: 'Cyberpunk' },
  { name: 'Shop District', category: 'Cyberpunk' },
  { name: 'Downtown', category: 'Cyberpunk' },
  { name: 'Factory', category: 'Cyberpunk' },
  { name: 'Power Plant', category: 'Cyberpunk' },
  { name: 'Military Base', category: 'Cyberpunk' },
  { name: 'Business District', category: 'Cyberpunk' },
  { name: 'School', category: 'Cyberpunk' },
  { name: 'Transport Base', category: 'Cyberpunk' },
  { name: 'Labratory Facility', category: 'Cyberpunk' },
  { name: 'Harbor', category: 'Cyberpunk' },
  { name: 'Abandoned School', category: 'Cyberpunk' },
  { name: 'Past Battlefield', category: 'Cyberpunk' },
  { name: 'Market', category: 'Cyberpunk' },
  { name: 'Ancient Ruins', category: 'Cyberpunk' },
  { name: 'Transport Route', category: 'Cyberpunk' },
  { name: 'Suburbs', category: 'Cyberpunk' },
  { name: 'Park', category: 'Cyberpunk' },
  { name: 'Hospital', category: 'Cyberpunk' },
  { name: 'House 1', category: 'Cyberpunk' },
  { name: 'House 2', category: 'Cyberpunk' },
  { name: 'Big House 1F', category: 'Cyberpunk' },
  { name: 'Big House 2F', category: 'Cyberpunk' },
  { name: 'Weapon Shop', category: 'Cyberpunk' },
  { name: 'Armor Shop', category: 'Cyberpunk' },
  { name: 'Item Shop', category: 'Cyberpunk' },
  { name: 'Hotel 1F', category: 'Cyberpunk' },
  { name: 'Hotel 2F', category: 'Cyberpunk' },
  { name: 'Office 1F', category: 'Cyberpunk' },
  { name: 'Office 2F', category: 'Cyberpunk' },
  { name: 'School Hall', category: 'Cyberpunk' },
  { name: 'School Classroom', category: 'Cyberpunk' },
  { name: 'Run-down House', category: 'Cyberpunk' },
  { name: 'Sewer', category: 'Cyberpunk' },
  { name: 'Factory', category: 'Cyberpunk' },
  { name: 'Computer Room', category: 'Cyberpunk' },
  { name: 'Military Base', category: 'Cyberpunk' },
  { name: 'Garage', category: 'Cyberpunk' },
  { name: 'Lab Room', category: 'Cyberpunk' },
  { name: 'Space Station', category: 'Cyberpunk' },
  { name: 'Ancient Ruins', category: 'Cyberpunk' },
  { name: 'Base Interior', category: 'Cyberpunk' },
  { name: 'Sewer Cave', category: 'Cyberpunk' },
  { name: 'Casino', category: 'Cyberpunk' },
  { name: 'Hospital', category: 'Cyberpunk' },
];

/** Big-endian uint32 읽기 */
function readUInt32BE(buf: Buffer, offset: number): number {
  return buf.readUInt32BE(offset);
}

/** Big-endian uint16 읽기 */
function readUInt16BE(buf: Buffer, offset: number): number {
  return buf.readUInt16BE(offset);
}

/** UTF-16BE로 인코딩된 이름을 바이너리에서 검색 */
function findUtf16BE(buf: Buffer, name: string, start: number, end: number): number {
  const nameBE = Buffer.alloc(name.length * 2);
  for (let i = 0; i < name.length; i++) nameBE.writeUInt16BE(name.charCodeAt(i), i * 2);
  for (let i = start; i < Math.min(end, buf.length - nameBE.length); i++) {
    if (buf.compare(nameBE, 0, nameBE.length, i, i + nameBE.length) === 0) {
      const ns = i - 6;
      if (buf.readUInt16BE(ns) === name.length) return ns;
    }
  }
  return -1;
}

/** name table에서 이름 읽기 */
function readNameAt(buf: Buffer, nameBase: number, nameOff: number): string | null {
  const abs = nameBase + nameOff;
  if (abs + 6 >= buf.length) return null;
  const len = buf.readUInt16BE(abs);
  if (len < 1 || len > 30 || abs + 6 + len * 2 > buf.length) return null;
  const nb = Buffer.from(buf.subarray(abs + 6, abs + 6 + len * 2));
  for (let j = 0; j < nb.length; j += 2) { const t = nb[j]; nb[j] = nb[j + 1]; nb[j + 1] = t; }
  return nb.toString('utf16le');
}

class SampleMapExtractor {
  private mapCache: Map<number, Record<string, unknown>> | null = null;
  private previewCache: Map<number, Buffer> | null = null;
  private binaryPath: string | null = null;

  /** macOS에서 RPG Maker MV 바이너리 경로 찾기 */
  findBinaryPath(): string | null {
    const steamPaths = [
      path.join(process.env.HOME || '', 'Library/Application Support/Steam/steamapps/common/RPG Maker MV/RPG Maker MV.app/Contents/MacOS/RPG Maker MV'),
    ];
    for (const p of steamPaths) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  /** 바이너리 경로 설정 */
  setBinaryPath(p: string): void {
    this.binaryPath = p;
    this.mapCache = null;
    this.previewCache = null;
  }

  /** Qt 리소스 구조 찾기: tree_base, name_base, data_base */
  private findResourceStructure(buf: Buffer): { treeBase: number; nameBase: number; dataBase: number } | null {
    // Step 1: 'Map001.json' UTF-16BE 검색으로 name table 영역 특정
    const map001pos = findUtf16BE(buf, 'Map001.json', 9000000, 10000000);
    if (map001pos === -1) return null;

    // Step 2: treeBase 찾기 - root directory entry 패턴 검색
    // root: nameOff=0(4) + flags=0x02(2) + childCount=1(4) + childOffset=1(4) = 14 bytes
    // child[1]: nameOff=0(4) + flags=0x02(2) + childCount=208(4) + childOffset=2(4)
    let treeBase = -1;
    for (let i = map001pos - 10000; i < map001pos; i++) {
      if (buf.readUInt32BE(i) === 0 && buf.readUInt16BE(i + 4) === 2) {
        const cc = buf.readUInt32BE(i + 6);
        const co = buf.readUInt32BE(i + 10);
        if (cc === 1 && co === 1) {
          // Verify next entry is also a directory with ~208 children
          const next = i + 14;
          if (buf.readUInt16BE(next + 4) === 2) {
            const cc2 = buf.readUInt32BE(next + 6);
            if (cc2 >= 200 && cc2 <= 220) {
              treeBase = i;
              break;
            }
          }
        }
      }
    }
    if (treeBase === -1) return null;

    // Step 3: nameBase 브루트포스 - tree 엔트리들의 nameOff가 알려진 이름을 가리키도록
    // 모든 Map###.json/png name entry 위치 수집
    const knownNames = new Set<number>();
    for (let mapNum = 1; mapNum <= 104; mapNum++) {
      for (const ext of ['json', 'png']) {
        const pos = findUtf16BE(buf, `Map${String(mapNum).padStart(3, '0')}.${ext}`, map001pos - 5000, map001pos + 8000);
        if (pos !== -1) knownNames.add(pos);
      }
    }

    let nameBase = -1;
    let bestCount = 0;
    for (let nb = map001pos - 5000; nb <= map001pos; nb++) {
      let count = 0;
      for (let idx = 2; idx < 210; idx++) {
        const nameOff = buf.readUInt32BE(treeBase + idx * 14);
        if (knownNames.has(nb + nameOff)) count++;
      }
      if (count > bestCount) {
        bestCount = count;
        nameBase = nb;
        if (count >= 208) break;
      }
    }
    if (nameBase === -1 || bestCount < 100) return null;

    // Step 4: dataBase 찾기 - Map099.json의 dataOff 사용
    // Map099.json은 가장 작은 dataOff를 가지므로 dataBase 검색 범위가 좁음
    const map099pos = findUtf16BE(buf, 'Map099.json', nameBase, nameBase + 8000);
    if (map099pos === -1) return null;
    const map099nameOff = map099pos - nameBase;

    let map099dataOff = -1;
    for (let idx = 2; idx < 210; idx++) {
      if (buf.readUInt32BE(treeBase + idx * 14) === map099nameOff) {
        map099dataOff = buf.readUInt32BE(treeBase + idx * 14 + 10);
        break;
      }
    }
    if (map099dataOff === -1) return null;

    let dataBase = -1;
    for (let db = nameBase; db < nameBase + 500000; db += 4) {
      const absPos = db + map099dataOff;
      if (absPos + 12 >= buf.length) continue;
      const totalSize = buf.readUInt32BE(absPos);
      if (totalSize < 50 || totalSize > 500000) continue;
      if (buf[absPos + 8] !== 0x78) continue;
      try {
        const dec = zlib.inflateSync(buf.subarray(absPos + 8, absPos + 8 + totalSize));
        if (dec.toString('utf-8').includes('"tilesetId"')) {
          // 다른 파일로 교차 검증
          let verified = 0;
          for (let idx = 2; idx < 210 && verified < 5; idx++) {
            const doff = buf.readUInt32BE(treeBase + idx * 14 + 10);
            const abs2 = db + doff;
            if (abs2 + 12 >= buf.length) continue;
            const ts2 = buf.readUInt32BE(abs2);
            if (ts2 < 50 || ts2 > 500000) continue;
            if (buf[abs2 + 8] === 0x78) {
              try {
                const d2 = zlib.inflateSync(buf.subarray(abs2 + 8, abs2 + 8 + ts2));
                if (d2.toString('utf-8').includes('"tilesetId"')) verified++;
              } catch { /* ignore */ }
            }
          }
          if (verified >= 3) { dataBase = db; break; }
        }
      } catch { /* ignore */ }
    }
    if (dataBase === -1) return null;

    return { treeBase, nameBase, dataBase };
  }

  /** 바이너리에서 모든 샘플 맵 + 프리뷰 PNG 추출 (메모리 캐시) */
  private extractFromBinary(): boolean {
    const binPath = this.binaryPath || this.findBinaryPath();
    if (!binPath) return false;
    this.binaryPath = binPath;

    let buf: Buffer;
    try {
      buf = fs.readFileSync(binPath);
    } catch {
      return false;
    }

    const structure = this.findResourceStructure(buf);
    if (!structure) return false;

    const { treeBase, nameBase, dataBase } = structure;

    // sequential data entry 테이블 구축
    const seqEntries: Array<{ absPos: number; doff: number; type: 'json' | 'png' | 'other' }> = [];
    let pos = dataBase;
    while (pos < dataBase + 5000000 && pos + 4 < buf.length) {
      const totalSize = readUInt32BE(buf, pos);
      if (totalSize === 0 || totalSize > 2000000) break;

      const raw = this.readResourceAt(buf, pos);
      let type: 'json' | 'png' | 'other' = 'other';
      if (raw[0] === 0x89 && raw[1] === 0x50) {
        type = 'png';
      } else {
        try {
          const text = raw.toString('utf-8');
          if (text.includes('"tilesetId"')) type = 'json';
        } catch { /* ignore */ }
      }

      seqEntries.push({ absPos: pos, doff: pos - dataBase, type });
      pos += 4 + totalSize;
    }

    const doffToIdx = new Map<number, number>();
    seqEntries.forEach((e, i) => doffToIdx.set(e.doff, i));

    const maps = new Map<number, Record<string, unknown>>();
    const previews = new Map<number, Buffer>();

    for (let mapNum = 1; mapNum <= 104; mapNum++) {
      const mapFileName = `Map${String(mapNum).padStart(3, '0')}.json`;
      const pngFileName = `Map${String(mapNum).padStart(3, '0')}.png`;

      const nameOffset = this.findNameOffset(buf, nameBase, mapFileName);
      if (nameOffset === null) continue;

      const dataOffset = this.findDataOffset(buf, treeBase, nameOffset);

      if (dataOffset !== null) {
        const absPos = dataBase + dataOffset;
        const raw = this.readResourceAt(buf, absPos);

        if (raw[0] !== 0x89) {
          // JSON 데이터
          try {
            maps.set(mapNum, JSON.parse(raw.toString('utf-8')));
          } catch { /* ignore */ }
        } else {
          // tree가 PNG를 가리킴 → 인접 entry에서 JSON 찾기
          const idx = doffToIdx.get(dataOffset);
          if (idx !== undefined) {
            for (const adj of [1, -1, 2, -2]) {
              const adjIdx = idx + adj;
              if (adjIdx >= 0 && adjIdx < seqEntries.length && seqEntries[adjIdx].type === 'json') {
                try {
                  const adjRaw = this.readResourceAt(buf, seqEntries[adjIdx].absPos);
                  maps.set(mapNum, JSON.parse(adjRaw.toString('utf-8')));
                  break;
                } catch { /* ignore */ }
              }
            }
          }
        }
      }

      // PNG 프리뷰 추출
      const pngNameOffset = this.findNameOffset(buf, nameBase, pngFileName);
      if (pngNameOffset !== null) {
        const pngDataOffset = this.findDataOffset(buf, treeBase, pngNameOffset);
        if (pngDataOffset !== null) {
          const pngAbsPos = dataBase + pngDataOffset;
          const pngRaw = this.readResourceAt(buf, pngAbsPos);
          if (pngRaw[0] === 0x89 && pngRaw[1] === 0x50) {
            previews.set(mapNum, Buffer.from(pngRaw));
          }
        }
      }
    }

    if (maps.size > 0) {
      this.mapCache = maps;
      this.previewCache = previews;
      return true;
    }
    return false;
  }

  /** 데이터 엔트리 읽기 (압축/비압축 자동 감지) */
  private readResourceAt(buf: Buffer, absPos: number): Buffer {
    const totalSize = readUInt32BE(buf, absPos);

    if (totalSize > 8 && absPos + 8 < buf.length) {
      const magic = buf[absPos + 8];
      const next = buf[absPos + 9];
      if (magic === 0x78 && (next === 0x01 || next === 0x5e || next === 0x9c || next === 0xda)) {
        try {
          return zlib.inflateSync(buf.subarray(absPos + 8, absPos + 8 + totalSize));
        } catch { /* fall through */ }
      }
    }

    return buf.subarray(absPos + 4, absPos + 4 + totalSize);
  }

  /** name table에서 이름의 name_offset 찾기 */
  private findNameOffset(buf: Buffer, nameBase: number, name: string): number | null {
    const pos = findUtf16BE(buf, name, nameBase, nameBase + 8000);
    return pos !== -1 ? pos - nameBase : null;
  }

  /** tree에서 name_offset에 해당하는 data_offset 찾기 */
  private findDataOffset(buf: Buffer, treeBase: number, nameOffset: number): number | null {
    for (let idx = 2; idx < 210; idx++) {
      const toff = treeBase + idx * 14;
      if (readUInt32BE(buf, toff) === nameOffset) {
        const flags = readUInt16BE(buf, toff + 4);
        if (!(flags & 0x02)) {
          return readUInt32BE(buf, toff + 10);
        }
      }
    }
    return null;
  }

  /** 캐시 확보 (필요 시 바이너리에서 추출) */
  private ensureCache(): boolean {
    if (this.mapCache) return true;
    return this.extractFromBinary();
  }

  /** 맵 목록 반환 */
  getMapList(): Array<{ id: number; name: string; category: string; width?: number; height?: number; tilesetId?: number }> | null {
    if (!this.ensureCache()) return null;
    const maps = this.mapCache!;

    return MAP_NAMES.map((info, index) => {
      const mapNum = index + 1;
      const mapData = maps.get(mapNum);
      return {
        id: mapNum,
        name: info.name,
        category: info.category,
        width: mapData ? (mapData as any).width : undefined,
        height: mapData ? (mapData as any).height : undefined,
        tilesetId: mapData ? (mapData as any).tilesetId : undefined,
      };
    });
  }

  /** 특정 맵 데이터 반환 */
  getMapData(mapId: number): Record<string, unknown> | null {
    if (!this.ensureCache()) return null;
    return this.mapCache!.get(mapId) || null;
  }

  /** 특정 맵 프리뷰 PNG 반환 */
  getPreview(mapId: number): Buffer | null {
    if (!this.ensureCache()) return null;
    return this.previewCache?.get(mapId) || null;
  }

  /** 상태 조회 */
  getStatus(): { available: boolean; count: number; detectedBinaryPath: string | null } {
    const available = this.ensureCache();
    return {
      available,
      count: available ? this.mapCache!.size : 0,
      detectedBinaryPath: this.binaryPath || this.findBinaryPath(),
    };
  }

  /** RPG Maker MV BaseResource/img 경로 찾기 */
  findBaseResourceImgPath(): string | null {
    const candidates = [
      path.join(process.env.HOME || '', 'Library/Application Support/Steam/steamapps/common/RPG Maker MV/dlc/BaseResource/img'),
      path.join(process.env.HOME || '', 'Library/Application Support/Steam/steamapps/common/RPG Maker MV/dlc/BaseResource_Compressed/img'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  /**
   * BaseResource/img 에서 프로젝트 img 폴더로 누락된 파일만 복사
   * @returns 복사된 파일 경로 목록
   */
  copyMissingResources(projectImgDir: string): string[] {
    const srcBase = this.findBaseResourceImgPath();
    if (!srcBase) return [];

    const copied: string[] = [];

    const copyDir = (srcDir: string, dstDir: string) => {
      if (!fs.existsSync(srcDir)) return;
      const entries = fs.readdirSync(srcDir, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const dstPath = path.join(dstDir, entry.name);
        if (entry.isDirectory()) {
          copyDir(srcPath, dstPath);
        } else {
          // 이미 존재하면 스킵 (webp 변환본도 있으면 스킵)
          const ext = path.extname(entry.name).toLowerCase();
          const altExt = ext === '.png' ? '.webp' : ext === '.webp' ? '.png' : '';
          const altPath = altExt ? dstPath.slice(0, -ext.length) + altExt : '';
          if (fs.existsSync(dstPath) || (altPath && fs.existsSync(altPath))) continue;
          fs.mkdirSync(dstDir, { recursive: true });
          fs.copyFileSync(srcPath, dstPath);
          copied.push(path.relative(projectImgDir, dstPath));
        }
      }
    };

    copyDir(srcBase, projectImgDir);
    return copied;
  }

  /** 캐시 초기화 */
  clearCache(): void {
    this.mapCache = null;
    this.previewCache = null;
  }
}

export default new SampleMapExtractor();
