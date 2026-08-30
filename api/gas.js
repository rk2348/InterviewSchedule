// api/gas.js
// ブラウザとGoogle Apps Script(GAS)の間に立つ中継サーバー。
// ブラウザは常にこの/api/gasだけを呼び出すので、CORSの制限にかかりません。
// (サーバー同士の通信にはCORSの制約が無いため)
//
// package.jsonの有無や設定に依存しないよう、CommonJS形式(module.exports)で書いています。
//
// 【重要】このファイルはVercelのプロジェクトの api/gas.js に置いてください。
// Google Apps Scriptの「Code.gs」とは別物です。間違えて入れ替えると
// Apps Script側で「ReferenceError: module is not defined」というエラーになります。
//
// 【修正メモ】
// Google Apps Scriptの /exec URL は、リクエストを受けると必ず一度302リダイレクトを
// 返す仕組みになっています。ここで redirect:'follow'（自動追従）を使うと、
// POSTリクエストがリダイレクト先ではGETに変換されてしまい、送信したデータ（本文）が
// 失われてしまう問題がありました（＝共有リンク発行や回答保存が正しく動かない原因）。
// そのため、リダイレクトはメソッドとボディを保持したまま自前で追いかけるようにしています。

module.exports = async function handler(req, res) {
  // ご自身のGASウェブアプリのURL
  const GAS_URL = "https://script.google.com/macros/s/AKfycbz9EK_dBdiUl56G1kFK11nMTczXNgzBfD1t2NBv-D973gLTOAAgiMK6EEDA7otR3nJI/exec";

  try {
    const targetUrl = new URL(GAS_URL);

    // ブラウザから来たクエリパラメータ（?action=getConfig&id=xxx など）をそのまま引き継ぐ
    const incoming = new URL(req.url, `http://${req.headers.host}`);
    incoming.searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });

    const fetchOptions = {
      method: req.method,
      redirect: 'manual', // 自動追従させず、下のループで自前でリダイレクトを処理する
    };

    if (req.method === 'POST') {
      fetchOptions.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
      // VercelはContent-Type: text/plainのボディを文字列としてreq.bodyに渡してくれる
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    // GASの302リダイレクトを、メソッドとボディを保持したまま最大5回まで自前で追いかける
    let currentUrl = targetUrl.toString();
    let gasRes;
    for (let i = 0; i < 5; i++) {
      gasRes = await fetch(currentUrl, fetchOptions);
      if ([301, 302, 303, 307, 308].includes(gasRes.status)) {
        const location = gasRes.headers.get('location');
        if (!location) break;
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      break;
    }

    const text = await gasRes.text();

    res.status(200);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: 'proxy failed', detail: String(err) });
  }
};