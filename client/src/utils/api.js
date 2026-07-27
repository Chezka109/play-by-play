export async function apiFetchJson(path, { method = 'GET', body, signal } = {}) {
    const resp = await fetch(path, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal,
    })

    if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        throw new Error(`HTTP ${resp.status} ${resp.statusText}: ${text}`)
    }

    return resp.json()
}
