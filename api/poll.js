export default async function handler(req, res) {
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
    const statusRes = await fetch(
      `https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video/requests/${request_id}/status`,
      {
        headers: {
          Authorization: `Key ${FAL_KEY}`,
        },
      }
    );

    const statusData = await statusRes.json();
    console.log("Poll status response:", JSON.stringify(statusData));

    if (!statusRes.ok) {
      return res.status(500).json({
        error: statusData.detail || statusData.message || "Poll failed",
        raw: statusData,
      });
    }

    const status = statusData.status;

    if (status === "COMPLETED") {
      const resultRes = await fetch(
        `https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video/requests/${request_id}`,
        {
          headers: {
            Authorization: `Key ${FAL_KEY}`,
          },
        }
      );

      const resultData = await resultRes.json();
      console.log("Poll result response:", JSON.stringify(resultData));

      const videoUrl =
        resultData?.output?.video?.url ||
        resultData?.video?.url ||
        resultData?.videoUrl ||
        null;

      if (!videoUrl) {
        return res.status(500).json({
          error: "Video URL not found in response",
          raw: resultData,
        });
      }

      return res.status(200).json({
        status: "COMPLETED",
        videoUrl,
      });
    }

    if (status === "FAILED") {
      return res.status(200).json({
        status: "FAILED",
        error: "Generation failed on Fal.ai",
      });
    }

    return res.status(200).json({
      status: status || "IN_QUEUE",
    });
  } catch (err) {
    console.error("Poll error:", err);
    return res.status(500).json({ error: err.message });
  }
}
