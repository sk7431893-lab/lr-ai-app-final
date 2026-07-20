export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { prompt, duration, aspect_ratio } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt required" });

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: "FAL_KEY missing in environment" });

  try {
    // Step 1: Submit job to Fal.ai Kling
    const submitRes = await fetch(
      "https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Key ${FAL_KEY}`,
        },
        body: JSON.stringify({
          prompt: prompt,
          duration: duration || "5",
          aspect_ratio: aspect_ratio || "16:9",
        }),
      }
    );

    const submitData = await submitRes.json();
    console.log("Submit response:", JSON.stringify(submitData));

    if (!submitRes.ok) {
      return res.status(500).json({ error: submitData.detail || submitData.message || "Submit failed" });
    }

    const requestId = submitData.request_id;
    if (!requestId) {
      return res.status(500).json({ error: "No request_id received from Fal.ai" });
    }

    // Step 2: Poll for result (max 4 minutes)
    for (let i = 0; i < 48; i++) {
      await new Promise(r => setTimeout(r, 5000)); // 5 sec wait

      const resultRes = await fetch(
        `https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video/requests/${requestId}`,
        {
          headers: { "Authorization": `Key ${FAL_KEY}` },
        }
      );

      const resultData = await resultRes.json();
      console.log(`Poll ${i + 1} - Status:`, resultData.status);

      if (resultData.status === "COMPLETED") {
        const videoUrl =
          resultData?.output?.video?.url ||
          resultData?.video?.url ||
          resultData?.videoUrl;

        if (videoUrl) {
          return res.status(200).json({ videoUrl });
        } else {
          return res.status(500).json({ error: "Video URL not found in response" });
        }
      }

      if (resultData.status === "FAILED") {
        return res.status(500).json({ error: "Video generation failed on Fal.ai" });
      }
    }

    return res.status(504).json({ error: "Timeout - video took too long. Try again." });

  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}
