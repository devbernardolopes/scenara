export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const chunks = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    const body = Buffer.concat(chunks)
    const contentType = req.headers['content-type'] || 'multipart/form-data'

    const catboxRes = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    })

    const text = await catboxRes.text()
    res.status(catboxRes.status).setHeader('Content-Type', 'text/plain').send(text)
  } catch (err) {
    res.status(502).json({ error: err.message || 'Proxy request failed' })
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}
