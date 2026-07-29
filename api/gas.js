// api/gas.js
// ブラウザとGoogle Apps Script(GAS)の間に立つ中継サーバー。
// ブラウザは常にこの/api/gasだけを呼び出すので、CORSの制限にかかりません。
// (サーバー同士の通信にはCORSの制約が無いため)

export default async function handler(req, res) {
  // ここにご自身のGASウェブアプリのURLを入れてください
  const GAS_URL = "https://script.google.com/macros/s/AKfycbzF_yc43D4sUpN3pTbhG-u3Gkb9porCVuoqH7rhWJk5ObYu0glbZuP2tzB_7i8vTZK2/exec";

  try {
    const targetUrl = new URL(GAS_URL);

    // ブラウザから来たクエリパラメータ（?action=getConfig&id=xxx など）をそのまま引き継ぐ
    const incoming = new URL(req.url, `http://${req.headers.host}`);
    incoming.searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });

    const fetchOptions = {
      method: req.method,
      redirect: 'follow',
    };

    if (req.method === 'POST') {
      fetchOptions.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
      // VercelはContent-Type: text/plainのボディを文字列としてreq.bodyに渡してくれる
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const gasRes = await fetch(targetUrl.toString(), fetchOptions);
    const text = await gasRes.text();

    res.status(200);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: 'proxy failed', detail: String(err) });
  }
}