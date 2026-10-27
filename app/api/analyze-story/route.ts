import { NextRequest, NextResponse } from 'next/server';
import { createAgentStory, getAgentStoriesByEmiten, updateAgentStory } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const emiten = searchParams.get('emiten')?.toUpperCase();

  if (!emiten) {
    return NextResponse.json({ error: 'Missing emiten parameter' }, { status: 400 });
  }

  try {
    const stories = await getAgentStoriesByEmiten(emiten);
    
    if (!stories || stories.length === 0) {
      return NextResponse.json({ 
        success: true, 
        data: null,
        message: 'No analysis found'
      });
    }

    return NextResponse.json({ 
      success: true, 
      data: stories 
    });
  } catch (error) {
    console.error('Error fetching agent story:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch analysis' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const emiten = body.emiten?.toUpperCase();
    const keyStats = body.keyStats;

    if (!emiten) {
      return NextResponse.json({ error: 'Missing emiten parameter' }, { status: 400 });
    }

    // Create pending record
    const story = await createAgentStory(emiten);

    // Check GEMINI_API_KEY
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const errMsg = 'GEMINI_API_KEY belum dikonfigurasi di .env.local';
      await updateAgentStory(story.id, {
        status: 'error',
        error_message: errMsg,
      });
      return NextResponse.json({
        success: true,
        data: story,
        message: errMsg,
      });
    }

    // Trigger background function
    const host = request.headers.get('host');
    const isLocal = host?.includes('localhost') || host?.includes('127.0.0.1');
    const baseUrl = isLocal ? 'http://localhost:8888' : `https://${host}`;

    const functionUrl = baseUrl.includes('/.netlify/functions')
      ? baseUrl
      : `${baseUrl.replace(/\/$/, '')}/.netlify/functions`;

    console.log(`[Agent Story] Triggering background function at: ${functionUrl}/analyze-story-background`);

    try {
      await fetch(`${functionUrl}/analyze-story-background?emiten=${emiten}&id=${story.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyStats }),
      });
    } catch (triggerError: any) {
      console.warn('Background function trigger notice:', triggerError.message);
      await updateAgentStory(story.id, {
        status: 'error',
        error_message: isLocal
          ? 'Fitur AI Story Analysis memerlukan Netlify Function atau background worker lokal aktif.'
          : 'Gagal memulai proses analisis background.',
      });
      return NextResponse.json({
        success: true,
        data: story,
        message: 'Analysis initiated with local fallback notice',
      });
    }

    return NextResponse.json({
      success: true, 
      data: story,
      message: 'Analysis started'
    });
  } catch (error) {
    console.error('Error starting agent story:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to start analysis' 
    }, { status: 500 });
  }
}
