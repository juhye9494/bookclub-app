// seed_insights_events.js
// Supabase에 insights 테이블 데이터와 events 테이블 데이터를 시드
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://awusckhabidneejhzbmi.supabase.co';
const supabaseKey = 'sb_publishable_siGYFN5l8xQr5h-MF5HBNg_KV3nkz0W';
const supabase = createClient(supabaseUrl, supabaseKey);

const SEED_INSIGHTS = [
  {
    id: 'insight-1',
    day: '월요일',
    type: '에디터 칼럼',
    title: '반도체 섹터 급등과 향후 실전 전망',
    author: '이성민 경제 에디터',
    date: '2026-06-01',
    summary: '반도체 섹터가 최근 사상 최고치를 경신했습니다. AI 혁명이 가져올 하드웨어 시장의 변화와 관련 추천 도서를 알아봅니다.',
    content: `최근 글로벌 시장에서 반도체 섹터의 지수가 연일 급등하며 사상 최고치를 경신했습니다. 엔비디아를 필두로 한 AI 가속기 시장의 독점이 지속되는 한편, 국내 메모리 반도체 리더들의 고대역폭 메모리(HBM) 경쟁도 더욱 뜨거워지고 있습니다.<br/><br/>이러한 현상은 단순한 단기 과열일까요, 아니면 새로운 메가 트렌드의 서막일까요? 역사적으로 반도체 사이클은 약 3~4년 주기로 호황과 불황을 반복해 왔습니다. 하지만 이번 AI 혁명은 하드웨어 인프라에 대한 수요의 근본적인 체질 개선을 요구하고 있습니다.<br/><br/><strong>■ 핵심 전망 포인트:</strong><br/>1. AI 데이터센터 인프라 확장 속도가 2027년까지 가속화될 것입니다.<br/>2. 온디바이스 AI(On-device AI) 시장의 개화로 스마트폰, 오토모티브 반도체의 단가가 급등할 것입니다.<br/>3. 차세대 패키징 공정의 지배력을 가진 소부장 기업들의 가치가 재평가될 것입니다.<br/><br/>이러한 흐름을 한발 앞서 분석하려면 이번 기수의 추천 도서인 <strong>[CES 2026]</strong>과 <strong>[사이클 투자 법칙]</strong>을 꼭 함께 읽어보시기를 권장합니다. 기술의 패러다임과 투자의 리듬을 동시에 읽는 안목을 기를 수 있을 것입니다.`,
    cover: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    likes: 42,
    order_idx: 0
  },
  {
    id: 'insight-2',
    day: '수요일',
    type: '마케터 베스트 리뷰',
    title: '독자가 남긴 가장 울림 있는 리뷰: "정리로 시작하는 인생 리셋"',
    author: '박소현 마케터',
    date: '2026-05-27',
    summary: '정경자 대표의 책을 읽고 삶의 태도를 바꾼 30대 직장인 독자의 베스트 리뷰를 공유합니다.',
    content: `언더라인 독서클럽의 많은 회원분들이 남겨주신 주옥같은 서평 중, 이번 주 마케터가 꼽은 베스트 리뷰는 아이디 <em>'reading_star'</em> 님의 글입니다.<br/><br/><strong>[독자 리뷰 본문 일부]</strong><br/>"하루 30분 책을 읽겠다는 나와의 약속이 벌써 한 달째 지켜지고 있습니다. 정경자 대표의 [정리로 시작하는 인생 리셋]을 읽으며, 물리적인 방의 가구 배치만을 바꾼 것이 아닙니다. 내 컴퓨터 바탕화면의 쓸모없는 파일들, 그리고 머릿속에서 부유하던 해묵은 고민들을 비워내기 시작했습니다. 비우는 법을 알게 되니 역설적으로 채울 수 있는 여유가 생겼고, 내 일상도 한층 가벼워졌습니다. 웰컴 굿즈로 받은 모래시계를 보며 매일 모래가 떨어지는 30분 동안 밑줄을 긋는 시간이 제 하루 중 가장 밀도 높은 행복입니다."<br/><br/>정리가 물건의 정리가 아니라 내 삶의 우선순위를 정렬하는 작업이라는 깨달음이 마케터에게도 큰 울림을 주었습니다. 여러분은 최근 일상에서 무엇을 비워내고 계시나요? 댓글로 여러분의 정리에 관한 소회를 나누어 주세요!`,
    cover: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=800&q=80',
    likes: 35,
    order_idx: 1
  },
  {
    id: 'insight-3',
    day: '금요일',
    type: '독서 습관 에세이',
    title: '하루 30분이 주는 삶의 고요와 성장',
    author: '김원준 본부장',
    date: '2026-05-29',
    summary: '출근 전 혹은 퇴근 후 30분, 그 짧은 몰입의 시간이 만드는 생각의 근육에 대하여 이야기합니다.',
    content: `현대인들은 매일 끝없는 스마트폰 피드와 숏폼 콘텐츠의 세례 속에서 살아갑니다. 도파민 중독의 시대, 우리 뇌는 가만히 멈춰서 긴 호흡의 글을 깊이 사색할 기회를 거의 잃어버렸습니다.<br/><br/>제가 매일 아침 출근 직후 컴퓨터를 켜기 전에 모래시계를 뒤집고 30분 동안 책을 읽기 시작한 지 3년이 되었습니다. 처음 10분은 눈앞의 활자가 잘 읽히지 않고 엉뚱한 업무 생각만 떠올랐습니다. 하지만 모래알이 떨어지는 소리 없는 집중 속에 20분을 넘어서면 어느새 뇌가 고요해지며 저자의 생각에 온전히 동화되는 것을 느낍니다.<br/><br/>하루 30분은 전체 하루의 단 2%에 불과합니다. 하지만 이 2%의 시간이 만드는 생각의 근육이 나머지 98%의 삶을 주도적으로 살아가게 하는 에너지가 됩니다.<br/><br/>한 권의 책을 완벽히 소화하려 부담 가질 필요는 없습니다. 그 속에서 단 한 줄, 내 마음을 울린 밑줄(Underline)을 찾아내고 그것을 가슴에 새기는 것만으로도 충분합니다. 이번 주말, 단 30분만 스마트폰을 끄고 모래시계를 뒤집어 보는 것은 어떨까요?`,
    cover: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=800&q=80',
    likes: 58,
    order_idx: 2
  }
];

