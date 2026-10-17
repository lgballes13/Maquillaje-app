-- ============================================================================
-- Pruebas del portafolio y sus autorizaciones (Fase 6, pgTAP). Ejecutar con:
--   npx supabase test db
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

\set cliente1 '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1"}'
\set admin1fa '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}'
\set admin2fa '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2"}'
\set c1 'eeeeeeee-0000-4000-8000-000000000001'
\set c2 'eeeeeeee-0000-4000-8000-000000000002'
\set w1 'ffffffff-0000-4000-8000-000000000001'
\set w2 'ffffffff-0000-4000-8000-000000000002'
\set w3 'ffffffff-0000-4000-8000-000000000003'

-- ---------------------------------------------------------------------------
-- 1. La admin registra la autorización y el trabajo
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to :'admin2fa';

select lives_ok(format(
  $$insert into public.portfolio_consents (id, client_name, signed_on, document_path)
    values (%L, 'Laura Gómez', current_date, 'formatos/uno.pdf')$$, :'c1'),
  'la admin registra una autorización firmada');
select lives_ok(format(
  $$insert into public.portfolio_works (id, title, category_id, consent_id)
    values (%L, 'Novia en el jardín', 'cccccccc-0000-4000-8000-000000000001', %L)$$, :'w1', :'c1'),
  'la admin crea un trabajo ligado a la autorización');
select is((select is_published from public.portfolio_works where id = :'w1'), false,
  'un trabajo nuevo empieza oculto');
select throws_ok(format(
  $$insert into public.portfolio_works (title, consent_id, is_published) values ('Directo', %L, true)$$, :'c1'),
  '42501', null, 'no se puede crear un trabajo ya publicado (columna sin permiso)');
select throws_ok(format('update public.portfolio_works set is_published = true where id = %L', :'w1'),
  'P0001', 'after_photo_required', 'sin foto de «después» no se publica');

insert into public.portfolio_images (work_id, kind, storage_path, alt_text)
values (:'w1', 'before', 'trabajos/w1-antes.webp', 'Rostro sin maquillaje'),
       (:'w1', 'after', 'trabajos/w1-despues.webp', 'Maquillaje de novia terminado');

select lives_ok(format('update public.portfolio_works set is_published = true where id = %L', :'w1'),
  'con autorización y foto de «después» se publica');
select isnt((select published_at from public.portfolio_works where id = :'w1'), null,
  'queda la fecha de publicación');

insert into public.portfolio_works (id, title, consent_id) values (:'w2', 'Borrador', :'c1');

-- ---------------------------------------------------------------------------
-- 2. Lo que ven los visitantes y las clientas
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select is((select count(*)::int from public.portfolio_works where id in (:'w1', :'w2')), 1,
  'el visitante solo ve el trabajo publicado');
select is((select count(*)::int from public.portfolio_images where work_id = :'w1'), 2,
  'el visitante ve las fotos del trabajo publicado');
select throws_ok('select * from public.portfolio_consents', '42501', null,
  'el visitante no puede leer las autorizaciones');
select throws_ok(format(
  $$insert into public.portfolio_works (title, consent_id) values ('Intruso', %L)$$, :'c1'),
  '42501', null, 'el visitante no crea trabajos');
select is((select count(*)::int from public.portfolio_categories), 3,
  'el visitante ve las categorías activas');

reset role;
set local role authenticated;
set local request.jwt.claims to :'cliente1';
select is((select count(*)::int from public.portfolio_works where id in (:'w1', :'w2')), 1,
  'la clienta solo ve lo publicado');
select is((select count(*)::int from public.portfolio_consents), 0,
  'la clienta no ve ninguna autorización');
select throws_ok($$insert into public.portfolio_categories (name) values ('Intrusa')$$,
  '42501', null, 'la clienta no crea categorías');
select is((select count(*)::int from public.portfolio_images where work_id = :'w2'), 0,
  'la clienta no ve fotos de trabajos ocultos');

-- La admin sin 2FA en esta sesión tampoco ve las autorizaciones.
set local request.jwt.claims to :'admin1fa';
select is((select count(*)::int from public.portfolio_consents), 0,
  'sin 2FA la admin no ve las autorizaciones');

-- ---------------------------------------------------------------------------
-- 3. Retirar la autorización
-- ---------------------------------------------------------------------------
set local request.jwt.claims to :'admin2fa';
select throws_ok(format('delete from public.portfolio_consents where id = %L', :'c1'),
  '42501', null, 'una autorización no se borra');
select throws_ok(format($$update public.portfolio_consents set client_name = 'Otra' where id = %L$$, :'c1'),
  '42501', null, 'el nombre de la clienta no se cambia');
select lives_ok(format(
  $$update public.portfolio_consents set revoked_at = now(), revoked_reason = 'La clienta lo pidió' where id = %L$$, :'c1'),
  'la admin registra que la clienta retiró la autorización');
select is((select is_published from public.portfolio_works where id = :'w1'), false,
  'al retirar la autorización el trabajo se oculta solo');
select is((select published_at from public.portfolio_works where id = :'w1'), null,
  'y pierde la fecha de publicación');
select throws_ok(format('update public.portfolio_works set is_published = true where id = %L', :'w1'),
  'P0001', 'consent_required', 'con la autorización retirada no se vuelve a publicar');
select throws_ok(format('update public.portfolio_consents set revoked_at = null where id = %L', :'c1'),
  'P0001', 'consent_revoked', 'una autorización retirada no se reactiva');

reset role;
set local role anon;
select is((select count(*)::int from public.portfolio_works where id = :'w1'), 0,
  'el visitante ya no ve el trabajo');

-- ---------------------------------------------------------------------------
-- 4. Borrar la última foto de «después» oculta el trabajo
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims to :'admin2fa';
insert into public.portfolio_consents (id, client_name, signed_on, document_path)
values (:'c2', 'Sofía Ruiz', current_date, 'formatos/dos.jpg');
insert into public.portfolio_works (id, title, consent_id) values (:'w3', 'Social de noche', :'c2');
insert into public.portfolio_images (work_id, kind, storage_path, alt_text)
values (:'w3', 'after', 'trabajos/w3-despues.webp', 'Maquillaje social de noche');
update public.portfolio_works set is_published = true where id = :'w3';
delete from public.portfolio_images where work_id = :'w3';
select is((select is_published from public.portfolio_works where id = :'w3'), false,
  'sin fotos de «después» el trabajo se oculta');

-- ---------------------------------------------------------------------------
-- 5. Archivos: el formato firmado es privado
-- ---------------------------------------------------------------------------
reset role;
insert into storage.objects (bucket_id, name, owner)
values ('autorizaciones', 'formatos/uno.pdf', '11111111-1111-1111-1111-111111111111');

select is((select public from storage.buckets where id = 'autorizaciones'), false,
  'el bucket de autorizaciones es privado');
select is((select public from storage.buckets where id = 'portafolio'), true,
  'el bucket de fotos del portafolio es público');

set local role authenticated;
set local request.jwt.claims to :'cliente1';
select is((select count(*)::int from storage.objects where bucket_id = 'autorizaciones'), 0,
  'una clienta no ve los formatos firmados');

set local request.jwt.claims to :'admin2fa';
select is((select count(*)::int from storage.objects
           where bucket_id = 'autorizaciones' and name = 'formatos/uno.pdf'), 1,
  'la admin con 2FA ve el formato firmado');

select * from finish();
rollback;
