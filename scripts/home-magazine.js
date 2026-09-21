'use strict';

const HOME_CONTAINER = '<div class="home-content-container">';
const DATE_FORMAT = 'YYYY-MM-DD';

function toArray(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (typeof collection.toArray === 'function') return collection.toArray();
  if (Array.isArray(collection.data)) return collection.data;
  return Array.from(collection);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

function cleanExcerpt(value, length) {
  const text = String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text.length > length ? `${text.slice(0, length).trimEnd()}...` : text;
}

function formatDate(value) {
  if (value && typeof value.format === 'function') return value.format(DATE_FORMAT);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function findMatchingDiv(html, start) {
  const divPattern = /<\/?div\b[^>]*>/gi;
  divPattern.lastIndex = start;
  let depth = 0;
  let match;

  while ((match = divPattern.exec(html))) {
    if (match[0].startsWith('</')) depth -= 1;
    else depth += 1;
    if (depth === 0) return divPattern.lastIndex;
  }
  return -1;
}

function createHomeMarkup(hexo, pagePosts, page) {
  const theme = hexo.theme.config || {};
  const sitePosts = toArray(hexo.locals.get('posts'));
  const categories = toArray(hexo.locals.get('categories')).sort((left, right) => (
    right.length - left.length || String(left.name).localeCompare(String(right.name), 'zh-CN')
  ));
  const tags = toArray(hexo.locals.get('tags')).sort((left, right) => (
    right.length - left.length || String(left.name).localeCompare(String(right.name), 'zh-CN')
  ));
  const root = hexo.config.root || '/';
  const excerptLength = (theme.home && theme.home.excerpt_length) || 150;
  const author = (theme.info && theme.info.author) || hexo.config.author || '';
  const aboutText = (theme.global && theme.global.open_graph && theme.global.open_graph.description)
    || hexo.config.description || '';
  const readingTime = hexo.extend.helper.get('min2read');
  const urlFor = (path) => {
    const value = String(path || '');
    if (/^https?:\/\//i.test(value)) return value;
    return `${root.replace(/\/$/, '/')}${value.replace(/^\//, '')}`;
  };
  const firstEntry = (collection) => toArray(collection)[0] || null;
  const postTags = (post) => toArray(post.tags);
  const categoryMarkup = (post) => {
    const category = firstEntry(post.categories);
    return category
      ? `<a class="magazine-category" href="${escapeHtml(urlFor(category.path))}">${escapeHtml(category.name)}</a>`
      : '<span class="magazine-category magazine-category-muted">未分类</span>';
  };
  const tagMarkup = (post) => {
    const items = postTags(post).slice(0, 4);
    if (!items.length) return '';
    return `<ul class="magazine-tag-list" aria-label="文章标签">${items.map((tag) => (
      `<li><a href="${escapeHtml(urlFor(tag.path))}"># ${escapeHtml(tag.name)}</a></li>`
    )).join('')}</ul>`;
  };
  const metadataMarkup = (post) => {
    let minutes = '';
    try {
      minutes = readingTime ? readingTime(post.content || '') : '';
    } catch (error) {
      minutes = '';
    }
    const date = formatDate(post.date);
    return `<div class="magazine-meta-row">${date ? `<time datetime="${date}">${date}</time>` : ''}${minutes ? `<span>${escapeHtml(minutes)} 分钟阅读</span>` : ''}</div>`;
  };
  const excerptMarkup = (post) => {
    const source = post.excerpt && post.excerpt !== 'false' ? post.excerpt : post.content;
    const excerpt = cleanExcerpt(source, excerptLength);
    return excerpt ? `<p class="magazine-excerpt">${escapeHtml(excerpt)}</p>` : '';
  };
  const thumbnailFor = (post) => {
    const image = post.thumbnail || post.cover || post.banner;
    if (!image || image === false) return '';
    if (post.thumbnail || (typeof image === 'string' && image.includes('/'))) return image;
    if (hexo.config.marked && hexo.config.marked.postAsset) return `${post.path}/${image}`;
    return '';
  };
  const posts = toArray(pagePosts);
  const sectionHeader = `<header class="magazine-section-header"><div><p class="magazine-eyebrow">文章</p><h2 id="latest-posts-title">最新文章</h2></div><p class="magazine-post-count">共 ${sitePosts.length} 篇文章</p></header>`;

  const paginatorMarkup = (() => {
    if (!page || page.total <= 1) return '';
    const base = String(page.base || '').replace(/^\/+|\/+$/g, '');
    const paginationDir = String(hexo.config.pagination_dir || 'page').replace(/^\/+|\/+$/g, '');
    const hrefFor = (number) => {
      const path = number === 1
        ? base
        : `${base ? `${base}/` : ''}${paginationDir}/${number}/`;
      return escapeHtml(urlFor(path));
    };
    const numbers = Array.from({ length: page.total }, (_, index) => index + 1);
    const previous = page.current > 1
      ? `<a class="extend prev" rel="prev" href="${hrefFor(page.current - 1)}"><i class="fa-regular fa-angle-left"></i></a>`
      : '';
    const next = page.current < page.total
      ? `<a class="extend next" rel="next" href="${hrefFor(page.current + 1)}"><i class="fa-regular fa-angle-right"></i></a>`
      : '';
    const pages = numbers.map((number) => (
      number === page.current
        ? `<span class="page-number current">${number}</span>`
        : `<a class="page-number" href="${hrefFor(number)}">${number}</a>`
    )).join('');
    return `<div class="paginator">${previous}${pages}${next}</div>`;
  })();

  let articleMarkup = '<div class="magazine-empty-state"><p>文章正在整理中。</p></div>';
  if (posts.length) {
    const featured = posts[0];
    const featuredImage = thumbnailFor(featured);
    const featuredCategory = firstEntry(featured.categories);
    const visual = featuredImage
      ? `<div class="magazine-feature-visual has-image"><img src="${escapeHtml(urlFor(featuredImage))}" alt="${escapeHtml(featured.title)}"></div>`
      : `<div class="magazine-feature-visual"><span class="magazine-feature-visual-label">最新</span><strong>${escapeHtml(featuredCategory ? featuredCategory.name : '未分类')}</strong><span class="magazine-feature-visual-title">${escapeHtml(featured.title)}</span></div>`;
    const featuredMarkup = `<article class="home-article-item magazine-feature"><a class="magazine-feature-link" href="${escapeHtml(urlFor(featured.path))}" aria-label="阅读文章：${escapeHtml(featured.title)}">${visual}<div class="magazine-feature-copy">${categoryMarkup(featured)}<h3>${escapeHtml(featured.title)}</h3>${excerptMarkup(featured)}${metadataMarkup(featured)}${tagMarkup(featured)}</div></a></article>`;
    const cardMarkup = posts.slice(1).map((post) => (
      `<li class="home-article-item magazine-article-card"><a class="magazine-article-card-link" href="${escapeHtml(urlFor(post.path))}" aria-label="阅读文章：${escapeHtml(post.title)}"><div class="magazine-article-card-main">${categoryMarkup(post)}<h3>${escapeHtml(post.title)}</h3>${excerptMarkup(post)}</div><div class="magazine-article-card-footer">${metadataMarkup(post)}${tagMarkup(post)}</div></a></li>`
    )).join('');
    articleMarkup = `${featuredMarkup}${cardMarkup ? `<ul class="home-article-list magazine-article-grid">${cardMarkup}</ul>` : ''}`;
  }

  const categoryList = categories.length
    ? `<ul class="magazine-index-list">${categories.slice(0, 6).map((category) => (
      `<li><a href="${escapeHtml(urlFor(category.path))}"><span>${escapeHtml(category.name)}</span><small>${category.length}</small></a></li>`
    )).join('')}</ul>`
    : '<p class="magazine-index-empty">暂未设置分类。</p>';
  const tagList = tags.length
    ? `<ul class="magazine-tag-cloud">${tags.slice(0, 12).map((tag) => (
      `<li><a href="${escapeHtml(urlFor(tag.path))}"># ${escapeHtml(tag.name)}</a></li>`
    )).join('')}</ul>`
    : '<p class="magazine-index-empty">暂未设置标签。</p>';
  const explore = `<section class="magazine-explore" aria-labelledby="explore-content-title"><header class="magazine-subsection-header"><p class="magazine-eyebrow">索引</p><h2 id="explore-content-title">探索内容</h2></header><div class="magazine-explore-grid"><section class="magazine-explore-group" aria-labelledby="category-index-title"><h3 id="category-index-title">分类</h3>${categoryList}</section><section class="magazine-explore-group" aria-labelledby="tag-index-title"><h3 id="tag-index-title">标签</h3>${tagList}</section><a class="magazine-archive-link" href="${escapeHtml(urlFor(hexo.config.archive_dir || 'archives'))}"><span>归档</span><strong>按时间浏览</strong><i class="fa-regular fa-arrow-right" aria-hidden="true"></i></a></div></section>`;
  const about = author || aboutText
    ? `<aside class="magazine-about" aria-labelledby="about-site-title"><div><p class="magazine-eyebrow">关于我</p><h2 id="about-site-title">${escapeHtml(author || hexo.config.title)}</h2></div>${aboutText ? `<p>${escapeHtml(aboutText)}</p>` : ''}</aside>`
    : '';

  return `<section class="home-content-container magazine-home-content" aria-labelledby="latest-posts-title">${sectionHeader}${articleMarkup}${explore}${about}<div class="home-paginator magazine-paginator">${paginatorMarkup}</div></section>`;
}

// Replace only the theme's homepage article container after it has rendered.
hexo.extend.filter.register('after_render:html', function replaceHomeContent(html, data) {
  if (!data || data.path !== 'index.html') return html;
  const start = html.indexOf(HOME_CONTAINER);
  if (start < 0) return html;
  const end = findMatchingDiv(html, start);
  if (end < 0) return html;
  return `${html.slice(0, start)}${createHomeMarkup(this, data.page && data.page.posts, data.page)}${html.slice(end)}`;
}, 20);
