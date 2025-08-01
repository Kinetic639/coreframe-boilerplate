# Test Product Creation

To test if product creation is working after applying the RLS policies:

## 1. Apply the Migration First

- Use one of the methods above to apply the RLS policies migration
- The migration file is: `supabase/migrations/20250801073511_add_product_rls_policies.sql`

## 2. Test Product Creation

1. **Navigate to**: `/dashboard/warehouse/products`
2. **Click**: "Dodaj produkt" (Add Product)
3. **Fill in the form**:
   - Name: "Test Product"
   - SKU: "TEST-001"
   - Description: "Test product description"
   - Default Unit: "szt."
   - Variant Name: "Standard"
   - Purchase Price: 100.00
   - Location: Select any available location
   - Initial Quantity: 10

4. **Submit the form**

## 3. Expected Results After Migration:

✅ **Product creates successfully** without RLS errors
✅ **Product appears in the product list**
✅ **Stock locations are properly associated** with the branch
✅ **Only users with branch access can see the product**

## 4. Debug Information:

If product creation still fails, check:

- Browser developer console for errors
- Network tab for failed API requests
- Supabase logs in the dashboard

## 5. Manual RLS Verification:

You can verify RLS is working by checking in Supabase dashboard:

- Go to Table Editor
- Check if `products` table shows "RLS enabled"
- Verify policies are applied to all product-related tables
