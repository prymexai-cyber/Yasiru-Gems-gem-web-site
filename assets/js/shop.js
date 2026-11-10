'use strict';
// Customer accounts, orders, payment slips, order tracking and card payments for connected websites,
// plus the dashboard views of orders and customers.
const crypto = require('crypto');
const express = require('express');
const sharp = require('sharp');
const { rateLimit } = require('express-rate-limit');
const { finalPrice } = require('./pricing');

const DISTRICTS = ['Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'];
const STATUSES = ['placed', 'processing', 'shipped', 'delivered', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'slip_uploaded', 'paid', 'failed'];
const STATUS_TEXT = {
  placed: 'Order placed',
  processing: 'Order being processed',
  shipped: 'Handed over for delivery',
  delivered: 'Delivered',
  cancelled: 'Order cancelled',
};
const PAYMENT_TEXT = { pending: 'Waiting for payment', slip_uploaded: 'Payment slip received', paid: 'Payment confirmed', failed: 'Payment failed' };
const MAX_SLIPS = 10;

const limiter = (minutes, limit) =>
  rateLimit({ windowMs: minutes * 60000, limit, standardHeaders: true, legacyHeaders: false, message: { error: 'too_many' } });
const tokenHash = (t) => crypto.createHash('sha256').update(t).digest('hex');
const md5u = (s) => crypto.createHash('md5').update(s).digest('hex').toUpperCase();
const digits = (v) => String(v || '').replace(/\D/g, '');
const lastNine = (v) => digits(v).slice(-9);
const money = (n) => Math.round(Number(n) * 100) / 100;

