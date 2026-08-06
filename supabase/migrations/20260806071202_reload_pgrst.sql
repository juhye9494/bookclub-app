-- Reload PostgREST schema cache so it can find the newly added place_book_order_v5 function.
NOTIFY pgrst, 'reload schema';
