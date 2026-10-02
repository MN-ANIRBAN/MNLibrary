export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ImgBB API key is not configured on the server.' });
  }

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'content-type': req.headers['content-type'],
      },
      body: req,
      duplex: 'half'
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("ImgBB API server error:", error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
