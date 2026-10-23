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
    const [loadingBatches, setLoadingBatches] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!commodity) {
            setAvailableBatches([]);
            setSelectedBatchId("");
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
                    const remaining = parseFloat(data.remainingQuantity);
                    const isEligible = !data.qualityStatus || data.qualityStatus.toLowerCase() === "eligible";

                    if (remaining > 0 && isEligible) {
                        batchList.push({
                            id: docSnap.id,
                            ...data,
                            remainingQuantity: remaining
                        });
                    }
                });

                batchList.sort((a, b) => new Date(a.receiptDate) - new Date(b.receiptDate));
                setAvailableBatches(batchList);

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
    }, [commodity]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedBatchId) {
            alert("Please select a valid batch.");
            return;
        }

        const chosenBatch = availableBatches.find(b => b.id === selectedBatchId);
        const qtyToDispatch = parseFloat(dispatchQty);

        if (!chosenBatch) {
            alert("Batch not found.");
            return;
        }

        if (qtyToDispatch > chosenBatch.remainingQuantity) {
            alert(`Requested quantity (${qtyToDispatch} kg) exceeds available batch stock (${chosenBatch.remainingQuantity} kg).`);
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

            await addDoc(collection(db, "dispatches"), {
                commodity: commodity,
                batchDocId: chosenBatch.id,
                batchId: chosenBatch.batchId,
                quantityDispatched: qtyToDispatch,
                destinationFps: destinationFps,
                dispatchDate: new Date().toISOString().split('T')[0],
                dispatchedBy: userName,
                dispatchedByRole: userRole,
                timestamp: serverTimestamp() // Ensures precise sorting
            });

            const batchRef = doc(db, "batches", chosenBatch.id);
            const newRemaining = chosenBatch.remainingQuantity - qtyToDispatch;

            await updateDoc(batchRef, {
                remainingQuantity: newRemaining
            });

            alert(`Stock dispatched successfully!\nBatch ${chosenBatch.batchId} updated. Remaining stock: ${newRemaining} ${chosenBatch.unit || 'kg'}`);

            setCommodity("");
            setSelectedBatchId("");
            setDispatchQty("");
            setDestinationFps("");
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
            <main className="container">
                <div className="heading">
                    <h1>Dispatch Stock (iPDS)</h1>
                </div>

                <form className="form-card" onSubmit={handleSubmit}>
                    <h2 className="section-title">FIFO Allocation & Delivery Challan</h2>

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
                                    <option value="">No stock available</option>
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
                                setAvailableBatches([]);
                            }}
                        >
                            Clear Form
                        </button>
                        <button type="submit" className="save-btn" disabled={submitting}>
                            {submitting ? "Processing..." : "Confirm Dispatch"}
                        </button>
                    </div>
                </form>
            </main>
            <Footer />
        </div>
    );
}

export default Dispatch;