# Automation Reference

Set up automated orders and scheduled trading strategies.

## Order Types

### Limit Orders
Execute trade when price reaches target.

**Examples:**
- "Set a limit order to buy ETH at $3,000"
- "Limit order: sell BNKR when it hits $0.02"
- "Buy 1 SOL if price drops to $100"
- "Sell my PEPE at $0.000015"

**Use cases:**
- Buy the dip
- Take profit at target
- Enter at better price
- Exit at predetermined level

### Stop Loss Orders
Automatically sell to limit losses.

**Examples:**
- "Set stop loss for my ETH at $2,500"
- "Stop loss: sell 50% of BNKR if it drops 20%"
- "Protect my SOL position with stop at $150"

**Use cases:**
- Protect gains
- Limit downside
- Risk management
- Sleep peacefully

### DCA (Dollar Cost Averaging)
Invest fixed amounts at regular intervals.

**Examples:**
- "DCA $100 into ETH every week"
- "Set up daily $50 Bitcoin purchases"
- "Buy $25 of SOL every Monday"
- "Monthly $500 DCA into ETH"

**Use cases:**
- Reduce timing risk
- Build position over time
- Smooth out volatility
- Disciplined investing

**Intervals:**
- Hourly
- Daily
- Weekly
- Monthly

### TWAP (Time-Weighted Average Price)
Spread large orders over time to reduce market impact.

**Examples:**
- "TWAP: buy $1000 of ETH over 24 hours"
- "Spread my sell order over 4 hours"
- "Buy 10 ETH using TWAP over next 6 hours"
- "TWAP sell 50% of position over 12 hours"

**Use cases:**
- Large order execution
- Reduce slippage
- Minimize market impact
- Better average price

### Scheduled Commands
Run any Bankr command on a schedule.

**Examples:**
- "Every morning at 8am, check my portfolio"
- "Daily at 9am, check ETH price"
- "Every Monday, show me trending tokens"
- "Hourly, check my open positions"

**Use cases:**
- Regular monitoring
- Automated reporting
- Price alerts
- Balance checks

## Managing Automations

### View Active Automations
**Examples:**
- "Show my automations"
- "What limit orders do I have?"
- "List my active DCAs"
- "Show all scheduled commands"

**Information shown:**
- Order type
- Asset/pair
- Trigger condition
- Amount
- Status
- Created date

### Cancel Automations
**Examples:**
- "Cancel my ETH limit order"
- "Stop my DCA into Bitcoin"
- "Cancel all my stop losses"
- "Remove my SOL automation"

**Cancellation:**
- Immediate effect
- No fees for canceling
- Can recreate anytime
- To modify an automation, cancel and recreate with new parameters

## Creating Automations from the API

Automations are created, listed and cancelled in natural language — there is no dedicated API-key REST endpoint for them. Send the same phrasing you'd type in the terminal through `/agent/prompt` (or `bankr agent prompt`):

```bash
curl -X POST "https://api.bankr.bot/agent/prompt" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "DCA $50 into ETH on Base every Monday"}'
```

```bash
bankr agent prompt "Show my automations"
bankr agent prompt "Cancel my ETH limit order"
```

**An API key can create automations on its own** — no web-terminal step is required first. The automation binds to the wallet behind the API key at creation, and every later scheduled run executes against that same wallet. An answer telling you to provision the automation wallet in the web terminal is not a real precondition; retry, and report it if it persists.

The `/user/automation/*` REST endpoints you may see referenced are **Bankr Terminal session endpoints**, not part of the API-key surface — an `X-API-Key` request to them will not authenticate. Use `/agent/prompt` for API-key integrations.

> Bankr Club gating on automations applies the same way regardless of how the automation was created.

## Chain Support

### EVM Chains (Base, Polygon, Ethereum)
- ✅ Limit orders
- ✅ Stop loss
- ✅ DCA
- ✅ TWAP
- ✅ Scheduled commands

### Solana
- ✅ Limit orders (via Jupiter Trigger)
- ✅ Stop loss (via Jupiter)
- ✅ DCA (via Jupiter)
- ⚠️ TWAP (limited support)
- ✅ Scheduled commands

## Common Issues

| Issue | Resolution |
|-------|------------|
| Order not triggering | Check price hasn't already passed |
| Insufficient balance | Ensure funds available when executes |
| Order cancelled | May have conflicting orders |
| Slippage on trigger | Market moved quickly |
| DCA not executing | Check balance and gas funds |

## Best Practices

### Setting Up
1. **Start small** - Test with small amounts
2. **Clear conditions** - Be specific about triggers
3. **Check balance** - Ensure funds available
4. **Set alerts** - Get notified on execution
5. **Review regularly** - Update as market changes

### Risk Management
1. **Always use stop loss** - Especially for leverage
2. **Don't set and forget** - Monitor periodically
3. **Adjust targets** - Update as conditions change
4. **Consider gas** - Factor in execution costs
5. **Test first** - Try one small automation first

### DCA Strategy
1. **Consistent amounts** - Stick to the plan
2. **Long timeframe** - At least 3-6 months
3. **Don't pause** - Keep going through volatility
4. **Review quarterly** - Adjust if needed
5. **Compound** - Consider increasing over time

### Limit Order Strategy
1. **Realistic prices** - Check historical support/resistance
2. **Layered orders** - Multiple orders at different prices
3. **Time limits** - Set expiration if needed
4. **Review daily** - Cancel stale orders
5. **Be patient** - Good prices take time

## Tips for Success

### Automation is Not Set-and-Forget
- Check on orders regularly
- Market conditions change
- Update targets as needed
- Cancel outdated orders

### Combine Strategies
- DCA + stop loss = Protected accumulation
- Limit buy + limit sell = Range trading
- TWAP + stop loss = Large position exit

### Use Alerts
- Get notified on execution
- Track automation performance
- Stay informed without constant checking
- Review execution prices

### Keep It Simple
- Start with basic automations
- Add complexity gradually
- Don't over-automate
- Clear naming for tracking

## Cost Considerations

### Execution Costs
- Gas fees on each trigger
- Higher on Ethereum mainnet
- Very low on Base/Polygon
- Factor into profit calculations

### DCA Costs
- Per-transaction gas
- Can add up with frequent DCA
- Daily DCA = 365 transactions/year
- Weekly might be more efficient

### TWAP Costs
- Multiple transactions
- Total gas = intervals × gas per tx
- Balance cost vs slippage savings

## Examples by Use Case

### Build Long-Term Position
```
"DCA $200 into ETH every week for 6 months"
"Set stop loss at -30% to protect"
"Monthly review of strategy"
```

### Take Profit Strategy
```
"Limit order: sell 25% at $4,000"
"Limit order: sell 25% at $4,500"
"Limit order: sell 50% at $5,000"
```

### Downside Protection
```
"Stop loss at -20% for all holdings"
"Set stop loss for my ETH at $2,500"
"Stop loss: sell 50% of BNKR if it drops 20%"
```

### Opportunistic Buying
```
"Buy $100 ETH if drops to $2,500"
"Buy $200 ETH if drops to $2,000"
"Buy $500 ETH if drops to $1,500"
```

## Monitoring & Adjusting

### Weekly Reviews
- Check execution history
- Adjust price targets
- Cancel outdated orders
- Review performance

### Monthly Analysis
- Calculate ROI
- Compare to manual trading
- Adjust DCA amounts
- Refine strategy

### Quarterly Rebalance
- Reassess allocations
- Update long-term targets
- Modify automation strategy
- Consider market changes

---

**Remember**: Automation is a tool to execute your strategy, not a replacement for strategy. Regular review and adjustment is key to success.
