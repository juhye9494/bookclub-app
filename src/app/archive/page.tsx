"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function ArchivePage() {
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchArchive() {
      // 1. Fetch all cycles
      const { data: cyclesData, error: cycleErr } = await supabase
        .from('cycles')
        .select('*')
        .order('start_date', { ascending: false });

      // 2. Fetch all books
      const { data: booksData, error: bookErr } = await supabase
        .from('books')
        .select('*');

      if (cycleErr || bookErr) {
        console.error('Failed to load data', cycleErr, bookErr);
        setLoading(false);
        return;
      }

      // 3. Map books to cycles and sort books by order_idx
      const mapped = (cyclesData || []).map(c => {
        const cBooks = (booksData || [])
          .filter(b => b.cycle_id === c.id)
          .sort((a, b) => (a.order_idx || 0) - (b.order_idx || 0));
        return { ...c, books: cBooks };
      });

      setCycles(mapped);
      setLoading(false);
    }
    fetchArchive();
  }, []);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', fontFamily: 'var(--sans)', color: 'var(--text)' }}>


      <section style={{ padding: '110px 5vw 56px', textAlign: 'center', maxWidth: '1200px', margin: '0 auto' }}>
        <p style={{ fontSize: '0.78rem', fontWeight: 500, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '16px' }}>Past Books</p>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.03em', marginBottom: '16px' }}>지난 도서 리스트</h1>
        <p style={{ color: 'var(--text-mid)', fontSize: '1rem', lineHeight: 1.8 }}>6개월마다 새롭게 큐레이션되는 한경 석세스 클럽의 도서 기록.<br />지난 시즌의 책들을 한눈에 살펴보세요.</p>
      </section>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 5vw 100px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>불러오는 중...</div>
        ) : cycles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>아직 등록된 시즌이 없습니다.</div>
        ) : (
          cycles.map(c => (
            <section key={c.id} style={{ marginBottom: '64px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', paddingBottom: '16px', marginBottom: '24px', borderBottom: '2px solid var(--text)' }}>
                <div>
                  <span style={{ fontFamily: 'var(--serif)', fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{c.label}</span>
                  {c.status === 'active' ? (
                    <span style={{ display: 'inline-block', marginLeft: '12px', padding: '3px 10px', background: 'var(--accent)', color: '#fff', fontSize: '0.7rem', fontWeight: 600, borderRadius: '12px', verticalAlign: 'middle', letterSpacing: '0.04em' }}>현재 시즌</span>
                  ) : (
                    <span style={{ display: 'inline-block', marginLeft: '12px', padding: '3px 10px', background: 'var(--text-muted)', color: '#fff', fontSize: '0.7rem', fontWeight: 600, borderRadius: '12px', verticalAlign: 'middle', letterSpacing: '0.04em' }}>종료</span>
                  )}
                </div>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>{c.start_date} ~ {c.end_date} · 도서 {c.books.length}권</span>
              </div>
              
              {c.books.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>등록된 도서가 없습니다.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '32px 20px' }}>
                  {c.books.map((b: any) => {
                    const hasImg = !!b.cover;
                    return (
                      <div key={b.id} style={{ textAlign: 'center' }}>
                        <div style={{ 
                          aspectRatio: '3/4.3', 
                          background: hasImg ? '#2a2620' : 'var(--bg-warm)', 
                          borderRadius: '4px', 
                          boxShadow: '0 2px 18px rgba(0,0,0,0.08)', 
                          overflow: 'hidden', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          padding: hasImg ? '0' : '20px 14px',
                          position: 'relative',
                          fontFamily: 'var(--serif)',
                          fontWeight: 700,
                          fontSize: '1rem',
                          lineHeight: 1.35,
                          color: 'var(--text)',
                          textAlign: 'center',
                          letterSpacing: '-0.01em'
                        }}>
                          {hasImg ? (
                            <>
                              <img src={b.cover} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <div style={{ content: '""', position: 'absolute', top: 0, left: 0, width: '5px', height: '100%', background: 'rgba(0,0,0,0.18)', zIndex: 1 }} />
                            </>
                          ) : (
                            <span>{b.title}</span>
                          )}
                        </div>
                        <p style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '14px', lineHeight: 1.4 }}>{b.title}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{b.author}</p>
                        {b.lecture && <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent)', marginTop: '6px', letterSpacing: '-0.01em' }}>+ 저자 강연권</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ))
        )}
      </main>

    </div>
  );
}
