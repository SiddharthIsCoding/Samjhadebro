import React, { useState, useEffect } from 'react';
import Nav from './navbar';
import Footer from "./footer";
import { auth, db } from './firebase';
import { collection, getDocs, query, where, addDoc, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import './App.css';

function Dispatch() {
    const [commodity, setCommodity] = useState("");
    const [availableBatches, setAvailableBatches] = useState([]);
    const [dispatchQty, setDispatchQty] = useState("");
    const [destinationFps, setDestinationFps] = useState("");
    const [loadingBatches, setLoadingBatches] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const todayStr = new Date().toISOString().split('T')[0];

    // Fetch eligible, non-expired batches sorted by FIFO (oldest first)
    useEffect(() => {
        if (!commodity) {
            setAvailableBatches([]);
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

                    // Case 3 Guardrail: Exclude expired stock
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
            } catch (error) {
                console.error("Error fetching batches for dispatch: ", error);
            } finally {
                setLoadingBatches(false);
            }
        };

        fetchBatches();
    }, [commodity, todayStr]);

    // Calculate total stock available across all eligible batches for this commodity
    const totalAvailableStock = availableBatches.reduce((acc, b) => acc + b.remainingQuantity, 0);
    const requestedQty = parseFloat(dispatchQty) || 0;

    // Preview FIFO multi-batch allocation breakdown as user types quantity
    const getBatchAllocationPreview = () => {
        if (requestedQty <= 0 || availableBatches.length === 0) return [];
        let remainingToAllocate = requestedQty;
        const allocation = [];

        for (let batch of availableBatches) {
            if (remainingToAllocate <= 0) break;
            const take = Math.min(batch.remainingQuantity, remainingToAllocate);
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

        if (requestedQty > totalAvailableStock) {
            alert(`Requested quantity (${requestedQty} kg) exceeds total available eligible stock (${totalAvailableStock} kg).`);
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

            // Perform Multi-Batch FIFO Allocation Loop (Case 1)
            let remNeeded = requestedQty;
            const batchBreakdownSummary = [];

            for (let batch of availableBatches) {
                if (remNeeded <= 0) break;

                const takeQty = Math.min(batch.remainingQuantity, remNeeded);
                const newRemaining = batch.remainingQuantity - takeQty;

                // Update individual batch document remaining stock in Firestore
                const batchRef = doc(db, "batches", batch.id);
                await updateDoc(batchRef, { remainingQuantity: newRemaining });

                batchBreakdownSummary.push(`${takeQty} kg from Batch ${batch.batchId}`);
                remNeeded -= takeQty;
            }

            const breakdownText = batchBreakdownSummary.join(" + ");

            // Record consolidated dispatch audit entry
            await addDoc(collection(db, "dispatches"), {
                commodity: commodity,
                quantityDispatched: requestedQty,
                destinationFps: destinationFps,
                dispatchDate: todayStr,
                batchBreakdown: batchBreakdownSummary,
                dispatchSummaryText: `Dispatched ${requestedQty} kg total (${breakdownText}) to ${destinationFps}`,
                dispatchedBy: userName,
                dispatchedByRole: userRole,
                timestamp: serverTimestamp()
            });

            alert(`Stock dispatched successfully via FIFO chain!\nBreakdown: ${breakdownText}\nDestination: ${destinationFps}`);

            // Reset Form
            setCommodity("");
            setDispatchQty("");
            setDestinationFps("");
            setAvailableBatches([]);
        } catch (error) {
            console.error("Error performing split stock dispatch: ", error);
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
                    <h2 className="section-title">Multi-Batch FIFO Allocation &amp; Delivery Challan</h2>

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
                            <label>Total Eligible Stock Available</label>
                            <div className="input" style={{ background: "#110e0e", color: commodity ? "#4CAF50" : "#8294aa", display: "flex", alignItems: "center" }}>
                                {loadingBatches ? "Calculating..." : commodity ? `${totalAvailableStock} kg across ${availableBatches.length} batch(es)` : "Select commodity first"}
                            </div>
                        </div>

                        <div className="field">
                            <label htmlFor="quantity">Dispatch Quantity (kg) *</label>
                            <input
                                type="number"
                                id="quantity"
                                className="input"
                                min="0.01"
                                step="0.01"
                                placeholder="Enter total quantity"
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

                        {/* Real-time FIFO Multi-Batch Split Allocation Preview */}
                        {allocationPreview.length > 0 && (
                            <div className="field full-width" style={{ background: "#110e0e", border: "1px dashed rgb(174, 128, 43)", padding: "15px", borderRadius: "8px" }}>
                                <label style={{ color: "rgb(174, 128, 43)", fontWeight: "bold", marginBottom: "8px", display: "block" }}>
                                    FIFO Split-Batch Allocation Preview:
                                </label>
                                <ul style={{ margin: 0, paddingLeft: "20px", color: "#b0bec5", fontSize: "14px" }}>
                                    {allocationPreview.map((item, idx) => (
                                        <li key={idx} style={{ marginBottom: "4px" }}>
                                            Pulling <strong style={{ color: "#fff" }}>{item.amount} {item.unit}</strong> from <span style={{ color: "rgb(210, 160, 60)" }}>Batch {item.batchId}</span> {idx === 0 ? "(Oldest FIFO)" : `(${idx + 1}${idx === 1 ? 'nd' : idx === 2 ? 'rd' : 'th'} Oldest)`}
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
                                setDispatchQty("");
                                setDestinationFps("");
                                setAvailableBatches([]);
                            }}
                        >
                            Clear Form
                        </button>
                        {/* Case 2: Double-Submit Protection */}
                        <button type="submit" className="save-btn" disabled={submitting || !commodity || availableBatches.length === 0}>
                            {submitting ? "Processing Dispatch..." : "Confirm Split Dispatch"}
                        </button>
                    </div>
                </form>
            </main>

            <Footer />
        </div>
    );
}

export default Dispatch;