import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

/**
 * RPG Maker MV 바이너리에서 샘플 맵 데이터를 추출하는 서비스
 *
 * RPG Maker MV는 Qt 기반 에디터로, 샘플 맵이 바이너리 내 Qt 리소스로 내장되어 있음.
 * Qt 리소스 형식: tree table + name table + data table
 * - name table: len(2, BE) + hash(4, BE) + UTF-16BE string
 * - tree entry: name_offset(4, BE) + flags(2, BE) + country(2) + lang(2) + data_offset(4, BE)
 * - data entry: total_size(4, BE) + [uncomp_size(4, BE) + zlib_data] or raw_data
 */

interface SampleMap {
  name: string;
  category: 'Fantasy' | 'Cyberpunk';
  data: Record<string, unknown>;
}

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

/** Qt 리소스 이름 해시 함수 */
function qtHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 4) + name.charCodeAt(i)) >>> 0;
    const g = h & 0xf0000000;
    h ^= g >>> 23;
    h &= ~g;
    h = h >>> 0;
  }
  return h;
}

/** Big-endian uint32 읽기 */
function readUInt32BE(buf: Buffer, offset: number): number {
  return buf.readUInt32BE(offset);
}

/** Big-endian uint16 읽기 */
function readUInt16BE(buf: Buffer, offset: number): number {
  return buf.readUInt16BE(offset);
}

class SampleMapExtractor {
  private cache: Map<number, Record<string, unknown>> | null = null;
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

