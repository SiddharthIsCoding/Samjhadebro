const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

exports.processDispatch = onRequest({ cors: true }, async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).send({ error: "Method Not Allowed" });
    }

    const { commodity, requestedQty, destinationFps, isFifoBypassed, fifoExceptionReason, selectedBatchId } = req.body;
    
    // Basic validation
    if (!commodity || !requestedQty || requestedQty <= 0 || !destinationFps) {
        return res.status(400).send({ error: "Invalid dispatch parameters." });
    }

    try {
        const result = await db.runTransaction(async (transaction) => {
            const todayStr = new Date().toISOString().split('T')[0];
            
            // 1. Fetch eligible batches inside transaction
            const batchesSnapshot = await transaction.get(db.collection("batches"));
            let batchList = [];

            batchesSnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const docCommodity = (data.commodity || "").trim().toLowerCase();
                if (docCommodity !== commodity.trim().toLowerCase()) return;

                const remaining = typeof data.remainingQuantity === 'number' ? data.remainingQuantity : parseFloat(data.remainingQuantity) || 0;
                const status = (data.quality || data.qualityStatus || "eligible").toLowerCase();
                const isEligible = status !== "rejected";
                const isExpired = data.expiryDate && data.expiryDate < todayStr;

                if (remaining > 0 && isEligible && !isExpired) {
                    batchList.push({
                        id: docSnap.id,
                        ref: docSnap.ref,
                        ...data,
                        batchId: data.batchId || docSnap.id,
                        remainingQuantity: remaining,
                        receiptDate: data.receiptDate || data.recdDate || data.arrivalDate || "2026-01-01"
                    });
                }
            });

            // Sort FIFO (oldest first)
            batchList.sort((a, b) => new Date(a.receiptDate) - new Date(b.receiptDate));

            const totalAvailable = batchList.reduce((acc, b) => acc + b.remainingQuantity, 0);
            if (requestedQty > totalAvailable) {
                throw new Error(`Insufficient stock. Requested: ${requestedQty}, Available: ${totalAvailable}`);
            }

            // Handle FIFO violation ordering if user overrode top batch
            const fifoRecommendedId = batchList.length > 0 ? batchList[0].id : "";
            const isViolation = selectedBatchId && fifoRecommendedId && selectedBatchId !== fifoRecommendedId;

            if (isViolation && !fifoExceptionReason) {
                throw new Error("FIFO Exception reason is mandatory for overrides.");
            }

            let processingList = batchList;
            if (isViolation) {
                const targetBatch = batchList.find(b => b.id === selectedBatchId);
                if (targetBatch) {
                    processingList = [targetBatch, ...batchList.filter(b => b.id !== selectedBatchId)];
                }
            }

            let remNeeded = requestedQty;
            const batchBreakdownSummary = [];
            const allocationPreview = [];

            // 2. Perform atomic updates on batch documents
            for (let batch of processingList) {
                if (remNeeded <= 0) break;
                const takeQty = Math.min(batch.remainingQuantity, remNeeded);
                if (takeQty <= 0) continue;

                const newRemaining = batch.remainingQuantity - takeQty;
                transaction.update(batch.ref, { remainingQuantity: newRemaining });

                batchBreakdownSummary.push(`${takeQty} kg from Batch ${batch.batchId}`);
                allocationPreview.push({
                    batchId: batch.batchId,
                    amount: takeQty,
                    unit: batch.unit || 'kg',
                    receiptDate: batch.receiptDate
                });
                remNeeded -= takeQty;
            }

            // 3. Generate Challan ID and record dispatch log
            const today = new Date();
            const yearMonth = today.toISOString().slice(0, 7).replace('-', '');
            const commPrefix = commodity.slice(0, 3).toUpperCase();
            const randomSeq = Math.floor(1000 + Math.random() * 9000);
            const challanId = `CHAL-${yearMonth}-${commPrefix}-${randomSeq}`;

            const dispatchRef = db.collection("dispatches").doc();
            transaction.set(dispatchRef, {
                challanId,
                commodity,
                quantityDispatched: requestedQty,
                destinationFps,
                dispatchDate: todayStr,
                isFifoBypassed: isViolation,
                fifoExceptionReason: isViolation ? fifoExceptionReason.trim() : "N/A (Standard FIFO followed)",
                batchBreakdown: batchBreakdownSummary,
                dispatchSummaryText: `Dispatched ${requestedQty} kg total (${batchBreakdownSummary.join(" + ")}) to ${destinationFps}`,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            return { challanId, allocationPreview };
        });

        return res.status(200).send({ success: true, ...result });
    } catch (error) {
        return res.status(400).send({ error: error.message });
    }
});

