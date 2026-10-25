// Every ABI fragment this skill uses. Signatures were copied from the Flash
// contract sources (ecosystem/components/*) and the live webclient, and each
// selector is checked against the deployed bytecode by check-contracts.mjs.
import { parseAbi } from 'viem';

const POOL_KEY = '(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)';
const SHAPE = '(uint8 mode,uint8 preset,bool overrideStockpile,uint16 stockpileBps,(uint16 participantBps,uint16 liquidityBps,uint16 creatorChurnBps,uint16 protocolChurnBps) split,(uint24 widthTicks,uint16 binsBelowLaunch,uint8 count,(uint16 bins,int24 exponentTicks,uint32 sharePpm)[8] segments) lattice,address rewardAsset,uint8 ownerLadder)';
const LATTICE_PARAMS = '(int24 startTick,uint24 widthTicks,uint8 count,uint128 total,(uint16 bins,int24 exponentTicks,uint32 sharePpm)[8] segments)';
const CANDIDATE = '(address creator,string name,string symbol,uint256 principal,uint256 buyVolume,uint256 sellVolume,uint64 buyCount,uint64 sellCount,uint256 units,uint256 costBasis)';
const WAR_STATE = '(uint8 phase,uint8 pair,uint256 candidateCount,uint256 winnerId,uint256 entryFee,uint256 baseGoal,uint256 goal,uint256 totalPrincipal,address winnerToken,bytes32 poolId,uint256 winnerClaimPool,uint256 loserClaimPool,uint256 winnerUnitsClaimed,uint256 loserBasisClaimed,uint256 winnerTokensClaimed,uint256 loserTokensClaimed,uint256 buyVolume,uint256 sellVolume,uint256 curveScale,uint32 curveRatioBps,uint16 claimFeeBps,uint256 totalCostBasis,uint256 winnerUnits,uint256 loserBasis,uint256 readyAt,uint256 flashUsd18,uint256 quoteOut,uint256 launchTokenUsd18,uint256 abortedFlash,uint256 abortedPrincipal,uint256 refundedFlash)';

export const erc20 = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner,address spender) view returns (uint256)',
  'function approve(address spender,uint256 amount) returns (bool)',
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
]);

export const permit2 = parseAbi([
  'function allowance(address user,address token,address spender) view returns (uint160 amount,uint48 expiration,uint48 nonce)',
  'function approve(address token,address spender,uint160 amount,uint48 expiration)',
]);

export const universalRouter = parseAbi([
  'function execute(bytes commands,bytes[] inputs,uint256 deadline) payable',
]);

export const v4Quoter = parseAbi([
  `function quoteExactInputSingle((${POOL_KEY} poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountOut,uint256 gasEstimate)`,
  `function quoteExactOutputSingle((${POOL_KEY} poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountIn,uint256 gasEstimate)`,
  'function quoteExactInput((address exactCurrency,(address intermediateCurrency,uint24 fee,int24 tickSpacing,address hooks,bytes hookData)[] path,uint128 exactAmount) params) returns (uint256 amountOut,uint256 gasEstimate)',
  'error UnexpectedRevertBytes(bytes revertData)',
  'error NotEnoughLiquidity(bytes32 poolId)',
]);

// ---------------------------------------------------------------- Referral Coin (FLASH/ETH)

export const rcHook = parseAbi([
  'function BIND_MAGIC() view returns (bytes4)',
  'function poolState() view returns (uint160 sqrtPriceX96,int24 tick,uint128 liquidity,uint24 lpFee)',
  `function getReserves(${POOL_KEY} key) view returns (uint256 amount0,uint256 amount1)`,
]);

export const rcPolicy = parseAbi([
  'function gasFloor() view returns (uint32)',
  'function FEE_REFERRED_BPS() view returns (uint256)',
  'function FEE_UNREFERRED_BPS() view returns (uint256)',
  'function MAX_TOTAL_BPS() view returns (uint256)',
  'function quoteSellTax(uint256 amount,bool exactIn) view returns (uint256 impactBps,uint256 impactTaxBps,uint256 ethTaxBps)',
]);

