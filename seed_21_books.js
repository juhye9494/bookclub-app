const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let supabaseUrl = '';
let supabaseKey = '';

try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const env = {};
  envContent.split(/\r?\n/).forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
  supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
} catch (e) {
  console.error("Failed to read .env.local file:", e);
}

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Anon Key!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const booksData = [
  {
    title: '사이클 투자 법칙',
    author: '조윤남 지음',
    genre: '경제 · 투자',
    cover: '/uploads/cd52ee5bff3ec53eb02c5a0e4fce2526.jpg',
    tags: ['주식', '투자', '강연 포함', '대표 도서'],
    description: '주식시장 슈퍼사이클에 올라타는 실전 매매법. 코스피 5,000 시대 필독서 — 위기는 피하고 기회는 확실히 잡아라! 홍성국 전 더불어민주당 최고위원, 이효석 HSD엔진 대표, 오라영 신한은행 패시브인덱 단장이 강력 추천한 투자 바이블입니다.',
    lecture: { desc: '저자 조윤남이 직접 진행하는 "사이클로 읽는 주식시장" 투자 강연.', perks: ['90분 심층 분석 강의', '사이클 투자 체크리스트 PDF', '비공개 Q&A 세션'] }
  },
  {
    title: 'CES 2026',
    author: '한국경제신문 × The Miilk',
    genre: '테크 · 트렌드',
    cover: '/uploads/041f16811654291628de9f342681dbb1.png',
    tags: ['IT · 기술', 'AI · 혁신'],
    description: 'AI 리더십부터 로봇공학, 양자컴퓨터까지 — 세계 최대 가전·IT 박람회 CES 2026의 모든 것을 한 권에 담았습니다. 한국경제신문과 The Miilk이 공동 취재한 현장 리포트와 전문가 인사이트를 통해 2026년 기술 트렌드를 선점하세요.',
    lecture: null
  },
  {
    title: '정리로 시작하는 인생 리셋',
    author: '정경자 지음',
    genre: '라이프스타일',
    cover: '/uploads/ce7fe03d39caf9b1708cba7e5e7faa83.jpg',
    tags: ['정리 · 수납', '라이프스타일', '강연 포함'],
    description: '10만 가구의 변화를 이끌어온 정리 전문가 정경자의 인생 정리 바이블. 생각·시간·공간을 한꺼번에 리셋하는 실전 방법론을 담았습니다. "정리는 끝이 아니라 변화의 시작이다!" 정리수납 노하우부터 생활주기별 정리 TIP, 공간 경영 철학까지 모두 수록했습니다.',
    lecture: { desc: '저자 정경자가 직접 진행하는 "공간 정리로 인생 바꾸기" 온라인 강연.', perks: ['60분 실전 정리 강의', '공간별 체크리스트 PDF 제공', '1:1 Q&A 세션 포함'] }
  },
  {
    title: '프로젝트리츠로 일하는 법',
    author: '강병기 외 4인',
    genre: '부동산 · 비즈니스',
    cover: '/uploads/fd38af558278f9de5a15d0ab05aaf85e.jpg',
    tags: ['부동산', '리츠', '강연 포함'],
    description: '새로운 부동산 개발 플랫폼 PROJECT REITs의 모든 것. 개발·운영·공모·상장까지, 리츠 전문가 5인이 집필한 국내 최초 리츠 종합 안내서입니다. 실무 현장의 생생한 사례와 함께 복잡한 리츠 구조를 명쾌하게 정리했습니다.',
    lecture: { desc: '저자 5인이 릴레이로 진행하는 "리츠 실무 완전정복" 온라인 강연 시리즈.', perks: ['총 3회 릴레이 강연 (각 60분)', '리츠 투자 체크리스트 PDF', '실무 사례집 별책 제공'] }
  },
  {
    title: '퍼지키즈',
    author: '한지우 지음',
    genre: '교육 · 자녀교육',
    cover: '/uploads/d1bae06b6d279117f4aeacbd777accbb.jpg',
    tags: ['AI 교육', '인문학', '강연 포함'],
    description: 'AI 시대의 새로운 인재상을 제시하는 혁신적 교육서. 속도보다 방향, 지식보다 감각을 키우는 인문학 자녀교육의 핵심을 담았습니다. 방종임 교육대기자TV, 독지선 선생님 강력 추천! 초등 학부모 필독서로 꼽히는 베스트셀러입니다.',
    lecture: { desc: '저자 한지우가 직접 강의하는 "AI 시대 아이 키우기" 학부모 특강.', perks: ['75분 온라인 특강', '연령별 인문학 교육 로드맵 PDF', '학부모 커뮤니티 초대'] }
  },
  {
    title: '덜 멍청하게 살기 위한 최소한의 철학',
    author: '라르스 스벤젠',
    genre: '철학 · 인문',
    cover: '/uploads/775c4d1d6677a6abd5ce990900c13cb0.jpg',
    tags: ['철학', '인문', '번역서'],
    description: '전 세계 35개 언어로 읽히는 북유럽 철학자 라르스 스벤젠의 신작. 멍청함은 지능이 아니라 태도다 — 타인의 멍청함에 화가 나고, 자신의 멍청함은 두려운 모든 사람을 위한 지적 수업.',
    lecture: null
  },
  // Additional 15 books to reach 21
  {
    title: '부의 시나리오',
    author: '오건영 지음',
    genre: '경제 · 경영',
    cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80',
    tags: ['거시경제', '금리', '환율', '재테크'],
    description: '코로나 이후 글로벌 경제 시나리오 and 자산 배분 전략. 금리와 환율, 그리고 채권 시장의 변동성을 금리 전문가 오건영의 친절한 설명으로 완벽히 마스터합니다.',
    lecture: null
  },
  {
    title: '돈의 속성',
    author: '김승호 지음',
    genre: '경제 · 경영',
    cover: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=400&q=80',
    tags: ['부의 본질', '투자 마인드', '경영 철학'],
    description: '최상위 부자가 말하는 돈에 대한 태도와 자산 관리 원칙. 돈을 인격체로 대하라는 저자의 독특한 철학과 인생관을 담은 메가 베스트셀러.',
    lecture: null
  },
  {
    title: '트렌드 코리아 2026',
    author: '김난도 외 지음',
    genre: '경제 · 트렌드',
    cover: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=400&q=80',
    tags: ['소비 트렌드', '전망', '인사이트'],
    description: '2026년을 주도할 주요 소비 트렌드 키워드 분석. 급변하는 비즈니스 환경에서 생존하고 혁신하기 위한 필수 바이블.',
    lecture: null
  },
  {
    title: '백만장자 시크릿',
    author: '하브 에커 지음',
    genre: '자기계발',
    cover: 'https://images.unsplash.com/photo-1610116306796-6fea9f4fae38?auto=format&fit=crop&w=400&q=80',
    tags: ['마인드셋', '부자 생각', '자기계발'],
    description: '내 안의 무의식적인 부 플랜을 재설정하여 부의 잠재력을 깨우는 법. 가난한 생각의 틀을 깨부수는 강력한 가이드.',
    lecture: null
  },
  {
    title: '아르떼 클래식 산책',
    author: '김소연 지음',
    genre: '예술 · 교양',
    cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=400&q=80',
    tags: ['음악', '예술', '인문학'],
    description: '위대한 작곡가들의 삶과 클래식 명곡에 얽힌 흥미로운 에피소드. 한경 아르떼 필하모닉 공연을 더욱 깊게 감상하기 위한 예술 교양 도서.',
    lecture: null
  },
  {
    title: '일잘러의 기획서 작성법',
    author: '박형준 지음',
    genre: '비즈니스 실무',
    cover: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=400&q=80',
    tags: ['생산성', '보고서', '기획', '실무'],
    description: '보고 즉시 통과되는 핵심 기획서와 보고서 작성의 정석. 논리적 뼈대 잡기부터 깔끔한 시각화 방법까지 직무 실무 노하우 대공개.',
    lecture: null
  },
  {
    title: '주식 투자 무작정 따라하기',
    author: '윤재수 지음',
    genre: '경제 · 투자',
    cover: 'https://images.unsplash.com/photo-1590212151175-e58edd96185b?auto=format&fit=crop&w=400&q=80',
    tags: ['주식 기초', '차트 분석', '재테크'],
    description: '주식 입문자들을 위한 영원한 베스트셀러. 계좌 개설부터 기술적 분석, 실전 매매 원칙까지 가장 정석적이고 체계적인 입문서.',
    lecture: null
  },
  {
    title: '타이탄의 도구들',
    author: '팀 페리스 지음',
    genre: '자기계발',
    cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=400&q=80',
    tags: ['글로벌 리더', '습관', '성공 루틴'],
    description: '세계 최고들의 모임인 타이탄(거인) 200여 명을 인터뷰하여 밝혀낸 그들만의 극비 습관과 생각 방식.',
    lecture: null
  },
  {
    title: '아주 작은 습관의 힘',
    author: '제임스 클리어 지음',
    genre: '자기계발',
    cover: 'https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&w=400&q=80',
    tags: ['습관 개선', '목표 달성', '자기계발'],
    description: '매일 1%씩 성장하는 습관 복리의 놀라운 마법. 뇌과학과 행동심리학을 근거로 한 완벽한 습관 설계 4단계 방법론.',
    lecture: null
  },
  {
    title: '인간 관계론',
    author: '데일 카네기 지음',
    genre: '인문 · 심리',
    cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=400&q=80',
    tags: ['커뮤니케이션', '소통', '인간관계', '고전'],
    description: '시간이 흘러도 변치 않는 인간 소통의 영원한 바이블. 사람의 마음을 사로잡고 조화로운 리더십을 발휘하는 실천 기술.',
    lecture: null
  },
  {
    title: '사피엔스',
    author: '유발 하라리 지음',
    genre: '역사 · 인문',
    cover: 'https://images.unsplash.com/photo-1474932430478-367dbb6832c1?auto=format&fit=crop&w=400&q=80',
    tags: ['인류 역사', '문명사', '사학'],
    description: '변방의 유인원에서 지구의 지배자가 된 사피엔스 인류의 역사. 인지혁명, 농업혁명, 과학혁명을 통해 문명사를 대담하게 파헤칩니다.',
    lecture: null
  },
  {
    title: '생각에 관한 생각',
    author: '대니얼 카너먼 지음',
    genre: '행동경제학',
    cover: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=400&q=80',
    tags: ['의사결정', '심리학', '노벨상'],
    description: '직관(빠른 생각)과 사색(느린 생각)의 상호작용이 일으키는 생각의 함정과 의사결정의 심리학을 다룬 행동경제학의 바이블.',
    lecture: null
  },
  {
    title: '부자 아빠 가난한 아빠',
    author: '로버트 기요사키 지음',
    genre: '경제 · 재테크',
    cover: 'https://images.unsplash.com/photo-1592492159418-09f31333cca8?auto=format&fit=crop&w=400&q=80',
    tags: ['금융 지능', '자산과 부채', '스테디셀러'],
    description: '돈을 위해 일하지 말고 돈이 나를 위해 일하게 하라! 전 세계 자산 교과서가 된 금융 마인드 혁신 지침서.',
    lecture: null
  },
  {
    title: '지적 대화를 위한 넓고 얕은 지식',
    author: '채사장 지음',
    genre: '철학 · 인문',
    cover: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&w=400&q=80',
    tags: ['철학', '역사', '과학', '교양'],
    description: '역사, 경제, 정치, 사회, 윤리를 단숨에 관통하는 대화용 통합 지식. 내 대화의 격을 넓혀주는 최소한의 인문 교양 교과서.',
    lecture: null
  },
  {
    title: '파타고니아, 파도가 칠 때는 서핑을',
    author: '이본 쉬나드 지음',
    genre: '경영 · 기업철학',
    cover: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=400&q=80',
    tags: ['친환경', '기업가정신', 'ESG'],
    description: '환경을 파괴하지 않으면서 사업을 성장시키는 파타고니아의 진심 어린 기업 철학과 기후 위기 극복 실천 에세이.',
    lecture: null
  }
];

