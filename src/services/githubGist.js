const GITHUB_API = 'https://api.github.com'
const GIST_FILENAME = 'Scenara-export.json'

function gistHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }
}

export async function gistCreate(token, content, description) {
  const res = await fetch(`${GITHUB_API}/gists`, {
    method: 'POST',
    headers: gistHeaders(token),
    body: JSON.stringify({
      description,
      public: false,
      files: { [GIST_FILENAME]: { content } },
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Gist create failed (${res.status}): ${body}`)
  }
  return res.json()
}

export async function gistUpdate(token, gistId, content, description) {
  const res = await fetch(`${GITHUB_API}/gists/${gistId}`, {
    method: 'PATCH',
    headers: gistHeaders(token),
    body: JSON.stringify({
      description,
      files: { [GIST_FILENAME]: { content } },
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Gist update failed (${res.status}): ${body}`)
  }
  return res.json()
}

export async function gistGetRaw(token, gistId) {
  const res = await fetch(`${GITHUB_API}/gists/${gistId}`, {
    headers: gistHeaders(token),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Gist fetch failed (${res.status}): ${body}`)
  }
  const gist = await res.json()
  const file = gist.files?.[GIST_FILENAME]
  if (!file) {
    throw new Error(`File "${GIST_FILENAME}" not found in gist`)
  }
  if (file.truncated) {
    const rawRes = await fetch(file.raw_url)
    if (!rawRes.ok) throw new Error('Failed to fetch raw gist content')
    return rawRes.text()
  }
  return file.content
}
