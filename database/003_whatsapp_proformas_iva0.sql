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