async function seed() {
  try {
    // 1. Get active cycle
    const { data: cycles, error: cErr } = await supabase
      .from('cycles')
      .select('*')
      .eq('status', 'active')
      .order('start_date', { ascending: false })
      .limit(1);

    if (cErr || !cycles || cycles.length === 0) {
      console.error("No active cycle found!", cErr);
      process.exit(1);
    }

    const activeCycle = cycles[0];
    console.log("Active cycle:", activeCycle.id, activeCycle.label);

    // 2. Clear existing books for this cycle
    const { error: dErr } = await supabase
      .from('books')
      .delete()
      .eq('cycle_id', activeCycle.id);

    if (dErr) {
      console.error("Failed to delete books:", dErr);
      process.exit(1);
    }
    console.log("Cleared existing books.");

    // 3. Insert 21 books
    const booksToInsert = booksData.map((b, i) => ({
      ...b,
      id: `b-${Date.now()}-${i}`,
      cycle_id: activeCycle.id,
      order_idx: i
    }));

    const { error: iErr } = await supabase
      .from('books')
      .insert(booksToInsert);

    if (iErr) {
      console.error("Failed to insert books:", iErr);
      process.exit(1);
    }

    console.log(`Successfully seeded ${booksToInsert.length} books!`);
  } catch (err) {
    console.error("Error running seed:", err);
  }
}

seed();
