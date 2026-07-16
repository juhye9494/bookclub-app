"use client";
import React from 'react';
import Header from './Header';
import Footer from './Footer';
import { ToastProvider } from './Toast';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex flex-col">
          {children}
        </main>
        <Footer />
      </div>
    </ToastProvider>
  );
}