export const rcRegistry = parseAbi([
  'function bindNonce(address account) view returns (uint256)',
  'function bindingOf(address account) view returns (address referrer,bool explicitlyBound)',
  'function isReferred(address account) view returns (bool)',
  'function codeOf(address account) view returns (uint64)',
  'function ownerOfCode(uint64 code) view returns (address)',
  'function codeThreshold() view returns (uint256)',
  'function codesIssued() view returns (uint64)',
  'function refereeCount(address account) view returns (uint256)',
  'function bucketOf(address account) view returns (uint256 eth,uint256 flash)',
  'function lifetimeEarned(address account) view returns (uint256 eth,uint256 flash)',
  'function previewClaim(address account) view returns (uint256 ethPayout,uint256 tokenPayout,address parent,uint256 ethCascaded,uint256 tokenCascaded)',
  'function sortedRankOf(address account) view returns (uint256)',
  'function top100Sorted() view returns (address[] accounts,uint256[] scores)',
  'function top100Pool() view returns (uint256)',
  'function top100FlashPool() view returns (uint256)',
  'function airdropThreshold() view returns (uint256)',
  'function flashAirdropThreshold() view returns (uint256)',
  'function bind(uint64 code)',
  'function bindWithSig(address account,uint64 code,uint256 deadline,bytes sig)',
  'function claim() returns (uint256 ethPaid,uint256 tokenPaid)',
  'function distributeTop100() returns (uint256 distributed)',
  'error InvalidCode()',
  'error AlreadyBound()',
  'error SelfReferral()',
  'error SignatureExpired()',
  'error InvalidSignature()',
  'error NotEOA()',
  'error ZeroAddress()',
  'error NotDeployed()',
  'error ForbiddenFactory()',
]);

export const rcKoth = parseAbi([
  'function game() view returns ((uint64 round,address leader,uint128 leaderBid,uint256 trigger,uint64 since,uint256 expiresAt,uint128 held,uint128 pot,uint32 duration,uint16 incrementBps,uint128 startBid) g)',
  'function nextTrigger() view returns (uint256)',
  'function expired() view returns (bool)',
  'function totals() view returns (uint256 ethIn,uint256 churnEth,uint256 flashIn,uint256 flashToChurn,uint256 revShareIn)',
  'function settle()',
  'error NotExpired()',
]);

// ---------------------------------------------------------------- FlashV3 (every other token)

export const v3Hook = parseAbi([
  `function poolState(${POOL_KEY} key) view returns (uint160 sqrtPriceX96,int24 tick,uint128 liquidity,uint24 lpFee)`,
  'function poolInfoOf(bytes32 id) view returns ((address creator,uint8 kind,bool tokenIs0,bool churnOff,bytes32 marketId))',
  'function creatorOf(bytes32 poolId) view returns (address)',
]);

export const v3Registry = parseAbi([
  'function poolOfToken(address token) view returns (bytes32)',
]);

export const v3Ledger = parseAbi([
  'function sweep(bytes32 poolId) returns (uint256 quantOut)',
]);

// ---------------------------------------------------------------- Perps V5 + QUANT

export const perpsIssuer = parseAbi([
  'function navPerToken(uint256 id) view returns (uint256)',
  'function buyCapacityUsdc(uint256 id) view returns (uint256 cap)',
  'function effectiveSupply(uint256 id) view returns (uint256)',
  'function positionOf(uint256 id,address account) view returns (uint256 shares,uint256 basisUsdc,uint256 avgCostPerToken)',
  'function quantMinted() view returns (uint256)',
  'function memeRoutes(bytes32 poolId) view returns (address recipient,uint96 owed)',
  'function unwind(uint256 id,uint256 amount,uint256 minUsdcOut,address to) returns (uint256 usdcOut)',
]);

export const perpsHook = parseAbi([
  'function pools(bytes32) view returns (uint32 marketId,bool registered,bool usdcIs0,uint32 gasFloor)',
]);

