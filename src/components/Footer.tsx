"use client";
import React, { useState } from 'react';
import Link from 'next/link';

export default function Footer() {
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  return (
    <>
      <footer>
        <div className="footer-grid">
          <div>
            <div className="footer-logo"><img src="/logo.svg" alt="한경 석세스 클럽" className="brand-logo" /></div>
          </div>
          <div className="footer-company">
            <div><strong>대표이사</strong>서정환</div>
            <div><strong>주소</strong>04505 서울시 중구 청파로 463 한국경제신문사 6층</div>
            <div><strong>사업자번호</strong>104-81-47761</div>
          </div>
          <div className="footer-contact">
            📞 02-360-4555<br />
            📧 bp@hankyung.com
            <div style={{ marginTop: '14px' }}>
              <button type="button" className="footer-policy-btn" onClick={() => setIsPrivacyOpen(true)}>개인정보처리방침</button>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p className="footer-legal">© 한경매거진앤북</p>
          <Link href="/admin" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textDecoration: 'none', opacity: 0.6 }}>관리자</Link>
        </div>
      </footer>

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
