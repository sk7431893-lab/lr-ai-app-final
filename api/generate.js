export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).send();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { prompt, image_url, duration, aspect_ratio } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const FAL_KEY = process.env.FAL_KEY;

  if (!FAL_KEY) {
    console.error("FAL_KEY is not set.");
    return res.status(500).json({ error: "Server configuration error: FAL_KEY missing." });
  }

  try {
    const response = await fetch("https://fal.run/fal-ai/kling-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${FAL_KEY}`,
      },
      body: JSON.stringify({
        prompt: prompt,
        image_url: image_url, // optional
        duration: parseInt(duration) || 5,
        aspect_ratio: aspect_ratio || "16:9"
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Fal.ai API Error:", data);
      const errorMessage = data.detail ? data.detail[0].msg : data.error || "Unknown Fal.ai API error";
      return res.status(response.status).json({ error: `Fal.ai API error: ${errorMessage}` });
    }

    res.status(200).json({ videoUrl: data.video_url });

  } catch (error) {
    console.error("Backend error:", error);
    res.status(500).json({ error: "Internal Server Error during video generation." });
  }
}
