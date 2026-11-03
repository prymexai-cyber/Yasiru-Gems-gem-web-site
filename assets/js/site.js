/* Yasiru Gems website */
(function () {
  'use strict';
  var page = document.body.dataset.page;
  var cfg = window.PRYME || {};
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gsap = window.gsap;
  var FALLBACK_WA = '14028087890';
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
  function formatPrice(p) {
    if (p.price === null || p.price === undefined) return 'Ask for price';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: p.currency || 'USD', maximumFractionDigits: 0 }).format(p.price);
    } catch (e) { return p.currency + ' ' + p.price; }
  }
  function metaLine(p) {
    return [p.type, p.carat ? p.carat + ' ct' : ''].filter(Boolean).join(', ');
  }

  var waNumber = FALLBACK_WA;
  var ngjaNo = '234533';
  function waLink(text) { return 'https://wa.me/' + waNumber + (text ? '?text=' + encodeURIComponent(text) : ''); }
  function gemUrl(p) { return 'gem.html?gem=' + encodeURIComponent(p.slug); }
  function gemMessage(p) {
    var abs = new URL(gemUrl(p), location.href).href;
    var bits = [p.name, metaLine(p)].filter(Boolean).join(' - ');
    return 'Hello Yasiru Gems, I would like to buy this gem:\n' + bits + '\n' + abs;
  }
  function wireWa() {
    $$('[data-wa]').forEach(function (a) {
      a.href = waLink(a.dataset.wa);
      a.target = '_blank';
      a.rel = 'noopener';
    });
    $$('[data-phone]').forEach(function (a) { a.href = waLink(); a.target = '_blank'; a.rel = 'noopener'; });
    var f = $('.wa-float');
    if (f) f.href = waLink('Hello Yasiru Gems, I have a question.');
  }

  /* ---------- shared layout ---------- */
  function layout() {
    var bg = document.createElement('div');
    bg.className = 'aurora';
    bg.innerHTML = '<i></i><i></i><i></i>';
    document.body.prepend(bg);

    var links = [['index.html', 'Home', 'home'], ['about.html', 'About us', 'about'], ['gems.html', 'Our Gems', 'gems'], ['contact.html', 'Contact us', 'contact']];
    var header = document.createElement('header');
    header.className = 'top';
    header.innerHTML =
      '<div class="bar"><a class="brand" href="index.html">' + LOGO + 'Yasiru Gems</a>' +
      '<nav class="nav" id="nav" aria-label="Main">' +
      links.map(function (l) { return '<a href="' + l[0] + '"' + (l[2] === page ? ' aria-current="page"' : '') + '>' + l[1] + '</a>'; }).join('') +
      '<a class="buy-link" href="buy.html"' + (page === 'buy' ? ' aria-current="page"' : '') + '>Buy now</a></nav>' +
      '<button class="menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="nav"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8h16M4 16h16"/></svg></button></div>';
    document.body.prepend(header);

    var btn = $('.menu-btn', header), nav = $('.nav', header);
    function setMenu(open) {
      nav.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (open) header.classList.add('solid'); else updateHeader();
    }
    btn.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    document.addEventListener('click', function (e) { if (!header.contains(e.target)) setMenu(false); });

    var hero = $('.hero');
    function updateHeader() {
      var dark = hero && hero.getBoundingClientRect().bottom > 70;
      if (nav.classList.contains('open')) return;
      header.classList.toggle('solid', !dark);
      document.body.classList.toggle('in-hero', !!dark);
    }
    addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();

    var foot = document.createElement('footer');
    foot.className = 'foot';
    foot.innerHTML =
      '<div class="wrap"><div class="foot-grid"><div><a class="brand" href="index.html">' + LOGO + 'Yasiru Gems</a>' +
      '<p>Genuine, quality gemstones at low prices. NGJA registered, with more than 25 years of experience.</p><p class="foot-ngja"><img class="ngja-logo hidden" data-ngja-logo alt="NGJA logo"><span>Gem dealer: U. L. D. R. P GUNASINGHE<br>NGJA licence number: <span data-ngja-no>234533</span></span></p></div>' +
      '<div><h2>Pages</h2><ul><li><a href="index.html">Home</a></li><li><a href="about.html">About us</a></li><li><a href="gems.html">Our Gems</a></li><li><a href="contact.html">Contact us</a></li><li><a href="buy.html">Buy now</a></li></ul></div>' +
      '<div><h2>WhatsApp</h2><ul><li><a data-phone href="#">+1 (402) 808-7890</a></li></ul></div></div>' +
      '<p class="copy">&copy; ' + new Date().getFullYear() + ' Yasiru Gems</p></div>';
    document.body.append(foot);

    var wa = document.createElement('a');
    wa.className = 'wa-float';
    wa.setAttribute('aria-label', 'Chat with us on WhatsApp');
    wa.target = '_blank';
    wa.rel = 'noopener';
    wa.innerHTML = WA_ICON;
    document.body.append(wa);

    // Real refraction is only reliable in Chromium; other browsers keep the blurred glass.
    if (window.chrome && !reduce && matchMedia('(min-width: 700px)').matches) {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '0');
      svg.setAttribute('height', '0');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.position = 'absolute';
      svg.innerHTML = '<filter id="liquid" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.009 0.014" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="46" xChannelSelector="R" yChannelSelector="G"/></filter>';
      document.body.append(svg);
      document.documentElement.classList.add('lq');
    }
    wireWa();
  }

  /* ---------- hero video ---------- */
  // Each clip tries a phone/desktop size, then the Netlify relay in _redirects if the direct link is refused.
  function pixabay(base) {
    var phone = matchMedia('(max-width: 700px)').matches;
    var order = phone ? ['small', 'medium', 'large'] : ['medium', 'large'];
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
      }, { rootMargin: '300px' });
      io.observe(band);
    });
  }
  var heroKey = null;

  // Shows the official NGJA logo as soon as assets/ngja-logo.png is in the website folder.
  function ngjaLogo() {
    var slots = $$('[data-ngja-logo]');
    if (!slots.length) return;
    var probe = new Image();
    probe.onload = function () {
      slots.forEach(function (n) { if (!n.getAttribute('src')) { n.src = probe.src; n.classList.remove('hidden'); } });
      $$('.cred-seal').forEach(function (n) { n.classList.add('hidden'); });
    };
    probe.src = 'assets/ngja-logo.png';
  }

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
      v.preload = 'auto';
      var i = 0;
      v.addEventListener('error', function () {
        i++;
        if (i < sources.length) { v.src = sources[i]; v.load(); if (v.dataset.active) v.play().catch(function () {}); }
      });
      v.src = sources[0];
      box.append(v);
      return v;
    });
    if (!videos.length) return;

    var index = 0;
    function show(n) {
      videos.forEach(function (v, k) {
        if (k === n) {
          v.dataset.active = '1';
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
    show(0);
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
  function applySite(data) {
    if (!data || !data.site) return;
    if (data.site.whatsapp) { waNumber = data.site.whatsapp; wireWa(); }
  }
  function skeletons(n) { var s = ''; for (var i = 0; i < n; i++) s += '<div class="skeleton"></div>'; return s; }
  function noteHtml(title, text) {
    return '<div class="note"><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p><a class="btn btn-solid" data-wa="Hello Yasiru Gems, which gemstones do you have available?" href="#">Chat with us</a></div>';
  }
  function soldBand(large) { return '<span class="soldband' + (large ? ' large' : '') + '">Sold out</span>'; }

  function cardHtml(p) {
    var img = p.images[0];
    return '<article class="gem-card' + (p.sold ? ' is-sold' : '') + '"><a class="gem-link" href="' + esc(gemUrl(p)) + '">' +
      '<div class="gem-pic">' + (img ? '<img src="' + esc(img.thumb) + '" alt="' + esc(p.name) + '" loading="lazy" draggable="false"' + (p.sold ? ' class="sold-img"' : '') + '>' : '') + (p.sold ? soldBand() : '') + '</div>' +
      '<div class="gem-info"><h3>' + esc(p.name) + '</h3><div class="gem-meta">' + esc(metaLine(p)) + '</div><div class="gem-price">' + (p.sold ? 'Sold out' : esc(formatPrice(p))) + '</div></div></a>' +
      '<div class="gem-foot">' + (p.sold
        ? '<a class="card-wa off" target="_blank" rel="noopener" href="' + esc(waLink('Hello Yasiru Gems, ' + p.name + ' is sold out. Do you have a similar stone?')) + '">Ask for a similar stone</a>'
        : '<a class="card-wa" target="_blank" rel="noopener" href="' + esc(waLink(gemMessage(p))) + '">' + WA_ICON + 'WhatsApp</a>') +
      '</div></article>';
  }
  function animateIn(nodes) {
    wireGlass(nodes);
    if (!gsap || reduce || !nodes.length) return;
    gsap.from(nodes, { y: 34, opacity: 0, duration: .8, stagger: .06, ease: 'power3.out', clearProps: 'transform,opacity' });
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
        wireWa();
        animateIn($$('.gem-card', rail));
      });
      dragScroll(rail);
      var lens = $('.glass-lens');
      if (lens && gsap && !reduce) {
        gsap.to(lens, { y: 26, rotation: 3, duration: 6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
        if (matchMedia('(pointer: fine)').matches) {
          var x = gsap.quickTo(lens, 'x', { duration: 1.6, ease: 'power3' });
          $('.hero').addEventListener('pointermove', function (e) { x((e.clientX / innerWidth - .5) * 90); });
        }
      }
      if (gsap && !reduce && window.ScrollTrigger) {
        var gl = $('.gl');
        if (gl) {
          var len = gl.getTotalLength();
          gsap.set(gl, { strokeDasharray: len, strokeDashoffset: len });
          gsap.set('.gf', { opacity: 0 });
          var tl = gsap.timeline({ scrollTrigger: { trigger: '.gem-draw', start: 'top 80%', once: true } });
          tl.to(gl, { strokeDashoffset: 0, duration: 2.4, ease: 'power1.inOut' }).to('.gf', { opacity: 1, duration: 1 }, 1.4);
        }
        var y = $('#years');
        if (y) {
          var o = { n: 0 };
          gsap.to(o, { n: 25, duration: 1.8, ease: 'power2.out', scrollTrigger: { trigger: y, start: 'top 85%', once: true }, onUpdate: function () { y.textContent = Math.round(o.n); } });
        }
      }
    },

    about: function () { catalog(function (d) { applySite(d); }); },
    contact: function () {
      catalog(function (d) { applySite(d); });
      $('#msg').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = new FormData(e.target);
        window.open(waLink('Hello Yasiru Gems, my name is ' + f.get('name') + '.\n' + f.get('text')), '_blank', 'noopener');
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
            '<strong>' + esc(p.name) + '</strong><small>' + esc(p.sold ? 'Sold out' : formatPrice(p)) + '</small></button>';
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
    document.title = p.name + ' | Yasiru Gems';
    var imgs = p.images;
    var first = imgs[0];
    var specs = p.specs.map(function (x) { return [x.label, x.value]; });
    box.style.display = '';
    box.innerHTML =
      '<div class="gallery"><button type="button" class="stage" id="stage" aria-label="Open photo to zoom">' +
      (first ? '<img id="mainImg" src="' + esc(first.full) + '" alt="' + esc(p.name) + '"' + (p.sold ? ' class="sold-img"' : '') + '>' : '') +
      (p.sold ? soldBand(true) : '') + '<span class="zoom-hint">Tap to zoom</span><span class="lens" id="lens"></span></button>' +
      (imgs.length > 1 ? '<div class="thumbs">' + imgs.map(function (im, i) {
        return '<button type="button" class="thumb" data-i="' + i + '" aria-label="Photo ' + (i + 1) + ' of ' + imgs.length + '" aria-current="' + (i === 0) + '"><img src="' + esc(im.thumb) + '" alt=""></button>';
      }).join('') + '</div>' : '') + '</div>' +
      '<div class="buy-box" data-glass>' + (p.type ? '<div class="d-type">' + esc(p.type) + '</div>' : '') + '<h1>' + esc(p.name) + '</h1>' +
      (p.sold ? '<div class="d-state">This stone is sold out</div>' : '<div class="d-price">' + esc(formatPrice(p)) + '</div>') +
      (p.sold
        ? '<a class="btn btn-wa" target="_blank" rel="noopener" href="' + esc(waLink('Hello Yasiru Gems, ' + p.name + ' is sold out. Do you have a similar stone?')) + '">' + WA_ICON + 'Ask for a similar stone</a>'
        : '<a class="btn btn-wa" target="_blank" rel="noopener" href="' + esc(waLink(gemMessage(p))) + '">' + WA_ICON + 'Chat with us</a><a class="btn btn-solid" href="buy.html?gem=' + encodeURIComponent(p.slug) + '">Buy now</a>') +
      (specs.length ? '<dl class="specs">' + specs.map(function (s) { return '<div><dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
      (p.description ? '<p class="d-desc">' + esc(p.description) + '</p>' : '') +
      '<p class="d-trust">NGJA registered gem dealer: U. L. D. R. P GUNASINGHE. Licence number <span data-ngja-no>' + esc(ngjaNo) + '</span>. More than 25 years of experience.</p></div>';

    var current = 0, main = $('#mainImg'), stage = $('#stage'), lens = $('#lens');
    $$('.thumb', box).forEach(function (t) {
      t.addEventListener('click', function () {
        current = +t.dataset.i;
        main.src = imgs[current].full;
        $$('.thumb', box).forEach(function (o) { o.setAttribute('aria-current', String(o === t)); });
      });
    });
    if (first) {
      stage.addEventListener('click', function () { openViewer(imgs, current, p.name); });
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
          lens.style.backgroundImage = 'url("' + imgs[current].full.replace(/"/g, '%22') + '")';
          lens.style.backgroundSize = dw * z + 'px ' + dh * z + 'px';
          lens.style.backgroundPosition = -((x - ox) * z - half) + 'px ' + -((y - oy) * z - half) + 'px';
        });
        stage.addEventListener('pointerleave', function () { lens.style.opacity = 0; });
      }
    }
    wireGlass($$('[data-glass]', box));
    if (gsap && !reduce) gsap.from(box.children, { y: 30, opacity: 0, duration: .9, stagger: .12, ease: 'power3.out', clearProps: 'transform,opacity' });
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
      var tl = gsap.timeline({ delay: .12 });
      tl.from(splitWords(h), { yPercent: 112, duration: 1.15, stagger: .07, ease: 'power4.out' });
      var rest = $$('.reveal-hero');
      if (rest.length) tl.from(rest, { y: 22, opacity: 0, duration: .9, stagger: .12, ease: 'power3.out' }, '-=.65');
      gsap.from('.bar', { y: -30, opacity: 0, duration: 1, ease: 'power3.out' });
    }
    var media = $('.hero-media');
    if (media) gsap.to(media, { yPercent: 7, scale: 1.05, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    $$('.rise').forEach(function (n) {
      gsap.from(n, { y: 36, opacity: 0, duration: 1, ease: 'power3.out', clearProps: 'transform', scrollTrigger: { trigger: n, start: 'top 90%', once: true } });
    });
    $$('.closing-card, .cred-main').forEach(function (n) {
      gsap.fromTo(n, { scale: .95 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: n, start: 'top 95%', end: 'top 50%', scrub: true } });
    });
    if (matchMedia('(pointer: fine)').matches) {
      $$('.btn').forEach(function (b) {
        b.addEventListener('pointermove', function (e) {
          var r = b.getBoundingClientRect();
          gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * .16, y: (e.clientY - r.top - r.height / 2) * .24, duration: .4 });
        });
        b.addEventListener('pointerleave', function () { gsap.to(b, { x: 0, y: 0, duration: .7, ease: 'elastic.out(1,.45)' }); });
      });
    }
    wireGlass($$('.glass-card, .glass-note, .cred, .buy-panel'));
  }
  function transitions() {
    if (!gsap || reduce) return;
    var w = document.createElement('div');
    w.className = 'wipe';
    w.setAttribute('aria-hidden', 'true');
    w.innerHTML = LOGO;
    document.body.append(w);
    var key = 'yg_wipe';
    var entering = false;
    try { entering = sessionStorage.getItem(key) === '1'; sessionStorage.removeItem(key); } catch (e) {}
    gsap.set(w, { yPercent: entering ? 0 : 100, visibility: entering ? 'visible' : 'hidden' });
    if (entering) gsap.to(w, { yPercent: -100, duration: .7, ease: 'power3.inOut', delay: .05, onComplete: function () { gsap.set(w, { visibility: 'hidden' }); } });
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a || a.target || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.defaultPrevented) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(https?:|mailto:|tel:)/.test(href)) return;
      e.preventDefault();
      try { sessionStorage.setItem(key, '1'); } catch (err) {}
      gsap.set(w, { visibility: 'visible' });
      gsap.fromTo(w, { yPercent: 100 }, { yPercent: 0, duration: .5, ease: 'power3.inOut', onComplete: function () { location.href = a.href; } });
    });
    addEventListener('pageshow', function (e) { if (e.persisted) gsap.set(w, { yPercent: 100, visibility: 'hidden' }); });
  }

  /* ---------- start ---------- */
  function start() {
    layout();
    ngjaLogo();
    playHero();
    bandVideos();
    intro();
    transitions();
    if (pages[page]) pages[page]();
  }
  if (cfg.demo && !window.YG_DEMO) {
    var s = document.createElement('script');
    s.src = 'assets/js/demo.js';
    s.onload = s.onerror = start;
    document.head.append(s);
  } else start();
})();
