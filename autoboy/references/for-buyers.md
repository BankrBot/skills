# AutoBoy Buyers

Choose pre-token projects, auto-buy their tokens the instant they launch

## Workflow

1. **Get a key** — `POST /api-key-requests` (see the main SKILL.md). Approval also
   provisions your AutoBoy smart wallet on Base.
2. **Get your wallet address** — `GET /api-keys` and `GET /wallet` returns
   the smart-wallet address.
3. **Fund your wallet** - Send USDC (Base) to your wallet address; auto-buys spend
   that balance.
4. **Browse projects** — `GET /projects`, `GET /projects/{slug}`.
5. **Place buy orders** — `POST /orders` with one item per project.
6. **Monitor and adjust orders** — `GET /orders`, `PATCH /orders`, `DELETE /orders`.
7. _AutoBoy auto-buys on launch — AutoBoy fills your buy orders automatically when the
   project launches._
8. **Withdraw** — `POST /wallet/withdrawals` to pull USDC or tokens out.

## Relevant endpoints

### Base URL

```
https://thefirm.biz/api/public/v1
```

### Authorization

- **Request an API key** → [`POST /api/public/v1/api-key-requests`](https://docs.thefirm.biz/api-reference/api-keys/request-an-api-key)

### Projects

- **List projects** → [`GET /api/public/v1/projects`](https://docs.thefirm.biz/api-reference/projects/list-projects)
- **Get a project** → [`GET /api/public/v1/projects/{slug}`](https://docs.thefirm.biz/api-reference/projects/get-a-project)
- **List a project's buyers** → [`GET /api/public/v1/projects/{slug}/buyers`](https://docs.thefirm.biz/api-reference/projects/list-a-projects-buyers)

### Buy orders

- **List buy orders** → [`GET /api/public/v1/orders`](https://docs.thefirm.biz/api-reference/buy-orders/list-buy-orders)
- **Create buy orders** → [`POST /api/public/v1/orders`](https://docs.thefirm.biz/api-reference/buy-orders/create-buy-orders)
- **Update buy orders** → [`PATCH /api/public/v1/orders`](https://docs.thefirm.biz/api-reference/buy-orders/update-buy-orders)
- **Delete buy orders** → [`DELETE /api/public/v1/orders`](https://docs.thefirm.biz/api-reference/buy-orders/delete-buy-orders)

### AutoBoy wallet

- **Get AutoBoy wallet** → [`GET /api/public/v1/wallet`](https://docs.thefirm.biz/api-reference/autoboy-wallet/get-autoboy-wallet)
- **Withdraw an asset** → [`POST /api/public/v1/wallet/withdrawals`](https://docs.thefirm.biz/api-reference/autoboy-wallet/withdraw-an-asset)

## Feedback or questions?

- Contact [@firmjeff](https://t.me/firmjeff) on Telegram, or:
- Send via the REST API → [`POST /api/public/v1/feedback`](https://docs.thefirm.biz/api-reference/feedback/send-feedback)

## Full docs for buyers

Full docs for buyers are available here: [docs.thefirm.biz/buylisting](https://docs.thefirm.biz/buylisting)