  /** Qt 리소스 구조 찾기: tree_base, name_base, data_base */
  private findResourceStructure(buf: Buffer): { treeBase: number; nameBase: number; dataBase: number } | null {
    // 1. 'maps' 문자열을 UTF-16 BE로 검색하여 name table 위치 찾기
    const mapsUtf16 = Buffer.from([0x00, 0x6d, 0x00, 0x61, 0x00, 0x70, 0x00, 0x73]); // 'maps'
    let nameBase = -1;
    let mapsOffset = -1;

    for (let i = 9000000; i < Math.min(buf.length, 10000000); i++) {
      if (buf[i] === 0x00 && buf[i + 1] === 0x6d &&
          buf.compare(mapsUtf16, 0, 8, i, i + 8) === 0) {
        // name entry: len(2) + hash(4) + data
        const nameStart = i - 6;
        const len = readUInt16BE(buf, nameStart);
        if (len === 4) {
          const hash = readUInt32BE(buf, nameStart + 2);
          if (hash === qtHash('maps')) {
            mapsOffset = nameStart;
            break;
          }
        }
      }
    }

    if (mapsOffset === -1) return null;

    // name_base 찾기: 'maps' 앞에 있는 '1' 엔트리
    // 'maps' 앞으로 스캔하여 name table 시작점 찾기
    for (let i = mapsOffset - 100; i < mapsOffset; i++) {
      const len = readUInt16BE(buf, i);
      if (len === 1) {
        const hash = readUInt32BE(buf, i + 2);
        if (hash === qtHash('1')) {
          const char = readUInt16BE(buf, i + 6);
          if (char === 0x0031) { // '1'
            nameBase = i;
            break;
          }
        }
      }
    }

    if (nameBase === -1) return null;

    // 2. tree_base 찾기: name_base 앞에서 root entry 검색
    // root entry: name_off=0(4) + flags=2(2) + count=1(4) + first_child=1(4) = 14 bytes
    const rootPattern = Buffer.from([0, 0, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 1]);
    let treeBase = -1;

    for (let i = nameBase - 10000; i < nameBase; i++) {
      if (buf.compare(rootPattern, 0, 14, i, i + 14) === 0) {
        // Verify child[1] entry
        const child1 = i + 14;
        const childNameOff = readUInt32BE(buf, child1);
        const childFlags = readUInt16BE(buf, child1 + 4);
        if (childNameOff === 0 && childFlags === 2) {
          const childCount = readUInt32BE(buf, child1 + 6);
          if (childCount > 100 && childCount < 300) {
            treeBase = i;
            break;
          }
        }
      }
    }

    if (treeBase === -1) return null;

    // 3. data_base 찾기: name_base 뒤에 데이터 블록 시작
    // data entries는 name table 끝 이후에 시작
    // name table은 약 6000 bytes
    const dataSearchStart = nameBase + 5000;
    let dataBase = -1;

    // Map099.json의 data_offset(가장 작은 값들 중 하나)으로 data_base 추정
    // name_off for Map099.json을 찾고, tree에서 data_offset 확인 후 실제 데이터 위치로 역산
    const map099hash = qtHash('Map099.json');
    const hashBytes = Buffer.alloc(4);
    hashBytes.writeUInt32BE(map099hash);

    let map099nameOff = -1;
    for (let i = nameBase; i < nameBase + 6000; i++) {
      if (buf.readUInt32BE(i) === map099hash) {
        const ns = i - 2;
        const nl = readUInt16BE(buf, ns);
        if (nl === 11) {
          const name = buf.subarray(ns + 6, ns + 6 + nl * 2).swap16().toString('utf16le');
          if (name === 'Map099.json') {
            map099nameOff = ns - nameBase;
            break;
          }
        }
      }
    }

    if (map099nameOff !== -1) {
      // tree에서 해당 name_offset을 가진 entry 찾기
      for (let idx = 2; idx < 210; idx++) {
        const toff = treeBase + idx * 14;
        if (readUInt32BE(buf, toff) === map099nameOff) {
          const flags = readUInt16BE(buf, toff + 4);
          if (!(flags & 0x02)) {
            const dataOff = readUInt32BE(buf, toff + 10);
            // data_base + dataOff = 실제 데이터 시작 위치
            // 실제 데이터에서 zlib magic 검색
            for (let search = dataSearchStart; search < dataSearchStart + 200000; search++) {
              if (buf[search] === 0x78 && (buf[search + 1] === 0x9c || buf[search + 1] === 0x01 || buf[search + 1] === 0xda)) {
                // size(4) + uncomp(4) + zlib 패턴 확인
                const testBase = search - 8 - dataOff;
                if (testBase > 0) {
                  // 검증: 이 base로 다른 알려진 맵도 찾을 수 있는지
                  const testPos = testBase + dataOff;
                  const totalSize = readUInt32BE(buf, testPos);
                  if (totalSize > 100 && totalSize < 100000) {
                    try {
                      const decompressed = zlib.inflateSync(buf.subarray(testPos + 8, testPos + 8 + totalSize));
                      const text = decompressed.toString('utf-8');
                      if (text.includes('"tilesetId"')) {
                        dataBase = testBase;
                        break;
                      }
                    } catch { /* ignore */ }
                  }
                }
              }
            }
            break;
          }
        }
      }
    }

    if (dataBase === -1) return null;

    return { treeBase, nameBase, dataBase };
  }