const SEED_EVENTS = [
  {
    id: 'ev-1',
    title: '[저자강연] 정경자 대표의 "공간 정리로 인생 바꾸기" 특강',
    category: '저자강연',
    date: '2026-06-15 (월) 19:30',
    location: '한국경제신문사 18층 다산홀 (오프라인 & 온라인 병행)',
    cover: '/uploads/author_lecture_event.png',
    description: '인생 정리 전문가 정경자 대표가 제안하는 공간 경영 및 정리 노하우 특강입니다.<br/><br/><strong>[강연 핵심 내용]</strong><br/>• 복잡한 생각과 물건을 비우는 \'비움의 미학\'<br/>• 생활주기별 공간 수납 설계 팁<br/>• 시간과 정서적 에너지를 회복하는 힐링 세션<br/><br/><strong>[회원 전용 혜택]</strong><br/>• 정리수납 1:1 현장 상담 (선착순 5명)<br/>• 정리 체크리스트 및 가이드북 PDF 제공',
    status: '모집중',
    order_idx: 0
  },
  {
    id: 'ev-2',
    title: '한경 석세스 클럽 2026 네트워킹 디너 "Success Night"',
    category: '패밀리행사',
    date: '2026-07-10 (금) 18:30',
    location: '포시즌스 호텔 서울 그랜드볼룸',
    cover: '/uploads/networking_dinner_event.png',
    description: '한경 석세스 클럽의 우수 멤버 및 오피니언 리더들이 함께 모여 인사이트를 나누고 네트워크를 형성하는 연례 네트워킹 행사입니다.<br/><br/><strong>[행사 구성]</strong><br/>• Part 1: 2026 하반기 경제 트렌드 스페셜 강연<br/>• Part 2: 멤버십 갈라 디너 및 네트워킹 세션<br/>• Part 3: 행운권 추첨 및 특별 기념품 증정',
    status: '진행예정',
    order_idx: 1
  },
  {
    id: 'ev-3',
    title: '[멤버십 혜택] 예술의전당 "베르나르 뷔페" 특별초대전 티켓 제공',
    category: '문화제휴',
    date: '2026-05-01 ~ 2026-06-30',
    location: '예술의전당 한가람미술관',
    cover: '/uploads/art_exhibition_event.png',
    description: '20세기 현대 미술의 거장, 베르나르 뷔페의 대형 회고전에 한경 석세스 클럽 회원 여러분을 무료 초대합니다.<br/><br/><strong>[제공 혜택]</strong><br/>• 골드/프리미엄 멤버: 전시 무료 관람권 2매 증정<br/>• 일반 멤버: 현장 티켓 30% 특별 할인<br/>• 오디오 가이드 모바일 쿠폰 무료 배포',
    status: '모집중',
    order_idx: 2
  }
];

async function seed() {
  console.log('=== Seeding insights ===');
  
  // Upsert insights
  for (const insight of SEED_INSIGHTS) {
    const { data, error } = await supabase
      .from('insights')
      .upsert(insight, { onConflict: 'id' });
    if (error) {
      console.error(`Failed to upsert insight "${insight.title}":`, error.message);
    } else {
      console.log(`✓ Insight: ${insight.title}`);
    }
  }

  console.log('\n=== Seeding events ===');
  
  // Upsert events
  for (const event of SEED_EVENTS) {
    const { data, error } = await supabase
      .from('events')
      .upsert(event, { onConflict: 'id' });
    if (error) {
      console.error(`Failed to upsert event "${event.title}":`, error.message);
    } else {
      console.log(`✓ Event: ${event.title}`);
    }
  }

  console.log('\n=== Verifying ===');
  
  const { data: insightsData } = await supabase.from('insights').select('id, title');
  console.log(`Insights in DB: ${insightsData?.length || 0}`);
  insightsData?.forEach(i => console.log(`  - ${i.title}`));

  const { data: eventsData } = await supabase.from('events').select('id, title, status');
  console.log(`Events in DB: ${eventsData?.length || 0}`);
  eventsData?.forEach(e => console.log(`  - ${e.title} [${e.status}]`));
}

seed().then(() => {
  console.log('\n✅ Seed complete!');
  process.exit(0);
}).catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
