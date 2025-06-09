-- Aktualizacja ustawień sidebaru dla modułu warehouse

update public.modules
set settings = jsonb_build_object(
  'sidebar', jsonb_build_array(
    jsonb_build_object(
      'key', 'warehouse',
      'label', 'Magazyn',
      'icon', 'Warehouse',
      'children', jsonb_build_array(
        jsonb_build_object(
          'key', 'deliveries',
          'label', 'Dostawy',
          'href', '/warehouse/deliveries',
          'icon', 'Truck'
        ),
        jsonb_build_object(
          'key', 'suppliers',
          'label', 'Dostawcy',
          'href', '/warehouse/suppliers',
          'icon', 'Users'
        )
      )
    )
  )
)
where slug = 'warehouse';
