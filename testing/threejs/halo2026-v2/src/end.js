// End layout over the gallery. Built from a layout description (config end.layouts), so
// several editorial options can be compared live: keys 0-5 or ?layout=N.
// All positions are in the 1920x1080 design frame and mapped like the 'edge' scenes,
// so the text stays locked to the bars. Each piece slides up out of its own mask.
window.HaloEnd = function (C) {
  const E = C.end;
  const root = document.createElement('div');
  root.id = 'end';
  document.body.appendChild(root);

  const LOGO = `<svg viewBox="0 0 80 34" fill="currentColor" aria-label="Halo">
    <path d="M23.4679 33.3116L18.5155 33.3215L18.5141 18.525H4.95385V33.3201L0 33.3173V0.0312371L4.95385 0.0340769V13.9403H18.5141L18.5155 0.032657H23.4679V33.3116Z"/>
    <path d="M27.5701 20.4518C29.1087 19.4622 31.1975 18.978 33.028 18.8971L41.6637 18.5179L41.612 16.6267C41.5967 16.0772 41.4124 15.5717 41.2141 15.0691C40.6081 13.7174 39.4004 13.0174 37.9748 12.7732C36.788 12.5715 35.604 12.5715 34.4214 12.7831C32.6049 13.1082 31.097 14.1305 30.7898 16.0417L30.7074 17.0129H25.896C25.9281 13.9843 27.1498 11.5009 29.7175 9.95613C32.334 8.39143 35.9629 8.14579 38.9215 8.62429C41.9737 9.11841 44.5232 10.7413 45.5787 13.7685C45.985 14.9342 46.2029 16.1269 46.2043 17.392L46.2126 33.3158H41.7084L41.7 30.5698C40.657 32.0309 39.2566 33.0404 37.5657 33.5402C36.4627 33.8753 35.3555 33.9917 34.1938 33.9903C31.9124 33.9874 29.5611 33.5288 27.6943 32.1728C26.34 31.1903 25.3947 29.7988 24.9982 28.1489C24.6882 26.8611 24.6631 25.5605 24.9368 24.267C25.2775 22.6583 26.2101 21.3265 27.5715 20.449L27.5701 20.4518ZM37.3116 29.4013C40.3833 28.4244 41.6469 25.7863 41.6609 22.6469L33.2416 23.0133C32.4485 23.0473 31.7141 23.212 31.0202 23.5131C30.054 23.9319 29.4857 24.7767 29.4341 25.8331C29.3754 27.0187 29.8459 28.112 30.8191 28.7822C32.5519 29.9777 35.3248 29.9877 37.313 29.3984L37.3116 29.4013Z"/>
    <path d="M73.1781 32.897C69.9347 34.3183 65.739 34.3481 62.4816 33.0901C59.7449 32.0337 57.5822 29.972 56.387 27.2572C55.2393 24.6475 54.9726 21.636 55.3594 18.8119C55.9625 14.423 58.4576 10.818 62.5933 9.27175C65.6426 8.1316 69.4502 8.12024 72.5051 9.23626C76.5068 10.6973 79.0465 14.1064 79.7572 18.3348C80.1035 20.4007 80.0839 22.4765 79.6692 24.5297C78.9111 28.2852 76.6869 31.3593 73.1767 32.897H73.1781ZM70.0129 29.3615C72.7341 28.6075 74.4529 26.4295 75.0198 23.6891C75.3591 22.0435 75.3591 20.3666 75.0198 18.721C74.4641 16.0247 72.7928 13.8764 70.1595 13.0884C68.5412 12.6042 66.8169 12.5971 65.1889 13.0415C63.3361 13.5484 61.8393 14.7766 60.9569 16.4932C59.9306 18.4881 59.7282 20.9658 60.0759 23.1737C60.5436 26.1469 62.2763 28.5664 65.1889 29.3643C66.7624 29.796 68.4086 29.8059 70.0129 29.3615Z"/>
    <path d="M53.6881 0H48.9479V33.3641H53.6881V0Z"/></svg>`;

  const mask = (cls, inner, style = '') => `<div class="mask ${cls}" style="${style}"><div class="in">${inner}</div></div>`;
  const line = l => (typeof l === 'string' ? [l, 0] : l);   // 'text' or ['text', indent in design px]
  let L, blocks, pieces;

  function build(n) {
    L = E.layouts[n] || E.layouts[0];
    const title = L.title.lines || E.title, copy = L.copy.lines || E.copy;
    root.innerHTML =
      `<div class="blk logo">${mask('', LOGO)}</div>` +
      `<div class="blk title">${title.map(l => mask('tline', line(l)[0], `--ind:${line(l)[1]}`)).join('')}</div>` +
      `<div class="blk copy">${copy.map(l => mask('cline', l)).join('')}</div>` +
      `<div class="blk ctas">${mask('btn primary', E.buttons[0])}${mask('btn secondary', E.buttons[1])}</div>` +
      (L.meta || []).map(m => `<div class="blk meta">${mask('', m.text)}</div>`).join('') +
      (L.contact ? `<div class="blk topcta">${mask('', '<a class="topcta-btn" href="#">' + (L.contact.label || 'Contact us') + '</a>')}</div>` : '') +
      (L.burger ? `<div class="blk burger">${mask('', '<button class="burger-btn" type="button" aria-label="Open menu"><i></i><i></i></button>')}</div>` : '') +
      (L.nav ? `<nav class="blk nav">${E.nav.links.map(t => mask('nlink', t)).join('')}${mask('nlink cta', E.nav.cta)}</nav>` : '');
    const q = s => [...root.querySelectorAll(s)];
    const [logo, titleEl, copyEl, ctas] = ['.logo', '.title', '.copy', '.ctas'].map(s => root.querySelector(s));
    blocks = [[logo, L.logo], [titleEl, L.title], [copyEl, L.copy], [ctas, L.buttons], ...q('.meta').map((el, i) => [el, L.meta[i]]), ...q('.nav').map(el => [el, L.nav]), ...q('.burger').map(el => [el, L.burger]), ...q('.topcta').map(el => [el, L.contact])];
    // reveal order: logo, nav links, meta, title lines, copy lines, buttons
    pieces = [logo.firstElementChild, ...q('.topcta > .mask'), ...q('.burger > .mask'), ...q('.nlink'), ...q('.meta > .mask'), ...q('.tline'), ...q('.cline'), ...q('.btn')].map(m => m.firstElementChild);
    root.dataset.layout = n;
    place();
  }

  function place() {
    const W = innerWidth, H = innerHeight, m0 = C.margin;
    const s = Math.min(W / 1920, H / 1080), m = m0 * s;
    const kx = (W - 2 * m) / (1920 - 2 * m0), ky = (H - 2 * m) / (1080 - 2 * m0);
    const X = x => m + (x - m0) * kx, Y = y => m + (y - m0) * ky;
    for (const [el, P] of blocks) {
      const st = el.style;
      st.left = st.right = st.top = st.bottom = '';
      const align = P.align || 'left';
      if (align === 'right') st.right = `${W - X(P.x)}px`; else st.left = `${X(P.x)}px`;
      if (P.anchor === 'bottom') st.bottom = `${H - Y(P.y)}px`; else st.top = `${Y(P.y)}px`;
      st.transform = align === 'center' ? 'translateX(-50%)' : '';
      st.textAlign = P.textAlign || align;
      st.justifyContent = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
      if (P.w) st.width = `${P.w * s}px`;
      if (P.size) st.fontSize = `${P.size * s}px`;
      if (P.lh) st.lineHeight = P.lh;
      st.gap = P.gap != null ? `${P.gap}em` : '';
      st.letterSpacing = P.ls != null ? `${P.ls}em` : '';
    }
    // buttons can line up with the paragraph's left edge (alignWith: 'copy'), wherever that lands
    for (const [el, P] of blocks) {
      if (P.alignWith !== 'copy') continue;
      const c = root.querySelector('.copy').getBoundingClientRect();
      Object.assign(el.style, { right: '', left: `${c.left}px`, transform: '', justifyContent: 'flex-start' });
    }
    root.querySelectorAll('.tline').forEach(t => { t.style.paddingLeft = `${(+t.style.getPropertyValue('--ind') || 0) * kx}px`; });
  }

  const pick = +(new URLSearchParams(location.search).get('layout') ?? E.layout ?? 0);
  build(pick);
  addEventListener('resize', place);
  document.fonts.ready.then(place);   // re-measure once the fonts are in (buttons follow the paragraph's width)

  let onChange = () => {};
  const api = {
    // screen rects of the text blocks (masks, so unaffected by the slide), for the gallery
    // keepOut on a block (0..1) shrinks its no-photo zone around its centre: 1 = whole block,
    // 0.5 = photos may drift over its outer edges, 0 = photos may pass right through
    boxes: () => blocks.map(([el, P]) => {
      const b = el.getBoundingClientRect(), k = P.keepOut ?? 1, dx = b.width * (1 - k) / 2, dy = b.height * (1 - k) / 2;
      return { left: b.left + dx, right: b.right - dx, top: b.top + dy, bottom: b.bottom - dy };
    }).filter(b => b.right > b.left && b.bottom > b.top),
    layout: n => { build(n); onChange(); },
    bars: () => L.bars || null,   // a layout can set its own final bar rects (design px)
    onLayout: f => { onChange = f; },
    // et: seconds since the end layout started coming in (< 0 = hidden)
    update(et) {
      root.style.visibility = et < 0 ? 'hidden' : 'visible';
      pieces.forEach((el, i) => {
        const k = et < 0 ? 0 : C.easeFn(Math.min(Math.max((et - E.stagger * i) / E.duration, 0), 1));
        // push fully past the mask: 100% of the piece + its mask padding (tight line heights let tops peek)
        el.style.transform = `translateY(calc(${(1 - k) * 100}% + ${(1 - k) * 0.4}em))`;
        el.style.visibility = k > 0 ? 'visible' : 'hidden';   // nothing shows before its slide starts
      });
    },
  };
  // keys 0-5 swap layouts live
  addEventListener('keydown', e => { if (/^[0-9]$/.test(e.key) && E.layouts[+e.key]) api.layout(+e.key); });
  return api;
};
