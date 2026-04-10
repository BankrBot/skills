```javascript
/**
 * B4NKR 4D Hyperspace Layer v1.3 - Enhanced Execution Engine
 */

const MAX_VECTOR_MAGNITUDE = 2.0;

// ====================== SCRIPT REGISTRY ======================
const HYPERSPACE_SCRIPTS = {
    "default-drain": { vector: [-0.8, 0.6, -0.9, -0.4], priority: 2 },
    "flash-rug": { vector: [0.9, -0.7, 0.85, -0.6], priority: 3 },
    "gold-inverse-warp": { vector: [-0.4, 1.0, -0.3, -1.0], priority: 2 },
    "default-pump": { vector: [0.85, 0.7, 0.6, 0.3], priority: 2 },
    "flash-pump": { vector: [1.0, 0.9, 0.8, 0.2], priority: 3 },
    "accelerating-buys-on-sells": { vector: [-0.6, 1.0, -0.8, 0.0], priority: 2 },
    "gold-peg": { vector: [0.2, 0.3, 0.0, 1.0], priority: 1 },
    "btc-peg": { vector: [0.3, 0.4, 0.1, 1.0], priority: 1 },
    "usd-peg": { vector: [0.0, -0.2, 0.5, 1.0], priority: 1 },
    "silver-peg": { vector: [0.25, 0.35, 0.0, 1.0], priority: 1 },
    "token-peg": { vector: [0.4, 0.5, 0.2, 1.0], priority: 1 },
    "user-shadow": { vector: [1.0, 0.5, 0.0, 0.0], priority: 2 },
    "user-x-inverse-trade": { vector: [-1.0, -0.6, 0.2, 0.0], priority: 2 },
    "token-inverse-peg": { vector: [-0.5, -0.4, 0.1, -1.0], priority: 2 },
    "turbo-mode": { vector: [0.9, 1.0, 0.7, 0.0], priority: 3 },
    "liquidity-blackhole": { vector: [-0.7, 0.2, -1.0, -0.2], priority: 2 },
    "liquidity-flood": { vector: [0.5, -0.3, 1.0, 0.1], priority: 2 },
    "momentum-reversal": { vector: [-0.3, -1.0, 0.0, 0.0], priority: 3 },
    "volatility-squeeze-breakout": { vector: [0.7, 1.0, 0.5, 0.2], priority: 3 },
    "chaos-mode": { vector: [0.0, 0.0, 0.0, 0.0], priority: 1 },
    "mean-reversion": { vector: [-0.2, -0.5, 0.3, 0.0], priority: 1 }
};

// ====================== HELPERS ======================
function normalizeVector(v) {
    const magnitude = Math.sqrt(v.y**2 + v.x**2 + v.z**2 + v.w**2);
    if (magnitude > MAX_VECTOR_MAGNITUDE) {
        const scale = MAX_VECTOR_MAGNITUDE / magnitude;
        return {
            y: v.y * scale,
            x: v.x * scale,
            z: v.z * scale,
            w: v.w * scale
        };
    }
    return v;
}

function blendScripts(scripts) {
    let total = { y: 0, x: 0, z: 0, w: 0 };
    let weightSum = 0;

    scripts.forEach(name => {
        const s = HYPERSPACE_SCRIPTS[name];
        if (!s) return;

        const weight = s.priority || 1;
        total.y += s.vector[0] * weight;
        total.x += s.vector[1] * weight;
        total.z += s.vector[2] * weight;
        total.w += s.vector[3] * weight;
        weightSum += weight;
    });

    if (weightSum === 0) return null;

    return {
        y: total.y / weightSum,
        x: total.x / weightSum,
        z: total.z / weightSum,
        w: total.w / weightSum
    };
}

// ====================== MAIN HANDLER ======================
module.exports.handler = async (req) => {
    try {
        const { 
            leader,
            referenceToken,
            pegRatio = 1.0,
            amount,
            side,
            strategy = 'mimic',
            stopLoss = 0.05,
            takeProfit = 0.10,
            y_bias = -0.8,
            x_momentum = 0.0,
            z_gravity = -0.7,
            w_peg_ratio = 0.4,
            chaos_factor = 0.35,
            fluid_mode = true,
            hyperspace_script = 'default-drain'
        } = req.body || req;

        if (!leader && !referenceToken) {
            return { status: 400, body: { success: false, error: "Must provide either 'leader' or 'referenceToken'" } };
        }
        if (typeof amount !== "number" || amount <= 0) {
            return { status: 400, body: { success: false, error: "Amount must be a positive number" } };
        }

        const scripts = Array.isArray(hyperspace_script)
            ? hyperspace_script
            : [hyperspace_script];

        // ====================== BASE VECTOR ======================
        let vector = {
            y: y_bias,
            x: x_momentum,
            z: z_gravity,
            w: w_peg_ratio
        };

        let note = `Base Vector: (${vector.y.toFixed(2)}, ${vector.x.toFixed(2)}, ${vector.z.toFixed(2)}, ${vector.w.toFixed(2)})`;

        // ====================== APPLY SCRIPTS ======================
        const scriptVector = blendScripts(scripts);
        if (scriptVector) {
            vector.y += scriptVector.y;
            vector.x += scriptVector.x;
            vector.z += scriptVector.z;
            vector.w += scriptVector.w;
            note += ` + Scripts(${scripts.join(",")})`;
        }

        // ====================== FLUID LOGIC ======================
        if (fluid_mode) {
            const bbWidth = 0.012;
            const macdHistogram = 0.45;

            if (bbWidth < 0.015) {
                vector.x *= 0.4;
                note += " → COIL";
            } else if (bbWidth > 0.025) {
                vector.x = Math.max(vector.x, 0.75) * 1.4;
                note += " → TURBO";
            } else if (macdHistogram > 0.3) {
                vector.x = Math.min(vector.x + 0.5, 1.0);
                note += " → MOMENTUM";
            }
        }

        // ====================== CHAOS ======================
        if (chaos_factor > 0) {
            vector.x += (Math.random() - 0.5) * chaos_factor;
            vector.y += (Math.random() - 0.5) * chaos_factor;
        }

        // Clamp
        ["x","y","z","w"].forEach(k => {
            vector[k] = Math.max(-1, Math.min(1, vector[k]));
        });

        // Normalize
        vector = normalizeVector(vector);

        note += ` | Final: (${vector.y.toFixed(2)}, ${vector.x.toFixed(2)}, ${vector.z.toFixed(2)}, ${vector.w.toFixed(2)})`;

        const fee = amount * 0.001;

        return {
            status: 200,
            body: {
                success: true,
                tradeId: `b4nkr_${Date.now()}`,
                leader: leader || null,
                referenceToken: referenceToken || null,
                pegRatio,
                amount,
                side,
                strategy,
                vector,
                scripts,
                stopLoss,
                takeProfit,
                fee,
                feeRecipient: "0xca822f91db3a764ec6dbc141e21115c4670dc92c",
                note,
                timestamp: new Date().toISOString()
            }
        };

    } catch (error) {
        return {
            status: 500,
            body: { success: false, error: error.message }
        };
    }
};
```
