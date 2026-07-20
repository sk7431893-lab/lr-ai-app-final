import fetch from 'node-fetch';

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { prompt, image_url, duration, aspect_ratio } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt required" });

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: "FAL_KEY missing" });

  try {
    // Step 1: Submit job to Fal.ai
    const submitRes = await fetch("https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${FAL_KEY}`,
      },
      body: JSON.stringify({
        prompt: prompt,
        duration: String(duration || "5"),
        aspect_ratio: aspect_ratio || "16:9",
      }),
    });

    const submitData = await submitRes.json();
    if (!submitRes.ok) return res.status(500).json({ error: submitData.detail || "Submit failed" });

    const requestId = submitData.request_id;
    if (!requestId) return res.status(500).json({ error: "No request_id from Fal.ai" });

    // Step 2: Poll for result
    for (let i = 0; i < 48; i++) {
      await new Promise(r => setTimeout(r, 5000));

      const statusRes = await fetch(
        `https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video/requests/${requestId}`,
        {
          headers: { "Authorization": `Key ${FAL_KEY}` },
        }
      );

      const statusData = await statusRes.json();
      console.log(`Poll ${i + 1}:`, statusData.status);

      if (statusData.status === "COMPLETED") {
        const videoUrl =
          statusData.output?.video?.url ||
          statusData.video?.url ||
          statusData.videoUrl;

        if (videoUrl) return res.status(200).json({ videoUrl });
      }

      if (statusData.status === "FAILED") {
        return res.status(500).json({ error: "Video generation failed" });
      }
    }

    return res.status(504).json({ error: "Timeout - try again" });

  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