// FlashPerpsV5LimitOrders: take-profit / stop-loss listings (keeper-filled on the issuer's NAV).
export const perpOrders = parseAbi([
  'function place(uint256 marketId,uint8 kind,uint256 qty,uint256 triggerNav,uint256 minOut,uint256 expiry) returns (uint256 id)',
  'function placePair(uint256 marketId,uint256 qty,uint256 tpNav,uint256 slNav,uint256 slMinOut,uint256 expiry) returns (uint256 tpId,uint256 slId)',
  'function update(uint256 id,uint256 qty,uint256 triggerNav,uint256 minOut,uint256 expiry)',
  'function cancel(uint256[] ids)',
  'function check(uint256 id) view returns (uint8 code,uint256 nav)',
  'function takeProfitOut(uint256 qty,uint256 limitNav) pure returns (uint256)',
  'function minOrderUsdc() view returns (uint256)',
  'function paused() view returns (bool)',
  'function FEE_PIPS() view returns (uint256)',
  'error NotOrderOwner()',
  'error Paused()',
  'error InvalidParam()',
  'error BelowMinimum(uint256 valueUsdc,uint256 minUsdc)',
  'error NotOpen()',
  'error Expired()',
  'error UnknownMarket()',
]);

// FlashPerpsV5Lens over the live issuer: protocol / account / market KPIs and the QUANT rate.
export const perpsLens = parseAbi([
  'function globalKpi() view returns (uint256 profit,uint256 loss,uint256 quantMinted,bool quantLive)',
  'function accountKpi(address account) view returns (uint256 profit,uint256 loss,uint256 quantReceived)',
  'function marketKpi(uint256 id) view returns (uint256 usdcIn,uint256 usdcOut,uint256 profit,uint256 loss)',
  'function quantRateNow() view returns (uint256)',
  'function previewQuant(uint256 lossUsd6) view returns (uint256 user,uint256 tax)',
  'function unrealizedPnl(uint256 id,address account) view returns (int256)',
]);

// ---------------------------------------------------------------- churn (limit orders)

export const churn = parseAbi([
  'function marketAccounting(bytes32 id) view returns (uint64 epoch,uint256 inventory,uint256 shares,uint256 grossQuoteFilled,uint256 sellerFees,uint256 rewardsDistributed,uint256 rewardsPaid,uint256 epochClosures)',
  'function marketConfig(bytes32 id) view returns ((address token,address quote,address creator,address treasury,bytes32 upstream,uint16 fillBps,uint16 sellerFeeBps) config)',
  'function levelConfig(bytes32 id) view returns ((uint16 stepTicks,bool configured,uint112 minDeposit))',
  'function levels(bytes32 id,int24 fromTick,uint256 max) view returns (int24[])',
  'function snapToLevel(bytes32 id,int24 tick) view returns (int24)',
  'function positions(bytes32 id,address beneficiary,uint8 class) view returns (uint64 epoch,uint256 shares,uint256 debt,uint256 claimable)',
  'function previewClaim(bytes32 id,address beneficiary,uint8 class) view returns (uint256 amount)',
  'function levelPosition(bytes32 id,int24 level,address beneficiary) view returns (uint32 epoch,uint112 shares,uint256 debt,uint256 claimable,uint256 tokenOwed)',
  'function previewLevelClaim(bytes32 id,int24 level,address beneficiary) view returns (uint256)',
  'function previewLevelTokens(bytes32 id,int24 level,address beneficiary) view returns (uint256)',
  `function latticeOf(uint256 positionId) view returns ((address owner,bytes32 marketId,${LATTICE_PARAMS} params,(uint32 next,uint128 soldInNext) state,uint256 unreleased,uint256 bins))`,
  'function latticesOf(bytes32 id) view returns ((uint64 positionId,uint32 next,uint128 soldInNext,int24 startTick,uint24 widthTicks,uint32 bins)[])',
  'function isLatticeOpener(address account) view returns (bool)',
  'function deposit(bytes32 id,uint256 amount,address beneficiary) returns (uint256 shares)',
  'function withdraw(bytes32 id,uint256 sharesToBurn,address receiver) returns (uint256 tokenAmount)',
  'function claim(bytes32 id,address receiver) returns (uint256 quoteAmount)',
  'function depositLevel(bytes32 id,int24 floorTick,uint256 amount,address beneficiary) returns (int24 level,uint256 shares)',
  'function depositLevels(bytes32 id,int24[] floorTicks,uint256[] amounts,address beneficiary) returns (uint256[] shares)',
  'function withdrawLevel(bytes32 id,int24 level,uint256 sharesToBurn,address receiver) returns (uint256 tokenAmount)',
  'function claimLevels(bytes32 id,int24[] levels_,address receiver) returns (uint256 quoteAmount)',
  `function openLattice(bytes32 id,${LATTICE_PARAMS} p,address owner_) returns (uint256 positionId)`,
  'function withdrawLattice(uint256 positionId,address to) returns (uint256 unsoldTokens,uint256 quoteOut)',
  'function withdrawLatticeAmount(uint256 positionId,uint256 amount,address to) returns (uint256 tokens)',
  `function reformatLattice(uint256 positionId,${LATTICE_PARAMS} p) returns (uint256 returned)`,
  'function transferLattice(uint256 positionId,address to)',
]);

