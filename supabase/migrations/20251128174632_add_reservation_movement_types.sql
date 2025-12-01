-- =============================================
-- Add Reservation Movement Types (572, 573)
-- Based on AutoStacja specification
-- =============================================

-- Insert new reservation movement types
INSERT INTO public.movement_types (
  code,
  name,
  name_pl,
  description,
  category,
  affects_stock,
  polish_document_type,
  requires_approval,
  creates_reservation,
  requires_movement_request,
  requires_source_location,
  requires_destination_location
)
VALUES
  (
    '572',
    'Reservation Create',
    'Utworzenie rezerwacji',
    'Creates a soft reservation. Decreases available stock, increases reserved quantity.',
    'reservation',
    0,  -- Does not affect physical stock, only reserved quantity
    'RZ+',
    false,
    true,  -- This IS a reservation operation
    false,
    true,  -- Requires source location for reservation
    false
  ),
  (
    '573',
    'Reservation Release',
    'Zwolnienie rezerwacji',
    'Releases or cancels reservation. Frees available stock.',
    'reservation',
    0,  -- Does not affect physical stock, only reserved quantity
    'RZ-',
    false,
    true,  -- This IS a reservation operation
    false,
    true,  -- Requires source location to release from
    false
  )
ON CONFLICT (code) DO NOTHING;
