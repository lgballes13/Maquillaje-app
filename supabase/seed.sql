-- ============================================================================
-- Datos de prueba SOLO para desarrollo local (npx supabase db reset).
-- Nunca ejecutes este archivo en producción.
--
-- Usuarios creados (contraseña de todos: ClaveDePrueba123):
--   admin@demo.example    → rol admin (al entrar te pedirá configurar 2FA)
--   cliente@demo.example  → cliente
--   cliente2@demo.example → cliente
-- ============================================================================

create or replace function pg_temp.create_demo_user(p_id uuid, p_email text, p_name text)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('ClaveDePrueba123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'full_name', p_name,
      'privacy_accepted', true,
      'privacy_policy_version', '2026-10-16'
    ),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), p_id, p_id::text,
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  );
end;
$$;

select pg_temp.create_demo_user('11111111-1111-1111-1111-111111111111', 'admin@demo.example', 'Administradora Demo');
select pg_temp.create_demo_user('22222222-2222-2222-2222-222222222222', 'cliente@demo.example', 'Cliente Demo');
select pg_temp.create_demo_user('33333333-3333-3333-3333-333333333333', 'cliente2@demo.example', 'Cliente Dos');

insert into public.user_roles (user_id, role, granted_by)
values ('11111111-1111-1111-1111-111111111111', 'admin', null);

-- Tienda: categorías y productos de ejemplo (solo en local; en producción los crea la admin).
insert into public.product_categories (id, name, sort_order) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Labios', 1),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Rostro', 2),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'Brochas', 3);

insert into public.products (id, name, description, category_id, price_cop, stock, sort_order) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Labial líquido mate',
   'Producto de ejemplo para pruebas.', 'aaaaaaaa-0000-4000-8000-000000000001', 45000, 1000, 1),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Base de larga duración',
   'Producto de ejemplo para pruebas.', 'aaaaaaaa-0000-4000-8000-000000000002', 89000, 1000, 2),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'Set de brochas',
   'Producto de ejemplo para pruebas.', 'aaaaaaaa-0000-4000-8000-000000000003', 120000, 1000, 3);
