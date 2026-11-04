(() => {
"use strict";
const $=s=>document.querySelector(s), fmt=n=>new Intl.NumberFormat("fa-IR").format(n)+" تومان";
const products=[
{id:"cake-01",name:"کیک شکلاتی",category:"کیک",description:"کیک شکلاتی لطیف با گاناش",price:890000,image:"https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=80",tag:"محبوب"},
{id:"cake-02",name:"کیک توت‌فرنگی",category:"کیک",description:"خامه تازه و توت‌فرنگی",price:980000,image:"https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=700&q=80",tag:"ویژه"},
{id:"sweet-01",name:"کوکی شکلاتی",category:"شیرینی",description:"کوکی کره‌ای با تکه‌های شکلات",price:280000,image:"https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=700&q=80",tag:"تازه"},
{id:"sweet-02",name:"ماکارون رنگی",category:"شیرینی",description:"باکس ماکارون با طعم‌های متنوع",price:420000,image:"https://images.unsplash.com/photo-1569864358642-9d1684040f43?auto=format&fit=crop&w=700&q=80",tag:"دست‌ساز"},
{id:"dessert-01",name:"چیزکیک",category:"دسر",description:"چیزکیک لطیف با سس میوه",price:390000,image:"https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=700&q=80",tag:"پیشنهاد ما"},
{id:"dessert-02",name:"تارت میوه",category:"دسر",description:"کرم و میوه‌های فصل",price:360000,image:"https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=700&q=80",tag:"فصلی"},
{id:"gift-01",name:"باکس شیرینی",category:"باکس هدیه",description:"ترکیبی برای هدیه دادن",price:750000,image:"https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=700&q=80",tag:"هدیه"},
{id:"gift-02",name:"باکس مینی دسر",category:"باکس هدیه",description:"چند طعم دوست‌داشتنی در یک جعبه",price:620000,image:"https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=700&q=80",tag:"ویژه"}
];
let cart={},category="همه";const config=window.AIDA_CONFIG||{};
function renderProducts(){
const q=($("#productSearch").value||"").trim().toLowerCase();
const list=products.filter(p=>(category==="همه"||p.category===category)&&(p.name.toLowerCase().includes(q)||p.description.toLowerCase().includes(q)));
$("#productGrid").innerHTML=list.map(p=>'<article class="product-card"><div class="product-image"><img loading="lazy" src="'+p.image+'" alt="'+p.name+'"><span class="product-tag">'+p.tag+'</span><button class="add-button" data-add="'+p.id+'" aria-label="افزودن '+p.name+'">+</button></div><div class="product-info"><div><h3>'+p.name+'</h3><p>'+p.description+'</p></div><span class="price">'+fmt(p.price)+'</span></div></article>').join("")||'<p class="empty-cart">محصولی با این مشخصات پیدا نشد.</p>';
}
const qty=()=>Object.values(cart).reduce((a,b)=>a+b,0);
const total=()=>Object.keys(cart).reduce((sum,id)=>sum+products.find(p=>p.id===id).price*cart[id],0);
function renderCart(){
$("#cartCount").textContent=new Intl.NumberFormat("fa-IR").format(qty());$("#cartTotal").textContent=fmt(total());$("#checkoutTotal").textContent=fmt(total());$("#checkoutButton").disabled=!qty();
$("#cartItems").innerHTML=Object.keys(cart).map(id=>{const p=products.find(x=>x.id===id);return '<div class="cart-line"><img src="'+p.image+'" alt=""><div><h4>'+p.name+'</h4><small>'+fmt(p.price)+' برای هر عدد</small><div class="qty"><button data-qty="'+id+'" data-delta="-1">−</button><span>'+new Intl.NumberFormat("fa-IR").format(cart[id])+'</span><button data-qty="'+id+'" data-delta="1">+</button></div></div><b class="line-price">'+fmt(p.price*cart[id])+'</b></div>';}).join("")||'<div class="empty-cart">سبد خریدت هنوز خالیه.<br>یک شیرینی خوشمزه انتخاب کن ♡</div>';
}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2300);}
function openCart(){$("#cartDrawer").classList.add("open");$("#scrim").classList.add("show");$("#cartDrawer").setAttribute("aria-hidden","false");}
function closeCart(){$("#cartDrawer").classList.remove("open");$("#scrim").classList.remove("show");$("#cartDrawer").setAttribute("aria-hidden","true");}
function message(msg,type){const el=$("#formMessage");el.textContent=msg;el.className="form-message "+type;}
$("#productGrid").addEventListener("click",e=>{const b=e.target.closest("[data-add]");if(!b)return;cart[b.dataset.add]=(cart[b.dataset.add]||0)+1;renderCart();toast("به سبد خرید اضافه شد");});
$("#cartItems").addEventListener("click",e=>{const b=e.target.closest("[data-qty]");if(!b)return;const id=b.dataset.qty;cart[id]=(cart[id]||0)+Number(b.dataset.delta);if(cart[id]<=0)delete cart[id];renderCart();});
$("#filters").addEventListener("click",e=>{const b=e.target.closest("[data-category]");if(!b)return;category=b.dataset.category;document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x===b));renderProducts();});
$("#productSearch").addEventListener("input",renderProducts);$("#openCart").addEventListener("click",openCart);$("#closeCart").addEventListener("click",closeCart);$("#scrim").addEventListener("click",closeCart);
$("#checkoutButton").addEventListener("click",()=>{if(!qty())return;closeCart();$("#checkoutBackdrop").classList.add("show");message("","");});
$("#closeCheckout").addEventListener("click",()=>$("#checkoutBackdrop").classList.remove("show"));
$("#checkoutBackdrop").addEventListener("click",e=>{if(e.target.id==="checkoutBackdrop")$("#checkoutBackdrop").classList.remove("show");});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeCart();$("#checkoutBackdrop").classList.remove("show");}});
$("#year").textContent=new Date().getFullYear().toLocaleString("fa-IR");
const dateInput=document.querySelector('[name="delivery_date"]');
const minDate=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);dateInput.min=minDate;
$("#orderForm").addEventListener("submit",async e=>{
e.preventDefault();if(!qty())return message("سبد خرید خالی است.","error");
const url=(config.supabaseUrl||"").trim().replace(/\/$/,""),key=(config.supabaseAnonKey||"").trim();
if(!url||!key||url.includes("YOUR_PROJECT")||key.includes("YOUR_SUPABASE"))return message("سایت هنوز به پایگاه سفارش‌ها وصل نشده است؛ هیچ سفارش واقعی ارسال نشد. مراحل README را برای اتصال انجام دهید.","error");
const form=new FormData(e.currentTarget),phone=String(form.get("phone")||"").replace(/[^\d+]/g,"");
if(!/^(\+?98|0)?9\d{9}$/.test(phone))return message("شماره موبایل را درست وارد کن.","error");
const code="AIDA-"+Math.random().toString(36).slice(2,6).toUpperCase()+"-"+Date.now().toString().slice(-5);
const order={order_code:code,customer_name:String(form.get("name")).trim(),phone,district:String(form.get("district")).trim(),address:String(form.get("address")).trim(),delivery_date:String(form.get("delivery_date")),delivery_time:String(form.get("delivery_time")),notes:String(form.get("notes")||"").trim(),items:Object.keys(cart).map(id=>{const p=products.find(x=>x.id===id);return {product_id:id,name:p.name,quantity:cart[id],unit_price_toman:p.price};}),total_toman:total()};
const button=$("#submitOrder");button.disabled=true;button.textContent="در حال ثبت سفارش...";
try{
const res=await fetch(url+"/rest/v1/orders",{method:"POST",headers:{"Content-Type":"application/json","apikey":key,"Authorization":"Bearer "+key,"Prefer":"return=minimal"},body:JSON.stringify(order)});
if(!res.ok)throw new Error((await res.text()).slice(0,200)||"خطا در ثبت سفارش");
cart={};renderCart();e.currentTarget.reset();dateInput.min=minDate;$("#checkoutBackdrop").classList.remove("show");alert("سفارش با موفقیت ثبت شد.\\nکد پیگیری: "+code+"\\nبرای هماهنگی نهایی با شما تماس می‌گیریم.");toast("سفارش با موفقیت ثبت شد");
}catch(err){console.error(err);message("ثبت سفارش انجام نشد. اتصال و تنظیمات پایگاه داده را بررسی کنید. ("+err.message+")","error");}
finally{button.disabled=false;button.textContent="ثبت نهایی سفارش ←";}
});
renderProducts();renderCart();
})();