module.exports = function mountShop(d) {
  const { app, api, pool, newId, HttpError, wrap, str, publicBase, originAllowed, sendWhatsAppAlert, inTransaction, requireAuth, requireOwner, hashPassword, checkPassword } = d;
  const json = express.json({ limit: '32kb' });
  const payhereReady = (site) => Boolean(site.payhere_merchant_id && site.payhere_secret);
  const imgUrl = (base, id, size = 'thumb') => (id ? `${base}/img/${id}/${size}` : null);

  /* ---------- website side ---------- */
  const loadShopSite = wrap(async (req, res, next) => {
    const { rows } = await pool.query('SELECT * FROM sites WHERE site_key=$1', [req.params.key]);
    const site = rows[0];
    if (!site || !site.verified_at) throw new HttpError(403, 'site_not_verified');
    const origin = req.get('origin');
    res.vary('Origin');
    if (!originAllowed(origin, site)) throw new HttpError(403, 'origin_not_allowed');
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Max-Age': '600',
    });
    if (req.method === 'OPTIONS') return res.status(204).end();
    req.site = site;
    next();
  });

  const customerAuth = wrap(async (req, _res, next) => {
    const m = /^Bearer ([\w-]{20,100})$/.exec(req.get('authorization') || '');
    if (!m) throw new HttpError(401, 'login_required');
    const { rows } = await pool.query(
      `SELECT c.* FROM customer_sessions s JOIN customers c ON c.id = s.customer_id
       WHERE s.token_hash=$1 AND s.expires_at > now() AND c.site_id=$2`,
      [tokenHash(m[1]), req.site.id]
    );
    if (!rows[0]) throw new HttpError(401, 'login_required');
    req.customer = rows[0];
    req.token = m[1];
    next();
  });

  async function startSession(customerId) {
    const token = crypto.randomBytes(32).toString('base64url');
    await pool.query("INSERT INTO customer_sessions (token_hash, customer_id, expires_at) VALUES ($1,$2, now() + interval '60 days')", [
      tokenHash(token),
      customerId,
    ]);
    await pool.query('DELETE FROM customer_sessions WHERE expires_at < now()').catch(() => {});
    return token;
  }

  const customerOut = (c) => ({ name: c.name, email: c.email, phone: c.phone, address: c.address || {}, since: c.created_at });

  function cleanAddress(a) {
    a = a || {};
    const district = DISTRICTS.includes(a.district) ? a.district : '';
    return { line: str(a.line, 300), city: str(a.city, 80), district, postal: str(a.postal, 12) };
  }

  function orderOut(o, base, extra = {}) {
    return {
      no: o.order_no,
      createdAt: o.created_at,
      status: o.status,
      statusText: STATUS_TEXT[o.status] || o.status,
      paymentStatus: o.payment_status,
      paymentText: PAYMENT_TEXT[o.payment_status] || o.payment_status,
      paymentMethod: o.payment_method,
      payLink: o.payment_method === 'card_link' && o.payment_status !== 'paid' && o.status !== 'cancelled' ? o.pay_link : '',
      items: o.items.map((i) => ({ slug: i.slug, name: i.name, qty: i.qty, unitPrice: i.unitPrice, originalPrice: i.originalPrice, image: imgUrl(base, i.imageId) })),
      subtotal: o.subtotal,
      savings: o.savings,
      deliveryFee: o.delivery_fee,
      total: o.total,
      currency: o.currency,
      tracking: o.tracking,
      delivery: { name: o.name, phone: o.phone, phone2: o.phone2, address: o.address_line, city: o.city, district: o.district, postal: o.postal_code, country: o.country },
      notes: o.notes,
      ...extra,
    };
  }
  async function eventsFor(orderId) {
    const { rows } = await pool.query('SELECT status, note, created_at FROM order_events WHERE order_id=$1 ORDER BY id', [orderId]);
    return rows.map((e) => ({ status: e.status, statusText: STATUS_TEXT[e.status] || e.status, note: e.note, at: e.created_at }));
  }
  async function customerOrder(req) {
    const no = parseInt(req.params.no, 10);
    if (!Number.isInteger(no)) throw new HttpError(404, 'order_not_found');
    const { rows } = await pool.query('SELECT * FROM orders WHERE site_id=$1 AND order_no=$2 AND customer_id=$3', [req.site.id, no, req.customer.id]);
    if (!rows[0]) throw new HttpError(404, 'order_not_found');
    return rows[0];
  }
  async function fullCustomerOrder(req, o) {
    const [events, slips] = await Promise.all([
      eventsFor(o.id),
      pool.query('SELECT count(*)::int AS n FROM slips WHERE order_id=$1', [o.id]),
    ]);
    return orderOut(o, publicBase(req), { events, slipCount: slips.rows[0].n, cardAvailable: payhereReady(req.site) });
  }

  const shop = express.Router({ mergeParams: true });
  app.use('/public/v1/:key', loadShopSite, shop);

  const authLimit = limiter(15, 25);
  shop.post(
    '/auth/signup',
    authLimit,
    json,
    wrap(async (req, res) => {
      const name = str(req.body?.name, 80);
      const email = str(req.body?.email, 200).toLowerCase();
      const phone = str(req.body?.phone, 24);
      const password = String(req.body?.password ?? '');
      if (!name) throw new HttpError(400, 'name_required');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'bad_email');
      if (password.length < 8) throw new HttpError(400, 'short_password');
      if (password.length > 200) throw new HttpError(400, 'bad_request');
      const { rows } = await pool.query(
        `INSERT INTO customers (id, site_id, email, name, phone, password_hash) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (site_id, email) DO NOTHING RETURNING *`,
        [newId(), req.site.id, email, name, phone, await hashPassword(password)]
      );
      if (!rows[0]) throw new HttpError(409, 'email_taken');
      res.status(201).json({ token: await startSession(rows[0].id), customer: customerOut(rows[0]) });
    })
  );
  shop.post(
    '/auth/login',
    authLimit,
    json,
    wrap(async (req, res) => {
      const email = str(req.body?.email, 200).toLowerCase();
      const { rows } = await pool.query('SELECT * FROM customers WHERE site_id=$1 AND email=$2', [req.site.id, email]);
      const ok = rows[0] && (await checkPassword(String(req.body?.password ?? ''), rows[0].password_hash));
      if (!ok) throw new HttpError(401, 'wrong_login');
      await pool.query('UPDATE customers SET last_login=now() WHERE id=$1', [rows[0].id]);
      res.json({ token: await startSession(rows[0].id), customer: customerOut(rows[0]) });
    })
  );
  shop.post(
    '/auth/logout',
    customerAuth,
    wrap(async (req, res) => {
      await pool.query('DELETE FROM customer_sessions WHERE token_hash=$1', [tokenHash(req.token)]);
      res.json({ ok: true });
    })
  );
  shop.get('/me', customerAuth, (req, res) => res.json(customerOut(req.customer)));
  shop.patch(
    '/me',
    customerAuth,
    json,
    wrap(async (req, res) => {
      const c = req.customer;
      const name = req.body.name !== undefined ? str(req.body.name, 80) : c.name;
      if (!name) throw new HttpError(400, 'name_required');
      const { rows } = await pool.query('UPDATE customers SET name=$1, phone=$2, address=$3 WHERE id=$4 RETURNING *', [
        name,
        req.body.phone !== undefined ? str(req.body.phone, 24) : c.phone,
        JSON.stringify(req.body.address !== undefined ? cleanAddress(req.body.address) : c.address),
        c.id,
      ]);
      res.json(customerOut(rows[0]));
    })
  );
  shop.post(
    '/me/password',
    authLimit,
    customerAuth,
    json,
    wrap(async (req, res) => {
      if (!(await checkPassword(String(req.body.current ?? ''), req.customer.password_hash))) throw new HttpError(400, 'wrong_password');
      const next = String(req.body.next ?? '');
      if (next.length < 8 || next.length > 200) throw new HttpError(400, 'short_password');
      await pool.query('UPDATE customers SET password_hash=$1 WHERE id=$2', [await hashPassword(next), req.customer.id]);
      await pool.query('DELETE FROM customer_sessions WHERE customer_id=$1 AND token_hash<>$2', [req.customer.id, tokenHash(req.token)]);
      res.json({ ok: true });
    })
  );

  shop.get(
    '/orders',
    customerAuth,
    wrap(async (req, res) => {
      const { rows } = await pool.query('SELECT * FROM orders WHERE site_id=$1 AND customer_id=$2 ORDER BY created_at DESC LIMIT 200', [
        req.site.id,
        req.customer.id,
      ]);
      const base = publicBase(req);
      res.json(rows.map((o) => orderOut(o, base)));
    })
  );
  shop.get(
    '/orders/:no',
    customerAuth,
    wrap(async (req, res) => res.json(await fullCustomerOrder(req, await customerOrder(req))))
  );

  shop.post(
    '/orders',
    limiter(60, 30),
    customerAuth,
    json,
    wrap(async (req, res) => {
      const b = req.body || {};
      const site = req.site;
      const wanted = new Map();
      for (const it of Array.isArray(b.items) ? b.items.slice(0, 50) : []) {
        const slug = str(it?.slug, 100);
        const qty = Math.min(20, Math.max(1, parseInt(it?.qty, 10) || 1));
        if (slug) wanted.set(slug, (wanted.get(slug) || 0) + qty);
      }
      if (!wanted.size) throw new HttpError(400, 'empty_cart');
      const dl = {
        name: str(b.name, 80),
        phone: str(b.phone, 24),
        phone2: str(b.phone2, 24),
        line: str(b.address, 300),
        city: str(b.city, 80),
        district: str(b.district, 40),
        postal: str(b.postal, 12),
        notes: str(b.notes, 1000),
      };
      if (!dl.name || !dl.line || !dl.city) throw new HttpError(400, 'address_required');
      if (!DISTRICTS.includes(dl.district)) throw new HttpError(400, 'district_required');
      if (digits(dl.phone).length < 9) throw new HttpError(400, 'phone_required');
      let method = 'bank';
      if (b.payment === 'card') {
        if (payhereReady(site)) method = 'card';
        else if (site.card_links) method = 'card_link';
        else throw new HttpError(400, 'card_unavailable');
      }
      if (b.agree !== true) throw new HttpError(400, 'terms_required');

      const order = await inTransaction(async (c) => {
        const slugs = [...wanted.keys()];
        const { rows: prods } = await c.query(
          `SELECT p.* FROM products p JOIN product_sites ps ON ps.product_id = p.id AND ps.site_id = $1
           WHERE p.slug = ANY($2) AND p.published FOR UPDATE OF p`,
          [site.id, slugs]
        );
        const covers = await c.query(
          `SELECT DISTINCT ON (product_id) product_id, id FROM images
           WHERE product_id = ANY($1) AND kind = 'image' ORDER BY product_id, position`,
          [prods.map((p) => p.id)]
        );
        const cover = Object.fromEntries(covers.rows.map((r) => [r.product_id, r.id]));
        const problems = [];
        const lines = [];
        for (const [slug, qty] of wanted) {
          const p = prods.find((x) => x.slug === slug);
          if (!p || p.sold || p.stock < qty || p.price === null || p.currency !== 'LKR') {
            problems.push(slug);
            continue;
          }
          lines.push({ productId: p.id, slug, name: p.name, qty, unitPrice: finalPrice(p), originalPrice: Number(p.price), imageId: cover[p.id] || null });
        }
        if (problems.length) {
          const err = new HttpError(409, 'item_unavailable');
          err.details = problems;
          throw err;
        }
        for (const l of lines) {
          await c.query('UPDATE products SET stock = stock - $2, sold = (stock - $2) <= 0, updated_at = now() WHERE id = $1', [l.productId, l.qty]);
        }
        const subtotal = money(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));
        const savings = money(lines.reduce((s, l) => s + (l.originalPrice - l.unitPrice) * l.qty, 0));
        const fee = money(site.delivery_fee);
        const num = await c.query('UPDATE sites SET next_order_no = next_order_no + 1 WHERE id=$1 RETURNING next_order_no - 1 AS no', [site.id]);
        const id = newId(12);
        const { rows } = await c.query(
          `INSERT INTO orders (id, site_id, order_no, customer_id, email, name, phone, phone2, address_line, city, district, postal_code,
             notes, items, subtotal, savings, delivery_fee, total, payment_method)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
          [id, site.id, num.rows[0].no, req.customer.id, req.customer.email, dl.name, dl.phone, dl.phone2, dl.line, dl.city, dl.district, dl.postal,
            dl.notes, JSON.stringify(lines), subtotal, savings, fee, money(subtotal + fee), method]
        );
        await c.query("INSERT INTO order_events (order_id, status, note) VALUES ($1,'placed',$2)", [
          id,
          method === 'bank' ? 'Waiting for the bank transfer slip' : method === 'card_link' ? 'We will send you a secure card payment link' : 'Waiting for card payment',
        ]);
        return rows[0];
      });
      // Saves the address so the next checkout is quicker.
      await pool.query('UPDATE customers SET address=$1, phone=CASE WHEN phone=\'\' THEN $2 ELSE phone END WHERE id=$3', [
        JSON.stringify(cleanAddress({ line: dl.line, city: dl.city, district: dl.district, postal: dl.postal })),
        dl.phone,
        req.customer.id,
      ]);
      res.status(201).json(await fullCustomerOrder(req, order));
      sendWhatsAppAlert(
        site,
        `New order #${order.order_no} on ${site.name}\n${dl.name}, ${dl.phone}\n${dl.city}, ${dl.district}\nTotal: LKR ${order.total}\nPayment: ${method === 'bank' ? 'Bank transfer' : method === 'card_link' ? 'Card (send a payment link)' : 'Card'}`
      );
    })
  );

  shop.post(
    '/orders/:no/slip',
    limiter(60, 30),
    customerAuth,
    express.raw({ type: () => true, limit: '12mb' }),
    wrap(async (req, res) => {
      const o = await customerOrder(req);
      if (o.status === 'cancelled') throw new HttpError(409, 'order_cancelled');
      const buf = req.body;
      if (!Buffer.isBuffer(buf) || !buf.length) throw new HttpError(400, 'bad_file');
      const count = await pool.query('SELECT count(*)::int AS n FROM slips WHERE order_id=$1', [o.id]);
      if (count.rows[0].n >= MAX_SLIPS) throw new HttpError(409, 'too_many_slips');
      let data, mime;
      if (buf.subarray(0, 5).toString('latin1') === '%PDF-') {
        data = buf;
        mime = 'application/pdf';
      } else {
        try {
          data = await sharp(buf, { limitInputPixels: 80e6 }).rotate().resize(2200, 2200, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
          mime = 'image/webp';
        } catch {
          throw new HttpError(400, 'bad_file');
        }
      }
      const { rows } = await inTransaction(async (c) => {
        await c.query('INSERT INTO slips (id, order_id, mime, data, size_bytes) VALUES ($1,$2,$3,$4,$5)', [newId(12), o.id, mime, data, data.length]);
        const up = await c.query(
          `UPDATE orders SET payment_status = CASE WHEN payment_status='paid' THEN 'paid' ELSE 'slip_uploaded' END,
             status = CASE WHEN status='placed' THEN 'processing' ELSE status END, seen=false, updated_at=now()
           WHERE id=$1 RETURNING *`,
          [o.id]
        );
        await c.query('INSERT INTO order_events (order_id, status, note) VALUES ($1,$2,$3)', [o.id, up.rows[0].status, 'Payment slip uploaded']);
        return up;
      });
      res.json(await fullCustomerOrder(req, rows[0]));
      sendWhatsAppAlert(req.site, `Payment slip uploaded for order #${o.order_no} on ${req.site.name}. Total: LKR ${o.total}`);
    })
  );

  shop.post(
    '/orders/:no/payhere',
    customerAuth,
    json,
    wrap(async (req, res) => {
      const site = req.site;
      const o = await customerOrder(req);
      if (!payhereReady(site)) throw new HttpError(400, 'card_unavailable');
      if (o.status === 'cancelled') throw new HttpError(409, 'order_cancelled');
      if (o.payment_status === 'paid') throw new HttpError(409, 'already_paid');
      const amount = Number(o.total).toFixed(2);
      const [first, ...rest] = o.name.split(/\s+/);
      const siteUrl = (site.url || '').replace(/\/+$/, '');
      res.json({
        action: site.payhere_sandbox ? 'https://sandbox.payhere.lk/pay/checkout' : 'https://www.payhere.lk/pay/checkout',
        fields: {
          merchant_id: site.payhere_merchant_id,
          return_url: `${siteUrl}/order.html?no=${o.order_no}&card=1`,
          cancel_url: `${siteUrl}/order.html?no=${o.order_no}`,
          notify_url: `${publicBase(req)}/public/payhere/notify`,
          first_name: first || o.name,
          last_name: rest.join(' ') || '-',
          email: o.email,
          phone: o.phone,
          address: o.address_line,
          city: o.city,
          country: 'Sri Lanka',
          order_id: o.id,
          items: `Order ${o.order_no}`,
          currency: 'LKR',
          amount,
          hash: md5u(site.payhere_merchant_id + o.id + amount + 'LKR' + md5u(site.payhere_secret)),
        },
      });
    })
  );

  shop.post(
    '/track',
    limiter(15, 40),
    json,
    wrap(async (req, res) => {
      const no = parseInt(req.body?.orderNo, 10);
      const phone = lastNine(req.body?.phone);
      const { rows } = Number.isInteger(no) && phone.length === 9
        ? await pool.query('SELECT * FROM orders WHERE site_id=$1 AND order_no=$2', [req.site.id, no])
        : { rows: [] };
      const o = rows[0];
      if (!o || (lastNine(o.phone) !== phone && lastNine(o.phone2) !== phone)) throw new HttpError(404, 'order_not_found');
      res.json({
        no: o.order_no,
        createdAt: o.created_at,
        status: o.status,
        statusText: STATUS_TEXT[o.status],
        paymentStatus: o.payment_status,
        paymentText: PAYMENT_TEXT[o.payment_status],
        tracking: o.tracking,
        items: o.items.map((i) => ({ name: i.name, qty: i.qty })),
        total: o.total,
        currency: o.currency,
        city: o.city,
        events: await eventsFor(o.id),
      });
    })
  );

  // PayHere tells the server about each card payment here. Only a correct signature changes an order.
  app.post(
    '/public/payhere/notify',
    express.urlencoded({ extended: false, limit: '20kb' }),
    wrap(async (req, res) => {
      const b = req.body || {};
      const { rows } = await pool.query('SELECT o.*, s.payhere_merchant_id, s.payhere_secret, s.name AS site_name, s.id AS sid, s.whatsapp, s.alert_key FROM orders o JOIN sites s ON s.id=o.site_id WHERE o.id=$1', [
        str(b.order_id, 40),
      ]);
      const o = rows[0];
      if (!o || !o.payhere_secret || b.merchant_id !== o.payhere_merchant_id) return res.status(400).end();
      const local = md5u(String(b.merchant_id) + b.order_id + b.payhere_amount + b.payhere_currency + b.status_code + md5u(o.payhere_secret));
      const given = String(b.md5sig || '').toUpperCase();
      if (given.length !== local.length || !crypto.timingSafeEqual(Buffer.from(local), Buffer.from(given))) return res.status(400).end();
      if (Number(b.payhere_amount).toFixed(2) !== Number(o.total).toFixed(2) || b.payhere_currency !== o.currency) {
        console.error('PayHere amount did not match order', o.order_no);
        return res.status(400).end();
      }
      const code = String(b.status_code);
      if (code === '2' && o.payment_status !== 'paid') {
        const up = await pool.query(
          `UPDATE orders SET payment_status='paid', payment_ref=$2, status = CASE WHEN status='placed' THEN 'processing' ELSE status END,
             seen=false, updated_at=now() WHERE id=$1 RETURNING status`,
          [o.id, str(b.payment_id, 60)]
        );
        await pool.query('INSERT INTO order_events (order_id, status, note) VALUES ($1,$2,$3)', [o.id, up.rows[0].status, 'Card payment received']);
        sendWhatsAppAlert({ whatsapp: o.whatsapp, alert_key: o.alert_key }, `Card payment received for order #${o.order_no} on ${o.site_name}. LKR ${o.total}`);
      } else if (['-1', '-2', '-3'].includes(code) && o.payment_status !== 'paid') {
        await pool.query("UPDATE orders SET payment_status='failed', updated_at=now() WHERE id=$1", [o.id]);
        await pool.query('INSERT INTO order_events (order_id, status, note) VALUES ($1,$2,$3)', [o.id, o.status, 'Card payment did not go through']);
      }
      res.end('OK');
    })
  );

  /* ---------- dashboard side ---------- */
  const adminOrderOut = (o) => ({
    id: o.id,
    no: o.order_no,
    siteId: o.site_id,
    siteName: o.site_name,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    name: o.name,
    email: o.email,
    phone: o.phone,
    phone2: o.phone2,
    address: o.address_line,
    city: o.city,
    district: o.district,
    postal: o.postal_code,
    country: o.country,
    notes: o.notes,
    items: o.items.map((i) => ({ ...i, image: i.imageId ? `/img/${i.imageId}/thumb` : null })),
    subtotal: o.subtotal,
    savings: o.savings,
    deliveryFee: o.delivery_fee,
    total: o.total,
    currency: o.currency,
    paymentMethod: o.payment_method,
    payLink: o.pay_link,
    paymentStatus: o.payment_status,
    paymentRef: o.payment_ref,
    status: o.status,
    tracking: o.tracking,
    seen: o.seen,
    slipCount: o.slip_count || 0,
  });

  api.get(
    '/orders',
    requireAuth,
    wrap(async (req, res) => {
      const where = [];
      const args = [];
      if (req.query.site) {
        args.push(String(req.query.site));
        where.push(`o.site_id=$${args.length}`);
      }
      const tab = String(req.query.tab || 'all');
      if (tab === 'waiting') where.push("o.status='placed' AND o.payment_status IN ('pending','failed')");
      else if (tab === 'check') where.push("o.payment_status='slip_uploaded' AND o.status<>'cancelled'");
      else if (STATUSES.includes(tab)) {
        args.push(tab);
        where.push(`o.status=$${args.length}`);
      }
      const q = str(req.query.q, 80);
      if (q) {
        args.push(`%${q.replace(/[%_\\]/g, '\\$&')}%`);
        const n = args.length;
        where.push(`(o.order_no::text LIKE $${n} OR o.name ILIKE $${n} OR o.phone LIKE $${n} OR o.email ILIKE $${n})`);
      }
      const { rows } = await pool.query(
        `SELECT o.*, s.name AS site_name, (SELECT count(*)::int FROM slips x WHERE x.order_id=o.id) AS slip_count
         FROM orders o JOIN sites s ON s.id=o.site_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
         ORDER BY o.created_at DESC LIMIT 500`,
        args
      );
      res.json(rows.map(adminOrderOut));
    })
  );
  api.get(
    '/orders/:id',
    requireAuth,
    wrap(async (req, res) => {
      const { rows } = await pool.query('SELECT o.*, s.name AS site_name FROM orders o JOIN sites s ON s.id=o.site_id WHERE o.id=$1', [req.params.id]);
      if (!rows[0]) throw new HttpError(404, 'not_found');
      const [events, slips] = await Promise.all([
        eventsFor(rows[0].id),
        pool.query('SELECT id, mime, size_bytes, created_at FROM slips WHERE order_id=$1 ORDER BY created_at', [rows[0].id]),
      ]);
      await pool.query('UPDATE orders SET seen=true WHERE id=$1', [rows[0].id]);
      res.json({
        ...adminOrderOut(rows[0]),
        events,
        slips: slips.rows.map((s) => ({ id: s.id, url: `/api/slips/${s.id}`, pdf: s.mime === 'application/pdf', at: s.created_at })),
      });
    })
  );
  api.patch(
    '/orders/:id',
    requireAuth,
    wrap(async (req, res) => {
      const b = req.body || {};
      await inTransaction(async (c) => {
        const { rows } = await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [req.params.id]);
        const o = rows[0];
        if (!o) throw new HttpError(404, 'not_found');
        const status = b.status !== undefined ? String(b.status) : o.status;
        const pay = b.paymentStatus !== undefined ? String(b.paymentStatus) : o.payment_status;
        if (!STATUSES.includes(status) || !PAYMENT_STATUSES.includes(pay)) throw new HttpError(400, 'bad_request');
        const tracking = b.tracking !== undefined ? str(b.tracking, 300) : o.tracking;
        let payLink = o.pay_link;
        if (b.payLink !== undefined) {
          payLink = str(b.payLink, 1000);
          if (payLink) {
            let u;
            try { u = new URL(payLink); } catch { u = null; }
            if (!u || u.protocol !== 'https:') throw new HttpError(400, 'bad_pay_link');
            payLink = u.href;
          }
        }
        const note = str(b.note, 500);
        // Cancelling puts the stones back on sale. Re-opening takes them off sale again, if they are still free.
        if (status === 'cancelled' && o.status !== 'cancelled') {
          for (const i of o.items) {
            await c.query('UPDATE products SET stock = stock + $2, sold = false, updated_at=now() WHERE id=$1', [i.productId, i.qty]);
          }
        } else if (o.status === 'cancelled' && status !== 'cancelled') {
          for (const i of o.items) {
            const up = await c.query(
              'UPDATE products SET stock = stock - $2, sold = (stock - $2) <= 0, updated_at=now() WHERE id=$1 AND NOT sold AND stock >= $2',
              [i.productId, i.qty]
            );
            if (!up.rowCount) throw new HttpError(409, 'item_unavailable');
          }
        }
        await c.query('UPDATE orders SET status=$2, payment_status=$3, tracking=$4, pay_link=$5, updated_at=now() WHERE id=$1', [o.id, status, pay, tracking, payLink]);
        const notes = [];
        if (pay !== o.payment_status) notes.push(PAYMENT_TEXT[pay]);
        if (tracking !== o.tracking && tracking) notes.push(`Delivery details: ${tracking}`);
        if (payLink && payLink !== o.pay_link) notes.push('Card payment link ready');
        if (note) notes.push(note);
        if (status !== o.status || notes.length) {
          await c.query('INSERT INTO order_events (order_id, status, note) VALUES ($1,$2,$3)', [o.id, status, notes.join('. ')]);
        }
      });
      const { rows } = await pool.query('SELECT o.*, s.name AS site_name FROM orders o JOIN sites s ON s.id=o.site_id WHERE o.id=$1', [req.params.id]);
      res.json({ ...adminOrderOut(rows[0]), events: await eventsFor(rows[0].id) });
    })
  );
  api.get(
    '/slips/:id',
    requireAuth,
    wrap(async (req, res) => {
      const { rows } = await pool.query('SELECT mime, data FROM slips WHERE id=$1', [req.params.id]);
      if (!rows[0]) throw new HttpError(404, 'not_found');
      res.set({ 'Content-Type': rows[0].mime, 'Cache-Control': 'private, max-age=3600', 'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" });
      res.end(rows[0].data);
    })
  );

  api.get(
    '/customers',
    requireAuth,
    wrap(async (req, res) => {
      const where = [];
      const args = [];
      if (req.query.site) {
        args.push(String(req.query.site));
        where.push(`c.site_id=$${args.length}`);
      }
      const q = str(req.query.q, 80);
      if (q) {
        args.push(`%${q.replace(/[%_\\]/g, '\\$&')}%`);
        where.push(`(c.name ILIKE $${args.length} OR c.email ILIKE $${args.length} OR c.phone LIKE $${args.length})`);
      }
      const { rows } = await pool.query(
        `SELECT c.id, c.name, c.email, c.phone, c.address, c.created_at, c.last_login, s.name AS site_name,
           (SELECT count(*)::int FROM orders o WHERE o.customer_id=c.id) AS orders,
           (SELECT COALESCE(sum(total),0)::float8 FROM orders o WHERE o.customer_id=c.id AND o.status<>'cancelled') AS spent
         FROM customers c JOIN sites s ON s.id=c.site_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
         ORDER BY c.created_at DESC LIMIT 1000`,
        args
      );
      res.json(rows);
    })
  );
  api.post(
    '/customers/:id/password',
    requireAuth,
    wrap(async (req, res) => {
      // A readable temporary password the owner can send to the customer.
      const words = crypto.randomBytes(9).toString('base64url').replace(/[-_]/g, 'x');
      const password = words;
      const up = await pool.query('UPDATE customers SET password_hash=$1 WHERE id=$2', [await hashPassword(password), req.params.id]);
      if (!up.rowCount) throw new HttpError(404, 'not_found');
      await pool.query('DELETE FROM customer_sessions WHERE customer_id=$1', [req.params.id]);
      res.json({ password });
    })
  );
  api.delete(
    '/customers/:id',
    requireAuth,
    requireOwner,
    wrap(async (req, res) => {
      await pool.query('DELETE FROM customers WHERE id=$1', [req.params.id]);
      res.json({ ok: true });
    })
  );

  return { DISTRICTS };
};
