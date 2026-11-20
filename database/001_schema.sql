create extension if not exists pgcrypto;
do $$ begin create type public.app_role as enum ('ADMIN','VENDEDORA'); exception when duplicate_object then null; end $$;
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade,full_name text,email text,role public.app_role not null default 'VENDEDORA',is_active boolean not null default true,created_at timestamptz default now());
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,full_name,email) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.email) on conflict(id) do nothing; return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
create table if not exists public.categories(id uuid primary key default gen_random_uuid(),name text unique not null,slug text unique not null,is_active boolean default true,created_at timestamptz default now());
create table if not exists public.products(id uuid primary key default gen_random_uuid(),category_id uuid references public.categories(id),name text not null,code text unique not null,description text,price numeric(12,2) not null check(price>=0),image_url text,is_active boolean default true,created_at timestamptz default now(),updated_at timestamptz default now());
create table if not exists public.product_images(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products(id) on delete cascade,image_url text not null,color text,is_primary boolean default false,created_at timestamptz default now());
create table if not exists public.product_variants(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products(id) on delete cascade,size text,color text,sku text unique,stock integer not null default 0 check(stock>=0),created_at timestamptz default now(),unique(product_id,size,color));
create table if not exists public.category_discounts(id uuid primary key default gen_random_uuid(),name text not null,category_id uuid not null references public.categories(id) on delete cascade,percentage numeric(5,2) not null check(percentage>0 and percentage<=90),start_at timestamptz,end_at timestamptz,is_active boolean default true,created_at timestamptz default now());
create table if not exists public.customers(id uuid primary key default gen_random_uuid(),full_name text not null,phone text not null,email text,city text,address text,created_at timestamptz default now(),unique(phone));
create table if not exists public.orders(id uuid primary key default gen_random_uuid(),order_number text unique not null default ('DI-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),customer_id uuid references public.customers(id),status text not null default 'PENDIENTE_PAGO',payment_method text,payment_status text default 'PENDIENTE',delivery_type text default 'ENVIO',subtotal numeric(12,2) default 0,total numeric(12,2) default 0,created_at timestamptz default now());
create table if not exists public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid references public.orders(id) on delete cascade,product_id uuid references public.products(id),variant_id uuid references public.product_variants(id),quantity integer not null check(quantity>0),unit_price numeric(12,2) not null,discount_percent numeric(5,2) default 0,line_total numeric(12,2) not null);
create table if not exists public.proformas(id uuid primary key default gen_random_uuid(),proforma_number text unique not null default ('PF-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),customer_id uuid references public.customers(id),created_by uuid references public.profiles(id),status text default 'PENDIENTE',delivery_type text default 'ENVIO',subtotal numeric(12,2) default 0,total numeric(12,2) default 0,created_at timestamptz default now());
create table if not exists public.proforma_items(id uuid primary key default gen_random_uuid(),proforma_id uuid references public.proformas(id) on delete cascade,product_id uuid references public.products(id),variant_id uuid references public.product_variants(id),quantity integer not null,unit_price numeric(12,2) not null,discount_percent numeric(5,2) default 0,line_total numeric(12,2) not null);
create table if not exists public.sales(id uuid primary key default gen_random_uuid(),sale_number text unique not null default ('VT-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),proforma_id uuid references public.proformas(id),customer_id uuid references public.customers(id),created_by uuid references public.profiles(id),payment_method text,payment_reference text,total numeric(12,2),created_at timestamptz default now());
create table if not exists public.sale_items(id uuid primary key default gen_random_uuid(),sale_id uuid references public.sales(id) on delete cascade,product_id uuid references public.products(id),variant_id uuid references public.product_variants(id),quantity integer,unit_price numeric(12,2),discount_percent numeric(5,2),line_total numeric(12,2));
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_variants_product on public.product_variants(product_id);
create index if not exists idx_discounts_category on public.category_discounts(category_id,is_active);
create index if not exists idx_orders_status on public.orders(status);
create or replace function public.round_to_half(v numeric) returns numeric language sql immutable as $$ select round(v*2)/2 $$;
create or replace function public.get_category_discount(p_category uuid) returns numeric language sql stable as $$ select coalesce((select percentage from public.category_discounts where category_id=p_category and is_active=true and (start_at is null or start_at<=now()) and (end_at is null or end_at>=now()) order by created_at desc limit 1),0) $$;
create or replace function public.create_store_order(p_customer jsonb,p_items jsonb,p_payment_method text default 'PENDIENTE') returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; oid uuid; itm jsonb; prod public.products%rowtype; v public.product_variants%rowtype; pct numeric; unit numeric; qty int; subtotal numeric:=0; result jsonb;
begin
 insert into customers(full_name,phone,email,city,address) values(p_customer->>'full_name',p_customer->>'phone',p_customer->>'email',p_customer->>'city',p_customer->>'address')
 on conflict(phone) do update set full_name=excluded.full_name,email=excluded.email,city=excluded.city,address=excluded.address returning id into cid;
 insert into orders(customer_id,payment_method,delivery_type) values(cid,p_payment_method,coalesce(p_customer->>'delivery_type','ENVIO')) returning id into oid;
 for itm in select * from jsonb_array_elements(p_items) loop
  select * into prod from products where id=(itm->>'product_id')::uuid and is_active=true;
  if not found then raise exception 'Producto no disponible'; end if;
  qty:=(itm->>'quantity')::int; if qty<1 then raise exception 'Cantidad inválida'; end if;
  if itm->>'variant_id' is not null and itm->>'variant_id'<>'null' then
   select * into v from product_variants where id=(itm->>'variant_id')::uuid for update;
   if not found or v.stock<qty then raise exception 'Stock insuficiente para %',prod.name; end if;
  end if;
  pct:=get_category_discount(prod.category_id); unit:=round_to_half(prod.price*(1-pct/100));
  insert into order_items(order_id,product_id,variant_id,quantity,unit_price,discount_percent,line_total) values(oid,prod.id,nullif(itm->>'variant_id','null')::uuid,qty,unit,pct,unit*qty);
  subtotal:=subtotal+unit*qty;
 end loop;
 update orders set subtotal=subtotal,total=subtotal where id=oid;
 select jsonb_build_object('order_id',oid,'order_number',order_number,'total',total,'status',status) into result from orders where id=oid; return result;
end $$;
create or replace function public.create_proforma(p_customer jsonb,p_items jsonb,p_delivery_type text,p_created_by uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; pid uuid; itm jsonb; prod public.products%rowtype; pct numeric; unit numeric; qty int; subtotal numeric:=0; result jsonb;
begin
 insert into customers(full_name,phone,email,city,address) values(p_customer->>'full_name',p_customer->>'phone',p_customer->>'email',p_customer->>'city',p_customer->>'address')
 on conflict(phone) do update set full_name=excluded.full_name,email=excluded.email,city=excluded.city,address=excluded.address returning id into cid;
 insert into proformas(customer_id,created_by,delivery_type) values(cid,p_created_by,p_delivery_type) returning id into pid;
 for itm in select * from jsonb_array_elements(p_items) loop
  select * into prod from products where id=(itm->>'product_id')::uuid and is_active=true;
  if not found then raise exception 'Producto no disponible'; end if;
  qty:=(itm->>'quantity')::int; pct:=coalesce((itm->>'discount_percent')::numeric,get_category_discount(prod.category_id)); unit:=coalesce((itm->>'unit_price')::numeric,round_to_half(prod.price*(1-pct/100)));
  insert into proforma_items(proforma_id,product_id,variant_id,quantity,unit_price,discount_percent,line_total) values(pid,prod.id,nullif(itm->>'variant_id','null')::uuid,qty,unit,pct,unit*qty);
  subtotal:=subtotal+unit*qty;
 end loop;
 update proformas set subtotal=subtotal,total=subtotal where id=pid;
 select jsonb_build_object('proforma_id',pid,'proforma_number',proforma_number,'total',total,'status',status) into result from proformas where id=pid;return result;
end $$;
create or replace function public.confirm_proforma_as_sale(p_proforma_id uuid,p_user_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare pf proformas%rowtype; it record; sid uuid; v product_variants%rowtype; result jsonb;
begin
 select * into pf from proformas where id=p_proforma_id for update;
 if not found then raise exception 'Proforma no existe'; end if;
 if pf.status<>'PENDIENTE' then raise exception 'La proforma ya fue procesada'; end if;
 for it in select * from proforma_items where proforma_id=p_proforma_id loop
  if it.variant_id is not null then select * into v from product_variants where id=it.variant_id for update; if not found or v.stock<it.quantity then raise exception 'Stock insuficiente'; end if; end if;
 end loop;
 insert into sales(proforma_id,customer_id,created_by,total) values(pf.id,pf.customer_id,p_user_id,pf.total) returning id into sid;
 for it in select * from proforma_items where proforma_id=p_proforma_id loop
  insert into sale_items(sale_id,product_id,variant_id,quantity,unit_price,discount_percent,line_total) values(sid,it.product_id,it.variant_id,it.quantity,it.unit_price,it.discount_percent,it.line_total);
  if it.variant_id is not null then update product_variants set stock=stock-it.quantity where id=it.variant_id; end if;
 end loop;
 update proformas set status='CONVERTIDA' where id=pf.id;
 select jsonb_build_object('sale_id',sid,'sale_number',sale_number,'total',total) into result from sales where id=sid;return result;
end $$;

-- Ajustes de operación comercial: proforma pública por WhatsApp, sin cobro online ni IVA.
alter table public.customers alter column phone drop not null;
alter table public.proformas alter column delivery_type set default 'POR_DEFINIR';
alter table public.proformas add column if not exists vat_rate numeric(5,2) not null default 0;
alter table public.proformas add column if not exists vat_amount numeric(12,2) not null default 0;
alter table public.proformas add column if not exists notes text;
alter table public.orders add column if not exists vat_rate numeric(5,2) not null default 0;
alter table public.orders add column if not exists vat_amount numeric(12,2) not null default 0;
alter table public.proforma_items add column if not exists vat_amount numeric(12,2) not null default 0;
alter table public.proforma_items add column if not exists product_name_snapshot text;
alter table public.proforma_items add column if not exists product_code_snapshot text;

create or replace function public.create_store_proforma(p_customer jsonb,p_items jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; pid uuid; itm jsonb; prod public.products%rowtype; pct numeric; unit numeric; qty int; subtotal numeric:=0; result jsonb; detail jsonb;
begin
 if coalesce(trim(p_customer->>'full_name'),'')='' or coalesce(trim(p_customer->>'city'),'')='' then raise exception 'Ingresa nombres y ciudad'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'El carrito está vacío'; end if;
 insert into customers(full_name,phone,city) values(trim(p_customer->>'full_name'),nullif(trim(p_customer->>'phone'),''),trim(p_customer->>'city'))
 on conflict(phone) do update set full_name=excluded.full_name,city=excluded.city returning id into cid;
 insert into proformas(customer_id,delivery_type,status,vat_rate,vat_amount) values(cid,'POR_DEFINIR','PENDIENTE',0,0) returning id into pid;
 for itm in select * from jsonb_array_elements(p_items) loop
  select * into prod from products where id=(itm->>'product_id')::uuid and is_active=true;
  if not found then raise exception 'Producto no disponible'; end if;
  qty:=(itm->>'quantity')::int; if qty<1 then raise exception 'Cantidad inválida'; end if;
  pct:=get_category_discount(prod.category_id); unit:=round_to_half(prod.price*(1-pct/100));
  insert into proforma_items(proforma_id,product_id,variant_id,quantity,unit_price,discount_percent,line_total,vat_amount,product_name_snapshot,product_code_snapshot)
  values(pid,prod.id,nullif(itm->>'variant_id','null')::uuid,qty,unit,pct,unit*qty,0,prod.name,prod.code);
  subtotal:=subtotal+unit*qty;
 end loop;
 update proformas set subtotal=subtotal,total=subtotal,vat_rate=0,vat_amount=0 where id=pid;
 select coalesce(jsonb_agg(jsonb_build_object('name',coalesce(pi.product_name_snapshot,p.name),'code',coalesce(pi.product_code_snapshot,p.code),'quantity',pi.quantity,'unit_price',pi.unit_price,'line_total',pi.line_total)), '[]'::jsonb)
 into detail from proforma_items pi left join products p on p.id=pi.product_id where pi.proforma_id=pid;
 select jsonb_build_object('proforma_id',pf.id,'proforma_number',pf.proforma_number,'subtotal',pf.subtotal,'vat_rate',0,'vat_amount',0,'total',pf.total,'items',detail)
 into result from proformas pf where pf.id=pid;
 return result;
end $$;
grant execute on function public.create_store_proforma(jsonb,jsonb) to anon,authenticated;
