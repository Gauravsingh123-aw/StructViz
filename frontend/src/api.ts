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
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed with status ${res.status}`);
  }

  return res.json();
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
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed with status ${res.status}`);
  }

  return res.json();
}
