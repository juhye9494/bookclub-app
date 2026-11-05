import { NextResponse } from 'next/server';

/**
 * Helper to return a JSON response with `Cache-Control: no-store` header.
 * Mirrors the previously duplicated function used across API routes.
 */
export function jsonNoStore(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
