const https = require("https");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET" }, body: "" };
  }

  const params = event.queryStringParameters || {};
  const provider = params.provider || "newsdata";
  const apiKey = params.apikey;
  const query = params.q || "artificial intelligence";
  const language = params.language || "en";

  if (!apiKey) return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: { message: "apikey parameter saknas" } }) };

  let newsUrl;
  if (provider === "newsdata") {
    newsUrl = `https://newsdata.io/api/1/latest?apikey=${apiKey}&q=${encodeURIComponent(query)}&language=${language}&category=technology,science`;
  } else if (provider === "gnews") {
    newsUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=${language}&max=10&apikey=${apiKey}`;
  } else if (provider === "newsapi") {
    const from = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&from=${from}&sortBy=publishedAt&pageSize=10&apiKey=${apiKey}`;
  } else {
    return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: { message: "Okänd provider" } }) };
  }

  try {
    const data = await new Promise((resolve, reject) => {
      https.get(newsUrl, res => {
        let body = "";
        res.on("data", c => body += c);
        res.on("end", () => resolve({ statusCode: res.statusCode, body }));
      }).on("error", reject);
    });

    return { statusCode: data.statusCode, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: data.body };
  } catch (e) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: { message: e.message } }) };
  }
};