/** IRobinhoodUnifiedChurn.ShareClass: wallets hold the Public class. */
export const CHURN_CLASS_PUBLIC = 0;

// ---------------------------------------------------------------- launch-v5

export const launchpad = parseAbi([
  'function launchesLength() view returns (uint256)',
  'function launchAt(uint256 i) view returns (address)',
  'function launchOf(address token) view returns ((address creator,address curve,bytes32 salt,bytes32 poolId,uint8 pair,bool graduated,bool aborted,uint16 launchToleranceBps,string name,string symbol,(bytes32 w0,bytes32 w1,bytes32 w2,bytes32 w3) shape,address quote))',
  'function currentCreationFee() view returns (uint256)',
  `function createLaunchShaped((string name,string symbol,uint8 pair) input,${SHAPE} shape) returns (address token,address curve)`,
  `function createLaunchQuoted((string name,string symbol,uint8 pair) input,address quote,${SHAPE} shape) returns (address token,address curve)`,
  'function finalize(address token)',
  'event LaunchCreated(address indexed token,address indexed curve,address indexed creator,uint8 pair,uint256 goalFlash0,uint256 flashUsd18)',
  'error BelowGoal(uint256 requiredUsd18,uint256 realisedUsd18)',
  'error UnknownLaunch()',
]);

export const launchRouter = parseAbi([
  'function currentCreationFee() view returns (uint256)',
  'function createWithEth((string name,string symbol,uint8 pair) input,uint256 minFlashOut,uint256 minTokens,address recipient) payable returns (address launchToken,address curve,uint256 spent,uint256 tokens)',
  'function createWithEthQuoted((string name,string symbol,uint8 pair) input,address quote,uint256 minFlashOut,uint256 minTokens,address recipient) payable returns (address launchToken,address curve,uint256 spent,uint256 tokens)',
  'function buyWithEth(address launchToken,uint256 minFlashOut,uint256 minTokens,address recipient) payable returns (uint256 spent,uint256 tokens)',
]);

export const curve = parseAbi([
  'function phase() view returns (uint8)',
  'function creator() view returns (address)',
  'function token() view returns (address)',
  'function spotPrice() view returns (uint256)',
  'function principalRaised() view returns (uint256)',
  'function tokensSold() view returns (uint256)',
  'function goalFlashNow() view returns (uint256 goal)',
  'function currentFeeBps() view returns (uint256 buyBps,uint256 sellBps)',
  'function claimableTokensOf(address) view returns (uint256)',
  'function creatorFeesOwed() view returns (uint256)',
  'function participantCount() view returns (uint256)',
  'function quoteBuy(uint256 grossFlashIn) view returns (uint256 flashSpent,uint256 tokensOut,uint256 refundAmount)',
  'function quoteSell(address account,uint256 tokensIn) view returns (uint256 notional,uint256 baseOut,uint256 quoteOut)',
  'function buy(uint256 grossFlashIn,uint256 minTokensOut,address recipient) returns (uint256 flashSpent,uint256 tokensOut)',
  'function sell(uint256 tokensIn,uint256 minFlashOut,address recipient) returns (uint256 paid)',
  'function poke() returns (bool locked)',
  'function claim(address recipient) returns (uint256 amount)',
  'function airdrop(uint256 from,uint256 count) returns (uint256 sent,uint256 skipped)',
  'function refundAborted(address recipient) returns (uint256 flashOut)',
  'function claimCreatorFees(address recipient) returns (uint256 amount)',
]);

