# Aida Cockings

A Persian RTL responsive pastry storefront for Tehran.

## Included
- Responsive storefront, product search and categories
- Shopping cart and order form (no online payment)
- Supabase integration for saving customer orders
- Row Level Security: public visitors can submit orders but cannot read or modify them

## Connect order storage (required for real orders)
1. Create a project at https://supabase.com/.
2. Open SQL Editor in the Supabase dashboard and run the contents of supabase.sql.
3. In Project Settings → API, copy the Project URL and anon/public key.
4. Edit config.js and replace supabaseUrl and supabaseAnonKey.
5. Commit the change. Never use the service_role/secret key in browser code.
6. View incoming orders in Supabase Dashboard → Table Editor → orders. Keep the dashboard private and enable two-factor authentication.

The RLS policy allows INSERT only. Website visitors cannot query the table. The Supabase dashboard is the owner's private order inbox.

## Publish with GitHub Pages
1. Open repository Settings → Pages.
2. Under Build and deployment, choose Deploy from a branch.
3. Select branch main and folder /(root), then Save.
4. GitHub Pages should publish at https://he3amsvg.github.io/aida-cocking/ after deployment finishes.

## Before public launch
- Replace the sample products, descriptions, prices and photos with Aida's real menu.
- Connect Supabase and test a real order end to end.
- Confirm delivery areas, fees, lead time and cancellation rules.
- Add the business contact details and privacy information.

Prices are demo values in toman. The website does not take payments. Until Supabase is configured, the form deliberately refuses to claim that an order was received.
