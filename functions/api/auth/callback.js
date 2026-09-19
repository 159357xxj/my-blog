// GET /api/auth/callback
// Decap CMS GitHub OAuth 第二步：用 code 换 token，校验登录者是否为站主，
// 再通过 postMessage 把 token 交还给 /admin/ 页面。
// 依赖 Pages 环境变量：
//   GITHUB_CLIENT_ID
//   GITHUB_CLIENT_SECRET
//   ALLOWED_GITHUB_LOGIN（允许登录的 GitHub 用户名，默认 159357xxj）
const htmlPage = (script) =>
  new Response(
    `<!doctype html><html><body><p>正在完成登录…</p><script>${script}<\/script></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );

export async function onRequestGet(context) {
  const { request, env } = context;
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code || !env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return htmlPage('alert("登录失败：缺少授权码或服务端未配置环境变量。");window.close();');
  }

  // 用 code 换取 access token（secret 只在服务端使用，不会进入前端）
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;

  if (!token) {
    return htmlPage('alert("登录失败：GitHub 未返回有效 token。");window.close();');
  }

  // 校验登录者身份，只有站主本人可以拿到 token
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  const user = await userRes.json();
  const allowedLogin = (env.ALLOWED_GITHUB_LOGIN || '159357xxj').toLowerCase();

  if ((user.login || '').toLowerCase() !== allowedLogin) {
    return htmlPage('alert("该 GitHub 账号没有管理权限。");window.close();');
  }

  // 按 Decap CMS 约定的 postMessage 协议把 token 交还后台页面
  const message = `authorization:github:${JSON.stringify({ token, provider: 'github' })}`;
  return htmlPage(
    `window.opener && window.opener.postMessage(${JSON.stringify(message)}, ${JSON.stringify(origin)});window.close();`,
  );
}
