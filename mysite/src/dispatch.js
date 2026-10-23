import React, { useState, useEffect } from 'react';
import Nav from './navbar';
import Footer from "./footer";
import { auth, db } from './firebase';
import { collection, getDocs, query, where, addDoc, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import './App.css';

function Dispatch() {
    const [commodity, setCommodity] = useState("");
    const [availableBatches, setAvailableBatches] = useState([]);
    const [selectedBatchId, setSelectedBatchId] = useState("");
    const [dispatchQty, setDispatchQty] = useState("");
    const [destinationFps, setDestinationFps] = useState("");
    const [fifoReason, setFifoReason] = useState("");
    const [loadingBatches, setLoadingBatches] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const todayStr = new Date().toISOString().split('T')[0];

    // Fetch eligible, non-expired batches sorted by FIFO (oldest first)
    useEffect(() => {
        if (!commodity) {
            setAvailableBatches([]);
            setSelectedBatchId("");
            setFifoReason("");
            return;
        }

        const fetchBatches = async () => {
            setLoadingBatches(true);
            try {
                const q = query(
                    collection(db, "batches"),
                    where("commodity", "==", commodity)
                );

                const querySnapshot = await getDocs(q);
                const batchList = [];

                querySnapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const remaining = parseFloat(data.remainingQuantity) || 0;
                    const status = (data.qualityStatus || "").toLowerCase();
                    const isEligible = status === "eligible";

                    // Exclude expired stock
                    const expiry = data.expiryDate;
                    const isExpired = expiry && expiry < todayStr;

                    if (remaining > 0 && isEligible && !isExpired) {
                        batchList.push({
                            id: docSnap.id,
                            ...data,
                            remainingQuantity: remaining
                        });
                    }
                });

                // Sort oldest receipt date first (FIFO)
                batchList.sort((a, b) => new Date(a.receiptDate) - new Date(b.receiptDate));
                setAvailableBatches(batchList);

                // Auto-select the oldest batch by default (FIFO priority)
                if (batchList.length > 0) {
                    setSelectedBatchId(batchList[0].id);
                } else {
                    setSelectedBatchId("");
                }
            } catch (error) {
                console.error("Error fetching batches for dispatch: ", error);
            } finally {
                setLoadingBatches(false);
            }
        };

        fetchBatches();
    }, [commodity, todayStr]);

    // Check if user selected a batch other than the top FIFO recommended batch
    const fifoRecommendedBatchId = availableBatches.length > 0 ? availableBatches[0].id : "";
    const isFifoViolation = selectedBatchId && fifoRecommendedBatchId && selectedBatchId !== fifoRecommendedBatchId;

    const requestedQty = parseFloat(dispatchQty) || 0;
    const selectedBatch = availableBatches.find(b => b.id === selectedBatchId);
    const totalAvailableStock = availableBatches.reduce((acc, b) => acc + b.remainingQuantity, 0);

    // Multi-batch allocation preview
    const getBatchAllocationPreview = () => {
        if (requestedQty <= 0 || availableBatches.length === 0) return [];
        
        if (selectedBatch && requestedQty <= selectedBatch.remainingQuantity && !isFifoViolation) {
            return [{
                batchId: selectedBatch.batchId,
                amount: requestedQty,
                unit: selectedBatch.unit || 'kg'
            }];
        }

        let remainingToAllocate = requestedQty;
        const allocation = [];

        const processingList = isFifoViolation && selectedBatch 
            ? [selectedBatch, ...availableBatches.filter(b => b.id !== selectedBatch.id)]
            : availableBatches;

        for (let batch of processingList) {
            if (remainingToAllocate <= 0) break;
            const take = Math.min(batch.remainingQuantity, remainingToAllocate);
            if (take <= 0) continue;
            allocation.push({
                batchId: batch.batchId,
                amount: take,
                unit: batch.unit || 'kg'
            });
            remainingToAllocate -= take;
        }
        return allocation;
    };

    const allocationPreview = getBatchAllocationPreview();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (requestedQty <= 0) {
            alert("Please enter a valid dispatch quantity.");
            return;
        }

        // Edge Case: Not enough total stock in the godown across all eligible batches
        if (requestedQty > totalAvailableStock) {
            alert(
                `Insufficient Stock Error!\n\n` +
                `Requested: ${requestedQty} kg\n` +
                `Total Available Eligible Stock: ${totalAvailableStock} kg\n\n` +
                `Shortfall: ${(requestedQty - totalAvailableStock).toFixed(2)} kg.\n` +
                `Please reduce the dispatch quantity or inward new stock before fulfilling this order.`
            );
            return;
        }

        if (isFifoViolation && !fifoReason.trim()) {
            alert("FIFO Exception Detected: You must state a valid reason for bypassing the recommended FIFO batch.");
            return;
        }

        setSubmitting(true);

        try {
            const currentUser = auth.currentUser;
            let userName = currentUser ? currentUser.displayName || "Warehouse Officer" : "System";
            let userRole = "Manager";

            if (currentUser) {
                try {
                    const userDocRef = doc(db, "users", currentUser.uid);
                    const docSnap = await getDoc(userDocRef);
                    if (docSnap.exists()) {
                        userName = docSnap.data().name || userName;
                        userRole = docSnap.data().role || userRole;
                    }
                } catch (err) {
                    console.error("Error fetching user profile:", err);
                }
            }

            let remNeeded = requestedQty;
            const batchBreakdownSummary = [];

            const batchesToProcess = isFifoViolation && selectedBatch 
                ? [selectedBatch, ...availableBatches.filter(b => b.id !== selectedBatch.id)]
                : availableBatches;

            for (let batch of batchesToProcess) {
                if (remNeeded <= 0) break;

                const takeQty = Math.min(batch.remainingQuantity, remNeeded);
                if (takeQty <= 0) continue;

                const newRemaining = batch.remainingQuantity - takeQty;

                const batchRef = doc(db, "batches", batch.id);
                await updateDoc(batchRef, { remainingQuantity: newRemaining });

                batchBreakdownSummary.push(`${takeQty} kg from Batch ${batch.batchId}`);
                remNeeded -= takeQty;
            }

            const breakdownText = batchBreakdownSummary.join(" + ");

            // Record consolidated dispatch entry
            await addDoc(collection(db, "dispatches"), {
                commodity: commodity,
                quantityDispatched: requestedQty,
                destinationFps: destinationFps,
                dispatchDate: todayStr,
                isFifoBypassed: isFifoViolation,
                fifoExceptionReason: isFifoViolation ? fifoReason.trim() : "N/A (Standard FIFO followed)",
                batchBreakdown: batchBreakdownSummary,
                dispatchSummaryText: `Dispatched ${requestedQty} kg total (${breakdownText}) to ${destinationFps}`,
                dispatchedBy: userName,
                dispatchedByRole: userRole,
                timestamp: serverTimestamp()
            });

            alert(`Stock dispatched successfully!\nBreakdown: ${breakdownText}\nDestination: ${destinationFps}`);

            // Reset Form
            setCommodity("");
            setSelectedBatchId("");
            setDispatchQty("");
            setDestinationFps("");
            setFifoReason("");
            setAvailableBatches([]);
        } catch (error) {
            console.error("Error performing stock dispatch: ", error);
            alert("Failed to process dispatch. Check console for details.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ textAlign: "left", minHeight: "100vh", position: "relative", paddingBottom: "60px" }}>
            <Nav />

            <main className="container" style={{ maxWidth: "850px" }}>


                <form className="form-card" onSubmit={handleSubmit}>
                    <h2 className="section-title">Batch Selection &amp; Delivery Challan</h2>

                    <div className="form-grid">
                        <div className="field">
                            <label htmlFor="commodity">Commodity Name *</label>
                            <select 
                                id="commodity" 
                                className="select" 
                                value={commodity}
                                onChange={(e) => setCommodity(e.target.value)}
                                required
                            >
                                <option value="">Select commodity</option>
                                <option value="Wheat">Wheat</option>
                                <option value="Rice">Rice</option>
                                <option value="Sugar">Sugar</option>
                                <option value="Salt">Salt</option>
                                <option value="Oil">Oil</option>
                                <option value="Chana">Chana</option>
                                <option value="Tuvar Dal">Tuvar Dal</option>
                            </select>
                        </div>

                        <div className="field">
                            <label htmlFor="batch">Select Batch (FIFO Auto-Prioritized) *</label>
                            <select 
                                id="batch" 
                                className="select" 
                                value={selectedBatchId}
                                onChange={(e) => setSelectedBatchId(e.target.value)}
                                required
                                disabled={!commodity || loadingBatches}
                            >
                                {!commodity ? (
                                    <option value="">Select commodity first</option>
                                ) : loadingBatches ? (
                                    <option value="">Loading batches...</option>
                                ) : availableBatches.length === 0 ? (
                                    <option value="">No eligible stock available</option>
                                ) : (
                                    availableBatches.map((batchItem, index) => (
                                        <option key={batchItem.id} value={batchItem.id}>
                                            {batchItem.batchId} - {batchItem.remainingQuantity} {batchItem.unit || 'kg'} available (Recd: {batchItem.receiptDate}) {index === 0 ? '★ FIFO Recommended' : ''}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        <div className="field">
                            <label htmlFor="quantity">Dispatch Quantity (kg) *</label>
                            <input
                                type="number"
                                id="quantity"
                                className="input"
                                min="0.01"
                                step="0.01"
                                placeholder="Enter quantity"
                                value={dispatchQty}
                                onChange={(e) => setDispatchQty(e.target.value)}
                                required
                                disabled={!commodity || availableBatches.length === 0}
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="destination">Fair Price Shop (FPS) ID / Destination *</label>
                            <input
                                type="text"
                                id="destination"
                                className="input"
                                placeholder="e.g. FPS-1042 / Sector 6 Centre"
                                value={destinationFps}
                                onChange={(e) => setDestinationFps(e.target.value)}
                                required
                            />
                        </div>

                        {/* Conditional FIFO Exception Input Box: Appears only if FIFO recommended batch is bypassed */}
                        {isFifoViolation && (
                            <div className="field full-width" style={{ marginTop: "10px" }}>
                                <label htmlFor="fifoReason" style={{ color: "#ff9800" }}>
                                    ⚠️ FIFO Override Exception Reason *
                                </label>
                                <input
                                    type="text"
                                    id="fifoReason"
                                    className="input"
                                    placeholder="e.g. Damaged packaging in older batch / Urgent request for specific quality"
                                    value={fifoReason}
                                    onChange={(e) => setFifoReason(e.target.value)}
                                    required
                                    style={{
                                        borderColor: "#ff9800",
                                        background: "#1c1408"
                                    }}
                                />
                                <span style={{ color: "#ff9800", fontSize: "12px", marginTop: "4px", display: "block" }}>
                                    Notice: You are overriding the oldest eligible FIFO batch. A valid exception reason is required for audit logs.
                                </span>
                            </div>
                        )}

                        {/* Allocation Preview Breakdown */}
                        {allocationPreview.length > 0 && (
                            <div className="field full-width" style={{ background: "#110e0e", border: "1px dashed rgb(174, 128, 43)", padding: "15px", borderRadius: "8px" }}>
                                <label style={{ color: "rgb(174, 128, 43)", fontWeight: "bold", marginBottom: "8px", display: "block" }}>
                                    ⚡ Batch Allocation Breakdown:
                                </label>
                                <ul style={{ margin: 0, paddingLeft: "20px", color: "#b0bec5", fontSize: "14px" }}>
                                    {allocationPreview.map((item, idx) => (
                                        <li key={idx} style={{ marginBottom: "4px" }}>
                                            Pulling <strong style={{ color: "#fff" }}>{item.amount} {item.unit}</strong> from <span style={{ color: "rgb(210, 160, 60)" }}>Batch {item.batchId}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="buttons">
                        <button 
                            type="button" 
                            className="clear-btn"
                            onClick={() => {
                                setCommodity("");
                                setSelectedBatchId("");
                                setDispatchQty("");
                                setDestinationFps("");
                                setFifoReason("");
                                setAvailableBatches([]);
                            }}
                        >
                            Clear Form
                        </button>
                        <button type="submit" className="save-btn" disabled={submitting || !commodity || availableBatches.length === 0}>
                            {submitting ? "Processing Dispatch..." : "Confirm Dispatch"}
                        </button>
                    </div>
                </form>
            </main>

            <Footer />
        </div>
    );
}

export default Dispatch;