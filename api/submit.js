export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { prompt, duration, aspect_ratio } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt required" });
  }

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) {
    return res.status(500).json({ error: "FAL_KEY missing" });
  }

  try {
    const submitRes = await fetch(
      "https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${FAL_KEY}`,
        },
        body: JSON.stringify({
          prompt: prompt,
          duration: Number(duration) || 5,
          aspect_ratio: aspect_ratio || "16:9",
        }),
      }
    );

    const data = await submitRes.json();
    console.log("Submit response:", JSON.stringify(data));

    if (!submitRes.ok) {
      return res.status(500).json({
        error: data.detail || data.message || "Submit failed",
        raw: data,
      });
    }

    if (!data.request_id) {
      return res.status(500).json({
        error: "No request_id received",
        raw: data,
      });
    }

    return res.status(200).json({
      request_id: data.request_id,
    });
  } catch (err) {
    console.error("Submit error:", err);
    return res.status(500).json({ error: err.message });
  }
}
