/* Ceylon Gem Lanka website */
(function () {
  'use strict';
  var page = document.body.dataset.page;
  var cfg = window.PRYME || {};
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gsap = window.gsap;
  var BRAND = 'Ceylon Gem Lanka';
  // Both WhatsApp numbers are shown everywhere. The first one opens when someone taps a WhatsApp button.
  var CONTACTS = [{ num: '94711027938', label: '+94 71 102 7938' }, { num: '14028087890', label: '+1 (402) 808-7890' }];
  // Used when the store has not entered its own bank accounts yet.
  var DEFAULT_BANKS = [
    { bank: 'Seylan Bank PLC', number: '0660 3337 1604 001', name: 'U.L.D.R.P Gunasinghe' },
    { bank: 'Sampath Bank PLC', number: '110655302478', name: 'U.L.D.R.P Gunasinghe' },
  ];
  var WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.600 15.100L2 22l5-1.300A10 10 0 1 0 12 2zm0 18.200a8.200 8.200 0 0 1-4.200-1.200l-.3-.2-3 .8.800-2.900-.2-.3A8.200 8.200 0 1 1 12 20.200zm4.600-6.100c-.3-.1-1.500-.7-1.700-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.200-.3.200-.5.100a6.700 6.700 0 0 1-3.300-2.900c-.3-.4.300-.4.800-1.400.1-.2 0-.3 0-.5l-.8-1.800c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.100-.7.300-.2.300-.9.900-.9 2.200s.9 2.500 1 2.700c.1.200 1.800 2.800 4.400 3.900 1.600.7 2.300.8 3.100.6.500-.1 1.500-.6 1.700-1.200.2-.6.2-1.100.1-1.200-.1-.1-.3-.2-.6-.3z"/></svg>';
  var LOGO = '<img class="logo" src="assets/logo.svg" alt="">';

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(v) {
    return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function qs(name) { return new URLSearchParams(location.search).get(name); }
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }
  function money(n, cur) {
    return (cur || 'LKR') + ' ' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function payPrice(p) { return p.finalPrice !== undefined && p.finalPrice !== null ? p.finalPrice : p.price; }
  function formatPrice(p) {
    if (p.price === null || p.price === undefined) return 'Ask for price';
    return money(payPrice(p), p.currency);
  }
  // The price with the old price struck through when there is a discount.
  function priceHtml(p) {
    if (p.price === null || p.price === undefined) return 'Ask for price';
    var now = '<span class="notranslate">' + esc(money(payPrice(p), p.currency)) + '</span>';
    if (p.discount && payPrice(p) < p.price) {
      var off = p.discount.type === 'percent' ? p.discount.value + '% off' : 'Save ' + money(p.price - payPrice(p), p.currency);
      return now + ' <s class="was notranslate">' + esc(money(p.price, p.currency)) + '</s> <span class="off">' + esc(off) + '</span>';
    }
    return now;
  }
  function buyable(p) { return !p.sold && p.currency === 'LKR' && p.price !== null && p.price !== undefined; }
  // Every gem that is not sold can go in the cart. Gems without an LKR price are priced on WhatsApp.
  function cartable(p) { return !p.sold; }
  function askMessage(p, qty) {
    return gemMessage(p).replace('I would like to buy this gem:', 'I would like to buy this gem' + (qty > 1 ? ' (quantity ' + qty + ')' : '') + '. Please tell me the price:');
  }

  /* ---------- cart and account ---------- */
  var CART_KEY = 'cgl_cart_' + (cfg.key || 'local');
  var TOKEN_KEY = 'cgl_token_' + (cfg.key || 'local');
  function cartGet() { var c = store(CART_KEY); return Array.isArray(c) ? c : []; }
  function cartSet(c) { store(CART_KEY, c); updateCartBadge(); }
  function cartAdd(slug, qty, max) {
    var c = cartGet();
    var it = c.filter(function (x) { return x.slug === slug; })[0];
    if (it) it.qty = Math.min(max || 1, it.qty + qty);
    else c.push({ slug: slug, qty: Math.min(max || 1, qty) });
    cartSet(c);
  }
  function cartCount() { return cartGet().reduce(function (n, i) { return n + i.qty; }, 0); }
  function updateCartBadge() {
    var n = cartCount();
    $$('[data-cart-count]').forEach(function (b) { b.textContent = n; b.classList.toggle('hidden', !n); });
  }
  function token() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function setToken(t) { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) { /* private mode */ } }
  // Talks to Pryme Store as the signed-in customer. Errors come back as { code, details }.
  function shopApi(method, path, body, raw) {
    if (!cfg.api || !cfg.key) return Promise.reject({ code: 'offline' });
    var headers = {};
    var t = token();
    if (t) headers.Authorization = 'Bearer ' + t;
    if (body !== undefined && !raw) headers['Content-Type'] = 'application/json';
    if (raw) headers['Content-Type'] = 'application/octet-stream';
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 75000);
    return fetch(cfg.api + '/public/v1/' + encodeURIComponent(cfg.key) + path, {
      method: method,
      headers: headers,
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
      signal: ctrl.signal,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (r.status === 401) setToken(null);
        if (!r.ok) throw { code: data.error || (r.status === 413 ? 'file_too_large' : 'default'), details: data.details, status: r.status };
        return data;
      });
    }, function () { throw { code: 'network' }; }).finally(function () { clearTimeout(timer); });
  }
  function metaLine(p) {
    return [p.type, p.carat ? p.carat + ' ct' : ''].filter(Boolean).join(', ');
  }

  var waNumber = CONTACTS[0].num;
  function waLink(text, num) { return 'https://wa.me/' + (num || waNumber) + (text ? '?text=' + encodeURIComponent(text) : ''); }
  function numbersHtml(text) {
    return CONTACTS.map(function (c) {
      return '<a class="wa-num notranslate" target="_blank" rel="noopener" href="' + esc(waLink(text, c.num)) + '">' + esc(c.label) + '</a>';
    }).join(' <span class="sep">/</span> ');
  }
  function gemUrl(p) { return 'gem.html?gem=' + encodeURIComponent(p.slug); }
  function gemMessage(p) {
    var abs = new URL(gemUrl(p), location.href).href;
    var bits = [p.name, metaLine(p)].filter(Boolean).join(' - ');
    return 'Hello Ceylon Gem Lanka, I would like to buy this gem:\n' + bits + '\n' + abs;
  }
  function wireWa() {
    $$('[data-wa]').forEach(function (a) {
      a.href = waLink(a.dataset.wa);
      a.target = '_blank';
      a.rel = 'noopener';
    });
    $$('[data-phone]').forEach(function (a) { a.href = waLink(); a.target = '_blank'; a.rel = 'noopener'; });
    $$('[data-wa-num]').forEach(function (a) { var c = CONTACTS[+a.dataset.waNum]; a.href = waLink(a.dataset.text || '', c.num); a.target = '_blank'; a.rel = 'noopener'; });
    $$('[data-numbers]').forEach(function (n) { n.innerHTML = numbersHtml(n.dataset.numbers || ''); });
    var f = $('.wa-float');
    if (f) f.href = waLink('Hello Ceylon Gem Lanka, I have a question.');
  }

  /* ---------- translation ---------- */
  // Google's website translator. A visitor whose browser uses another language sees the site in it straight away.
  var LANGS = [['en', 'English'], ['si', 'සිංහල'], ['ta', 'தமிழ்'], ['zh-CN', '中文 (简体)'], ['zh-TW', '中文 (繁體)'], ['ja', '日本語'], ['ko', '한국어'], ['th', 'ไทย'], ['hi', 'हिन्दी'], ['ar', 'العربية'], ['ru', 'Русский'], ['de', 'Deutsch'], ['fr', 'Français'], ['es', 'Español'], ['it', 'Italiano'], ['pt', 'Português'], ['nl', 'Nederlands'], ['tr', 'Türkçe'], ['iw', 'עברית'], ['ms', 'Bahasa Melayu'], ['id', 'Bahasa Indonesia'], ['vi', 'Tiếng Việt'], ['pl', 'Polski'], ['uk', 'Українська'], ['sv', 'Svenska'], ['fa', 'فارسی'], ['bn', 'বাংলা'], ['ur', 'اردو']];
  function mapLang(tag) {
    var t = String(tag || 'en').toLowerCase();
    if (/^zh-(tw|hk|mo)|^zh-hant/.test(t)) return 'zh-TW';
    if (/^zh/.test(t)) return 'zh-CN';
    var base = t.split('-')[0];
    return { he: 'iw', nb: 'no', nn: 'no', fil: 'tl', jv: 'jw' }[base] || base;
  }
  function cookieLang() {
    var m = /(?:^|;\s*)googtrans=\/[^/;]*\/([^;]+)/.exec(document.cookie);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function writeLang(code) {
    var expire = 'expires=Thu, 01 Jan 1970 00:00:00 GMT;';
    var hosts = ['', '; domain=' + location.hostname];
    hosts.forEach(function (h) { document.cookie = 'googtrans=; path=/; ' + expire + h; });
    if (code && code !== 'en') document.cookie = 'googtrans=/en/' + code + '; path=/';
  }
  function translation(header) {
    var chosen = store('cgl_lang');
    var current = cookieLang();
    if (!chosen && !current) {
      var auto = mapLang((navigator.languages && navigator.languages[0]) || navigator.language);
      if (auto !== 'en') { writeLang(auto); current = auto; }
    }
    current = current || 'en';
    var btn = $('.lang-btn', header), menu = $('.lang-menu', header);
    $('.lang-code', btn).textContent = current.split('-')[0].toUpperCase();
    menu.innerHTML = '<p>Choose a language</p><div class="lang-list">' + LANGS.map(function (l) {
      return '<button type="button" data-lang="' + l[0] + '"' + (l[0] === current ? ' aria-current="true"' : '') + '>' + esc(l[1]) + '</button>';
    }).join('') + '</div><p class="lang-note">Translated automatically by Google. Prices and order details stay the same.</p>';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = menu.classList.toggle('hidden') === false;
      btn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (e) { if (!menu.contains(e.target)) { menu.classList.add('hidden'); btn.setAttribute('aria-expanded', 'false'); } });
    $$('[data-lang]', menu).forEach(function (b) {
      b.addEventListener('click', function () {
        store('cgl_lang', b.dataset.lang);
        writeLang(b.dataset.lang);
        location.reload();
      });
    });
    if (current !== 'en') {
      var holder = document.createElement('div');
      holder.id = 'google_translate_element';
      holder.hidden = true;
      document.body.append(holder);
      window.cglTranslateInit = function () {
        new window.google.translate.TranslateElement({ pageLanguage: 'en', autoDisplay: false }, 'google_translate_element');
      };
      var sc = document.createElement('script');
      sc.src = 'https://translate.google.com/translate_a/element.js?cb=cglTranslateInit';
      sc.async = true;
      document.head.append(sc);
    }
  }

  /* ---------- shared layout ---------- */
  function layout() {
    if (cfg.api) {
      var pc = document.createElement('link');
      pc.rel = 'preconnect';
      pc.href = cfg.api;
      pc.crossOrigin = 'anonymous';
      document.head.append(pc);
    }
    var bg = document.createElement('div');
    bg.className = 'aurora';
    bg.innerHTML = '<i></i><i></i><i></i>';
    document.body.prepend(bg);

    var links = [['index.html', 'Home', 'home'], ['about.html', 'About us', 'about'], ['gems.html', 'Our Gems', 'gems'], ['nature.html', 'Our Nature', 'nature'], ['events.html', 'Gem Events', 'events'], ['contact.html', 'Contact us', 'contact']];
    var ICONS = {
      globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
      user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.500 4-7 8-7s7.200 2.500 8 7"/></svg>',
      bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    };
    var header = document.createElement('header');
    header.className = 'top';
    header.innerHTML =
      '<div class="strip"><span class="strip-nums">WhatsApp <span data-numbers></span></span><span class="strip-delivery">Island-wide delivery in <b data-days>4</b> working days</span><a href="track.html">Track your order</a></div>' +
      '<div class="bar"><a class="brand notranslate" href="index.html">' + LOGO + BRAND + '</a>' +
      '<nav class="nav" id="nav" aria-label="Main">' +
      links.map(function (l) { return '<a href="' + l[0] + '"' + (l[2] === page ? ' aria-current="page"' : '') + '>' + l[1] + '</a>'; }).join('') +
      '<a class="nav-extra" href="track.html">Track your order</a><a class="nav-extra" href="account.html">My account</a>' +
      '<a class="buy-link" href="buy.html"' + (page === 'buy' ? ' aria-current="page"' : '') + '>Buy now</a></nav>' +
      '<div class="tools"><button class="tool lang-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Language">' + ICONS.globe + '<span class="lang-code notranslate"></span></button>' +
      '<a class="tool" href="' + (token() ? 'account.html' : 'login.html') + '" aria-label="My account">' + ICONS.user + '</a>' +
      '<a class="tool" href="cart.html" aria-label="Cart">' + ICONS.bag + '<span class="cart-count hidden notranslate" data-cart-count></span></a>' +
      '<button class="menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="nav"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8h16M4 16h16"/></svg></button></div></div>' +
      '<div class="lang-menu hidden notranslate" role="menu" aria-label="Choose a language"></div>';
    document.body.prepend(header);
    translation(header);
    updateCartBadge();

    var btn = $('.menu-btn', header), nav = $('.nav', header);
    function setMenu(open) {
      nav.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      updateHeader();
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); setMenu(!nav.classList.contains('open')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    document.addEventListener('click', function (e) { if (!header.contains(e.target)) setMenu(false); });

    var hero = $('.hero');
    function updateHeader() {
      var dark = hero && hero.getBoundingClientRect().bottom > 70;
      if (nav.classList.contains('open')) return;
            document.body.classList.toggle('in-hero', !!dark);
    }
    addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();

    var foot = document.createElement('footer');
    foot.className = 'foot';
    foot.innerHTML =
      '<div class="wrap"><div class="foot-grid"><div><a class="brand notranslate" href="index.html">' + LOGO + BRAND + '</a>' +
      '<p>Genuine, quality gemstones at low prices.</p><p class="foot-ngja"><img class="ngja-logo" src="assets/ngja-logo.png" alt="National Gem &amp; Jewellery Authority logo" width="46" height="46" loading="lazy"><span>NGJA licensed gem dealer with more than 25 years of experience</span></p>' +
      '<p class="foot-delivery">Delivery within Sri Lanka only, to your door within <b data-days>4</b> working days. Delivery charge <b class="notranslate" data-fee>LKR 450</b>.</p></div>' +
      '<div><h2>Shop</h2><ul><li><a href="gems.html">Our Gems</a></li><li><a href="buy.html">Buy now</a></li><li><a href="cart.html">Cart</a></li><li><a href="account.html">My account</a></li><li><a href="track.html">Track your order</a></li></ul></div>' +
      '<div><h2>About</h2><ul><li><a href="about.html">About us</a></li><li><a href="nature.html">Our Nature</a></li><li><a href="events.html">Gem Events</a></li><li><a href="contact.html">Contact us</a></li><li><a href="privacy.html">Privacy Policy</a></li><li><a href="terms.html">Terms &amp; Conditions</a></li></ul></div>' +
      '<div><h2>WhatsApp</h2><ul class="foot-nums"><li><a data-wa-num="0" href="#" class="notranslate">+94 71 102 7938</a></li><li><a data-wa-num="1" href="#" class="notranslate">+1 (402) 808-7890</a></li></ul><p class="pay-note">We accept bank transfers to Seylan Bank and Sampath Bank.</p></div></div>' +
      '<p class="copy">&copy; ' + new Date().getFullYear() + ' <span class="notranslate">' + BRAND + '</span>. Developed by <span class="notranslate">Pryme X AI</span></p></div>';
    document.body.append(foot);

    var wa = document.createElement('a');
    wa.className = 'wa-float';
    wa.setAttribute('aria-label', 'Chat with us on WhatsApp');
    wa.target = '_blank';
    wa.rel = 'noopener';
    wa.innerHTML = WA_ICON;
    document.body.append(wa);

    // Opens the next page faster by fetching it when a link is about to be used.
    if (HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
      var rules = document.createElement('script');
      rules.type = 'speculationrules';
      rules.textContent = JSON.stringify({ prefetch: [{ where: { href_matches: '/*' }, eagerness: 'moderate' }] });
      document.head.append(rules);
    }
    wireWa();
  }

  /* ---------- hero video ---------- */
  // Each clip tries a phone/desktop size, then the Netlify relay in _redirects if the direct link is refused.
  function pixabay(base) {
    // The video sits behind glass, so smaller files look the same and load much faster.
    var phone = matchMedia('(max-width: 700px)').matches;
    var order = phone ? ['tiny', 'small', 'medium', 'large'] : ['small', 'medium', 'large'];
    var list = order.map(function (s) { return base + '_' + s + '.mp4'; });
    list.push(base.replace('https://cdn.pixabay.com/video/', 'pv/') + '_large.mp4');
    return list;
  }
  function pexels(path) { return ['https://videos.pexels.com/video-files/' + path, 'px/' + path]; }
  var PB = 'https://cdn.pixabay.com/video/';
  var CLIPS = {
    home: [pexels('18993612/18993612-hd_1920_1080_50fps.mp4'), pixabay(PB + '2023/09/24/182129-871642673')],
    about: [pixabay(PB + '2023/11/29/191283-889685028')],
    gems: [pixabay(PB + '2023/08/07/174999-852541228')],
    contact: [pixabay(PB + '2023/09/29/182817-869773961')],
    buy: [pixabay(PB + '2020/11/23/57165-484331013')],
    closing: [pixabay(PB + '2025/06/18/286459')],
    cred: [pixabay(PB + '2024/10/17/236710')],
    island: [pixabay(PB + '2024/10/11/235859')],
    contactcard: [pixabay(PB + '2025/08/22/299021')],
    gemsband: [pixabay(PB + '2024/12/13/246461')],
    nature: [pixabay(PB + '2025/12/17/322546')],
    events: [pixabay(PB + '2025/04/16/272321')],
    login: [pixabay(PB + '2023/10/25/186465-878145163')],
    account: [pixabay(PB + '2024/10/10/235737')],
    cart: [pixabay(PB + '2025/07/03/289235')],
    checkout: [pixabay(PB + '2023/09/29/182813-869773956')],
    order: [pixabay(PB + '2025/07/31/294529')],
    track: [pixabay(PB + '2025/12/17/322549')],
    privacy: [pixabay(PB + '2025/09/04/301646')],
    terms: [pixabay(PB + '2023/08/16/176299-855206492')],
  };
  function sourcesFor(name, i, list) {
    // A file saved in assets/video always wins, so no code edit is needed to use your own clip.
    return ['assets/video/' + name + '-' + (i + 1) + '.mp4'].concat(list);
  }
  // Banner videos only start loading when they come near the screen.
  function bandVideos() {
    var conn = navigator.connection;
    if (reduce || (conn && conn.saveData)) return;
    $$('[data-bgvideo]').forEach(function (band) {
      var list = CLIPS[band.dataset.bgvideo];
      if (!list) return;
      var sources = sourcesFor(band.dataset.bgvideo, 0, list[0]);
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var v = $('video.band-video', band);
          if (e.isIntersecting && !v) {
            v = document.createElement('video');
            v.className = 'band-video';
            v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
            v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
            var i = 0;
            v.addEventListener('error', function () { i++; if (i < sources.length) { v.src = sources[i]; v.play().catch(function () {}); } });
            v.addEventListener('playing', function () { v.classList.add('on'); });
            v.src = sources[0];
            band.prepend(v);
            v.play().catch(function () {});
          } else if (v) {
            if (e.isIntersecting) v.play().catch(function () {}); else v.pause();
          }
        });
      }, { rootMargin: '150px' });
      io.observe(band);
    });
  }
  var heroKey = null;

  function playHero(override) {
    var hero = $('[data-hero]');
    if (!hero) return;
    var box = $('.hero-media', hero);
    var name = hero.dataset.hero;
    if (reduce) return;

    var clips = CLIPS[name] || [];
    if (override) clips = [[override]];
    else clips = clips.map(function (c, i) { return sourcesFor(name, i, c); });
    var key = JSON.stringify(clips);
    if (key === heroKey) return;
    heroKey = key;
    box.innerHTML = '';

    var videos = clips.map(function (sources) {
      var v = document.createElement('video');
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('muted', '');
      v.loop = true;
      v.preload = 'none';
      var i = 0;
      v.addEventListener('error', function () {
        i++;
        if (i < sources.length) { v.src = sources[i]; v.load(); if (v.dataset.active) v.play().catch(function () {}); }
      });
      v.dataset.first = sources[0];
      box.append(v);
      return v;
    });
    if (!videos.length) return;

    var index = 0;
    function show(n) {
      videos.forEach(function (v, k) {
        if (k === n) {
          v.dataset.active = '1';
          if (!v.getAttribute('src')) v.src = v.dataset.first;
          var p = v.play();
          if (p) p.catch(function () {});
          v.addEventListener('playing', function once() { v.classList.add('on'); v.removeEventListener('playing', once); });
          if (v.readyState > 2) v.classList.add('on');
        } else {
          delete v.dataset.active;
          v.classList.remove('on');
          setTimeout(function () { if (!v.dataset.active) v.pause(); }, 1500);
        }
      });
    }
    // The page and its text appear first. The video follows a moment later.
    setTimeout(function () { show(0); }, 120);
    if (videos.length > 1) setInterval(function () {
      if (document.hidden) return;
      index = (index + 1) % videos.length;
      show(index);
    }, 16000);
    // Phones in battery-saver mode can block autoplay until the first touch.
    ['pointerdown', 'scroll'].forEach(function (ev) {
      addEventListener(ev, function retry() {
        if (videos[index].paused) videos[index].play().catch(function () {});
        removeEventListener(ev, retry);
      }, { passive: true });
    });
    document.addEventListener('visibilitychange', function () {
      var cur = videos[index];
      if (document.hidden) cur.pause(); else cur.play().catch(function () {});
    });
  }

  /* ---------- catalogue ---------- */
  // Reads the general Pryme Store product format into the fields this gem website shows.
  function normalise(data) {
    if (!data || !data.products) return data;
    data.products.forEach(function (p) {
      p.type = p.category || '';
      p.specs = p.specs || [];
      var w = p.specs.filter(function (s) { return /^weight/i.test(s.label); })[0];
      p.carat = w ? parseFloat(w.value) || null : null;
      p.searchText = (p.name + ' ' + p.type + ' ' + p.specs.map(function (s) { return s.value; }).join(' ')).toLowerCase();
    });
    return data;
  }
  function catalog(onData) {
    if (cfg.demo) { onData(window.YG_DEMO || { products: [], site: {} }, true); return; }
    if (!cfg.api || !cfg.key) { onData(null, true); return; }
    var cacheKey = 'yg_catalog_' + cfg.key;
    var cached = store(cacheKey);
    if (cached) onData(normalise(cached), false);
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 75000);
    fetch(cfg.api + '/public/v1/' + encodeURIComponent(cfg.key) + '/catalog', { signal: ctrl.signal, cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('catalog'); return r.json(); })
      .then(function (data) {
        store(cacheKey, JSON.parse(JSON.stringify(data)));
        onData(normalise(data), true);
      })
      .catch(function () { if (!cached) onData(null, true); })
      .finally(function () { clearTimeout(timer); });
  }
  var siteInfo = { deliveryFee: 450, deliveryDays: 4, bankAccounts: DEFAULT_BANKS, cardPayments: false, cardMode: '' };
  function applySite(data) {
    if (!data || !data.site) return;
    var st = data.site;
    if (st.deliveryFee !== undefined) siteInfo.deliveryFee = st.deliveryFee;
    if (st.deliveryDays) siteInfo.deliveryDays = st.deliveryDays;
    if (st.bankAccounts && st.bankAccounts.length) siteInfo.bankAccounts = st.bankAccounts;
    siteInfo.cardPayments = Boolean(st.cardPayments);
    siteInfo.cardMode = st.cardMode || (st.cardPayments ? 'payhere' : '');
    $$('[data-days]').forEach(function (n) { n.textContent = siteInfo.deliveryDays; });
    $$('[data-fee]').forEach(function (n) { n.textContent = money(siteInfo.deliveryFee); });
  }
  function skeletons(n) { var s = ''; for (var i = 0; i < n; i++) s += '<div class="skeleton"></div>'; return s; }
  function noteHtml(title, text) {
    return '<div class="note"><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p><a class="btn btn-solid" data-wa="Hello Ceylon Gem Lanka, which gemstones do you have available?" href="#">Chat with us</a></div>';
  }
  function soldBand(large) { return '<span class="soldband' + (large ? ' large' : '') + '">Sold out</span>'; }

  function cardHtml(p) {
    var img = p.images[0];
    var cart = cartable(p) ? '<button type="button" class="card-cart" data-add="' + esc(p.slug) + '" data-max="' + (p.stock || 1) + '">Add to cart</button>' : '';
    return '<article class="gem-card' + (p.sold ? ' is-sold' : '') + '"><a class="gem-link" href="' + esc(gemUrl(p)) + '">' +
      '<div class="gem-pic">' + (img ? '<img src="' + esc(img.thumb) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async" draggable="false"' + (p.sold ? ' class="sold-img"' : '') + '>' : '') + (p.sold ? soldBand() : '') + '</div>' +
      '<div class="gem-info"><h3>' + esc(p.name) + '</h3><div class="gem-meta">' + esc(metaLine(p)) + '</div><div class="gem-price">' + (p.sold ? 'Sold out' : priceHtml(p)) + '</div></div></a>' +
      (p.discount && !p.sold ? '<span class="sale-tag">Sale</span>' : '') +
      '<div class="gem-foot' + (cart ? ' two' : '') + '">' + cart + (p.sold
        ? '<a class="card-wa off" target="_blank" rel="noopener" href="' + esc(waLink('Hello Ceylon Gem Lanka, ' + p.name + ' is sold out. Do you have a similar stone?')) + '">Ask for a similar stone</a>'
        : '<a class="card-wa" target="_blank" rel="noopener" href="' + esc(waLink(gemMessage(p))) + '" aria-label="Ask about ' + esc(p.name) + ' on WhatsApp">' + WA_ICON + (cart ? '' : 'WhatsApp') + '</a>') +
      '</div></article>';
  }
  // Add-to-cart buttons anywhere on the page.
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]');
    if (!b) return;
    e.preventDefault();
    cartAdd(b.dataset.add, 1, +b.dataset.max || 1);
    b.textContent = 'Added';
    b.classList.add('done');
    toast('Added to your cart', 'cart.html', 'View cart');
    setTimeout(function () { b.textContent = 'Add to cart'; b.classList.remove('done'); }, 1600);
  });
  function toast(text, href, label) {
    var t = document.createElement('div');
    t.className = 'site-toast';
    t.setAttribute('role', 'status');
    t.innerHTML = '<span>' + esc(text) + '</span>' + (href ? '<a href="' + esc(href) + '">' + esc(label) + '</a>' : '');
    document.body.append(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, 3200);
  }
  function animateIn(nodes) {
    wireGlass(nodes);
    if (!gsap || reduce || !nodes.length) return;
    gsap.from(nodes, { y: 16, opacity: 0, duration: .45, stagger: .03, ease: 'power2.out', clearProps: 'transform,opacity' });
  }

  /* ---------- events ---------- */
  var PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s7-7.200 7-12a7 7 0 1 0-14 0c0 4.800 7 12 7 12z"/><circle cx="12" cy="10" r="2.500"/></svg>';
  function parseDay(d) { var p = String(d).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function dayText(d) { return parseDay(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function eventDates(e) { return e.endDate && e.endDate !== e.startDate ? dayText(e.startDate) + ' to ' + dayText(e.endDate) : dayText(e.startDate); }
  function todayKey() { var n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); }
  function splitEvents(list) {
    var today = todayKey();
    var isPast = function (e) { return (e.endDate || e.startDate) < today; };
    return {
      upcoming: list.filter(function (e) { return !isPast(e); }),
      past: list.filter(isPast).reverse(),
    };
  }
  function eventCard(e) {
    return '<article class="event-card"><div class="event-pic">' + (e.image ? '<img src="' + esc(e.image.full) + '" alt="' + esc(e.title) + '" loading="lazy" decoding="async">' : '') + '<span class="event-date">' + esc(eventDates(e)) + '</span></div>' +
      '<div class="event-body"><h3>' + esc(e.title) + '</h3>' +
      (e.location ? '<div class="event-place">' + PIN + (e.mapUrl ? '<a href="' + esc(e.mapUrl) + '" target="_blank" rel="noopener">' + esc(e.location) + '</a>' : '<span>' + esc(e.location) + '</span>') + '</div>' : '') +
      (e.time ? '<div class="event-place"><span>' + esc(e.time) + '</span></div>' : '') +
      (e.description ? '<p class="event-desc">' + esc(e.description) + '</p>' : '') + '</div></article>';
  }

  /* ---------- pages ---------- */
  var pages = {
    home: function () {
      var rail = $('#featured');
      rail.innerHTML = '<div class="skeleton" style="flex:0 0 300px"></div><div class="skeleton" style="flex:0 0 300px"></div><div class="skeleton" style="flex:0 0 300px"></div>';
      var last = '';
      catalog(function (data, final) {
        applySite(data);
        var list = data ? data.products : [];
        if (!list.length && !final) return;
        var chosen = list.filter(function (p) { return p.featured && !p.sold; });
        if (chosen.length < 4) chosen = chosen.concat(list.filter(function (p) { return chosen.indexOf(p) < 0; })).slice(0, 8);
        var html = chosen.length ? chosen.map(cardHtml).join('') : noteHtml('New stones are on the way', 'Chat with us to ask what is available today.');
        if (html === last) return;
        last = html;
        rail.innerHTML = html;
        var upcoming = splitEvents((data && data.events) || []).upcoming.slice(0, 3);
        if (upcoming.length) {
          $('#homeEventGrid').innerHTML = upcoming.map(eventCard).join('');
          $('#homeEvents').classList.remove('hidden');
        }
        wireWa();
        animateIn($$('.gem-card', rail));
      });
      dragScroll(rail);
      // A real photo saved as assets/gem-mine.jpg replaces the illustration automatically.
      var minePhoto = new Image();
      minePhoto.onload = function () {
        var slot = $('[data-mine-photo]');
        slot.src = minePhoto.src;
        slot.classList.remove('hidden');
        $('[data-mine-caption]').textContent = 'A gem mine in Sri Lanka.';
      };
      minePhoto.src = 'assets/gem-mine.jpg';
      if (gsap && !reduce && window.ScrollTrigger) {
        var y = $('#years');
        if (y) {
          var o = { n: 0 };
          gsap.to(o, { n: 25, duration: 1.8, ease: 'power2.out', scrollTrigger: { trigger: y, start: 'top 85%', once: true }, onUpdate: function () { y.textContent = Math.round(o.n); } });
        }
      }
    },

    about: function () { catalog(function (d) { applySite(d); }); },
    nature: function () { catalog(function (d) { applySite(d); }); },
    events: function () {
      var up = $('#upcoming'), past = $('#past'), box = $('#pastBox');
      up.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
      catalog(function (data, final) {
        applySite(data);
        if (!data) {
          if (final) { up.innerHTML = noteHtml('Events could not load', 'Check your connection and refresh, or ask us on WhatsApp.'); wireWa(); }
          return;
        }
        var parts = splitEvents(data.events || []);
        up.innerHTML = parts.upcoming.length ? parts.upcoming.map(eventCard).join('') : (final ? noteHtml('No upcoming events right now', 'Chat with us to find out where you can meet us next.') : up.innerHTML);
        box.classList.toggle('hidden', !parts.past.length);
        past.innerHTML = parts.past.map(eventCard).join('');
        wireWa();
        wireGlass($$('.event-card'));
      });
    },
    contact: function () {
      catalog(function (d) { applySite(d); });
      var form = $('#msg'), state = $('#formState'), fallback = $('#formWa'), sendBtn = $('#send');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var f = new FormData(form);
        var body = { name: f.get('name'), contact: f.get('contact'), message: f.get('text'), website: f.get('website') };
        function show(text) { state.textContent = text; state.classList.remove('hidden'); }
        function failed() {
          sendBtn.disabled = false;
          show('Your message could not be sent. Please send it on WhatsApp instead.');
          fallback.href = waLink('Hello Ceylon Gem Lanka, my name is ' + body.name + '.\n' + body.message);
          fallback.classList.remove('hidden');
        }
        fallback.classList.add('hidden');
        if (!cfg.api || !cfg.key) return failed();
        sendBtn.disabled = true;
        show('Sending your message...');
        var ctrl = new AbortController();
        var timer = setTimeout(function () { ctrl.abort(); }, 75000);
        fetch(cfg.api + '/public/v1/' + encodeURIComponent(cfg.key) + '/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        }).then(function (r) {
          if (!r.ok) throw new Error('send');
          form.reset();
          sendBtn.disabled = false;
          show('Thank you. Your message has been sent, and we will reply soon.');
        }).catch(failed).finally(function () { clearTimeout(timer); });
      });
    },

    gems: function () {
      var grid = $('#grid'), count = $('#count'), types = $('#types');
      grid.innerHTML = skeletons(8);
      var slowTimer = setTimeout(function () { if (!all) count.textContent = 'Loading our gems. This can take up to a minute the first time.'; }, 5000);
      var all = null, type = '', q = '';
      function draw() {
        var list = all.filter(function (p) {
          return (!type || p.type === type) && (!q || p.searchText.indexOf(q) >= 0);
        });
        var sort = $('#sort').value;
        var pr = function (p) { return p.price === null || p.price === undefined ? Infinity : p.price; };
        if (sort === 'low') list.sort(function (a, b) { return a.sold - b.sold || pr(a) - pr(b); });
        if (sort === 'high') list.sort(function (a, b) { return a.sold - b.sold || (b.price || 0) - (a.price || 0); });
        if (sort === 'carat') list.sort(function (a, b) { return a.sold - b.sold || (b.carat || 0) - (a.carat || 0); });
        count.textContent = list.length + (list.length === 1 ? ' gem' : ' gems');
        grid.innerHTML = list.length ? list.map(cardHtml).join('') : noteHtml(all.length ? 'No gems match your search' : 'New stones are on the way', all.length ? 'Clear the search, or ask us on WhatsApp.' : 'Chat with us to ask what is available today.');
        wireWa();
        animateIn($$('.gem-card', grid));
      }
      function drawChips() {
        var names = [];
        all.forEach(function (p) { if (p.type && names.indexOf(p.type) < 0) names.push(p.type); });
        types.innerHTML = names.length < 2 ? '' : [''].concat(names).map(function (n) {
          return '<button type="button" class="chip" data-t="' + esc(n) + '" aria-pressed="' + (n === type) + '">' + esc(n || 'All') + '</button>';
        }).join('');
        $$('.chip', types).forEach(function (c) {
          c.addEventListener('click', function () {
            type = c.dataset.t;
            $$('.chip', types).forEach(function (o) { o.setAttribute('aria-pressed', String(o === c)); });
            draw();
          });
        });
      }
      catalog(function (data, final) {
        applySite(data);
        if (!data) {
          if (final) { clearTimeout(slowTimer); count.textContent = ''; grid.innerHTML = noteHtml('Our gems could not load', 'Check your connection and refresh, or ask us on WhatsApp.'); wireWa(); }
          return;
        }
        clearTimeout(slowTimer);
        all = data.products;
        drawChips();
        draw();
      });
      var t;
      $('#q').addEventListener('input', function (e) {
        clearTimeout(t);
        t = setTimeout(function () { q = e.target.value.trim().toLowerCase(); if (all) draw(); }, 150);
      });
      $('#sort').addEventListener('change', function () { if (all) draw(); });
    },

    gem: function () {
      var box = $('#detail');
      box.innerHTML = '<div class="skeleton" style="aspect-ratio:1"></div><div class="skeleton" style="aspect-ratio:1"></div>';
      var slug = qs('gem'), lastKey = '';
      catalog(function (data, final) {
        applySite(data);
        if (!data) {
          if (final) { box.style.display = 'block'; box.innerHTML = noteHtml('This gem could not load', 'Check your connection and refresh, or ask us on WhatsApp.'); wireWa(); }
          return;
        }
        var p = data.products.filter(function (x) { return x.slug === slug; })[0];
        if (!p) {
          if (final) { box.style.display = 'block'; box.innerHTML = noteHtml('This gem is no longer listed', 'See our other stones, or ask us on WhatsApp.'); wireWa(); }
          return;
        }
        var key = JSON.stringify(p);
        if (key === lastKey) return;
        lastKey = key;
        renderDetail(p, box);
        var more = data.products.filter(function (x) { return x.slug !== slug && !x.sold; }).slice(0, 4);
        if (more.length) {
          $('#relatedBox').classList.remove('hidden');
          $('#related').innerHTML = more.map(cardHtml).join('');
          wireGlass($$('.gem-card', $('#related')));
        }
      });
    },

    buy: function () {
      var pick = $('#pick'), tag = $('#tag'), chat = $('#chat'), hint = $('#hint');
      pick.innerHTML = skeletons(6);
      var all = null, selected = null, q = '';
      var wanted = qs('gem');
      function selectGem(p, scroll) {
        selected = p;
        $$('.pick', pick).forEach(function (n) { n.setAttribute('aria-checked', String(!!p && n.dataset.slug === p.slug)); });
        if (!p) {
          tag.className = 'tag-empty';
          tag.textContent = 'No gem selected yet';
          if ($('#checkoutGem')) $('#checkoutGem').classList.add('hidden');
          chat.classList.add('is-off');
          chat.setAttribute('aria-disabled', 'true');
          chat.removeAttribute('target');
          chat.href = '#';
          chat.innerHTML = WA_ICON + 'Chat with us';
          hint.textContent = 'Select a gem to continue.';
          return;
        }
        tag.className = 'gem-tag';
        var img = p.images[0];
        tag.innerHTML = (img ? '<img src="' + esc(img.thumb) + '" alt="">' : '') + '<div><strong>' + esc(p.name) + '</strong><small>' + esc([metaLine(p), formatPrice(p)].filter(Boolean).join(', ')) + '</small></div><button type="button" aria-label="Remove selected gem">&times;</button>';
        $('button', tag).addEventListener('click', function () { selectGem(null); });
        chat.classList.remove('is-off');
        chat.removeAttribute('aria-disabled');
        chat.href = waLink(gemMessage(p));
        chat.target = '_blank';
        chat.rel = 'noopener';
        chat.innerHTML = WA_ICON + 'Chat with us';
        hint.textContent = 'WhatsApp opens with this gem in your message.';
        var co = $('#checkoutGem');
        if (co) { co.classList.toggle('hidden', !buyable(p)); co.dataset.slug = p.slug; }
        if (gsap && !reduce) gsap.from(tag, { scale: .94, opacity: 0, duration: .45, ease: 'back.out(1.6)' });
        if (scroll && matchMedia('(max-width: 960px)').matches) $('#panel').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      function draw() {
        var list = all.filter(function (p) { return !q || p.searchText.indexOf(q) >= 0; });
        if (!list.length) {
          pick.innerHTML = noteHtml(all.length ? 'No gems match your search' : 'New stones are on the way', 'Chat with us to ask what is available today.');
          wireWa();
          return;
        }
        pick.innerHTML = list.map(function (p) {
          var img = p.images[0];
          return '<button type="button" class="pick" role="radio" data-slug="' + esc(p.slug) + '" aria-checked="' + !!(selected && selected.slug === p.slug) + '"' + (p.sold ? ' aria-disabled="true"' : '') + '>' +
            '<span class="gem-pic" style="display:block">' + (img ? '<img src="' + esc(img.thumb) + '" alt="" loading="lazy"' + (p.sold ? ' class="sold-img"' : '') + '>' : '') + (p.sold ? soldBand() : '') + '<span class="check"><svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg></span></span>' +
            '<strong>' + esc(p.name) + '</strong><small class="notranslate">' + esc(p.sold ? 'Sold out' : formatPrice(p)) + '</small></button>';
        }).join('');
        $$('.pick', pick).forEach(function (n) {
          n.addEventListener('click', function () {
            var p = all.filter(function (x) { return x.slug === n.dataset.slug; })[0];
            if (p && !p.sold) selectGem(p, true);
          });
        });
        animateIn($$('.pick', pick));
      }
      chat.addEventListener('click', function (e) { if (!selected) e.preventDefault(); });
      var co = $('#checkoutGem');
      if (co) co.addEventListener('click', function () {
        if (!selected) return;
        var c = cartGet().filter(function (x) { return x.slug !== selected.slug; });
        c.push({ slug: selected.slug, qty: 1 });
        cartSet(c);
        location.href = 'checkout.html';
      });
      selectGem(null);
      catalog(function (data, final) {
        applySite(data);
        if (!data) {
          if (final) { pick.innerHTML = noteHtml('Our gems could not load', 'Check your connection and refresh, or ask us on WhatsApp.'); wireWa(); }
          return;
        }
        all = data.products;
        if (selected) {
          var fresh = all.filter(function (x) { return x.slug === selected.slug && !x.sold; })[0] || null;
          selectGem(fresh);
        } else if (wanted) {
          var w = all.filter(function (x) { return x.slug === wanted && !x.sold; })[0];
          if (w) selectGem(w);
          wanted = null;
        }
        draw();
      });
      $('#bq').addEventListener('input', function (e) { q = e.target.value.trim().toLowerCase(); if (all) draw(); });
    },
    notfound: function () {},

    // Video check page: shows which clips this browser can play.
    check: function () {
      var box = $('#checks');
      Object.keys(CLIPS).forEach(function (name) {
        CLIPS[name].forEach(function (list, n) {
          var row = document.createElement('p');
          var sources = sourcesFor(name, n, list), i = 0;
          row.textContent = name + ' ' + (n + 1) + ': checking';
          box.append(row);
          var v = document.createElement('video');
          v.muted = true;
          v.preload = 'metadata';
          v.addEventListener('loadedmetadata', function () { row.textContent = name + ' ' + (n + 1) + ': OK (' + (sources[i].indexOf('http') === 0 ? 'direct link' : sources[i].indexOf('assets') === 0 ? 'saved file' : 'Netlify relay') + ')'; });
          v.addEventListener('error', function () {
            i++;
            if (i < sources.length) v.src = sources[i];
            else row.textContent = name + ' ' + (n + 1) + ': FAILED';
          });
          v.src = sources[0];
        });
      });
    },
  };

  /* ---------- gem detail ---------- */
  function renderDetail(p, box) {
    document.title = p.name + ' | ' + BRAND;
    var media = p.media && p.media.length ? p.media : p.images.map(function (m) { return { type: 'image', full: m.full, thumb: m.thumb }; });
    var imgs = media.filter(function (m) { return m.type !== 'video'; });
    var first = media[0];
    var specs = p.specs.map(function (x) { return [x.label, x.value]; });
    var max = p.stock || 1;
    var actions;
    if (p.sold) {
      actions = '<a class="btn btn-wa" target="_blank" rel="noopener" href="' + esc(waLink('Hello ' + BRAND + ', ' + p.name + ' is sold out. Do you have a similar stone?')) + '">' + WA_ICON + 'Ask for a similar stone</a>';
    } else {
      actions = (max > 1 ? '<label class="qty">Quantity <input type="number" id="qty" min="1" max="' + max + '" value="1" inputmode="numeric"></label>' : '') +
        '<div class="buy-actions"><button type="button" class="btn btn-solid" id="addCart">Add to cart</button><button type="button" class="btn btn-white" id="buyNow">Buy now</button></div>' +
        (buyable(p) ? '' : '<p class="ask-note">This gem is priced on request. <b>Buy now</b> opens WhatsApp, where we tell you the price and help you complete your purchase.</p>') +
        '<a class="btn btn-wa" target="_blank" rel="noopener" href="' + esc(waLink(gemMessage(p))) + '">' + WA_ICON + 'Chat with us</a>';
    }
    box.style.display = '';
    box.innerHTML =
      '<div class="gallery"><div class="stage-wrap"><button type="button" class="stage" id="stage" aria-label="Open photo to zoom">' +
      '<img id="mainImg" alt="' + esc(p.name) + '"' + (p.sold ? ' class="sold-img"' : '') + '>' +
      (p.sold ? soldBand(true) : '') + '<span class="zoom-hint">Tap to zoom</span><span class="lens" id="lens"></span></button>' +
      '<video id="mainVid" class="stage-video hidden" controls playsinline preload="metadata"></video></div>' +
      (media.length > 1 ? '<div class="thumbs">' + media.map(function (m, i) {
        return '<button type="button" class="thumb' + (m.type === 'video' ? ' is-video' : '') + '" data-i="' + i + '" aria-label="' + (m.type === 'video' ? 'Video' : 'Photo') + ' ' + (i + 1) + ' of ' + media.length + '" aria-current="' + (i === 0) + '">' +
          (m.type === 'video' ? '<video src="' + esc(m.full) + '#t=0.5" muted playsinline preload="metadata"></video><span class="play" aria-hidden="true">&#9654;</span>' : '<img src="' + esc(m.thumb) + '" alt="">') + '</button>';
      }).join('') + '</div>' : '') + '</div>' +
      '<div class="buy-box" data-glass>' + (p.type ? '<div class="d-type">' + esc(p.type) + '</div>' : '') + '<h1>' + esc(p.name) + '</h1>' +
      (p.sold ? '<div class="d-state">This stone is sold out</div>' : '<div class="d-price">' + priceHtml(p) + '</div>') +
      actions +
      (buyable(p) ? '<ul class="d-points"><li>Delivered to your door in Sri Lanka within <b data-days>' + siteInfo.deliveryDays + '</b> working days</li><li>Delivery charge <b class="notranslate" data-fee>' + esc(money(siteInfo.deliveryFee)) + '</b></li><li>Pay by bank transfer' + (siteInfo.cardPayments ? ' or card' : '') + '</li></ul>' : '') +
      (specs.length ? '<dl class="specs">' + specs.map(function (s) { return '<div><dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
      (p.description ? '<p class="d-desc">' + esc(p.description) + '</p>' : '') +
      '<p class="d-trust">NGJA licensed gem dealer with more than 25 years of experience.</p></div>';

    var current = 0, main = $('#mainImg'), vid = $('#mainVid'), stage = $('#stage'), lens = $('#lens');
    var photoIndex = 0;
    // Show the small photo at once, then swap in the sharp one when it has loaded.
    function showItem(i) {
      var m = media[i];
      current = i;
      if (!m) return;
      if (m.type === 'video') {
        stage.classList.add('hidden');
        vid.classList.remove('hidden');
        vid.src = m.full;
        vid.play().catch(function () {});
        return;
      }
      vid.pause();
      vid.classList.add('hidden');
      stage.classList.remove('hidden');
      photoIndex = imgs.indexOf(m);
      main.src = m.thumb;
      var sharp = new Image();
      sharp.onload = function () { if (current === i) main.src = sharp.src; };
      sharp.src = m.full;
    }
    if (first) showItem(0);
    $$('.thumb', box).forEach(function (t) {
      t.addEventListener('click', function () {
        showItem(+t.dataset.i);
        $$('.thumb', box).forEach(function (o) { o.setAttribute('aria-current', String(o === t)); });
      });
    });
    if (imgs.length) {
      stage.addEventListener('click', function () { openViewer(imgs, photoIndex, p.name); });
      if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
        $('.zoom-hint', box).textContent = 'Hover to magnify, click for full screen';
        stage.addEventListener('pointermove', function (e) {
          var r = stage.getBoundingClientRect();
          var nw = main.naturalWidth || r.width, nh = main.naturalHeight || r.height;
          var fit = Math.min(r.width / nw, r.height / nh);
          var dw = nw * fit, dh = nh * fit, ox = (r.width - dw) / 2, oy = (r.height - dh) / 2;
          var x = e.clientX - r.left, y = e.clientY - r.top;
          var inside = x >= ox && x <= ox + dw && y >= oy && y <= oy + dh;
          lens.style.opacity = inside ? 1 : 0;
          if (!inside) return;
          var z = 2.8, half = 115;
          lens.style.left = x - half + 'px';
          lens.style.top = y - half + 'px';
          lens.style.backgroundImage = 'url("' + imgs[photoIndex].full.replace(/"/g, '%22') + '")';
          lens.style.backgroundSize = dw * z + 'px ' + dh * z + 'px';
          lens.style.backgroundPosition = -((x - ox) * z - half) + 'px ' + -((y - oy) * z - half) + 'px';
        });
        stage.addEventListener('pointerleave', function () { lens.style.opacity = 0; });
      }
    }
    var qtyBox = $('#qty', box);
    function chosenQty() { return Math.min(max, Math.max(1, parseInt(qtyBox ? qtyBox.value : 1, 10) || 1)); }
    var add = $('#addCart', box);
    if (add) add.addEventListener('click', function () {
      cartAdd(p.slug, chosenQty(), max);
      toast('Added to your cart', 'cart.html', 'View cart');
    });
    var buyNow = $('#buyNow', box);
    if (buyNow) buyNow.addEventListener('click', function () {
      if (!buyable(p)) { window.open(waLink(askMessage(p, chosenQty())), '_blank', 'noopener'); return; }
      var c = cartGet().filter(function (x) { return x.slug !== p.slug; });
      c.push({ slug: p.slug, qty: chosenQty() });
      cartSet(c);
      location.href = 'checkout.html';
    });
    wireGlass($$('[data-glass]', box));
    if (gsap && !reduce) gsap.from(box.children, { y: 14, opacity: 0, duration: .4, stagger: .06, ease: 'power2.out', clearProps: 'transform,opacity' });
  }

  /* full-screen viewer: wheel, pinch, drag, double-tap */
  var viewer;
  function openViewer(imgs, start, name) {
    if (!viewer) {
      viewer = document.createElement('div');
      viewer.className = 'viewer';
      viewer.setAttribute('role', 'dialog');
      viewer.setAttribute('aria-modal', 'true');
      viewer.setAttribute('aria-label', 'Zoom photo');
      viewer.innerHTML = '<img alt="" draggable="false"><button class="v-btn v-close" aria-label="Close">&times;</button><button class="v-btn v-prev" aria-label="Previous photo">&#8249;</button><button class="v-btn v-next" aria-label="Next photo">&#8250;</button><div class="v-tools"><button class="v-btn v-out" aria-label="Zoom out">&minus;</button><span class="v-level" aria-live="polite">100%</span><button class="v-btn v-in" aria-label="Zoom in">+</button></div>';
      document.body.append(viewer);
    }
    var img = $('img', viewer), level = $('.v-level', viewer);
    var scale = 1, tx = 0, ty = 0, index = start, pointers = new Map(), pinch = null, drag = null, lastTap = 0;
    var returnFocus = document.activeElement;
    var MAX = 8;

    function apply(animate) {
      img.style.transition = animate ? 'transform .28s cubic-bezier(.2,.8,.2,1)' : 'none';
      img.style.transform = 'translate(-50%,-50%) translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
      level.textContent = Math.round(scale * 100) + '%';
      img.style.cursor = scale > 1 ? 'grab' : 'zoom-in';
    }
    function clamp() {
      var w = img.offsetWidth * scale, h = img.offsetHeight * scale;
      var mx = Math.max(0, (w - innerWidth) / 2), my = Math.max(0, (h - innerHeight) / 2);
      tx = Math.min(mx, Math.max(-mx, tx));
      ty = Math.min(my, Math.max(-my, ty));
    }
    function zoomAt(next, cx, cy, animate) {
      next = Math.min(MAX, Math.max(1, next));
      var ox = cx - innerWidth / 2 - tx, oy = cy - innerHeight / 2 - ty;
      tx -= ox * (next / scale - 1);
      ty -= oy * (next / scale - 1);
      scale = next;
      clamp();
      apply(animate);
    }
    function load(i) {
      index = (i + imgs.length) % imgs.length;
      scale = 1; tx = 0; ty = 0;
      img.src = imgs[index].full;
      img.alt = name;
      apply(false);
      var multi = imgs.length > 1;
      $('.v-prev', viewer).style.display = multi ? '' : 'none';
      $('.v-next', viewer).style.display = multi ? '' : 'none';
    }
    function close() {
      viewer.classList.remove('open');
      document.documentElement.style.overflow = '';
      removeEventListener('keydown', onKey);
      viewer.onwheel = viewer.onpointerdown = viewer.onpointermove = viewer.onpointerup = viewer.onpointercancel = null;
      if (returnFocus && returnFocus.focus) returnFocus.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') load(index - 1);
      else if (e.key === 'ArrowRight') load(index + 1);
      else if (e.key === '+' || e.key === '=') zoomAt(scale * 1.4, innerWidth / 2, innerHeight / 2, true);
      else if (e.key === '-') zoomAt(scale / 1.4, innerWidth / 2, innerHeight / 2, true);
    }
    $('.v-close', viewer).onclick = close;
    $('.v-prev', viewer).onclick = function () { load(index - 1); };
    $('.v-next', viewer).onclick = function () { load(index + 1); };
    $('.v-in', viewer).onclick = function () { zoomAt(scale * 1.5, innerWidth / 2, innerHeight / 2, true); };
    $('.v-out', viewer).onclick = function () { zoomAt(scale / 1.5, innerWidth / 2, innerHeight / 2, true); };
    viewer.onwheel = function (e) { e.preventDefault(); zoomAt(scale * Math.exp(-e.deltaY * .0022), e.clientX, e.clientY); };
    viewer.onpointerdown = function (e) {
      if (e.target.closest('button')) return;
      viewer.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        var p = Array.from(pointers.values());
        pinch = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), s: scale };
        drag = null;
      } else {
        drag = { x: e.clientX, y: e.clientY, tx: tx, ty: ty, moved: false };
      }
    };
    viewer.onpointermove = function (e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        var p = Array.from(pointers.values());
        var d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        zoomAt(pinch.s * d / pinch.d, (p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2);
      } else if (drag) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
        if (scale > 1) { tx = drag.tx + dx; ty = drag.ty + dy; clamp(); apply(false); }
      }
    };
    viewer.onpointerup = viewer.onpointercancel = function (e) {
      var wasDrag = drag;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size) { drag = null; return; }
      drag = null;
      if (!wasDrag) return;
      var dx = e.clientX - wasDrag.x;
      if (scale === 1 && wasDrag.moved && Math.abs(dx) > 60 && imgs.length > 1) { load(index + (dx < 0 ? 1 : -1)); return; }
      if (!wasDrag.moved) {
        var now = Date.now();
        var mouse = e.pointerType === 'mouse';
        if (mouse || now - lastTap < 320) {
          if (scale > 1) { scale = 1; tx = 0; ty = 0; apply(true); } else zoomAt(3, e.clientX, e.clientY, true);
          lastTap = 0;
        } else lastTap = now;
      }
    };
    addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    viewer.classList.add('open');
    load(start);
    $('.v-close', viewer).focus();
  }

  /* ---------- motion ---------- */
  function wireGlass(nodes) {
    if (!matchMedia('(pointer: fine)').matches || reduce) return;
    nodes.forEach(function (n) {
      if (n._glass) return;
      n._glass = true;
      n.addEventListener('pointermove', function (e) {
        var r = n.getBoundingClientRect();
        n.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        n.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }
  function dragScroll(el) {
    var down = false, sx = 0, sl = 0, moved = 0;
    el.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; sx = e.clientX; sl = el.scrollLeft; moved = 0; });
    addEventListener('pointermove', function (e) {
      if (!down) return;
      moved = Math.abs(e.clientX - sx);
      if (moved > 6) el.classList.add('drag');
      el.scrollLeft = sl - (e.clientX - sx);
    });
    addEventListener('pointerup', function () { if (down) { down = false; setTimeout(function () { el.classList.remove('drag'); }, 0); } });
  }
  function splitWords(el) {
    var words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = words.map(function (w) { return '<span class="w" aria-hidden="true"><span>' + esc(w) + '</span></span>'; }).join(' ');
    return $$('.w > span', el);
  }
  function intro() {
    if (!gsap || reduce) return;
    gsap.registerPlugin(window.ScrollTrigger);
    var h = $('.split');
    if (h) {
      var tl = gsap.timeline();
      tl.from(splitWords(h), { yPercent: 110, duration: .7, stagger: .035, ease: 'power3.out' });
      var rest = $$('.reveal-hero');
      if (rest.length) tl.from(rest, { y: 12, opacity: 0, duration: .5, stagger: .06, ease: 'power2.out' }, '-=.45');
      var panel = $('.hero-glass');
      if (panel) gsap.from(panel, { y: 18, opacity: 0, duration: .55, ease: 'power2.out' });
    }
    var media = $('.hero-media');
    if (media) gsap.to(media, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    $$('.rise').forEach(function (n) {
      gsap.from(n, { y: 18, opacity: 0, duration: .55, ease: 'power2.out', clearProps: 'transform', scrollTrigger: { trigger: n, start: 'top 94%', once: true } });
    });
    wireGlass($$('.glass-card, .glass-note, .cred, .buy-panel'));
  }
  /* ---------- shared with shop.js ---------- */
  window.CGL = {
    BRAND: BRAND, CONTACTS: CONTACTS, cfg: cfg, pages: pages, $: $, $$: $$, esc: esc, qs: qs, store: store,
    money: money, payPrice: payPrice, priceHtml: priceHtml, buyable: buyable, cartable: cartable, gemMessage: gemMessage, catalog: catalog, applySite: applySite, siteInfo: siteInfo,
    cartGet: cartGet, cartSet: cartSet, updateCartBadge: updateCartBadge, token: token, setToken: setToken, shopApi: shopApi,
    waLink: waLink, numbersHtml: numbersHtml, wireWa: wireWa, noteHtml: noteHtml, skeletons: skeletons, toast: toast, wireGlass: wireGlass, gemUrl: gemUrl,
  };

  /* ---------- start ---------- */
  function start() {
    layout();
    playHero();
    bandVideos();
    intro();
    if (pages[page]) pages[page]();
  }
  if (cfg.demo && !window.YG_DEMO) {
    var s = document.createElement('script');
    s.src = 'assets/js/demo.js';
    s.onload = s.onerror = start;
    document.head.append(s);
  } else if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
