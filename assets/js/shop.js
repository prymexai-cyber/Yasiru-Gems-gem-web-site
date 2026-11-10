/* Ceylon Gem Lanka shop: cart, sign in, checkout, payment slips, order tracking and My account */
(function () {
  'use strict';
  var C = window.CGL;
  if (!C) return;
  var $ = C.$, $$ = C.$$, esc = C.esc, money = C.money, shopApi = C.shopApi;
  var DISTRICTS = ['Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'];
  var ERRORS = {
    wrong_login: 'The email or password is not correct.',
    email_taken: 'An account with this email already exists. Sign in instead.',
    bad_email: 'Enter a valid email address.',
    short_password: 'Use a password with at least 8 characters.',
    wrong_password: 'Your current password is not correct.',
    name_required: 'Enter your full name.',
    phone_required: 'Enter a phone number we can reach you on, with at least 9 digits.',
    address_required: 'Enter your delivery address and city.',
    district_required: 'Choose your district.',
    terms_required: 'Please accept the Terms & Conditions to place your order.',
    item_unavailable: 'One of the stones in your cart is no longer available. It has been removed from your cart.',
    empty_cart: 'Your cart is empty.',
    card_unavailable: 'Card payment is not available yet. Please pay by bank transfer.',
    order_not_found: 'We could not find an order with that number and phone number. Check both and try again.',
    too_many: 'Too many tries. Please wait a few minutes and try again.',
    bad_file: 'This file could not be read. Upload a photo (JPG or PNG) or a PDF of your slip.',
    file_too_large: 'This file is too large. The limit is 12 MB.',
    too_many_slips: 'This order already has the most slips we can take. Send any more on WhatsApp.',
    order_cancelled: 'This order has been cancelled. Contact us on WhatsApp if this is a mistake.',
    already_paid: 'This order is already paid.',
    login_required: 'Please sign in again.',
    network: 'We could not reach our server. Check your internet connection and try again. The first try can take up to a minute.',
    offline: 'The shop is not connected right now. Please order on WhatsApp.',
    default: 'Something went wrong. Please try again, or order on WhatsApp.',
  };
  function errText(e) { return ERRORS[(e && e.code) || 'default'] || ERRORS.default; }
  function showError(box, e) { box.textContent = typeof e === 'string' ? e : errText(e); box.classList.remove('hidden'); box.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  function here() { return location.pathname.split('/').pop() + location.search; }
  function requireLogin() {
    if (C.token()) return true;
    location.replace('login.html?next=' + encodeURIComponent(here()));
    return false;
  }
  function onLoggedOut(e) {
    if (e && e.status === 401) { location.replace('login.html?next=' + encodeURIComponent(here())); return true; }
    return false;
  }
  function when(d) { return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  function statusPill(o) { return '<span class="pill st-' + esc(o.status) + '">' + esc(o.statusText) + '</span>'; }
  function delivery() {
    return '<div class="notice"><strong>We deliver only within Sri Lanka.</strong> Delivery charge <b class="notranslate" data-fee>' + esc(money(C.siteInfo.deliveryFee)) + '</b>, to your door within <b data-days>' + C.siteInfo.deliveryDays + '</b> working days after your payment is confirmed. ' +
      'Living outside Sri Lanka? Before you order, contact us on WhatsApp to ask whether we can deliver to your country: <span class="nums">' + C.numbersHtml('Hello ' + C.BRAND + ', do you deliver to my country?') + '</span></div>';
  }
  function loading(box) { box.innerHTML = '<div class="skeleton" style="aspect-ratio:auto;height:220px"></div>'; }

  // Matches cart lines to the latest catalogue, and drops stones that can no longer be bought.
  function cartLines(data) {
    var products = (data && data.products) || [];
    var removed = [];
    var lines = [];
    C.cartGet().forEach(function (i) {
      var p = products.filter(function (x) { return x.slug === i.slug; })[0];
      if (!p || !C.buyable(p)) { removed.push(p ? p.name : 'A stone'); return; }
      lines.push({ p: p, qty: Math.min(i.qty, p.stock || 1) });
    });
    if (removed.length) C.cartSet(lines.map(function (l) { return { slug: l.p.slug, qty: l.qty }; }));
    var subtotal = 0, original = 0;
    lines.forEach(function (l) { subtotal += C.payPrice(l.p) * l.qty; original += l.p.price * l.qty; });
    return { lines: lines, removed: removed, subtotal: subtotal, savings: original - subtotal, total: subtotal + Number(C.siteInfo.deliveryFee) };
  }
  function summaryHtml(c) {
    return '<div class="sum-rows notranslate-num"><span>Subtotal</span><span class="notranslate">' + esc(money(c.subtotal)) + '</span>' +
      (c.savings > 0 ? '<span>Discount</span><span class="notranslate save">- ' + esc(money(c.savings)) + '</span>' : '') +
      '<span>Delivery</span><span class="notranslate">' + esc(money(C.siteInfo.deliveryFee)) + '</span>' +
      '<strong>Total</strong><strong class="notranslate">' + esc(money(c.total)) + '</strong></div>';
  }
  function lineHtml(l, editable) {
    var img = l.p.images[0];
    return '<div class="line" data-slug="' + esc(l.p.slug) + '">' + (img ? '<img src="' + esc(img.thumb) + '" alt="">' : '<span class="ph"></span>') +
      '<div class="line-main"><a href="' + esc(C.gemUrl(l.p)) + '">' + esc(l.p.name) + '</a><div class="muted">' + C.priceHtml(l.p) + '</div>' +
      (editable ? '<div class="line-tools">' + ((l.p.stock || 1) > 1 ? '<label>Qty <input type="number" min="1" max="' + (l.p.stock || 1) + '" value="' + l.qty + '" data-qty inputmode="numeric"></label>' : '<span class="muted">Qty 1</span>') + '<button type="button" class="link-btn" data-remove>Remove</button></div>' : '<div class="muted">Qty ' + l.qty + '</div>') +
      '</div><strong class="notranslate">' + esc(money(C.payPrice(l.p) * l.qty)) + '</strong></div>';
  }

  /* ---------- cart ---------- */
  C.pages.cart = function () {
    var box = $('#cartBox');
    loading(box);
    C.catalog(function (data, final) {
      C.applySite(data);
      if (!data) { if (final) { box.innerHTML = C.noteHtml('Your cart could not load', 'Check your connection and refresh, or order on WhatsApp.'); C.wireWa(); } return; }
      draw(data);
    });
    function draw(data) {
      var c = cartLines(data);
      if (!c.lines.length) {
        box.innerHTML = (c.removed.length ? '<p class="alert">' + esc(c.removed.join(', ')) + ' is no longer available.</p>' : '') +
          '<div class="note"><h3>Your cart is empty</h3><p>Browse our gems and add the ones you like.</p><a class="btn btn-solid" href="gems.html">See our gems</a></div>';
        return;
      }
      box.innerHTML = '<div class="cart-grid"><div class="glass-card lines">' + (c.removed.length ? '<p class="alert">' + esc(c.removed.join(', ')) + ' is no longer available and was removed.</p>' : '') +
        c.lines.map(function (l) { return lineHtml(l, true); }).join('') + '</div>' +
        '<aside class="glass-card summary"><h2>Order summary</h2>' + summaryHtml(c) + delivery() +
        '<a class="btn btn-solid wide" href="checkout.html">Proceed to checkout</a><a class="btn btn-white wide" href="gems.html">Continue shopping</a></aside></div>';
      $$('[data-qty]', box).forEach(function (input) {
        input.addEventListener('change', function () {
          var slug = input.closest('.line').dataset.slug;
          var cart = C.cartGet();
          cart.forEach(function (i) { if (i.slug === slug) i.qty = Math.max(1, Math.min(+input.max, parseInt(input.value, 10) || 1)); });
          C.cartSet(cart);
          draw(data);
        });
      });
      $$('[data-remove]', box).forEach(function (b) {
        b.addEventListener('click', function () {
          var slug = b.closest('.line').dataset.slug;
          C.cartSet(C.cartGet().filter(function (i) { return i.slug !== slug; }));
          draw(data);
        });
      });
      C.wireWa();
    }
  };

  /* ---------- sign in ---------- */
  C.pages.login = function () {
    var next = C.qs('next') || 'account.html';
    if (!/^[\w-]+\.html(\?[\w=&%.-]*)?$/.test(next)) next = 'account.html';
    if (C.token()) { location.replace(next); return; }
    var tabs = $$('[data-tab]'), forms = { in: $('#signIn'), up: $('#signUp') };
    function show(which) {
      tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.tab === which)); });
      forms.in.classList.toggle('hidden', which !== 'in');
      forms.up.classList.toggle('hidden', which !== 'up');
    }
    tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.tab); }); });
    if (C.qs('new')) show('up');
    if (/checkout/.test(next)) $('#loginWhy').classList.remove('hidden');
    function submit(form, path, body) {
      var err = $('.form-error', form), btn = $('button[type=submit]', form);
      err.classList.add('hidden');
      btn.disabled = true;
      shopApi('POST', path, body).then(function (r) {
        C.setToken(r.token);
        location.replace(next);
      }).catch(function (e) { btn.disabled = false; showError(err, e); });
    }
    forms.in.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = new FormData(forms.in);
      submit(forms.in, '/auth/login', { email: f.get('email'), password: f.get('password') });
    });
    forms.up.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = new FormData(forms.up);
      if (f.get('password') !== f.get('password2')) return showError($('.form-error', forms.up), 'The two passwords do not match.');
      submit(forms.up, '/auth/signup', { name: f.get('name'), email: f.get('email'), phone: f.get('phone'), password: f.get('password') });
    });
    $('#forgotNums').innerHTML = C.numbersHtml('Hello ' + C.BRAND + ', I forgot my account password. My email is: ');
  };

  /* ---------- checkout ---------- */
  C.pages.checkout = function () {
    if (!requireLogin()) return;
    var box = $('#checkoutBox');
    loading(box);
    var me = null, data = null;
    shopApi('GET', '/me').then(function (m) { me = m; draw(); }).catch(function (e) { if (!onLoggedOut(e)) { me = {}; draw(); } });
    C.catalog(function (d, final) {
      C.applySite(d);
      if (!d) { if (final) { box.innerHTML = C.noteHtml('Checkout could not load', 'Check your connection and refresh, or order on WhatsApp.'); C.wireWa(); } return; }
      data = d;
      draw();
    });
    function draw() {
      if (!me || !data) return;
      var c = cartLines(data);
      if (!c.lines.length) {
        box.innerHTML = '<div class="note"><h3>Your cart is empty</h3><p>Add a gem to your cart before you check out.</p><a class="btn btn-solid" href="gems.html">See our gems</a></div>';
        return;
      }
      var a = me.address || {};
      var banks = C.siteInfo.bankAccounts;
      box.innerHTML = delivery() + '<form class="checkout-grid" id="co" novalidate><div class="col-main">' +
        '<section class="glass-card"><h2>Delivery details</h2><div class="form-grid">' +
        '<label class="full">Full name<input name="name" required maxlength="80" autocomplete="name" value="' + esc(me.name) + '"></label>' +
        '<label>WhatsApp or phone number<input name="phone" required maxlength="24" inputmode="tel" autocomplete="tel" placeholder="077 123 4567" value="' + esc(me.phone) + '"></label>' +
        '<label>Second phone number (optional)<input name="phone2" maxlength="24" inputmode="tel" placeholder="Another number we can call"></label>' +
        '<label class="full">Address<input name="address" required maxlength="300" autocomplete="street-address" placeholder="House number, street" value="' + esc(a.line) + '"></label>' +
        '<label>City or town<input name="city" required maxlength="80" autocomplete="address-level2" value="' + esc(a.city) + '"></label>' +
        '<label>District<select name="district" required><option value="">Choose your district</option>' + DISTRICTS.map(function (d) { return '<option' + (d === a.district ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select></label>' +
        '<label>Postal code (optional)<input name="postal" maxlength="12" inputmode="numeric" autocomplete="postal-code" value="' + esc(a.postal) + '"></label>' +
        '<label>Country<input value="Sri Lanka" disabled></label>' +
        '<label class="full">Note for us (optional)<textarea name="notes" rows="3" maxlength="1000" placeholder="Directions for delivery, or a question about your order"></textarea></label></div></section>' +
        '<section class="glass-card"><h2>Payment</h2><div class="pay-options">' +
        '<label class="pay-opt"><input type="radio" name="payment" value="bank" checked><span><strong>Bank transfer</strong><small>Transfer the total to one of our accounts, then upload your payment slip. We start processing your order as soon as the slip arrives.</small></span></label>' +
        '<label class="pay-opt' + (C.siteInfo.cardPayments ? '' : ' off') + '"><input type="radio" name="payment" value="card"' + (C.siteInfo.cardPayments ? '' : ' disabled') + '><span><strong>Card payment</strong><small>' + (!C.siteInfo.cardPayments ? 'Coming soon. Please pay by bank transfer for now.' : C.siteInfo.cardMode === 'link' ? 'Pay with Visa or Mastercard. After you order, we send you a secure card payment link here and on WhatsApp.' : 'Pay securely with Visa, Mastercard or Amex through PayHere.') + '</small></span></label></div>' +
        '<div class="banks" id="bankList">' + banks.map(bankHtml).join('') + '</div></section></div>' +
        '<aside class="glass-card summary"><h2>Your order</h2>' + c.lines.map(function (l) { return lineHtml(l, false); }).join('') + summaryHtml(c) +
        '<label class="agree"><input type="checkbox" name="agree" required> I agree to the <a href="terms.html" target="_blank">Terms &amp; Conditions</a> and <a href="privacy.html" target="_blank">Privacy Policy</a></label>' +
        '<p class="form-error hidden" role="alert"></p><button type="submit" class="btn btn-solid wide" id="place">Place order</button>' +
        '<p class="hint">Need help? WhatsApp <span class="nums">' + C.numbersHtml('Hello ' + C.BRAND + ', I need help with my order.') + '</span></p></aside></form>';
      var form = $('#co');
      $$('[name=payment]', form).forEach(function (r) { r.addEventListener('change', function () { $('#bankList').classList.toggle('hidden', form.payment.value !== 'bank'); }); });
      wireCopy(box);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var f = new FormData(form), err = $('.form-error', form), btn = $('#place');
        err.classList.add('hidden');
        if (!f.get('name') || !f.get('address') || !f.get('city')) return showError(err, ERRORS.address_required);
        if (String(f.get('phone') || '').replace(/\D/g, '').length < 9) return showError(err, ERRORS.phone_required);
        if (!f.get('district')) return showError(err, ERRORS.district_required);
        if (!f.get('agree')) return showError(err, ERRORS.terms_required);
        btn.disabled = true;
        btn.textContent = 'Placing your order...';
        shopApi('POST', '/orders', {
          items: c.lines.map(function (l) { return { slug: l.p.slug, qty: l.qty }; }),
          name: f.get('name'), phone: f.get('phone'), phone2: f.get('phone2'), address: f.get('address'), city: f.get('city'),
          district: f.get('district'), postal: f.get('postal'), notes: f.get('notes'), payment: f.get('payment'), agree: true,
        }).then(function (o) {
          C.cartSet([]);
          location.href = 'order.html?no=' + o.no + '&new=1';
        }).catch(function (e) {
          btn.disabled = false;
          btn.textContent = 'Place order';
          if (onLoggedOut(e)) return;
          if (e.code === 'item_unavailable' && e.details) {
            C.cartSet(C.cartGet().filter(function (i) { return e.details.indexOf(i.slug) < 0; }));
            C.catalog(function (d) { if (d) { data = d; draw(); showError($('.form-error'), ERRORS.item_unavailable); } });
            return;
          }
          showError(err, e);
        });
      });
      C.wireWa();
    }
  };
  function bankHtml(b) {
    return '<div class="bank"><div><span class="muted">Bank</span><strong>' + esc(b.bank) + '</strong></div>' +
      '<div><span class="muted">Account number</span><strong class="notranslate acc">' + esc(b.number) + '</strong><button type="button" class="link-btn" data-copy="' + esc(String(b.number).replace(/\s/g, '')) + '">Copy</button></div>' +
      '<div><span class="muted">Account name</span><strong class="notranslate">' + esc(b.name) + '</strong></div>' + (b.branch ? '<div><span class="muted">Branch</span><strong>' + esc(b.branch) + '</strong></div>' : '') + '</div>';
  }
  function wireCopy(root) {
    $$('[data-copy]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); };
        if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.copy).then(done, function () {});
      });
    });
  }

  /* ---------- one order: payment, slip upload, tracking ---------- */
  C.pages.order = function () {
    if (!requireLogin()) return;
    var no = parseInt(C.qs('no'), 10);
    var box = $('#orderBox');
    if (!no) { box.innerHTML = C.noteHtml('Order not found', 'Open your orders from My account.'); return; }
    loading(box);
    C.catalog(function (d) { C.applySite(d); });
    var polls = 0;
    function load() {
      shopApi('GET', '/orders/' + no).then(draw).catch(function (e) {
        if (onLoggedOut(e)) return;
        box.innerHTML = '<div class="note"><h3>This order could not load</h3><p>' + esc(errText(e)) + '</p><a class="btn btn-solid" href="account.html">My account</a></div>';
      });
    }
    load();
    function draw(o) {
      document.title = 'Order #' + o.no + ' | ' + C.BRAND;
      var waText = 'Hello ' + C.BRAND + ', here is the payment slip for my order #' + o.no + '.';
      var pay = '';
      var cardBack = C.qs('card') && o.paymentStatus !== 'paid';
      if (o.status === 'cancelled') {
        pay = '<div class="notice warn">This order has been cancelled. Contact us on WhatsApp if you have a question.</div>';
      } else if (o.paymentStatus === 'paid') {
        pay = '<div class="notice ok"><strong>Payment confirmed.</strong> Thank you. Your order is being prepared.</div>';
      } else if (cardBack) {
        pay = '<div class="notice"><strong>Thank you.</strong> We are confirming your card payment. This page updates in a moment.</div>';
        if (polls++ < 6) setTimeout(load, 5000);
      } else if (o.paymentMethod === 'card' && o.cardAvailable) {
        pay = '<div class="pay-box"><h2>Pay with card</h2><p>Pay <b class="notranslate">' + esc(money(o.total)) + '</b> securely through PayHere.</p><button type="button" class="btn btn-solid" id="payCard">Pay now with card</button><p class="form-error hidden" role="alert"></p>' +
          '<p class="hint">Prefer a bank transfer? Pay to one of the accounts below and upload your slip.</p></div>';
      }
      if (o.paymentMethod === 'card_link' && o.status !== 'cancelled' && o.paymentStatus !== 'paid') {
        pay = o.payLink ?
          '<div class="pay-box"><h2>Pay with card</h2><p>Your secure card payment link is ready. Pay <b class="notranslate">' + esc(money(o.total)) + '</b> with Visa or Mastercard.</p><a class="btn btn-solid" id="payLink" href="' + esc(o.payLink) + '" target="_blank" rel="noopener noreferrer">Pay by card</a>' +
            '<p class="hint">After you pay, we confirm your payment and update this page. Questions? WhatsApp <span class="nums">' + C.numbersHtml('Hello ' + C.BRAND + ', I have a question about paying for order #' + o.no + '.') + '</span></p></div>' :
          '<div class="pay-box"><h2>Pay with card</h2><p>Thank you. We are preparing a secure card payment link for <b class="notranslate">' + esc(money(o.total)) + '</b>. It will appear here and we will send it to your WhatsApp shortly.</p>' +
            '<p class="hint">Want it sooner? Message us: <span class="nums">' + C.numbersHtml('Hello ' + C.BRAND + ', please send me the card payment link for order #' + o.no + '.') + '</span></p><p class="hint">Prefer a bank transfer? Pay to one of the accounts below and upload your slip.</p></div>';
        if (!o.payLink && polls++ < 40) setTimeout(load, 15000);
      }
      var showBank = o.status !== 'cancelled' && o.paymentStatus !== 'paid' && !cardBack;
      var slipDone = o.paymentStatus === 'slip_uploaded';
      var bank = showBank ? '<div class="pay-box">' +
        (slipDone ? '<div class="notice ok"><strong>We received your payment slip.</strong> Your order is being processed. We will update this page when it is on its way.</div>' :
          '<h2>Pay by bank transfer</h2><ol class="pay-steps"><li>Transfer <b class="notranslate">' + esc(money(o.total)) + '</b> to one of these accounts.</li><li>Use your order number <b class="notranslate">#' + o.no + '</b> as the reference.</li><li>Upload a photo or PDF of your payment slip below.</li></ol>') +
        '<div class="banks">' + C.siteInfo.bankAccounts.map(bankHtml).join('') + '</div>' +
        '<form id="slipForm" class="slip-form"><label class="drop-zone"><input type="file" name="slip" accept="image/*,application/pdf" required><span id="slipName">' + (slipDone ? 'Upload another slip' : 'Choose your payment slip') + '</span><small>Photo or PDF, up to 12 MB</small></label>' +
        '<button type="submit" class="btn btn-solid">Upload slip</button><p class="form-error hidden" role="alert"></p></form>' +
        '<div class="fast"><strong>Want your order sooner?</strong> Also send your slip to us on WhatsApp and we will confirm it quickly: <span class="nums">' + C.numbersHtml(waText) + '</span></div></div>' : '';
      box.innerHTML = '<div class="order-head">' + (C.qs('new') ? '<p class="thanks">Thank you. Your order has been placed.</p>' : '') +
        '<h1 class="order-no">Order <span class="notranslate">#' + o.no + '</span></h1>' + statusPill(o) + '<span class="pill pay">' + esc(o.paymentText) + '</span><p class="muted">Placed on ' + esc(when(o.createdAt)) + '</p></div>' +
        '<div class="order-grid"><div class="col-main">' + pay + bank +
        '<section class="glass-card"><h2>Order progress</h2><ol class="timeline">' + o.events.map(function (ev) {
          return '<li><strong>' + esc(ev.statusText) + '</strong><span class="muted">' + esc(when(ev.at)) + '</span>' + (ev.note ? '<span>' + esc(ev.note) + '</span>' : '') + '</li>';
        }).join('') + '</ol>' + (o.tracking ? '<p class="tracking"><strong>Delivery details:</strong> ' + esc(o.tracking) + '</p>' : '') + '</section></div>' +
        '<aside class="glass-card summary"><h2>Items</h2>' + o.items.map(function (i) {
          return '<div class="line">' + (i.image ? '<img src="' + esc(i.image) + '" alt="">' : '<span class="ph"></span>') + '<div class="line-main"><span>' + esc(i.name) + '</span><div class="muted">Qty ' + i.qty + '</div></div><strong class="notranslate">' + esc(money(i.unitPrice * i.qty)) + '</strong></div>';
        }).join('') +
        '<div class="sum-rows"><span>Subtotal</span><span class="notranslate">' + esc(money(o.subtotal)) + '</span>' + (o.savings > 0 ? '<span>Discount</span><span class="notranslate save">- ' + esc(money(o.savings)) + '</span>' : '') +
        '<span>Delivery</span><span class="notranslate">' + esc(money(o.deliveryFee)) + '</span><strong>Total</strong><strong class="notranslate">' + esc(money(o.total)) + '</strong></div>' +
        '<h2>Delivery to</h2><p>' + esc(o.delivery.name) + '<br>' + esc([o.delivery.address, o.delivery.city, o.delivery.district, o.delivery.postal].filter(Boolean).join(', ')) + '<br>Sri Lanka<br><span class="notranslate">' + esc(o.delivery.phone) + '</span></p>' +
        '<p class="hint">Delivered to your door within <b data-days>' + C.siteInfo.deliveryDays + '</b> working days after your payment is confirmed.</p>' +
        '<a class="btn btn-white wide" href="account.html">All my orders</a></aside></div>';
      wireCopy(box);
      var sf = $('#slipForm');
      if (sf) {
        var input = $('input[type=file]', sf);
        input.addEventListener('change', function () { if (input.files[0]) $('#slipName').textContent = input.files[0].name; });
        sf.addEventListener('submit', function (e) {
          e.preventDefault();
          var file = input.files[0], err = $('.form-error', sf), btn = $('button', sf);
          err.classList.add('hidden');
          if (!file) return showError(err, 'Choose your slip first.');
          if (file.size > 12 * 1048576) return showError(err, ERRORS.file_too_large);
          btn.disabled = true;
          btn.textContent = 'Uploading...';
          shopApi('POST', '/orders/' + o.no + '/slip', file, true).then(function (fresh) {
            C.toast('Payment slip received. Your order is being processed.');
            draw(fresh);
          }).catch(function (e2) { btn.disabled = false; btn.textContent = 'Upload slip'; if (!onLoggedOut(e2)) showError(err, e2); });
        });
      }
      var pc = $('#payCard');
      if (pc) pc.addEventListener('click', function () {
        pc.disabled = true;
        shopApi('POST', '/orders/' + o.no + '/payhere', {}).then(function (r) {
          var f = document.createElement('form');
          f.method = 'POST';
          f.action = r.action;
          Object.keys(r.fields).forEach(function (k) {
            var i = document.createElement('input');
            i.type = 'hidden';
            i.name = k;
            i.value = r.fields[k];
            f.append(i);
          });
          document.body.append(f);
          f.submit();
        }).catch(function (e) { pc.disabled = false; showError($('.form-error', pc.parentNode), e); });
      });
      C.wireWa();
    }
  };

  /* ---------- track an order ---------- */
  C.pages.track = function () {
    C.catalog(function (d) { C.applySite(d); });
    var form = $('#trackForm'), out = $('#trackOut');
    if (C.qs('no')) form.orderNo.value = C.qs('no');
    if (C.token()) $('#trackAccount').classList.remove('hidden');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('.form-error', form), btn = $('button', form);
      err.classList.add('hidden');
      btn.disabled = true;
      shopApi('POST', '/track', { orderNo: form.orderNo.value.replace(/\D/g, ''), phone: form.phone.value }).then(function (o) {
        btn.disabled = false;
        var steps = ['placed', 'processing', 'shipped', 'delivered'];
        var at = steps.indexOf(o.status);
        out.innerHTML = '<section class="glass-card track-card"><h2>Order <span class="notranslate">#' + o.no + '</span></h2>' + statusPill(o) + '<span class="pill pay">' + esc(o.paymentText) + '</span>' +
          (o.status === 'cancelled' ? '' : '<ol class="progress">' + ['Order placed', 'Being processed', 'Handed for delivery', 'Delivered'].map(function (label, i) {
            return '<li class="' + (i <= at ? 'done' : '') + '">' + label + '</li>';
          }).join('') + '</ol>') +
          (o.tracking ? '<p class="tracking"><strong>Delivery details:</strong> ' + esc(o.tracking) + '</p>' : '') +
          '<p class="muted">' + esc(o.items.map(function (i) { return i.name + (i.qty > 1 ? ' x' + i.qty : ''); }).join(', ')) + '. Total <span class="notranslate">' + esc(money(o.total)) + '</span>.</p>' +
          '<ol class="timeline">' + o.events.map(function (ev) { return '<li><strong>' + esc(ev.statusText) + '</strong><span class="muted">' + esc(when(ev.at)) + '</span>' + (ev.note ? '<span>' + esc(ev.note) + '</span>' : '') + '</li>'; }).join('') + '</ol></section>';
        out.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }).catch(function (e2) { btn.disabled = false; out.innerHTML = ''; showError(err, e2); });
    });
  };

  /* ---------- My account ---------- */
  C.pages.account = function () {
    if (!requireLogin()) return;
    var box = $('#accountBox');
    loading(box);
    C.catalog(function (d) { C.applySite(d); });
    Promise.all([shopApi('GET', '/me'), shopApi('GET', '/orders')]).then(function (r) {
      var me = r[0], orders = r[1], a = me.address || {};
      box.innerHTML = '<div class="acc-head"><h2>Hello, ' + esc(me.name.split(' ')[0]) + '</h2><p class="muted">' + esc(me.email) + '</p><button type="button" class="btn btn-white" id="logout">Sign out</button></div>' +
        '<div class="acc-grid"><section class="glass-card"><h2>My orders</h2>' + (orders.length ? '<div class="orders">' + orders.map(function (o) {
          return '<a class="order-row" href="order.html?no=' + o.no + '"><strong class="notranslate">#' + o.no + '</strong><span class="muted">' + esc(when(o.createdAt)) + '</span><span class="notranslate">' + esc(money(o.total)) + '</span>' + statusPill(o) + '</a>';
        }).join('') + '</div>' : '<p class="muted">You have not placed an order yet.</p><a class="btn btn-solid" href="gems.html">See our gems</a>') + '</section>' +
        '<section class="glass-card"><h2>My details</h2><form id="prof" class="form-grid">' +
        '<label class="full">Full name<input name="name" required maxlength="80" value="' + esc(me.name) + '"></label>' +
        '<label class="full">Phone number<input name="phone" maxlength="24" inputmode="tel" value="' + esc(me.phone) + '"></label>' +
        '<label class="full">Address<input name="line" maxlength="300" value="' + esc(a.line) + '"></label>' +
        '<label>City or town<input name="city" maxlength="80" value="' + esc(a.city) + '"></label>' +
        '<label>District<select name="district"><option value="">Choose</option>' + DISTRICTS.map(function (d) { return '<option' + (d === a.district ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select></label>' +
        '<label>Postal code<input name="postal" maxlength="12" value="' + esc(a.postal) + '"></label>' +
        '<div class="full"><button class="btn btn-solid">Save my details</button><p class="form-error hidden" role="alert"></p></div></form></section>' +
        '<section class="glass-card"><h2>Change password</h2><form id="pw" class="form-grid"><label class="full">Current password<input type="password" name="current" required autocomplete="current-password"></label>' +
        '<label class="full">New password<input type="password" name="next" required minlength="8" autocomplete="new-password"></label><div class="full"><button class="btn btn-white">Change password</button><p class="form-error hidden" role="alert"></p></div></form></section></div>';
      $('#logout').addEventListener('click', function () {
        shopApi('POST', '/auth/logout', {}).catch(function () {}).finally(function () { C.setToken(null); location.href = 'index.html'; });
      });
      $('#prof').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = new FormData(e.target), err = $('.form-error', e.target);
        err.classList.add('hidden');
        shopApi('PATCH', '/me', { name: f.get('name'), phone: f.get('phone'), address: { line: f.get('line'), city: f.get('city'), district: f.get('district'), postal: f.get('postal') } })
          .then(function () { C.toast('Your details are saved'); }).catch(function (e2) { showError(err, e2); });
      });
      $('#pw').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = new FormData(e.target), err = $('.form-error', e.target);
        err.classList.add('hidden');
        shopApi('POST', '/me/password', { current: f.get('current'), next: f.get('next') })
          .then(function () { e.target.reset(); C.toast('Your password is changed'); }).catch(function (e2) { showError(err, e2); });
      });
    }).catch(function (e) {
      if (onLoggedOut(e)) return;
      box.innerHTML = '<div class="note"><h3>Your account could not load</h3><p>' + esc(errText(e)) + '</p></div>';
    });
  };

  /* ---------- contact page numbers ---------- */
  var contact = C.pages.contact;
  C.pages.contact = function () {
    if (contact) contact();
    var n = $('#contactNums');
    if (n) n.innerHTML = C.CONTACTS.map(function (c) {
      return '<a class="phone notranslate" target="_blank" rel="noopener" href="' + esc(C.waLink('Hello ' + C.BRAND + ', I have a question.', c.num)) + '">' + esc(c.label) + '</a>';
    }).join('');
  };
  C.pages.privacy = C.pages.terms = function () { C.catalog(function (d) { C.applySite(d); }); };
})();
