import { ApiResponse } from './types';

const BASE_URL = 'https://struct-viz.vercel.app';

export type ProjectFileInput = {
  path: string;
  code: string;
};

export async function convertCodeToInsights(code: string): Promise<ApiResponse> {
  const res = await fetch(`${BASE_URL}/swc-app/convert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: code,
  });

  if (!res.ok) {
    throw new Error(await responseErrorMessage(res));
  }

  return res.json();
} 

async function responseErrorMessage(res: Response) {
  const text = await res.text().catch(() => '');
  if (!text) return `Request failed with status ${res.status}`;

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.details)) return parsed.details.join('\n');
    return parsed.details || parsed.error || text;
  } catch {
    return text;
  }
}

export async function convertProjectToInsights(files: ProjectFileInput[]): Promise<ApiResponse> {
  const res = await fetch(`${BASE_URL}/swc-app/project`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files }),
  });

  if (!res.ok) {
    throw new Error(await responseErrorMessage(res));
  }

  return res.json();
}
