import { ApiResponse } from './types';

const BASE_URL = 'http://localhost:4000';

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