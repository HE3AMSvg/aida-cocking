# Aida Cockings

A production-minded Persian (RTL) pastry storefront for Tehran. The project is static-hosted on GitHub Pages and uses Supabase Postgres, Auth and Storage for order intake and private owner management.

## Application features
- Responsive storefront with category filters and search
- Live product catalog stored in Supabase (no invented seed products)
- Shopping cart saved locally in the visitor's browser
- Order submission through a PostgreSQL function that calculates prices on the server
- Private admin panel for order review, status updates, product editing and photo uploads
- Row Level Security (RLS) on all application tables
- No online payment integration

## Required one-time Supabase setup

The Supabase project must be created in an account controlled by the business owner. Do not send passwords, database connection strings, or secret/service-role keys in chat.

1. Create a Supabase project at https://supabase.com/ and choose a strong database password. Keep it private.
2. Open **SQL Editor** in that project's dashboard, create a new query, paste the complete contents of \`supabase.sql\`, and run it.
3. In **Project Settings → API**, copy the **Project URL** and the **Publishable key** (or legacy anon key). The publishable/anon key is designed to be public; the service_role/secret key is not.
4. In this repository, open \`config.js\`, replace \`YOUR_PROJECT_REF\` and \`YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY\` with those two public values, and commit the change. Never put a service_role key here.
5. In **Authentication → Users**, create/invite the owner's account using the business owner's email. Set a strong unique password.
6. In SQL Editor, replace \`OWNER_EMAIL_HERE\` in the final commented SQL statement with that exact owner email and run the statement. This adds only that account to the private admin allow-list.
7. Open \`https://he3amsvg.github.io/aida-cocking/admin.html\`, sign in with the owner's account, and add the real menu: product name, category, description, price in toman and photo. Products marked as visible appear in the storefront.

## Order and data security design
- Public visitors can read active product listings and product photos only.
- Public visitors cannot directly insert, select, update or delete order records.
- The only public order write route is \`public.aida_submit_order\`. It validates the customer fields and product availability, then calculates the total from database prices and saves immutable item price/name snapshots.
- Only owner accounts on the private allow-list can view orders, change their status, and manage products.
- The \`private\` schema is not intended to be exposed through the Supabase Data API.
- The browser receives only the public publishable/anon key. Never expose database passwords, service_role keys or other secrets.

## GitHub Pages
The repository includes a GitHub Actions workflow at \`.github/workflows/deploy-pages.yml\`. Each push to \`main\` triggers deployment. After a successful run, the storefront is available at:

https://he3amsvg.github.io/aida-cocking/

## Before accepting customer orders
- Complete the Supabase setup above.
- Add the real catalogue through the admin page; the preview prices are not business prices.
- Submit a test order and confirm that it appears in the private admin panel.
- Confirm the service area, delivery lead time, delivery fee, cancellation policy and customer contact details with the owner.
- Publish a suitable privacy notice and a business contact method before public promotion.

All sample products in preview mode are explicitly non-orderable. The site must be connected to Supabase and populated with real products before launch.
