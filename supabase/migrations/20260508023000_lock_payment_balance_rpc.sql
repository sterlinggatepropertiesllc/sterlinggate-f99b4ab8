-- Only trusted server-side code should apply Stripe payments to tenant balances.
-- Edge Functions call this with the service-role key; browser clients should not.
REVOKE EXECUTE ON FUNCTION public.record_payment_balance_adjustment(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_payment_balance_adjustment(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_payment_balance_adjustment(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_balance_adjustment(uuid, uuid, text) TO service_role;
