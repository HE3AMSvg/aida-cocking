(() => {
  "use strict";

  const CONFIG = window.AIDA_CONFIG || {};
  const STORAGE_KEY = "aida-cockings-cart-v2";
  const MAX_QUANTITY = 20;
  const CATEGORIES = new Set(["کیک", "شیرینی", "دسر", "باکس هدیه"]);
  const $ = (selector, root = document) => root.querySelector(selector);

  const state = {
    client: null,
    products: [],
    cart: readCart(),
    category: "همه",
    catalogReady: false,
    demoMode: false,
    submitting: false
  };

  const numberFormatter = new Intl.NumberFormat("fa-IR");
  const money = (amount) => numberFormatter.format(Number(amount) || 0) + " تومان";

  function normalizeDigits(value) {
    return String(value).replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function safeImageUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function readCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return Object.fromEntries(
        Object.entries(parsed)
          .filter(([id, quantity]) => /^[0-9a-f-]{36}$/i.test(id) && Number.isInteger(quantity) && quantity > 0 && quantity <= MAX_QUANTITY)
      );
    } catch {
      return {};
    }
  }

  function persistCart() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart));
    } catch {
      showToast("مرورگر اجازه ذخیره سبد خرید را نداد.");
    }
  }

  function showToast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("show");
    window.setTimeout(() => element.classList.remove("show"), 2500);
  }

  function setFormMessage(message, kind = "") {
    const element = $("#formMessage");
    element.textContent = message;
    element.className = "form-message " + kind;
  }

  function showCatalogNotice(message, kind = "info") {
    const notice = $("#catalogNotice");
    notice.textContent = message;
    notice.className = "catalog-notice " + kind;
    notice.hidden = false;
  }

  function hideCatalogNotice() {
    $("#catalogNotice").hidden = true;
  }

  function isConfigured() {
    return Boolean(
      typeof window.supabase?.createClient === "function" &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(String(CONFIG.supabaseUrl || "").trim()) &&
      String(CONFIG.supabaseAnonKey || "").trim().length > 20
    );
  }

  function renderProducts() {
    const query = ($("#productSearch").value || "").trim().toLocaleLowerCase("fa-IR");
    const filtered = state.products.filter((product) => {
      const matchesCategory = state.category === "همه" || product.category === state.category;
      const haystack = (product.name + " " + (product.description || "")).toLocaleLowerCase("fa-IR");
      return matchesCategory && haystack.includes(query);
    });

    const grid = $("#productGrid");
    grid.setAttribute("aria-busy", "false");

    if (!filtered.length) {
      grid.innerHTML = '<div class="empty-catalog"><span>✳</span><h3>فعلاً محصولی برای نمایش نداریم.</h3><p>به‌زودی انتخاب‌های خوشمزه اینجا قرار می‌گیرند.</p></div>';
      return;
    }

    grid.innerHTML = filtered.map((product) => {
      const image = safeImageUrl(product.image_url);
      const isDemo = Boolean(product.demo);
      const imageMarkup = image
        ? '<img loading="lazy" decoding="async" src="' + escapeHtml(image) + '" alt="' + escapeHtml(product.name) + '">'
        : '<div class="product-image-placeholder" aria-hidden="true">AIDA ✳</div>';
      const actionMarkup = isDemo
        ? '<span class="demo-product-label">نمونه نمایشی</span>'
        : '<button class="add-button" type="button" data-add="' + escapeHtml(product.id) + '" aria-label="افزودن ' + escapeHtml(product.name) + ' به سبد خرید">+</button>';

      return '<article class="product-card">' +
        '<div class="product-image">' + imageMarkup +
        '<span class="product-tag">' + escapeHtml(product.category) + '</span>' + actionMarkup + '</div>' +
        '<div class="product-info"><div><h3>' + escapeHtml(product.name) + '</h3><p>' + escapeHtml(product.description || "") + '</p></div>' +
        '<span class="price">' + money(product.price_toman) + '</span></div></article>';
    }).join("");
  }

  function cartLines() {
    return Object.entries(state.cart)
      .map(([id, quantity]) => {
        const product = state.products.find((entry) => entry.id === id && !entry.demo);
        return product ? { product, quantity } : null;
      })
      .filter(Boolean);
  }

  function cartQuantity() {
    return cartLines().reduce((sum, line) => sum + line.quantity, 0);
  }

  function cartTotal() {
    return cartLines().reduce((sum, line) => sum + Number(line.product.price_toman) * line.quantity, 0);
  }

  function reconcileCart() {
    const validIds = new Set(state.products.filter((product) => !product.demo).map((product) => product.id));
    for (const id of Object.keys(state.cart)) {
      if (!validIds.has(id)) delete state.cart[id];
    }
    persistCart();
  }

  function renderCart() {
    const lines = cartLines();
    $("#cartCount").textContent = numberFormatter.format(cartQuantity());
    $("#cartTotal").textContent = money(cartTotal());
    $("#checkoutTotal").textContent = money(cartTotal());
    $("#checkoutButton").disabled = !lines.length || state.demoMode;

    $("#cartItems").innerHTML = lines.length ? lines.map(({ product, quantity }) => {
      const image = safeImageUrl(product.image_url);
      const imageMarkup = image ? '<img src="' + escapeHtml(image) + '" alt="" loading="lazy">' : '<div class="cart-placeholder">A</div>';
      return '<div class="cart-line">' + imageMarkup + '<div><h4>' + escapeHtml(product.name) + '</h4>' +
        '<small>' + money(product.price_toman) + ' برای هر عدد</small><div class="qty">' +
        '<button type="button" data-qty="' + escapeHtml(product.id) + '" data-delta="-1" aria-label="کم کردن تعداد">−</button>' +
        '<span>' + numberFormatter.format(quantity) + '</span>' +
        '<button type="button" data-qty="' + escapeHtml(product.id) + '" data-delta="1" aria-label="زیاد کردن تعداد">+</button></div></div>' +
        '<b class="line-price">' + money(Number(product.price_toman) * quantity) + '</b></div>';
    }).join("") : '<div class="empty-cart">سبد خریدت هنوز خالیه.<br>یک شیرینی خوشمزه انتخاب کن ♡</div>';
  }

  function openCart() {
    $("#cartDrawer").classList.add("open");
    $("#scrim").classList.add("show");
    $("#cartDrawer").setAttribute("aria-hidden", "false");
    $("#closeCart").focus();
  }

  function closeCart() {
    $("#cartDrawer").classList.remove("open");
    $("#scrim").classList.remove("show");
    $("#cartDrawer").setAttribute("aria-hidden", "true");
  }

  async function loadProducts() {
    const grid = $("#productGrid");
    grid.setAttribute("aria-busy", "true");

    if (!isConfigured()) {
      state.demoMode = true;
      state.products = [
        { id: "demo-cake-01", name: "کیک شکلاتی", category: "کیک", description: "کیک شکلاتی لطیف با گاناش", price_toman: 890000, image_url: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=80", demo: true },
        { id: "demo-cake-02", name: "کیک توت‌فرنگی", category: "کیک", description: "خامه تازه و توت‌فرنگی", price_toman: 980000, image_url: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=700&q=80", demo: true },
        { id: "demo-sweet-01", name: "کوکی شکلاتی", category: "شیرینی", description: "کوکی کره‌ای با تکه‌های شکلات", price_toman: 280000, image_url: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=700&q=80", demo: true },
        { id: "demo-sweet-02", name: "ماکارون رنگی", category: "شیرینی", description: "باکس ماکارون با طعم‌های متنوع", price_toman: 420000, image_url: "https://images.unsplash.com/photo-1569864358642-9d1684040f43?auto=format&fit=crop&w=700&q=80", demo: true },
        { id: "demo-dessert-01", name: "چیزکیک", category: "دسر", description: "چیزکیک لطیف با سس میوه", price_toman: 390000, image_url: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=700&q=80", demo: true },
        { id: "demo-dessert-02", name: "تارت میوه", category: "دسر", description: "کرم و میوه‌های فصل", price_toman: 360000, image_url: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=700&q=80", demo: true },
        { id: "demo-gift-01", name: "باکس شیرینی", category: "باکس هدیه", description: "ترکیبی برای هدیه دادن", price_toman: 750000, image_url: "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=700&q=80", demo: true },
        { id: "demo-gift-02", name: "باکس مینی دسر", category: "باکس هدیه", description: "چند طعم دوست‌داشتنی در یک جعبه", price_toman: 620000, image_url: "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=700&q=80", demo: true }
      ];
      showCatalogNotice("حالت پیش‌نمایش فعال است؛ نام‌ها، عکس‌ها و قیمت‌ها نمونه‌اند و ثبت سفارش تا اتصال پایگاه داده غیرفعال است.", "warning");
      renderProducts();
      renderCart();
      state.catalogReady = true;
      return;
    }

    state.client = window.supabase.createClient(CONFIG.supabaseUrl.trim(), CONFIG.supabaseAnonKey.trim(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });

    try {
      const { data, error } = await state.client
        .from("aida_products")
        .select("id,name,category,description,price_toman,image_url,sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(100);

      if (error) throw error;
      state.products = (data || []).filter((product) =>
        product && typeof product.id === "string" &&
        typeof product.name === "string" &&
        CATEGORIES.has(product.category) &&
        Number.isSafeInteger(Number(product.price_toman)) &&
        Number(product.price_toman) > 0
      );
      state.demoMode = false;
      hideCatalogNotice();
      reconcileCart();
      if (!state.products.length) {
        showCatalogNotice("هنوز محصولی در فروشگاه منتشر نشده است. صاحب فروشگاه می‌تواند از بخش مدیریت محصولات را اضافه کند.", "info");
      }
    } catch (error) {
      console.error("Product catalog could not be loaded:", error);
      state.products = [];
      showCatalogNotice("بارگذاری محصولات با خطا روبه‌رو شد. اتصال پایگاه داده و تنظیمات دسترسی را بررسی کنید.", "error");
    }

    renderProducts();
    renderCart();
    state.catalogReady = true;
  }

  function setCategory(category, button) {
    state.category = category;
    document.querySelectorAll(".filter").forEach((element) => {
      const selected = element === button;
      element.classList.toggle("active", selected);
      element.setAttribute("aria-pressed", String(selected));
    });
    renderProducts();
  }

  function normalizePhone(value) {
    return normalizeDigits(value).replace(/[^\d+]/g, "");
  }

  function validateOrder(formData) {
    const name = String(formData.get("name") || "").trim();
    const phone = normalizePhone(formData.get("phone"));
    const district = String(formData.get("district") || "").trim();
    const address = String(formData.get("address") || "").trim();
    const date = String(formData.get("delivery_date") || "");
    const time = String(formData.get("delivery_time") || "");
    const notes = String(formData.get("notes") || "").trim();
    const honeypot = String(formData.get("website") || "").trim();

    if (honeypot) throw new Error("امکان ثبت این درخواست وجود ندارد.");
    if (name.length < 2 || name.length > 90) throw new Error("نام و نام خانوادگی را بررسی کن.");
    if (!/^(\+?98|0)?9\d{9}$/.test(phone)) throw new Error("شماره موبایل را به‌درستی وارد کن.");
    if (district.length < 2 || district.length > 80) throw new Error("محله را به‌درستی وارد کن.");
    if (address.length < 5 || address.length > 500) throw new Error("آدرس کامل را وارد کن.");
    if (!date || date < $("#orderForm [name=delivery_date]").min) throw new Error("تاریخ تحویل باید امروز یا یکی از روزهای آینده باشد.");
    if (!["10:00-13:00", "13:00-16:00", "16:00-19:00", "19:00-21:00"].includes(time)) throw new Error("زمان تحویل را انتخاب کن.");
    if (notes.length > 700) throw new Error("توضیحات سفارش بیش از حد طولانی است.");

    return { name, phone, district, address, date, time, notes };
  }

  async function submitOrder(event) {
    event.preventDefault();
    if (state.submitting) return;
    if (!state.client || state.demoMode) {
      setFormMessage("ثبت سفارش هنوز فعال نشده است؛ فروشگاه در حالت پیش‌نمایش قرار دارد.", "error");
      return;
    }

    const lines = cartLines();
    if (!lines.length) {
      setFormMessage("سبد خرید خالی است.", "error");
      return;
    }

    let customer;
    try {
      customer = validateOrder(new FormData(event.currentTarget));
    } catch (error) {
      setFormMessage(error.message, "error");
      return;
    }

    const button = $("#submitOrder");
    state.submitting = true;
    button.disabled = true;
    button.textContent = "در حال ثبت سفارش…";
    setFormMessage("در حال ارسال سفارش امن…");

    try {
      const { data, error } = await state.client.rpc("aida_submit_order", {
        p_customer_name: customer.name,
        p_phone: customer.phone,
        p_district: customer.district,
        p_address: customer.address,
        p_delivery_date: customer.date,
        p_delivery_time: customer.time,
        p_notes: customer.notes,
        p_items: lines.map(({ product, quantity }) => ({ product_id: product.id, quantity })),
        p_website: ""
      });

      if (error) throw error;
      if (!data || typeof data.order_code !== "string") throw new Error("پاسخ ثبت سفارش معتبر نبود.");

      state.cart = {};
      persistCart();
      renderCart();
      event.currentTarget.reset();
      setFormMessage("سفارش با موفقیت ثبت شد. کد پیگیری: " + data.order_code + " — برای هماهنگی نهایی با شما تماس می‌گیریم.", "success");
      button.textContent = "سفارش ثبت شد";
      showToast("سفارش با موفقیت ثبت شد");
    } catch (error) {
      console.error("Order submission failed:", error);
      const message = /rate|duplicate|60 seconds/i.test(String(error.message || ""))
        ? "لطفاً کمی صبر کن و دوباره تلاش کن."
        : "ثبت سفارش انجام نشد. لطفاً اتصال اینترنت را بررسی کن و دوباره تلاش کن.";
      setFormMessage(message, "error");
    } finally {
      state.submitting = false;
      window.setTimeout(() => {
        button.disabled = false;
        button.innerHTML = 'ثبت نهایی سفارش <span>←</span>';
      }, 900);
    }
  }

  function bindEvents() {
    $("#productGrid").addEventListener("click", (event) => {
      const button = event.target.closest("[data-add]");
      if (!button || state.demoMode) return;
      const id = button.dataset.add;
      const existing = state.cart[id] || 0;
      if (existing >= MAX_QUANTITY) return showToast("حداکثر تعداد هر محصول ۲۰ عدد است.");
      state.cart[id] = existing + 1;
      persistCart();
      renderCart();
      showToast("به سبد خرید اضافه شد");
    });

    $("#cartItems").addEventListener("click", (event) => {
      const button = event.target.closest("[data-qty]");
      if (!button) return;
      const id = button.dataset.qty;
      const next = (state.cart[id] || 0) + Number(button.dataset.delta);
      if (next <= 0) delete state.cart[id];
      else if (next <= MAX_QUANTITY) state.cart[id] = next;
      else return showToast("حداکثر تعداد هر محصول ۲۰ عدد است.");
      persistCart();
      renderCart();
    });

    $("#filters").addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (button) setCategory(button.dataset.category, button);
    });

    $("#productSearch").addEventListener("input", renderProducts);
    $("#openCart").addEventListener("click", openCart);
    $("#closeCart").addEventListener("click", closeCart);
    $("#scrim").addEventListener("click", closeCart);
    $("#checkoutButton").addEventListener("click", () => {
      if (!cartLines().length || state.demoMode) return;
      closeCart();
      $("#checkoutBackdrop").classList.add("show");
      setFormMessage("");
      $("#closeCheckout").focus();
    });
    $("#closeCheckout").addEventListener("click", () => $("#checkoutBackdrop").classList.remove("show"));
    $("#checkoutBackdrop").addEventListener("click", (event) => {
      if (event.target.id === "checkoutBackdrop") $("#checkoutBackdrop").classList.remove("show");
    });
    $("#orderForm").addEventListener("submit", submitOrder);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeCart();
        $("#checkoutBackdrop").classList.remove("show");
      }
    });
  }

  function setMinimumDeliveryDate() {
    const date = new Date();
    const tehranParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(date);
    $("#orderForm [name=delivery_date]").min = tehranParts;
  }

  async function init() {
    $("#year").textContent = new Date().getFullYear().toLocaleString("fa-IR");
    bindEvents();
    setMinimumDeliveryDate();
    await loadProducts();
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();