  /** 바이너리에서 모든 샘플 맵 추출 */
  extractAll(): Map<number, Record<string, unknown>> | null {
    if (this.cache) return this.cache;

    const binPath = this.binaryPath || this.findBinaryPath();
    if (!binPath) return null;
    this.binaryPath = binPath;

    let buf: Buffer;
    try {
      buf = fs.readFileSync(binPath);
    } catch {
      return null;
    }

    const structure = this.findResourceStructure(buf);
    if (!structure) return null;

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

    // 각 맵 추출
    const maps = new Map<number, Record<string, unknown>>();

    for (let mapNum = 1; mapNum <= 104; mapNum++) {
      const mapFileName = `Map${String(mapNum).padStart(3, '0')}.json`;

      // name table에서 hash로 찾기
      const nameOffset = this.findNameOffset(buf, nameBase, mapFileName);
      if (nameOffset === null) continue;

      // tree에서 data_offset 찾기
      const dataOffset = this.findDataOffset(buf, treeBase, nameOffset);

      if (dataOffset !== null) {
        const absPos = dataBase + dataOffset;
        const raw = this.readResourceAt(buf, absPos);

        if (raw[0] !== 0x89) {
          // JSON 데이터
          try {
            const mapData = JSON.parse(raw.toString('utf-8'));
            maps.set(mapNum, mapData);
            continue;
          } catch { /* fall through */ }
        }

        // tree가 PNG를 가리킴 → 인접 entry에서 JSON 찾기
        const idx = doffToIdx.get(dataOffset);
        if (idx !== undefined) {
          for (const adj of [1, -1, 2, -2]) {
            const adjIdx = idx + adj;
            if (adjIdx >= 0 && adjIdx < seqEntries.length && seqEntries[adjIdx].type === 'json') {
              try {
                const adjRaw = this.readResourceAt(buf, seqEntries[adjIdx].absPos);
                const mapData = JSON.parse(adjRaw.toString('utf-8'));
                maps.set(mapNum, mapData);
                break;
              } catch { /* ignore */ }
            }
          }
        }
      } else {
        // tree에 없는 경우 (Map029 등) - 미할당 JSON 찾기
        const assignedDoffs = new Set<number>();
        for (const [, entry] of maps) {
          // 이미 할당된 것들은 스킵
        }
        // sequential에서 미할당 JSON 찾기
        for (const entry of seqEntries) {
          if (entry.type === 'json' && !this.isAssignedOffset(buf, treeBase, nameBase, entry.doff, maps.size)) {
            try {
              const raw = this.readResourceAt(buf, entry.absPos);
              const mapData = JSON.parse(raw.toString('utf-8'));
              maps.set(mapNum, mapData);
              break;
            } catch { /* ignore */ }
          }
        }
      }
    }

    this.cache = maps;
    return maps;
  }

  /** 데이터 엔트리 읽기 (압축/비압축 자동 감지) */
  private readResourceAt(buf: Buffer, absPos: number): Buffer {
    const totalSize = readUInt32BE(buf, absPos);

    // 압축 여부 확인: offset+8에 zlib magic
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

  /** name table에서 이름의 name_offset 찾기 (hash 기반) */
  private findNameOffset(buf: Buffer, nameBase: number, name: string): number | null {
    const hash = qtHash(name);

    for (let i = nameBase; i < nameBase + 6000; i++) {
      if (i + 4 <= buf.length && buf.readUInt32BE(i) === hash) {
        const nameStart = i - 2;
        const nameLen = readUInt16BE(buf, nameStart);
        if (nameLen === name.length) {
          const nameBuf = buf.subarray(nameStart + 6, nameStart + 6 + nameLen * 2);
          const swapped = Buffer.from(nameBuf);
          for (let j = 0; j < swapped.length; j += 2) {
            const tmp = swapped[j];
            swapped[j] = swapped[j + 1];
            swapped[j + 1] = tmp;
          }
          const storedName = swapped.toString('utf16le');
          if (storedName === name) {
            return nameStart - nameBase;
          }
        }
      }
    }
    return null;
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

  /** 특정 data_offset이 다른 맵에 의해 이미 사용되었는지 확인 (Map029 처리용) */
  private isAssignedOffset(buf: Buffer, treeBase: number, nameBase: number, doff: number, _currentCount: number): boolean {
    // tree의 모든 file entry에서 이 doff를 참조하는지, 또는 인접한 entry로 사용되는지 확인
    for (let idx = 2; idx < 210; idx++) {
      const toff = treeBase + idx * 14;
      const flags = readUInt16BE(buf, toff + 4);
      if (flags & 0x02) continue;
      const tdo = readUInt32BE(buf, toff + 10);
      if (tdo === doff) return true;
    }
    return false;
  }

  /** 맵 목록 반환 */
  getMapList(): Array<{ id: number; name: string; category: string; width?: number; height?: number; tilesetId?: number }> | null {
    const maps = this.extractAll();
    if (!maps) return null;

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
    const maps = this.extractAll();
    if (!maps) return null;
    return maps.get(mapId) || null;
  }

  /** 캐시 초기화 */
  clearCache(): void {
    this.cache = null;
  }

  /** 바이너리 사용 가능 여부 */
  isAvailable(): boolean {
    return this.findBinaryPath() !== null;
  }
}

export default new SampleMapExtractor();
