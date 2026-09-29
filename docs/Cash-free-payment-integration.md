# Cashfree Payment Integration — Alfred Terminal

Integrate Cashfree Payment Gateway into the existing Alfred Terminal app for the "Buy Me a Coffee" / voluntary support feature.

IMPORTANT:

- Do NOT rebuild the existing app.
- Preserve all current UI and functionality.
- Use Cashfree's official Web Checkout / JS SDK flow.
- Never expose Cashfree credentials in client-side code.
- Never hard-code secrets.

## Environment Variables

Create:

CASHFREE_APP_ID=
CASHFREE_SECRET_KEY=
CASHFREE_ENV=sandbox

Use:

- `CASHFREE_APP_ID` as Cashfree `x-client-id`
- `CASHFREE_SECRET_KEY` as Cashfree `x-client-secret`

I will provide the actual values through the deployment environment.

## Payment Flow

User clicks:
"☕ Buy Me a Coffee"

Show a polished Alfred Terminal payment modal with:

- preset amounts: ₹50, ₹100, ₹250, ₹500
- custom amount
- UPI / available domestic payment methods
- international payment methods available for the merchant account
- clear "Support Alfred Terminal" CTA

When the user submits:

1. Frontend calls our secure backend endpoint, e.g.
   POST /api/payments/create-order

2. Backend creates a Cashfree order using the official API:
   POST /pg/orders

3. Generate a unique order_id.

4. Send:
   - order_amount
   - order_currency
   - customer_details
   - return_url
   - notify_url/webhook URL

5. Receive Cashfree `payment_session_id`.

6. Return ONLY the payment session information needed by the browser.

7. Frontend initializes the Cashfree JS SDK and opens Checkout using the payment session ID.

8. After checkout/redirect, NEVER trust the browser alone for final payment confirmation.

9. Backend must verify the order/payment status with Cashfree.

10. Implement a secure webhook endpoint, e.g.
    POST /api/payments/webhook

11. Make webhook handling idempotent.

12. Mark a support payment as successful only after Cashfree confirms a successful payment.

## UX

Keep the payment experience extremely simple.

Button:
"☕ Buy Me a Coffee"

Modal heading:
"Support Alfred Terminal"

Text:
"Help keep Alfred Terminal independent and improving."

Amount selector:
₹50
₹100
₹250
₹500
Custom

Primary button:
"Continue to Payment"

After success:
"Thank you for supporting Alfred Terminal."

After failure:
"Payment wasn't completed. Your account has not been charged by Alfred Terminal."

## Security

- Server-side Cashfree API calls only.
- Secrets must remain in environment variables.
- Do not expose CASHFREE_SECRET_KEY to the browser.
- Validate amount server-side.
- Prevent negative/zero/invalid amounts.
- Add reasonable maximum amount validation.
- Verify payment status server-side.
- Verify webhook authenticity according to current Cashfree documentation.
- Make webhook processing idempotent.
- Do not trust client-provided "payment successful" flags.

## Development

Use Cashfree Sandbox first.

After sandbox testing works, make production mode controlled entirely through:
CASHFREE_ENV=production

Use the correct Cashfree production endpoint automatically when production is enabled.

Do not change the existing resume/cover-letter generation logic.

Before coding, inspect the current project architecture and integrate into its existing API/routes/components instead of creating conflicting duplicate systems.

At the end, provide me with the exact environment variables I need to add to Vercel.

## Vercel / deployment env vars

Add these in Vercel → Project → Settings → Environment Variables:

```
CASHFREE_APP_ID=<your Cashfree App ID / x-client-id>
CASHFREE_SECRET_KEY=<your Cashfree Secret Key / x-client-secret>
CASHFREE_ENV=sandbox
```

When going live:

```
CASHFREE_ENV=production
```

Also ensure:

```
AUTH_URL=https://alfredterminal.xyz
```

(or your production origin) so `return_url` and `notify_url` resolve correctly.

Cashfree dashboard:
1. Whitelist `alfredterminal.xyz` (and localhost for sandbox testing).
2. Set webhook / notify URL to `https://alfredterminal.xyz/api/payments/webhook`.
3. Use sandbox App ID + Secret first; switch `CASHFREE_ENV=production` only after sandbox works.

IMPORTANT:
Do not ask me to paste credentials into source code.
