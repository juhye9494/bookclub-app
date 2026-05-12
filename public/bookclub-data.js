// ============================================================
// Bookclub Data Layer
// ============================================================
// Mock data layer using localStorage. Replace these functions
// with real API calls when backend is connected.
//
// Data shape:
//   cycle = { id, label, startDate, endDate, status, books: [book] }
//   book  = { id, title, author, genre, cover, tags[], desc, lecture? }
//   lecture = { desc, perks[] } | null
// ============================================================

const STORAGE_KEY = 'bookclub_cycles_v1';
const CURRENT_KEY = 'bookclub_current_cycle_v1';
const AUTH_KEY = 'bookclub_admin_auth_v1';

// Demo password — replace with real auth later
const DEMO_PASSWORD = 'se-admin';

// ---- Seed data (first run) ----
const SEED_CYCLES = [
  {
    id: 'cycle-2026-h1',
    label: '2026 상반기',
    startDate: '2026-01-01',
    endDate: '2026-06-30',
    status: 'active',
    books: [
      { id: 'b1', title: 'CES 2026', author: '한국경제신문 × The Miilk', genre: '테크 · 트렌드',
        cover: 'uploads/041f16811654291628de9f342681dbb1.png',
        tags: ['IT · 기술', 'AI · 혁신'],
        desc: 'AI 리더십부터 로봇공학, 양자컴퓨터까지 — 세계 최대 가전·IT 박람회 CES 2026의 모든 것을 한 권에 담았습니다.',
        lecture: null },
      { id: 'b2', title: '정리로 시작하는 인생 리셋', author: '정경자 지음', genre: '라이프스타일',
        cover: 'uploads/ce7fe03d39caf9b1708cba7e5e7faa83.jpg',
        tags: ['정리 · 수납', '라이프스타일', '강연 포함'],
        desc: '10만 가구의 변화를 이끌어온 정리 전문가 정경자의 인생 정리 바이블.',
        lecture: { desc: '저자 정경자가 직접 진행하는 "공간 정리로 인생 바꾸기" 온라인 강연.', perks: ['60분 실전 정리 강의', '체크리스트 PDF', '1:1 Q&A'] } },
      { id: 'b3', title: '프로젝트리츠로 일하는 법', author: '이종원 외 4인', genre: '경제 · 비즈니스',
        cover: 'uploads/fd38af558278f9de5a15d0ab05aaf85e.jpg',
        tags: ['부동산', '리츠', '강연 포함'],
        desc: '리츠 전문가 5인이 집필한 국내 최초 리츠 종합 안내서.',
        lecture: { desc: '저자 5인 릴레이 온라인 강연.', perks: ['총 3회 릴레이 강연', '리츠 체크리스트 PDF', '실무 사례집'] } },
      { id: 'b4', title: '퍼지키즈', author: '한지우 지음', genre: '교육 · 자녀교육',
        cover: 'uploads/d1bae06b6d279117f4aeacbd777accbb.jpg',
        tags: ['AI 교육', '인문학', '강연 포함'],
        desc: 'AI 시대의 새로운 인재상을 제시하는 혁신적 교육서.',
        lecture: { desc: '저자 한지우의 학부모 특강.', perks: ['75분 온라인 특강', '교육 로드맵 PDF', '커뮤니티 초대'] } },
      { id: 'b5', title: '덜 명청하게 살기 위한 최소한의 철학', author: '라르스 스벤젠', genre: '철학 · 인문',
        cover: 'uploads/775c4d1d6677a6abd5ce990900c13cb0.jpg',
        tags: ['철학', '인문', '번역서'],
        desc: '북유럽 철학자 라르스 스벤젠의 신작.',
        lecture: null },
      { id: 'b6', title: '사이클 투자 법칙', author: '조윤남 지음', genre: '경제 · 투자',
        cover: 'uploads/cd52ee5bff3ec53eb02c5a0e4fce2526.jpg',
        tags: ['주식', '투자', '강연 포함'],
        desc: '주식시장 슈퍼사이클에 올라타는 실전 매매법.',
        lecture: { desc: '저자 조윤남의 투자 강연.', perks: ['90분 심층 강의', '사이클 분석 PDF', '월별 뉴스레터'] } }
    ]
  },
  {
    id: 'cycle-2025-h2',
    label: '2025 하반기',
    startDate: '2025-07-01',
    endDate: '2025-12-31',
    status: 'archived',
    books: [
      { id: 'a1', title: '미라클 모닝 다이어리', author: '할 엘로드', genre: '자기계발', cover: '', tags: ['자기계발', '습관'], desc: '아침 30분이 인생을 바꾸는 실천법.', lecture: null },
      { id: 'a2', title: '세계 경제의 미래', author: '김광석', genre: '경제', cover: '', tags: ['경제', '트렌드', '강연 포함'], desc: '거시경제 전망과 투자 인사이트.', lecture: { desc: '저자 경제 전망 강연.', perks: ['90분 강연'] } },
      { id: 'a3', title: '디지털 트랜스포메이션', author: '오정연', genre: '비즈니스', cover: '', tags: ['DX', 'IT'], desc: '기업의 디지털 전환 실무 가이드.', lecture: null },
      { id: 'a4', title: '심플하게 산다', author: '도미니크 로로', genre: '라이프스타일', cover: '', tags: ['미니멀', '라이프'], desc: '단순한 삶의 기술.', lecture: null }
    ]
  },
  {
    id: 'cycle-2025-h1',
    label: '2025 상반기',
    startDate: '2025-01-01',
    endDate: '2025-06-30',
    status: 'archived',
    books: [
      { id: 'p1', title: '돈의 속성', author: '김승호', genre: '경제 · 투자', cover: '', tags: ['투자', '재테크'], desc: '부의 본질에 대한 통찰.', lecture: null },
      { id: 'p2', title: '아주 작은 습관의 힘', author: '제임스 클리어', genre: '자기계발', cover: '', tags: ['습관', '자기계발', '강연 포함'], desc: '1% 변화의 복리 효과.', lecture: { desc: '습관 형성 워크숍.', perks: ['실전 워크북'] } },
      { id: 'p3', title: '트렌드 코리아 2025', author: '김난도 외', genre: '트렌드', cover: '', tags: ['트렌드', '소비'], desc: '2025년 소비 트렌드 분석.', lecture: null },
      { id: 'p4', title: '클루지', author: '개리 마커스', genre: '심리 · 인문', cover: '', tags: ['뇌과학', '심리'], desc: '인간 뇌의 결함과 가능성.', lecture: null }
    ]
  }
];

