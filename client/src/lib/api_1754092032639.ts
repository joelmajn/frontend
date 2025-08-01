const BASE_URL = "https://x8ki-letl-twmt.n7.xano.io/api:agAjCmuq";

export async function apiRequest(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`Erro na requisição: ${res.statusText}`);
  }

  return res;
}
