// GET /api/auth
// Decap CMS GitHub OAuth 第一步：跳转到 GitHub 授权页。
// 依赖 Pages 环境变量：GITHUB_CLIENT_ID
export async function onRequestGet(context) {
  const { request, env } = context;
  const clientId = env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return new Response('OAuth 未配置：请在 Cloudflare Pages 设置中添加 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET 环境变量。', { status: 500 });
  }

  const url = new URL(request.url);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${url.origin}/api/auth/callback`,
    scope: 'repo,user',
    state: crypto.randomUUID(),
  });

  return Response.redirect(`https://github.com/login/oauth/authorize?${params}`, 302);
}
