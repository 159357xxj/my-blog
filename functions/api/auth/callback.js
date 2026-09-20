// GET /api/auth/callback
// GitHub OAuth 回调：交换授权码、校验管理员账号，并把令牌交还 Decap CMS。

const htmlPage = (script) =>
  new Response(
    `<!doctype html>
<html lang="zh-CN">
  <body>
    <p>正在完成登录...</p>
    <script>${script}<\/script>
  </body>
</html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  );

const callbackPage = (message, targetOrigin) => {
  const encodedMessage = JSON.stringify(message);
  const encodedOrigin = JSON.stringify(targetOrigin);

  return htmlPage(`
    (() => {
      const opener = window.opener;
      const targetOrigin = ${encodedOrigin};
      const handshake = 'authorizing:github';

      const sendHandshake = () => {
        if (opener && !opener.closed) {
          opener.postMessage(handshake, targetOrigin);
        }
      };

      window.addEventListener('message', (event) => {
        if (event.origin !== targetOrigin || event.data !== handshake) return;

        if (opener && !opener.closed) {
          opener.postMessage(${encodedMessage}, targetOrigin);
        }

        window.close();
      });

      sendHandshake();
      window.setTimeout(sendHandshake, 100);
    })();
  `);
};

const errorPage = (message, origin) =>
  callbackPage(
    `authorization:github:error:${JSON.stringify({ message })}`,
    origin,
  );

export async function onRequestGet(context) {
  const { request, env } = context;
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code || !env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return errorPage('登录失败：缺少授权码或服务端 OAuth 环境变量。', origin);
  }

  try {
    const redirectUri = `${origin}/api/auth/callback`;

    const tokenBody = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'chenyiping-blog-admin',
        },
        body: tokenBody.toString(),
      },
    );

    const tokenData = await tokenRes.json().catch(() => null);
    const token = tokenData?.access_token;

    if (!tokenRes.ok || !token) {
      console.error('GitHub OAuth token exchange failed:', tokenRes.status);
      return errorPage(
        '登录失败：GitHub 未返回有效授权令牌，请重新发起登录。',
        origin,
      );
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'chenyiping-blog-admin',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    const user = await userRes.json().catch(() => null);

    if (!userRes.ok || !user?.login) {
      console.error('GitHub user lookup failed:', userRes.status);
      return errorPage('登录失败：无法校验 GitHub 账号，请重新登录。', origin);
    }

    const allowedLogin = (
      env.ALLOWED_GITHUB_LOGIN || '159357xxj'
    ).toLowerCase();

    if (user.login.toLowerCase() !== allowedLogin) {
      return errorPage('该 GitHub 账号没有管理权限。', origin);
    }

    const message =
      `authorization:github:success:${JSON.stringify({
        token,
        provider: 'github',
      })}`;

    return callbackPage(message, origin);
  } catch (error) {
    console.error(
      'GitHub OAuth callback failed:',
      error instanceof Error ? error.message : String(error),
    );
    return errorPage('登录服务暂时异常，请稍后重试。', origin);
  }
}
