"use client";

import React from "react";

export default function LoginButton() {
  const handleLoginClick = () => {
    window.dispatchEvent(
      new CustomEvent('open-login', {
        detail: { mode: 'login' },
      })
    );
  };

  return (
    <button 
      onClick={handleLoginClick} 
      style={{ padding: '12px 24px', background: '#fc6640', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', width: '100%' }}
    >
      로그인하기
    </button>
  );
}