// ============================================================
// Storage helpers
// ============================================================

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn('Failed to load cycles', e); }
  // First run: seed
  saveAll(SEED_CYCLES);
  localStorage.setItem(CURRENT_KEY, 'cycle-2026-h1');
  return SEED_CYCLES;
}

function saveAll(cycles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cycles));
}

// ============================================================
// Public API — replace with backend calls later
// ============================================================

window.BookclubData = {
  // ---- Cycles ----
  getAllCycles() {
    return loadAll().sort((a, b) => b.startDate.localeCompare(a.startDate));
  },
  getCurrentCycle() {
    const all = loadAll();
    const currentId = localStorage.getItem(CURRENT_KEY) || all[0]?.id;
    return all.find(c => c.id === currentId) || all[0];
  },
  getCycleById(id) {
    return loadAll().find(c => c.id === id);
  },
  setCurrentCycle(id) {
    localStorage.setItem(CURRENT_KEY, id);
  },
  createCycle(cycle) {
    const all = loadAll();
    if (all.some(c => c.id === cycle.id)) throw new Error('이미 존재하는 사이클 ID입니다.');
    all.push({ ...cycle, books: cycle.books || [] });
    saveAll(all);
    return cycle;
  },
  updateCycle(id, updates) {
    const all = loadAll();
    const idx = all.findIndex(c => c.id === id);
    if (idx < 0) throw new Error('사이클을 찾을 수 없습니다.');
    all[idx] = { ...all[idx], ...updates };
    saveAll(all);
    return all[idx];
  },
  deleteCycle(id) {
    const all = loadAll().filter(c => c.id !== id);
    saveAll(all);
  },

  // ---- Books within a cycle ----
  addBook(cycleId, book) {
    const all = loadAll();
    const cycle = all.find(c => c.id === cycleId);
    if (!cycle) throw new Error('사이클을 찾을 수 없습니다.');
    const newBook = { id: 'b_' + Date.now(), tags: [], lecture: null, ...book };
    cycle.books.push(newBook);
    saveAll(all);
    return newBook;
  },
  updateBook(cycleId, bookId, updates) {
    const all = loadAll();
    const cycle = all.find(c => c.id === cycleId);
    if (!cycle) throw new Error('사이클을 찾을 수 없습니다.');
    const idx = cycle.books.findIndex(b => b.id === bookId);
    if (idx < 0) throw new Error('도서를 찾을 수 없습니다.');
    cycle.books[idx] = { ...cycle.books[idx], ...updates };
    saveAll(all);
    return cycle.books[idx];
  },
  deleteBook(cycleId, bookId) {
    const all = loadAll();
    const cycle = all.find(c => c.id === cycleId);
    if (!cycle) return;
    cycle.books = cycle.books.filter(b => b.id !== bookId);
    saveAll(all);
  },

  // ---- Auth (demo only — replace with real auth) ----
  login(password) {
    if (password === DEMO_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, '1');
      return true;
    }
    return false;
  },
  logout() {
    sessionStorage.removeItem(AUTH_KEY);
  },
  isAuthed() {
    return sessionStorage.getItem(AUTH_KEY) === '1';
  },

  // ---- Utilities ----
  resetToSeed() {
    saveAll(SEED_CYCLES);
    localStorage.setItem(CURRENT_KEY, 'cycle-2026-h1');
  }
};
