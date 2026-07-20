export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { request_id } = req.body;
  if (!request_id) return res.status(400).json({ error: "request_id required" });

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: "FAL_KEY missing" });

  try {
    const resultRes = await fetch(
      `https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video/requests/${request_id}`,
      {
        headers: { "Authorization": `Key ${FAL_KEY}` },
      }
    );

    const data = await resultRes.json();

    if (data.status === "COMPLETED") {
      const videoUrl =
        data?.output?.video?.url ||
        data?.video?.url ||
        data?.videoUrl;

      if (videoUrl) {
        return res.status(200).json({ status: "COMPLETED", videoUrl });
      } else {
        return res.status(500).json({ 
          error: "Video URL not found",
          raw: data 
        });
      }
    }

    if (data.status === "FAILED") {
      return res.status(500).json({ status: "FAILED", error: "Generation failed" });
    }

    return res.status(200).json({ status: data.status || "IN_QUEUE" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
