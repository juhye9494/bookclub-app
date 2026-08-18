import { NextResponse } from 'next/server';
import { getCycleOneStatus } from '@/lib/server/cycleUtils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const status = await getCycleOneStatus();
    
    if (status === 'error') {
      return NextResponse.json({ error: 'Failed to calculate count' }, { status: 500 });
    }

    return NextResponse.json({ status });
  } catch (error) {
    console.error('Error in subscribers-count route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
