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
            <div className="footer-logo"><img src="/logo.png" alt="한경 석세스 클럽" className="brand-logo" /></div>
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
            📞 02-360-4555<br />
            📧 bp@hankyung.com
            <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" className="footer-policy-btn" onClick={() => setIsTermsOpen(true)}>이용약관</button>
              <button type="button" className="footer-policy-btn" onClick={() => setIsRefundOpen(true)}>환불규정</button>
              <button type="button" className="footer-policy-btn" onClick={() => setIsPrivacyOpen(true)}>개인정보처리방침</button>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p className="footer-legal">© (주)한경매거진앤북. All rights reserved.</p>
          <Link href="/admin" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textDecoration: 'none', opacity: 0.6 }}>관리자</Link>
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
            <h4>제 1 조 (목적)</h4>
            <p>본 약관은 주식회사 한국경제매거진앤북(이하 '회사')이 제공하는 도서 구독 서비스 '한경 석세스 클럽'(이하 '서비스')의 가입 및 이용에 관한 조건과 절차, 회사와 회원의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>

            <h4>제 2 조 (용어의 정의)</h4>
            <p>본 약관에서 사용하는 용어의 정의는 다음과 같습니다.</p>
            <ul>
              <li>'서비스'라 함은 회사가 회원에게 제공하는 도서 정기 배송, 웰컴 키트 증정, 저자 강연권, 전자책 제공 등의 혜택이 포함된 구독 서비스를 의미합니다.</li>
              <li>'회원'이라 함은 서비스에 접속하여 본 약관에 동의하고 구독 요금을 결제하여 서비스를 이용하는 고객을 의미합니다.</li>
            </ul>

            <h4>제 3 조 (약관의 효력 및 변경)</h4>
            <p>회사는 본 약관의 내용을 회원이 쉽게 알 수 있도록 서비스 화면에 게시합니다. 회사가 약관을 변경할 경우에는 적용일자 및 개정사유를 명시하여 개정 약관 적용일 7일 전부터 공지합니다.</p>

            <h4>제 4 조 (구독 신청 및 서비스 제공)</h4>
            <p>이용자는 서비스가 제공하는 신청 절차에 따라 정기 구독을 신청하고 결제를 완료함으로써 서비스 이용 계약이 체결됩니다. 서비스는 6개월 구독 플랜(일시납 60,000원)을 기본으로 제공하며, 약정된 도서 및 사은품이 회원에게 배송됩니다.</p>

            <h4>제 5 조 (청약철회 및 환불)</h4>
            <p>회원은 구매한 구독 서비스에 대해 계약 체결일로부터 관련 법령에 따른 청약철회 권리를 가집니다. 구체적인 환불 범위, 공제 비용 및 청약철회 절차 등에 관한 세부 사항은 별도의 공식 환불규정 조항 및 고객센터 안내에 따릅니다.</p>

            <h4>제 6 조 (회사의 의무)</h4>
            <p>회사는 관련 법령과 본 약관이 금지하거나 미풍양속에 반하는 행위를 하지 않으며, 계속적이고 안정적으로 서비스를 제공하기 위해 최선을 다합니다.</p>

            <h4>제 7 조 (회원의 의무)</h4>
            <p>회원은 본 약관의 규정, 이용안내 및 서비스와 관련하여 공지한 주의사항을 준수하여야 하며, 기타 회사 업무에 방해되는 행위를 해서는 안 됩니다.</p>

            <h4>제 8 조 (개인정보 보호)</h4>
            <p>회사는 회원의 개인정보를 보호하기 위해 관련 법령 및 회사의 개인정보처리방침을 준수합니다.</p>

            <p style={{ marginTop: '24px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>본 약관은 2026년 1월 1일부터 적용됩니다.</p>
          </div>
        </div>
      </div>

      {/* REFUND MODAL */}
      <div className={`privacy-modal ${isRefundOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setIsRefundOpen(false); }}>
        <div className="privacy-card">
          <div className="privacy-head">
            <h3>환불규정</h3>
            <button type="button" className="privacy-close" onClick={() => setIsRefundOpen(false)}>×</button>
          </div>
          <div className="privacy-body">
            <h4>제1조 (목적)</h4>
            <p>본 환불정책은 한경매거진앤북(이하 “회사”)이 제공하는 유료 서비스 및 콘텐츠 이용과 관련하여 이용요금의 환불 기준 및 절차를 규정하는 것을 목적으로 합니다.</p>

            <h4>제2조 (환불 원칙)</h4>
            <p>1. 회사는 관련 법령 및 본 환불정책에 따라 이용자의 정당한 환불 요청에 대해 환불을 진행합니다.</p>
            <p>2. 환불 금액은 이용자가 실제 결제한 금액을 기준으로 산정합니다.</p>
            <p>3. 환불은 결제수단별 정책 및 결제대행사(PG사)의 처리 기준에 따라 진행될 수 있습니다.</p>
            
            <h4>제3조 (환불 기준)</h4>
            <h5>1. 서비스 이용 전 환불</h5>
            <p>이용자가 유료 서비스 결제 후 서비스 이용이 개시되지 않은 경우 전액 환불이 가능합니다.</p>
            <p>“서비스 이용 개시”란 이용자가 회사가 제공하는 유료 서비스 또는 혜택을 제공받은 경우를 의미하며, 다음 각 호의 어느 하나에 해당하는 경우 이용이 개시된 것으로 봅니다.</p>
            <ul>
              <li>디지털 콘텐츠 열람, 다운로드, 스트리밍 등 온라인 서비스 이용이 이루어진 경우</li>
              <li>구독 혜택으로 제공되는 굿즈 또는 사은품이 발송되었거나 수령된 경우</li>
              <li>정기 구독 혜택으로 제공되는 도서가 발송되었거나 수령된 경우</li>
              <li>기타 회사가 제공하는 유료 서비스 또는 혜택의 제공이 개시된 경우</li>
            </ul>

            <h5>2. 서비스 이용 후 환불</h5>
            <p>서비스 이용 개시 이후 환불을 요청하는 경우에는 이미 제공된 서비스 및 혜택에 해당하는 금액을 공제한 후 잔여 금액을 환불합니다. 이 경우 다음 항목이 포함될 수 있습니다.</p>
            <ul>
              <li>이용자가 제공받은 콘텐츠 또는 서비스 이용분</li>
              <li>구독 혜택으로 제공된 굿즈, 사은품 등의 실비</li>
              <li>발송된 도서의 권수에 해당하는 금액</li>
              <li>배송 완료된 상품의 배송비</li>
            </ul>
            <p>구독형 서비스의 경우 실제 이용 기간 및 제공된 혜택을 기준으로 산정하여 환불합니다.</p>

            <h5>3. 회사의 귀책 사유로 인한 환불</h5>
            <p>다음의 경우 회사는 이용자가 제공받지 못한 서비스에 해당하는 금액을 환불합니다.</p>
            <ul>
              <li>회사의 사정으로 서비스 제공이 불가능한 경우</li>
              <li>서비스의 중대한 오류 또는 장애로 정상적인 이용이 어려운 경우</li>
              <li>제공된 서비스에 중대한 하자가 있는 경우</li>
            </ul>
            
            <h4>제4조 (환불이 제한되는 경우)</h4>
            <p>다음의 경우 환불이 제한되거나 불가할 수 있습니다.</p>
            <p>1. 이용자가 이미 서비스의 주요 부분을 이용한 경우</p>
            <p>2. 이벤트, 프로모션, 할인 상품 등 별도의 환불 기준이 적용되는 경우</p>
            <p>3. 이용자의 단순 변심으로 환불을 요청하는 경우</p>
            <p>4. 이용자의 귀책 사유로 서비스 이용이 불가능한 경우</p>
            <p>5. 이용자가 제3자를 통해 서비스를 구매한 경우</p>
            <p>6. 결제 정보 또는 이용자 정보 확인이 불가능한 경우</p>
            <p>7. 관계 법령에서 환불 제한이 가능한 경우</p>
            
            <h4>제5조 (환불 절차)</h4>
            <p>1. 이용자는 고객센터 또는 이메일을 통해 환불을 요청할 수 있습니다.</p>
            <p>2. 회사는 환불 요청 접수 후 결제 내역 및 이용 여부를 확인한 뒤 환불 여부를 결정합니다.</p>
            <p>3. 환불 금액은 결제수단에 따라 카드 취소 또는 계좌 환불 등의 방식으로 처리됩니다.</p>
            
            <h4>제6조 (환불 처리 기간)</h4>
            <p>1. 환불이 승인된 경우 회사는 환불 요청 접수일로부터 영업일 기준 7~14일 이내 환불을 처리합니다.</p>
            <p>2. 신용카드 결제의 경우 카드사 정책에 따라 환불 완료 시점이 달라질 수 있습니다.</p>
            
            <h4>제7조 (면책)</h4>
            <p>1. 회사는 천재지변, 시스템 장애 등 불가항력적인 사유로 서비스 제공이 불가능한 경우 책임이 제한될 수 있습니다.</p>
            <p>2. 이용자의 귀책 사유로 발생한 서비스 이용 장애에 대해서는 회사가 책임을 지지 않습니다.</p>
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
            <p>한국경제매거진앤북(이하 '회사')은 다음의 목적을 위하여 개인정보를 처리합니다.</p>
            <ul>
              <li>회원 가입 및 관리, 본인 확인</li>
              <li>도서 구독 서비스 제공 및 배송</li>
              <li>웰컴 키트 및 사은품 발송</li>
              <li>행사 초청 및 고지사항 안내</li>
            </ul>
            <h4>2. 수집하는 개인정보 항목</h4>
            <ul>
              <li>필수: 이름, 연락처, 이메일, 배송지</li>
              <li>선택: 생년월일, 관심 분야</li>
              <li>결제 정보: 결제수단 정보(안전하게 암호화 처리)</li>
            </ul>
            <h4>3. 개인정보의 보유 및 이용 기간</h4>
            <p>회사는 원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 다만, 관계법령에 의해 보존할 필요가 있는 경우 해당 기간 동안 보관합니다.</p>
            <h4>4. 개인정보의 제3자 제공</h4>
            <p>회사는 이용자의 개인정보를 명시한 범위를 초과하여 이용하거나 제3자에게 제공하지 않습니다. 다만, 이용자의 사전 동의를 얻거나 법령의 규정에 의거한 경우에는 예외로 합니다.</p>
            <h4>5. 개인정보처리 책임자</h4>
            <p>한국경제매거진앤북 개인정보 보호책임자<br />
            이메일: bp@hankyung.com<br />
            전화: 02-360-4555</p>
            <h4>6. 이용자의 권리</h4>
            <p>이용자는 언제든지 등록되어 있는 본인의 개인정보를 조회하거나 수정할 수 있으며 가입해지 또는 삭제를 요청할 수도 있습니다.</p>
            <p style={{ marginTop: '24px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>본 방침은 2026년 1월 1일부터 적용됩니다.</p>
          </div>
        </div>
      </div>
    </>
  );
}
