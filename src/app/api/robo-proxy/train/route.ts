import { NextRequest, NextResponse } from 'next/server';

interface TrainRequestBody {
  api_key: string;
  workspace: string;
  project: string;
  version: number;
  model_type: string;
  epochs?: number;
  speed?: 'fast' | 'accurate';
}

export async function POST(request: NextRequest) {
  let body: TrainRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { api_key, workspace, project, version, model_type, epochs, speed } = body;

  const missingFields: string[] = [];
  if (!api_key) missingFields.push('api_key');
  if (!workspace) missingFields.push('workspace');
  if (!project) missingFields.push('project');
  if (version === undefined || version === null) missingFields.push('version');
  if (!model_type) missingFields.push('model_type');

  if (missingFields.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missingFields.join(', ')}` },
      { status: 400 }
    );
  }

  const requestBody: Record<string, unknown> = { version, model_type };
  if (epochs !== undefined) requestBody.epochs = epochs;
  if (speed !== undefined) requestBody.speed = speed;

  const roboflowUrl = `https://api.roboflow.com/${workspace}/${project}/jobs?api_key=${api_key}`;

  try {
    const roboflowResponse = await fetch(roboflowUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (roboflowResponse.status === 403) {
      return NextResponse.json(
        { error: 'API key lacks required training permissions' },
        { status: 403 }
      );
    }

    if (roboflowResponse.status === 429) {
      const retryAfter = roboflowResponse.headers.get('Retry-After');
      const headers: Record<string, string> = {};
      if (retryAfter) headers['Retry-After'] = retryAfter;
      return NextResponse.json(
        { error: 'Rate limited by Roboflow API' },
        { status: 429, headers }
      );
    }

    if (!roboflowResponse.ok) {
      return NextResponse.json(
        { error: 'Roboflow API request failed' },
        { status: 500 }
      );
    }

    return NextResponse.json(await roboflowResponse.json());

  } catch {
    return NextResponse.json(
      { error: 'Failed to connect to Roboflow API' },
      { status: 500 }
    );
  }
}