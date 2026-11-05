import 'server-only';
import zlib from 'zlib';

/**
 * 외부 무거운 의존성 없이 표준 OpenXML 규격의 순수 .xlsx 파일을 생성하는 빌더
 * - 전화번호 열: t="inlineStr" 로 저장하여 Excel에서 010 앞자리 0이 절대 잘리지 않고 텍스트로 보존됨
 */

function crc32(buf: Buffer): number {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return ~crc >>> 0;
}

interface ZipEntry {
  path: string;
  data: Buffer;
}

function createZipBuffer(entries: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const pathBuf = Buffer.from(entry.path, 'utf8');
    const uncompressedData = entry.data;
    const compressedData = zlib.deflateRawSync(uncompressedData);
    const crc = crc32(uncompressedData);

    // Local file header (30 bytes + path length)
    const localHeader = Buffer.alloc(30 + pathBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4);        // version needed (2.0)
    localHeader.writeUInt16LE(0, 6);         // flags
    localHeader.writeUInt16LE(8, 8);         // compression (deflate)
    localHeader.writeUInt16LE(0, 10);        // mod time
    localHeader.writeUInt16LE(0, 12);        // mod date
    localHeader.writeUInt32LE(crc, 14);      // crc-32
    localHeader.writeUInt32LE(compressedData.length, 18); // compressed size
    localHeader.writeUInt32LE(uncompressedData.length, 22); // uncompressed size
    localHeader.writeUInt16LE(pathBuf.length, 26); // file name length
    localHeader.writeUInt16LE(0, 28);        // extra field length
    pathBuf.copy(localHeader, 30);

    localHeaders.push(localHeader, compressedData);

    // Central directory header (46 bytes + path length)
    const centralHeader = Buffer.alloc(46 + pathBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4);        // version made by
    centralHeader.writeUInt16LE(20, 6);        // version needed
    centralHeader.writeUInt16LE(0, 8);         // flags
    centralHeader.writeUInt16LE(8, 10);        // compression
    centralHeader.writeUInt16LE(0, 12);        // mod time
    centralHeader.writeUInt16LE(0, 14);        // mod date
    centralHeader.writeUInt32LE(crc, 16);      // crc-32
    centralHeader.writeUInt32LE(compressedData.length, 20); // compressed size
    centralHeader.writeUInt32LE(uncompressedData.length, 24); // uncompressed size
    centralHeader.writeUInt16LE(pathBuf.length, 28); // file name length
    centralHeader.writeUInt16LE(0, 30);        // extra field length
    centralHeader.writeUInt16LE(0, 32);        // file comment length
    centralHeader.writeUInt16LE(0, 34);        // disk number start
    centralHeader.writeUInt16LE(0, 36);        // internal file attributes
    centralHeader.writeUInt32LE(0, 38);        // external file attributes
    centralHeader.writeUInt32LE(offset, 42);   // relative offset of local header
    pathBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);

    offset += localHeader.length + compressedData.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const ch of centralHeaders) {
    centralDirSize += ch.length;
  }

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4);          // disk number
  eocd.writeUInt16LE(0, 6);          // start disk
  eocd.writeUInt16LE(entries.length, 8); // total entries this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralDirSize, 12); // size of central dir
  eocd.writeUInt32LE(centralDirOffset, 16); // offset of central dir
  eocd.writeUInt16LE(0, 20);         // comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

function escapeXml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getColumnLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export interface XlsxSheetData {
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  sheetName?: string;
}

/**
 * 테이블 데이터를 완전한 OpenXML .xlsx 바이너리 버퍼로 변환
 */
export function buildXlsx(data: XlsxSheetData): Buffer {
  const { headers, rows, sheetName = '마케팅동의명단' } = data;

  // 1. sheet1.xml 생성
  let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  sheetXml += `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n`;
  
  // 컬럼 너비 설정 (cols)
  sheetXml += `<cols>\n`;
  headers.forEach((h, i) => {
    // 헤더 및 일반 텍스트 길이에 맞춘 적정 폭 지정
    let width = Math.max(12, h.length * 2.2);
    if (i === 0) width = 38; // 회원ID (UUID)
    if (i === 1) width = 16; // 이름
    if (i === 2) width = 28; // 이메일
    if (i === 3) width = 18; // 연락처
    if (i === 10) width = 22; // 최종처리시각
    sheetXml += `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>\n`;
  });
  sheetXml += `</cols>\n`;

  sheetXml += `<sheetData>\n`;

  // 헤더 행 (s="1" 스타일: 파란색 배경, 굵은 흰색 폰트)
  sheetXml += `<row r="1" ht="28" customHeight="1">\n`;
  headers.forEach((header, colIdx) => {
    const cellRef = `${getColumnLetter(colIdx)}1`;
    sheetXml += `<c r="${cellRef}" s="1" t="inlineStr"><is><t>${escapeXml(header)}</t></is></c>\n`;
  });
  sheetXml += `</row>\n`;

  // 데이터 행들 (s="2" 일반 텍스트, s="3" 가운데 정렬)
  rows.forEach((row, rowIdx) => {
    const rowNum = rowIdx + 2;
    sheetXml += `<row r="${rowNum}" ht="20" customHeight="1">\n`;
    row.forEach((cellVal, colIdx) => {
      const cellRef = `${getColumnLetter(colIdx)}${rowNum}`;
      const escaped = escapeXml(cellVal);
      
      // 전화번호 열(colIdx === 3), UUID(colIdx === 0) 등은 무조건 인라인 텍스트(inlineStr)로 출력
      // 이렇게 하면 엑셀에서 010 앞자리가 절대 숫자로 자동 변환되지 않고 온전하게 유지됨!
      sheetXml += `<c r="${cellRef}" s="2" t="inlineStr"><is><t>${escaped}</t></is></c>\n`;
    });
    sheetXml += `</row>\n`;
  });

  sheetXml += `</sheetData>\n`;
  sheetXml += `</worksheet>`;

  // 2. styles.xml 생성 (헤더 디자인 스타일)
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="10"/><color rgb="FF1F2937"/><name val="맑은 고딕"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E3A8A"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/></border>
    <border>
      <left style="thin"><color rgb="FFE5E7EB"/></left>
      <right style="thin"><color rgb="FFE5E7EB"/></right>
      <top style="thin"><color rgb="FFE5E7EB"/></top>
      <bottom style="thin"><color rgb="FFE5E7EB"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">
      <alignment vertical="center"/>
    </xf>
  </cellXfs>
</styleSheet>`;

  // 3. [Content_Types].xml
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  // 4. _rels/.rels
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  // 5. xl/_rels/workbook.xml.rels
  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  // 6. xl/workbook.xml
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const entries: ZipEntry[] = [
    { path: '[Content_Types].xml', data: Buffer.from(contentTypesXml, 'utf8') },
    { path: '_rels/.rels', data: Buffer.from(rootRelsXml, 'utf8') },
    { path: 'xl/_rels/workbook.xml.rels', data: Buffer.from(workbookRelsXml, 'utf8') },
    { path: 'xl/workbook.xml', data: Buffer.from(workbookXml, 'utf8') },
    { path: 'xl/styles.xml', data: Buffer.from(stylesXml, 'utf8') },
    { path: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheetXml, 'utf8') },
  ];

  return createZipBuffer(entries);
}
