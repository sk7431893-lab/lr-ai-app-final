export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { request_id } = req.body;
  if (!request_id) {
    return res.status(400).json({ error: "request_id required" });
  }

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) {
    return res.status(500).json({ error: "FAL_KEY missing" });
  }

  try {
    // Fal.ai se status laa rahe hain
    const resultRes = await fetch(
      `https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video/requests/${request_id}`,
      {
        headers: { Authorization: `Key ${FAL_KEY}` },
      }
    );

    const data = await resultRes.json();
    console.log("Poll response:", JSON.stringify(data));

    // Agar Fal side par bhi error hai
    if (!resultRes.ok) {
      return res.status(500).json({
        error: data.detail || data.message || "Fal poll failed",
        raw: data,
      });
    }

    // COMPLETED case
    if (data.status === "COMPLETED") {
      const videoUrl =
        data?.output?.video?.url ||
        data?.video?.url ||
        data?.videoUrl;

      if (!videoUrl) {
        return res.status(500).json({
          error: "Video URL not found in Fal response",
          raw: data,
        });
      }

      return res.status(200).json({
        status: "COMPLETED",
        videoUrl,
        // raw: data, // debugging ke liye rakh sakte ho
      });
    }

    // FAILED case
    if (data.status === "FAILED") {
      return res.status(500).json({
        status: "FAILED",
        error: "Generation failed on Fal.ai",
        raw: data,
      });
    }

    // Abhi tak complete nahi hua
    return res.status(200).json({
      status: data.status || "IN_QUEUE",
    });
  } catch (err) {
    console.error("Poll error:", err);
    return res.status(500).json({ error: err.message });
  }
}