export const launchExecutor = parseAbi([
  `function poolKeyForQuote(address token,address quote) view returns (${POOL_KEY} key,bool tokenIs0)`,
]);

export const weth = parseAbi([
  'function deposit() payable',
  'function withdraw(uint256 wad)',
]);

export const shapes = parseAbi([
  'function mode(uint8 id) view returns ((uint16 participantBps,uint16 liquidityBps,uint16 creatorChurnBps,uint16 protocolChurnBps) split,bool exists,bool enabled)',
  'function preset(uint8 id) view returns ((uint24 widthTicks,uint16 binsBelowLaunch,uint8 count,(uint16 bins,int24 exponentTicks,uint32 sharePpm)[8] segments) shape,uint16 stockpileBps,bool exists,bool enabled)',
]);

export const launchConfig = parseAbi([
  'function quoteRouteOf(address quote) view returns ((address adapter,address pool))',
]);

// ---------------------------------------------------------------- Token Wars V6

export const tokenWar = parseAbi([
  'function currentWarId() view returns (uint256)',
  'function currentEntryFee() view returns (uint256)',
  `function warState(uint256 id) view returns (${WAR_STATE})`,
  `function candidatesPage(uint256 warId,uint256 offset,uint256 limit) view returns (${CANDIDATE}[] page)`,
  'function candidatePairOf(uint256 warId,uint256 id) view returns (uint8 pair,address quote)',
  'function goalNow() view returns (uint256 goalUsd,uint256 goalFlash,uint256 extBps,uint256 capFactorBps,uint256 flashUsd18,uint8 priceState)',
  'function lockEligible() view returns (bool)',
  'function unitsOf(uint256 warId,uint256 id,address account) view returns (uint256)',
  'function costBasisOf(uint256 warId,uint256 id,address account) view returns (uint256)',
  'function hasClaimed(uint256 warId,address account) view returns (bool)',
  'function creatorFeesOf(uint256 warId,address creator) view returns (uint256)',
  'function quoteBuyV5(uint256 id,uint256 gross) view returns (uint256 spent,uint256 principal,uint256 feeBps,uint256 extensionBps,bool wouldLock)',
  'function quoteUnits(uint256 id,uint256 gross) view returns (uint256 units)',
  'function quoteSell(address account,uint256 id,uint256 units) view returns (uint256 gross,uint256 baseOut,uint256 quoteOut)',
  'function quoteJump(address account,uint256 fromId,uint256 toId,uint256 units) view returns (uint256 unitsOut,uint256 principalOut,uint256 sellFee,uint256 buyFee,uint256 sellFeeBps,uint256 buyFeeBps,bool wouldLock)',
  `function registerCandidatePaired((string name,string symbol) input,uint8 pair,address quote,${SHAPE} shape) returns (uint256 id)`,
  'function buy(uint256 id,uint256 gross,uint256 minUnits,address recipient) returns (uint256 spent,uint256 principal)',
  'function sell(uint256 id,uint256 units,uint256 minFlashOut,address recipient) returns (uint256 flashOut)',
  'function jump(uint256 fromId,uint256 toId,uint256 units,uint256 minUnitsOut) returns (uint256 unitsOut)',
  'function openWar() returns (uint256 warId)',
  'function finalize()',
  'function claim(uint256 warId,address recipient) returns (uint256 winnerTokens,uint256 loserTokens)',
  'function claimCreatorFees(uint256 warId,address recipient) returns (uint256 amount)',
  'function refundAborted(uint256 warId,uint256 id,address recipient) returns (uint256 flashOut)',
]);

