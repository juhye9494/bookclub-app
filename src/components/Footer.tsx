"use client";
import React, { useState } from 'react';
import Link from 'next/link';

export default function Footer() {
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);

  return (
    <>
      <footer>
        <div className="footer-grid">
          <div>
            <div className="footer-logo"><img src="/uploads/underline_logo.svg" alt="한경 언더라인 독서클럽" style={{ height: '18px', opacity: 0.5, display: 'block' }} /></div>
          </div>
          <div className="footer-company" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div><strong>상호</strong>(주)한경매거진앤북</div>
            <div><strong>대표이사</strong>서정환</div>
            <div><strong>사업자등록번호</strong>104-81-47761</div>
            <div><strong>통신판매업신고번호</strong>2004-서울중구-2651</div>
            <div><strong>주소</strong>04505 서울시 중구 청파로 463, 한국경제신문사 6층 (중림동)</div>
            <div><strong>호스팅서비스제공자</strong>(주)한경매거진앤북</div>
          </div>
          <div className="footer-contact">
            <div style={{ marginTop: '10px' }}>
              <Link href="/inquiry" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: 'var(--accent)', color: '#fff', borderRadius: '100px', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none', transition: 'opacity 0.2s' }}>
                ✉️ 1:1 문의하기
              </Link>
            </div>
            <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" className="footer-policy-btn" onClick={() => setIsTermsOpen(true)}>이용약관</button>
              <button type="button" className="footer-policy-btn" onClick={() => setIsRefundOpen(true)}>환불정책</button>
              <button type="button" className="footer-policy-btn" onClick={() => setIsPrivacyOpen(true)} style={{ fontWeight: '800', color: 'var(--accent)', textDecorationColor: 'var(--accent)' }}>개인정보처리방침</button>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p className="footer-legal">© (주)한경매거진앤북. All rights reserved.</p>
        </div>
      </footer>

      {/* TERMS MODAL */}
      <div className={`privacy-modal ${isTermsOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setIsTermsOpen(false); }}>
        <div className="privacy-card">
          <div className="privacy-head">
            <h3>서비스 이용약관</h3>
            <button type="button" className="privacy-close" onClick={() => setIsTermsOpen(false)}>×</button>
          </div>
          <div className="privacy-body">
            <h4>제1조 (목적)</h4>
            <p>본 약관은 한경 언더라인 독서클럽(이하 &ldquo;회사&rdquo;)이 제공하는 유료 북클럽 멤버십 서비스(이하 &ldquo;서비스&rdquo;)의 이용과 관련하여 회사와 회원 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.</p>

            <h4>제2조 (회원의 정의 및 가입)</h4>
            <p>① &ldquo;회원&rdquo;이란 회사가 운영하는 홈페이지를 통하여 본 약관에 동의하고 이용요금을 결제하여 서비스 이용 자격을 부여받은 자를 말합니다.</p>
            <p>② 회원은 본인의 정확한 정보를 제공하여야 하며, 타인의 명의를 도용하거나 허위 정보를 등록한 경우 회사는 회원 자격을 제한 또는 상실시킬 수 있습니다.</p>
            <p>③ 회원은 주소, 연락처 등 서비스 제공에 필요한 정보가 변경된 경우 즉시 수정하여야 하며, 이를 이행하지 않아 발생한 불이익에 대한 책임은 회원에게 있습니다.</p>

            <h4>제3조 (서비스의 내용)</h4>
            <p>회사가 제공하는 서비스의 내용은 다음 각 호와 같습니다.</p>
            <ul>
              <li>이용 기간 동안 제공되는 도서 발송 서비스</li>
              <li>가입 시 제공되는 웰컴 키트 발송</li>
              <li>전자책 및 PDF 콘텐츠 제공</li>
              <li>강연, 세미나 및 이벤트 참여 기회 제공</li>
              <li>아르떼 공연·전시 등 계열사 연계 문화 혜택 제공</li>
              <li>기타 회사가 회원을 대상으로 별도 안내하는 혜택</li>
            </ul>
            <p>회사는 서비스 운영상 필요에 따라 서비스의 구성, 혜택 및 제공 방식을 변경할 수 있으며, 변경 시 사전에 홈페이지 등을 통해 공지합니다.</p>

            <h4>제4조 (서비스 이용기간)</h4>
            <p>서비스 이용 기간은 결제일로부터 회사가 별도로 정한 기간까지로 합니다.</p>

            <h4>제5조 (회사의 의무)</h4>
            <p>① 회사는 관련 법령 및 본 약관이 정하는 바에 따라 안정적이고 지속적인 서비스를 제공하기 위해 노력합니다.</p>
            <p>② 회사는 회원의 개인정보를 관련 법령에 따라 보호하며, 개인정보 처리에 관한 사항은 별도의 개인정보처리방침에 따릅니다.</p>
            <p>③ 회사는 천재지변, 시스템 점검, 서비스 장애 또는 기타 불가피한 사유가 발생한 경우 서비스 제공을 일시적으로 중단할 수 있습니다.</p>

            <h4>제6조 (회원의 의무)</h4>
            <p>① 회원은 관계 법령, 본 약관 및 회사의 안내사항을 준수하여야 합니다.</p>
            <p>② 회원은 회사가 제공하는 전자책, PDF 등 디지털 콘텐츠를 무단 복제·배포·공유하거나 저작권을 침해하는 행위를 하여서는 안 됩니다.</p>
            <p>③ 회원은 서비스를 부정한 방법으로 이용하여서는 안 됩니다.</p>

            <h4>제7조 (서비스의 변경 및 종료)</h4>
            <p>① 회사는 운영상 또는 기술상 필요에 따라 서비스의 전부 또는 일부를 변경할 수 있습니다.</p>
            <p>② 회사는 사업 종료 등 부득이한 사유가 있는 경우 서비스를 종료할 수 있으며, 종료 시 사전에 회원에게 공지합니다.</p>

            <h4>제8조 (면책)</h4>
            <p>회사는 천재지변, 불가항력적 사유 또는 회원의 귀책 사유로 인하여 발생한 손해에 대하여 책임을 지지 않습니다.</p>

            <h4>제9조 (준거법 및 관할)</h4>
            <p>본 약관은 대한민국 법률에 따라 해석되며, 서비스 이용과 관련하여 발생한 분쟁은 관련 법령에 따른 관할 법원을 제1심 관할 법원으로 합니다.</p>

            <p style={{ marginTop: '24px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>본 약관은 2026년 1월 1일부터 적용됩니다.</p>
          </div>
        </div>
      </div>

      {/* REFUND MODAL */}
      <div className={`privacy-modal ${isRefundOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setIsRefundOpen(false); }}>
        <div className="privacy-card">
          <div className="privacy-head">
            <h3>환불정책</h3>
            <button type="button" className="privacy-close" onClick={() => setIsRefundOpen(false)}>×</button>
          </div>
          <div className="privacy-body">
            <h4>제1조 (기본 원칙)</h4>
            <p>① 본 환불정책은 「전자상거래 등에서의 소비자보호에 관한 법률」 및 공정거래위원회 소비자분쟁해결기준을 따릅니다.</p>
            <p>② 회원은 서비스 이용 기간 중 언제든지 중도 해지를 요청할 수 있습니다.</p>
            <p>③ 환불 금액은 총 결제금액에서 회원에게 실제 제공된 상품·콘텐츠·서비스의 이용대금 및 배송비를 공제한 후 산정합니다.</p>
            <p>④ 회사는 중도 해지에 따른 별도의 위약금 또는 해지 수수료를 부과하지 않습니다.</p>

            <h4>제2조 (청약철회)</h4>
            <p>① 회원은 결제일로부터 7일 이내에 청약철회를 요청할 수 있습니다.</p>
            <p>② 다만 다음 각 호의 어느 하나에 해당하는 경우에는 관련 법령에 따라 청약철회가 제한될 수 있습니다.</p>
            <ul>
              <li>도서 및 웰컴 키트가 이미 발송된 경우</li>
              <li>전자책 또는 디지털 콘텐츠의 다운로드·열람이 개시된 경우</li>
              <li>회원 맞춤형으로 제작된 상품이 제공된 경우</li>
            </ul>
            <p>③ 청약철회가 가능한 경우 회사는 전액 환불합니다.</p>

            <h4>제3조 (중도 해지 및 환불 기준)</h4>
            <p>① 서비스 이용 개시 후 중도 해지 시 환불 금액은 아래 기준에 따라 산정합니다.</p>
            <ul>
              <li>웰컴 키트: 실제 판매가 및 배송비</li>
              <li>종이책: 해지 시점까지 발송 완료된 도서의 실제 판매가 및 배송비</li>
              <li>전자책/PDF: 다운로드·열람 또는 발송 완료된 콘텐츠의 실제 판매가</li>
              <li>강연/행사: 참여 완료된 회차의 실제 운영비용 상당액</li>
            </ul>
            <p>② 전자책 및 디지털 콘텐츠는 다운로드 또는 열람이 개시된 경우 이용된 것으로 간주합니다.</p>
            <p>③ 무료 제공 혜택 또는 무상 프로모션으로 제공된 강연·행사·이벤트의 경우 환불 금액 산정 시 별도 차감 또는 환산되지 않을 수 있습니다.</p>
            <p>④ 환불 금액 산정식:</p>
            <p style={{ background: 'var(--bg-warm)', padding: '12px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
              환불금액 = 총 결제금액 - 기제공 혜택 상당액 - 발생 배송비
            </p>
            <p>⑤ 차감 금액의 총합이 결제 금액을 초과하는 경우 추가 비용은 청구하지 않으며 환불 금액은 없는 것으로 합니다.</p>

            <h4>제4조 (환불이 제한되는 경우)</h4>
            <p>다음 각 호의 경우 환불이 제한될 수 있습니다.</p>
            <ul>
              <li>서비스 이용 기간이 종료된 경우</li>
              <li>회원의 책임 있는 사유로 상품 등이 멸실·훼손된 경우</li>
              <li>관계 법령상 청약철회 제한 사유에 해당하는 경우</li>
            </ul>

            <h4>제5조 (환불 절차)</h4>
            <p>① 환불 신청은 회사가 지정한 고객센터를 통해 접수합니다.</p>
            <ul>
              <li>고객센터: hankbp@naver.com</li>
              <li>운영시간: 10:00 ~ 16:00 (주말·공휴일·점심시간 제외)</li>
            </ul>
            <p>② 회사는 환불 신청 접수 후 이용 내역 및 제공 여부를 확인한 뒤 영업일 기준 3~5일 이내 환불 절차를 진행합니다.</p>
            <p>③ 환불은 원칙적으로 기존 결제수단으로 처리됩니다.</p>
            <p>④ 신용카드 결제 시 환불은 카드취소로만 가능하며, 카드 결제 요금을 부분 취소하기 어려운 경우는 전액 취소 후 차액 납입을 요청할 수 있습니다.</p>

            <p style={{ marginTop: '24px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>본 환불정책은 2026년 1월 1일부터 적용됩니다.</p>
          </div>
        </div>
      </div>

      {/* PRIVACY MODAL */}
      <div className={`privacy-modal ${isPrivacyOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setIsPrivacyOpen(false); }}>
        <div className="privacy-card">
          <div className="privacy-head">
            <h3>개인정보처리방침</h3>
            <button type="button" className="privacy-close" onClick={() => setIsPrivacyOpen(false)}>×</button>
          </div>
          <div className="privacy-body">
            <h4>1. 개인정보의 수집 및 이용 목적</h4>
            <p>회사는 서비스 제공을 위하여 다음 목적 범위 내에서 개인정보를 수집 및 이용합니다.</p>
            <ul>
              <li>회원 가입 및 서비스 이용 관리</li>
              <li>도서 및 상품 배송</li>
              <li>결제 및 환불 처리</li>
              <li>고객 문의 응대 및 공지사항 전달</li>
              <li>이벤트 및 혜택 제공</li>
              <li>서비스 운영 및 품질 개선</li>
            </ul>

            <h4>2. 수집하는 개인정보 항목</h4>
            <ul>
              <li>필수 항목: 이름, 휴대전화번호, 이메일주소, 배송지 주소, 결제정보</li>
              <li>선택 항목: 마케팅 수신 동의 여부</li>
              <li>자동 수집 항목: IP 주소, 쿠키, 접속 로그, 서비스 이용 기록</li>
            </ul>

            <h4>3. 개인정보의 보유 및 이용 기간</h4>
            <p>회사는 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 다만 관계 법령에 따라 일정 기간 보관이 필요한 경우 아래와 같이 보관합니다.</p>
            <p><strong>1) 회원 탈퇴 시</strong></p>
            <ul>
              <li>보존 항목: 이름, 아이디, 이메일주소, 휴대전화번호 등 회원 관리 정보</li>
              <li>보존 목적: 부정 이용 방지, 분쟁 대응, 민원 처리</li>
              <li>보존 기간: 탈퇴 후 3개월</li>
            </ul>
            <p><strong>2) 관련 법령에 따른 보관</strong></p>
            <ul>
              <li>접속 로그, 접속 IP, 서비스 이용기록: 3개월 (통신비밀보호법)</li>
              <li>표시·광고에 관한 기록: 6개월 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
              <li>계약 또는 청약철회 등에 관한 기록: 5년</li>
              <li>대금결제 및 재화 등의 공급에 관한 기록: 5년</li>
              <li>소비자 불만 또는 분쟁처리에 관한 기록: 3년</li>
            </ul>

            <h4>4. 개인정보의 제3자 제공</h4>
            <p>회사는 회원의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 다음의 경우에는 예외로 합니다.</p>
            <ul>
              <li>회원이 사전에 동의한 경우</li>
              <li>법령에 의하여 요구되는 경우</li>
            </ul>

            <h4>5. 개인정보 처리의 위탁</h4>
            <p>회사는 서비스 제공 및 운영을 위해 필요한 경우 개인정보 처리업무를 외부 전문업체에 위탁할 수 있습니다. 이 경우 회사는 관련 법령에 따라 위탁계약 체결 시 개인정보가 안전하게 관리될 수 있도록 필요한 사항을 규정합니다.</p>
            <ul>
              <li>결제 처리: 토스페이먼츠</li>
              <li>상품 배송: (추후 지정 예정)</li>
              <li>문자·이메일 발송: 한경매거진앤북</li>
            </ul>

            <h4>6. 회원의 권리 및 행사 방법</h4>
            <p>회원은 언제든지 자신의 개인정보 열람·수정·삭제 및 처리 정지를 요청할 수 있습니다.</p>

            <h4>7. 개인정보의 파기 절차 및 방법</h4>
            <p>회사는 개인정보 보유 기간의 경과 또는 처리 목적 달성 시 해당 정보를 지체 없이 파기합니다.</p>

            <h4>8. 개인정보 보호 책임자</h4>
            <ul>
              <li>개인정보 보호 책임자: 서은실</li>
              <li>이메일: ess0317@hankyung.com</li>
            </ul>

            <h4>9. 개인정보처리방침의 변경</h4>
            <p>본 개인정보처리방침은 관련 법령 및 회사 정책에 따라 변경될 수 있으며, 변경 시 홈페이지를 통해 사전 공지합니다.</p>

            <p style={{ marginTop: '24px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>본 방침은 2026년 1월 1일부터 적용됩니다.</p>
          </div>
        </div>
      </div>
    </>
  );
}
