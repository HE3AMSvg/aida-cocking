(() => {
  "use strict";

  const config = window.AIDA_CONFIG || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const allowedCategories = new Set(["کیک", "شیرینی", "دسر", "باکس هدیه"]);
  const allowedStatuses = new Set(["new", "confirmed", "preparing", "delivered", "cancelled"]);
  const statusLabels = { new: "جدید", confirmed: "تأییدشده", preparing: "در حال آماده‌سازی", delivered: "تحویل‌شده", cancelled: "لغوشده" };
  const money = (value) => new Intl.NumberFormat("fa-IR").format(Number(value) || 0) + " تومان";
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const safeUrl = (value) => {
    try { const url = new URL(String(value || "")); return url.protocol === "https:" ? url.href : ""; }
    catch { return ""; }
  };

  let client = null;
  let session = null;
  let products = [];

  function showMessage(target, text, success = false) {
    const element = $(target);
    element.textContent = text;
    element.className = "admin-message" + (success ? " success" : "");
  }

  function readyConfig() {
    return Boolean(typeof window.supabase?.createClient === "function" &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(String(config.supabaseUrl || "")) &&
      String(config.supabaseAnonKey || "").length > 20);
  }

  function setLoggedIn(isLoggedIn) {
    $("#loginPanel").hidden = isLoggedIn;
    $("#dashboard").hidden = !isLoggedIn;
  }

  async function confirmAdmin(activeSession) {
    const { data, error } = await client.rpc("aida_is_admin");
    if (error) throw error;
    if (data !== true) throw new Error("این حساب دسترسی مدیر فروشگاه را ندارد.");
    session = activeSession;
    $("#adminEmail").textContent = activeSession.user.email || "";
    setLoggedIn(true);
    await Promise.all([loadOrders(), loadProducts()]);
  }

  async function restoreSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session) return;
    try {
      await confirmAdmin(data.session);
    } catch (error) {
      await client.auth.signOut();
      showMessage("#loginMessage", error.message || "دسترسی مدیریت تأیید نشد.");
    }
  }

  async function loadOrders() {
    $("#ordersList").innerHTML = '<p class="empty-admin">در حال دریافت سفارش‌ها…</p>';
    const { data, error } = await client.from("aida_orders")
      .select("id,order_code,customer_name,phone,district,address,delivery_date,delivery_time,notes,total_toman,status,created_at,aida_order_items(id,product_name_snapshot,quantity,unit_price_toman,line_total_toman)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error(error);
      $("#ordersList").innerHTML = '<p class="empty-admin">دریافت سفارش‌ها با خطا روبه‌رو شد.</p>';
      return;
    }
    if (!data || !data.length) {
      $("#ordersList").innerHTML = '<p class="empty-admin">هنوز سفارشی ثبت نشده است.</p>';
      return;
    }

    $("#ordersList").innerHTML = data.map((order) => {
      const items = (order.aida_order_items || []).map((item) =>
        escapeHtml(item.product_name_snapshot) + " × " + new Intl.NumberFormat("fa-IR").format(item.quantity) +
        " — " + money(item.line_total_toman)
      ).join("<br>");
      const date = new Date(order.created_at).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" });
      const delivery = escapeHtml(order.delivery_date) + " · " + escapeHtml(order.delivery_time);
      return '<article class="order-card"><div class="order-top"><strong class="order-code">' + escapeHtml(order.order_code) +
        '</strong><time class="order-date">' + escapeHtml(date) + '</time></div>' +
        '<div class="order-grid"><div><strong>مشتری:</strong> ' + escapeHtml(order.customer_name) + '</div>' +
        '<div><strong>تلفن:</strong> <a dir="ltr" href="tel:' + escapeHtml(order.phone) + '">' + escapeHtml(order.phone) + '</a></div>' +
        '<div><strong>محله:</strong> ' + escapeHtml(order.district) + '</div><div><strong>زمان تحویل:</strong> ' + delivery + '</div>' +
        '<div class="wide"><strong>آدرس:</strong> ' + escapeHtml(order.address) + '</div>' +
        (order.notes ? '<div class="wide"><strong>توضیحات:</strong> ' + escapeHtml(order.notes) + '</div>' : '') +
        '</div><div class="order-items">' + (items || "جزئیات محصول ثبت نشده است.") + '</div>' +
        '<div class="order-bottom"><strong class="order-total">' + money(order.total_toman) + '</strong>' +
        '<label class="status-control">وضعیت سفارش<select data-order-status="' + escapeHtml(order.id) + '">' +
        Object.entries(statusLabels).map(([value, label]) => '<option value="' + value + '"' + (order.status === value ? " selected" : "") + '>' + label + '</option>').join("") +
        '</select></label></div></article>';
    }).join("");
  }

  async function loadProducts() {
    $("#productsList").innerHTML = '<p class="empty-admin">در حال دریافت محصولات…</p>';
    const { data, error } = await client.from("aida_products")
      .select("id,name,category,description,price_toman,image_url,is_active,sort_order")
      .order("sort_order", { ascending: true })
      .limit(200);

    if (error) {
      console.error(error);
      $("#productsList").innerHTML = '<p class="empty-admin">دریافت محصولات با خطا روبه‌رو شد.</p>';
      return;
    }
    products = data || [];
    if (!products.length) {
      $("#productsList").innerHTML = '<p class="empty-admin">هنوز محصولی اضافه نشده است. از «محصول جدید» شروع کنید.</p>';
      return;
    }

    $("#productsList").innerHTML = products.map((product) => {
      const image = safeUrl(product.image_url);
      const imageMarkup = image ? '<img src="' + escapeHtml(image) + '" alt="" loading="lazy">' : '<div class="no-image">AIDA</div>';
      return '<article class="admin-product">' + imageMarkup + '<div><h3>' + escapeHtml(product.name) + '</h3>' +
        '<p>' + escapeHtml(product.category) + ' · ' + escapeHtml(product.description) + '</p>' +
        '<span class="product-meta">' + money(product.price_toman) + ' · ' + (product.is_active ? "نمایش در فروشگاه" : "پنهان") + '</span></div>' +
        '<div class="product-actions"><button type="button" data-edit-product="' + escapeHtml(product.id) + '">ویرایش</button>' +
        '<button type="button" class="danger" data-toggle-product="' + escapeHtml(product.id) + '">' + (product.is_active ? "پنهان‌کردن" : "انتشار") + '</button></div></article>';
    }).join("");
  }

  function resetProductForm() {
    $("#productForm").reset();
    $("#productForm [name=id]").value = "";
    $("#productForm [name=is_active]").checked = true;
    $("#productFormTitle").textContent = "افزودن محصول";
    $("#saveProductButton").textContent = "ذخیره محصول";
    $("#imagePreview").hidden = true;
    $("#imagePreview").innerHTML = "";
    showMessage("#productMessage", "");
  }

  function openProductForm(product = null) {
    resetProductForm();
    $("#productForm").hidden = false;
    if (product) {
      const form = $("#productForm");
      form.elements.id.value = product.id;
      form.elements.name.value = product.name;
      form.elements.category.value = product.category;
      form.elements.price_toman.value = product.price_toman;
      form.elements.description.value = product.description || "";
      form.elements.sort_order.value = product.sort_order || 0;
      form.elements.is_active.checked = Boolean(product.is_active);
      $("#productFormTitle").textContent = "ویرایش محصول";
      $("#saveProductButton").textContent = "ذخیره تغییرات";
      if (safeUrl(product.image_url)) {
        $("#imagePreview").innerHTML = '<img src="' + escapeHtml(product.image_url) + '" alt="پیش‌نمایش عکس فعلی">';
        $("#imagePreview").hidden = false;
      }
    }
    $("#productForm").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function uploadProductImage(productId, file) {
    if (!file) return null;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) throw new Error("فرمت عکس باید JPG، PNG یا WEBP باشد.");
    if (file.size > 5 * 1024 * 1024) throw new Error("حجم عکس باید کمتر از ۵ مگابایت باشد.");

    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = productId + "/" + Date.now() + "." + extension;
    const { error } = await client.storage.from("aida-product-images").upload(path, file, {
      cacheControl: "3600", upsert: false, contentType: file.type
    });
    if (error) throw error;
    const { data } = client.storage.from("aida-product-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function saveProduct(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const id = String(data.get("id") || "");
    const name = String(data.get("name") || "").trim();
    const category = String(data.get("category") || "");
    const description = String(data.get("description") || "").trim();
    const price = Number(data.get("price_toman"));
    const sortOrder = Number(data.get("sort_order") || 0);
    const imageFile = data.get("image");
    const active = form.elements.is_active.checked;

    if (name.length < 2 || name.length > 100) return showMessage("#productMessage", "نام محصول را بررسی کنید.");
    if (!allowedCategories.has(category)) return showMessage("#productMessage", "یک دسته‌بندی معتبر انتخاب کنید.");
    if (!Number.isSafeInteger(price) || price < 1 || price > 1000000000) return showMessage("#productMessage", "قیمت باید یک عدد معتبر به تومان باشد.");
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) return showMessage("#productMessage", "ترتیب نمایش معتبر نیست.");
    if (description.length > 500) return showMessage("#productMessage", "توضیحات بیش از حد طولانی است.");

    const button = $("#saveProductButton");
    button.disabled = true;
    button.textContent = "در حال ذخیره…";
    showMessage("#productMessage", "در حال ذخیره اطلاعات محصول…");

    try {
      let productId = id;
      if (!productId) {
        productId = crypto.randomUUID();
        const { error } = await client.from("aida_products").insert({
          id: productId,
          slug: "product-" + productId,
          name, category, description,
          price_toman: price, is_active: active, sort_order: sortOrder
        });
        if (error) throw error;
      } else {
        const { error } = await client.from("aida_products").update({
          name, category, description,
          price_toman: price, is_active: active, sort_order: sortOrder
        }).eq("id", productId);
        if (error) throw error;
      }

      if (imageFile instanceof File && imageFile.size > 0) {
        const imageUrl = await uploadProductImage(productId, imageFile);
        const { error } = await client.from("aida_products").update({ image_url: imageUrl }).eq("id", productId);
        if (error) throw error;
      }

      resetProductForm();
      await loadProducts();
      showToast("محصول ذخیره شد.");
    } catch (error) {
      console.error(error);
      showMessage("#productMessage", "ذخیره محصول انجام نشد: " + (error.message || "خطای نامشخص"));
    } finally {
      button.disabled = false;
      button.textContent = id ? "ذخیره تغییرات" : "ذخیره محصول";
    }
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "admin-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2400);
  }

  function bindEvents() {
    $("#loginForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const button = $("#loginButton");
      button.disabled = true;
      showMessage("#loginMessage", "در حال ورود…");
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: String(form.get("email") || "").trim(),
          password: String(form.get("password") || "")
        });
        if (error) throw error;
        await confirmAdmin(data.session);
        showMessage("#loginMessage", "");
      } catch (error) {
        await client.auth.signOut();
        setLoggedIn(false);
        showMessage("#loginMessage", error.message || "ورود انجام نشد.");
      } finally {
        button.disabled = false;
      }
    });

    $("#logoutButton").addEventListener("click", async () => {
      await client.auth.signOut();
      session = null;
      setLoggedIn(false);
      $("#loginForm").reset();
    });

    document.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-tab]").forEach((tab) => tab.classList.toggle("active", tab === button));
        $("#ordersPanel").hidden = button.dataset.tab !== "ordersPanel";
        $("#productsPanel").hidden = button.dataset.tab !== "productsPanel";
      });
    });

    $("#refreshOrders").addEventListener("click", loadOrders);
    $("#newProductButton").addEventListener("click", () => openProductForm());
    $("#cancelProductEdit").addEventListener("click", () => { resetProductForm(); $("#productForm").hidden = true; });
    $("#productForm").addEventListener("submit", saveProduct);

    $("#productForm [name=image]").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
        showMessage("#productMessage", "عکس باید JPG، PNG یا WEBP و حداکثر ۵ مگابایت باشد.");
        event.target.value = "";
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      $("#imagePreview").innerHTML = '<img src="' + previewUrl + '" alt="پیش‌نمایش عکس جدید">';
      $("#imagePreview").hidden = false;
    });

    $("#productsList").addEventListener("click", async (event) => {
      const editButton = event.target.closest("[data-edit-product]");
      const toggleButton = event.target.closest("[data-toggle-product]");
      if (editButton) {
        const product = products.find((entry) => entry.id === editButton.dataset.editProduct);
        if (product) openProductForm(product);
      }
      if (toggleButton) {
        const product = products.find((entry) => entry.id === toggleButton.dataset.toggleProduct);
        if (!product) return;
        toggleButton.disabled = true;
        const { error } = await client.from("aida_products").update({ is_active: !product.is_active }).eq("id", product.id);
        if (error) alert("تغییر وضعیت انجام نشد: " + error.message);
        await loadProducts();
      }
    });

    $("#ordersList").addEventListener("change", async (event) => {
      const select = event.target.closest("[data-order-status]");
      if (!select || !allowedStatuses.has(select.value)) return;
      select.disabled = true;
      const { error } = await client.from("aida_orders").update({ status: select.value }).eq("id", select.dataset.orderStatus);
      select.disabled = false;
      if (error) {
        alert("به‌روزرسانی وضعیت انجام نشد: " + error.message);
        await loadOrders();
      } else {
        showToast("وضعیت سفارش به‌روزرسانی شد.");
      }
    });
  }

  async function init() {
    if (!readyConfig()) {
      showMessage("#loginMessage", "ابتدا Supabase را طبق راهنمای README راه‌اندازی و فایل config.js را تکمیل کنید.");
      return;
    }
    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    bindEvents();
    try {
      await restoreSession();
    } catch (error) {
      showMessage("#loginMessage", error.message || "اتصال به پایگاه داده برقرار نشد.");
    }
    client.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!nextSession) {
        session = null;
        setLoggedIn(false);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();