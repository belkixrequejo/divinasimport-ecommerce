# DIVINAS IMPORT — E-commerce + administración
Proyecto React + Vite, API Node.js + Express y Supabase (PostgreSQL, Auth y Storage).

## Requisitos
Node.js 20.19+ o 22.12+, npm y un proyecto Supabase.

## 1. Base de datos
En Supabase → SQL Editor → New query, ejecutar en orden:
1. `database/001_schema.sql`
2. `database/002_seed_and_storage.sql`\n3. `database/003_whatsapp_proformas_iva0.sql`

El SQL crea tablas, índices, funciones RPC para proformas/ventas, descuentos por categoría y políticas RLS.
Crear además el bucket `product-images` como **público** (solo fotografías de catálogo). No guardar comprobantes privados en ese bucket.

## 2. Configurar backend
`cd backend && npm install`
Copiar `.env.example` a `.env` y completar:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY (solo servidor, nunca en frontend)
- SUPABASE_ANON_KEY
- FRONTEND_URL

Ejecutar `npm run dev`.

## 3. Configurar frontend
`cd frontend && npm install`
Copiar `.env.example` a `.env` y completar URL y anon key.
Ejecutar `npm run dev`. Abrir http://localhost:5173.

## 4. Primer administrador
Crear un usuario en Supabase → Authentication → Users. Luego ejecutar en SQL Editor:
`update public.profiles set role='ADMIN' where email='TU_CORREO';`

## Lógica comercial implementada
- La tienda muestra precio normal y precio promocional calculado desde el descuento activo de su categoría.\n- El cliente no paga en línea: ingresa nombres y ciudad, el sistema guarda una proforma con código y abre WhatsApp con el detalle en texto al número comercial configurado.
- Los descuentos se redondean al múltiplo de 0.50 más cercano (ej.: 5, 5.50, 6).
- En proformas se conserva el precio vigente al momento de crearla.
- Una proforma NO descuenta inventario. La venta confirmada sí lo hace mediante función transaccional, evitando stock negativo.
- Descuento de categoría y descuento mayorista no se acumulan: si un artículo ya tiene promoción, se usa esa promoción; el 10% mayorista solo se aplica a artículos sin promoción cuando la venta tiene 4 o más unidades.
- Fotos por producto y variantes: un producto puede tener varias fotos, colores y tallas; el stock se registra por combinación de talla/color.
- Las proformas del e-commerce se guardan en PostgreSQL con IVA 0%. No se cobra en línea. WhatsApp recibe el texto de la proforma en el número 593986086415. En administración se puede definir envío, retiro o compra en local sobre la misma proforma antes de convertirla en venta.

## Despliegue gratuito
Frontend: Vercel o Cloudflare Pages.
Backend: Render (plan gratuito sujeto a suspensión/limitaciones) o Railway según disponibilidad.
Supabase: plan Free sujeto a cuotas y políticas vigentes.
Configurar variables de entorno en cada plataforma. No subir `.env` ni claves privadas al repositorio.


## Acceso administrativo
- La tienda pública no muestra ningún botón de administrador.
- El panel administrativo se abre directamente en `/admin`.
- El acceso usa Supabase Auth (correo y contraseña) y comprueba el perfil en `public.profiles`.
- Los perfiles con rol `ADMIN` o `VENDEDORA` y `is_active=true` pueden ingresar.
- Para crear usuarios: Supabase Dashboard → Authentication → Users → Add user.
- Después de crear el usuario, el trigger crea automáticamente su fila en `public.profiles` con rol `VENDEDORA`.
- Para dar acceso de administrador, cambia el rol desde SQL Editor:
  `UPDATE public.profiles SET role='ADMIN' WHERE email='correo@ejemplo.com';`
- Para bloquear un usuario: `UPDATE public.profiles SET is_active=false WHERE email='correo@ejemplo.com';`
- Nunca publiques la clave `service_role` en el frontend.