export const warRouter = parseAbi([
  'function currentEntryFee() view returns (uint256)',
  `function submitWithEth((string name,string symbol) input,uint8 pair,address quote,${SHAPE} shape,uint256 minFlashOut) payable returns (uint256 candidateId)`,
  `function submitWithToken((string name,string symbol) input,uint8 pair,address quote,${SHAPE} shape,address tokenIn,uint256 amountIn,uint256 minFlashOut) returns (uint256 candidateId)`,
  'function backWithEth(uint256 candidateId,uint256 minFlashOut,uint256 minUnits,address recipient) payable returns (uint256 spent,uint256 units)',
  'function backWithToken(uint256 candidateId,address tokenIn,uint256 amountIn,uint256 minFlashOut,uint256 minUnits,address recipient) returns (uint256 spent,uint256 units)',
]);

// ---------------------------------------------------------------- treasury-v3, revenue share, migrator

export const treasuryFactory = parseAbi([
  'function predictTreasury(address token) view returns (address)',
  'function isTreasury(address account) view returns (bool)',
]);

export const treasury = parseAbi([
  'function token() view returns (address)',
  'function quote() view returns (address)',
  'function controller() view returns (address)',
  'function mode() view returns (uint8)',
  'function rewardAsset() view returns (address)',
]);

/** FlashRevenueShareV2 (ERC-1967 proxy): FLASH in, one full-range churn position, ETH out. */
export const revenueShareV2 = parseAbi([
  'function flash() view returns (address)',
  'function weth() view returns (address)',
  'function churn() view returns (address)',
  'function marketId() view returns (bytes32)',
  'function owner() view returns (address)',
  'function MIN_DEPOSIT() view returns (uint256)',
  'function pendingEth(address account) view returns (uint256)',
  'function flashOf(address account) view returns (uint256)',
  'function previewDeposit(uint256 amount) view returns (uint256)',
  'function accountOf(address account) view returns (uint256 shares,uint256 debt,uint256 owed,uint64 epoch)',
  'function totals() view returns (uint256 flashInPool,uint256 flashInChurn,uint256 totalShares,uint256 ethDistributed,uint256 ethPaid,uint256 flashRewarded,uint64 epoch,uint256 positionId)',
  'function deposit(uint256 amount) returns (uint256 shares)',
  'function claim(address to) returns (uint256 eth)',
  'function withdraw(uint256 sharesToBurn,address to) returns (uint256 eth)',
  'function addAssetReward(bytes32 marketId,uint256 amount) returns (uint256 received)',
  'function flush()',
  'function harvest()',
  'error BelowMinimum()',
  'error ZeroShares()',
  'error WrongMarket()',
  'error NothingToWithdraw()',
  'error ChurnUnavailable()',
  'error Protected()',
]);

/** FlashPoolStaking: the RETIRED Revenue Share vault. No new revenue; withdraw-only for its remaining holders. */
export const revenueShareRetired = parseAbi([
  'function token() view returns (address)',
  'function quoteToken() view returns (address)',
  'function rewardToken() view returns (address)',
  'function claimableRewards(address account) view returns (uint256)',
  'function claimableTokenRewards(address account) view returns (uint256)',
  'function totalAssets() view returns (uint256)',
  'function totalShares() view returns (uint256)',
  'function flashFeeBps() view returns (uint16)',
  'function sharesOf(address) view returns (uint256)',
  'function principalOf(address) view returns (uint256)',
  'function claimableQuoteRewards(address) view returns (uint256)',
  'function convertToShares(uint256) view returns (uint256)',
  'function convertToAssets(uint256) view returns (uint256)',
  'function deposit(uint256 assets,address receiver) returns (uint256)',
  'function withdraw(uint256 shares,address receiver) returns (uint256)',
  'function claimQuoteRewards(address receiver) returns (uint256)',
  'function claimRewards(address receiver) returns (uint256)',
  'function claimTokenRewards(address receiver) returns (uint256)',
]);

export { POOL_KEY, SHAPE, LATTICE_PARAMS };
