const https = require("https");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST" }, body: "" };
  }
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  try {
    const { apiKey, ...payload } = JSON.parse(event.body);
    if (!apiKey) return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: { message: "API-nyckel saknas" } }) };

    const postData = JSON.stringify(payload);
    const data = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: "api.anthropic.com", port: 443, path: "/v1/messages", method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Length": Buffer.byteLength(postData) },
      }, res => {
        let body = "";
        res.on("data", c => body += c);
        res.on("end", () => resolve({ statusCode: res.statusCode, body }));
      });
      req.on("error", reject);
      req.write(postData);
      req.end();
    });

    return { statusCode: data.statusCode, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: data.body };
  } catch (e) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: { message: e.message } }) };
  }
};
