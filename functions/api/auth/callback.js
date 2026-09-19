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

const errorPage = (message) =>
  htmlPage('alert(' + JSON.stringify(message) + ');window.close();');

export async function onRequestGet(context) {
  const { request, env } = context;
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code || !env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return errorPage('登录失败：缺少授权码或服务端未配置环境变量。');
  }

  try {
  // 用 code 换取 access token（secret 只在服务端使用，不会进入前端）
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: origin + '/api/auth/callback',
    }),
  });
  if (!tokenRes.ok) {
    console.error('GitHub OAuth token exchange failed:', tokenRes.status);
    return errorPage('登录失败：GitHub 拒绝换取授权令牌，请重新发起登录。');
  }

  const tokenData = await tokenRes.json().catch(() => null);
  const token = tokenData && tokenData.access_token;

  if (!token) {
    console.error('GitHub OAuth response did not include an access token.');
    return errorPage('登录失败：GitHub 未返回有效授权令牌，请重新登录。');
  }

  // 校验登录者身份，只有站主本人可以拿到 token
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'chenyiping-blog-admin',
  'X-GitHub-Api-Version': '2022-11-28',
},
  });
  if (!userRes.ok) {
    console.error('GitHub user lookup failed:', userRes.status);
    return errorPage('登录失败：无法校验 GitHub 账号，请重新登录。');
  }

  const user = await userRes.json().catch(() => null);
  const allowedLogin = (env.ALLOWED_GITHUB_LOGIN || '159357xxj').toLowerCase();

  if (((user && user.login) || '').toLowerCase() !== allowedLogin) {
    return errorPage('该 GitHub 账号没有管理权限。');
  }

  // 按 Decap CMS 约定的 postMessage 协议把 token 交还后台页面
  const message = `authorization:github:${JSON.stringify({ token, provider: 'github' })}`;
  return htmlPage(
    `window.opener && window.opener.postMessage(${JSON.stringify(message)}, ${JSON.stringify(origin)});window.close();`,
  );
  } catch (error) {
    console.error('GitHub OAuth callback failed:', error instanceof Error ? error.message : String(error));
    return errorPage('登录服务暂时异常，请稍后重试。');
  }
}
