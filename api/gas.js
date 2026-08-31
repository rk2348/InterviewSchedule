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
// 返す仕組みになっています。この最初のリクエストの時点で doGet/doPost の処理（スプレッド
// シートへの保存など）はすでに実行されており、302リダイレクトは「実行結果を取得するための
// 転送先」を案内しているだけです。そのため、
//   1. 最初のリクエストは元のメソッド（GET/POST）とボディをそのまま送る
//   2. リダイレクト先へは、結果を受け取るだけのGETでアクセスする（ボディの再送はしない）
// という形にする必要があります。以前のコードは redirect:'follow'（自動追従）を使っていた
// ため、POSTがリダイレクト先でGETに変換されてボディが失われ、さらにその後の修正でも
// リダイレクト先に誤ってPOSTボディを送り直してしまっていました。

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

    // 最初のリクエストだけ、元のメソッド・ボディを使う
    let currentUrl = targetUrl.toString();
    let currentOptions = { method: req.method, redirect: 'manual' };
    if (req.method === 'POST') {
      currentOptions.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
      // VercelはContent-Type: text/plainのボディを文字列としてreq.bodyに渡してくれる
      currentOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    let gasRes;
    for (let i = 0; i < 5; i++) {
      gasRes = await fetch(currentUrl, currentOptions);
      if ([301, 302, 303, 307, 308].includes(gasRes.status)) {
        const location = gasRes.headers.get('location');
        if (!location) break;
        currentUrl = new URL(location, currentUrl).toString();
        // リダイレクト先は実行結果を取得するだけなので、2回目以降は常にGETにする
        // （ボディを再送しない。doPost/doGetの処理は最初のリクエストで既に完了している）
        currentOptions = { method: 'GET', redirect: 'manual' };
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