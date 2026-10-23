import React, { useState, useEffect } from 'react';
import Nav from './navbar';
import Footer from "./footer";
import { auth, db } from './firebase';
import { collection, getDocs, query, where, addDoc, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
                // Fetch all documents from batches to ensure case-insensitive matching and robust unit parsing
                const querySnapshot = await getDocs(collection(db, "batches"));
                const batchList = [];

                querySnapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    
                    // 1. Case-insensitive commodity matching (fixes "oil" vs "Oil")
                    const docCommodity = (data.commodity || "").trim().toLowerCase();
                    const targetCommodity = (commodity || "").trim().toLowerCase();

                    if (docCommodity !== targetCommodity) return;

                    // 2. Safe quantity parsing (extracts number from strings like "1233 litre" or "3 quintal")
                    let remaining = 0;
                    if (typeof data.remainingQuantity === 'number') {
                        remaining = data.remainingQuantity;
                    } else if (typeof data.remainingQuantity === 'string') {
                        const parsed = parseFloat(data.remainingQuantity.replace(/[^0-9.]/g, ''));
                        remaining = isNaN(parsed) ? 0 : parsed;
                    }

                    // 3. Quality status check (handles 'quality' or 'qualityStatus', case-insensitive, ignoring rejected)
                    const status = (data.quality || data.qualityStatus || "eligible").toLowerCase();
                    const isEligible = status !== "rejected";

                    // 4. Exclude expired stock
                    const expiry = data.expiryDate;
                    const isExpired = expiry && expiry < todayStr;

                    if (remaining > 0 && isEligible && !isExpired) {
                        batchList.push({
                            id: docSnap.id,
                            ...data,
                            batchId: data.batchId || docSnap.id,
                            remainingQuantity: remaining,
                            receiptDate: data.receiptDate || data.recdDate || data.arrivalDate || "2026-01-01"
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
                unit: selectedBatch.unit || 'kg',
                receiptDate: selectedBatch.receiptDate
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
                unit: batch.unit || 'kg',
                receiptDate: batch.receiptDate
            });
            remainingToAllocate -= take;
        }
        return allocation;
    };

    const allocationPreview = getBatchAllocationPreview();

    // Unique Professional Challan ID Generator
    const generateUniqueChallanId = (commodityName) => {
        const today = new Date();
        const yearMonth = today.toISOString().slice(0, 7).replace('-', ''); // e.g., "202610"
        const commPrefix = (commodityName || "GEN").slice(0, 3).toUpperCase(); // e.g., "WHE"
        const randomSeq = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
        return `CHAL-${yearMonth}-${commPrefix}-${randomSeq}`;
    };

    // PDF Delivery Challan Generation Function
    const generatePDFChallan = (challanId, commodityName, totalQuantity, destination, breakdownItems, dispatcher, dispatcherRole, exceptionReason) => {
        const docPDF = new jsPDF();

        // 1. Header & Title Block
        docPDF.setFillColor(27, 22, 22);
        docPDF.rect(0, 0, 210, 40, 'F');

        docPDF.setTextColor(174, 128, 43);
        docPDF.setFontSize(20);
        docPDF.setFont('helvetica', 'bold');
        docPDF.text("ANNARAKSHAK (iPDS)", 14, 18);

        docPDF.setFontSize(10);
        docPDF.setTextColor(255, 255, 255);
        docPDF.text("OFFICIAL DELIVERY CHALLAN & DISPATCH RECEIPT", 14, 26);
        docPDF.setFontSize(8);
        docPDF.setTextColor(180, 180, 180);
        docPDF.text("Smart Commodity Stock Allocation & FIFO Management System", 14, 32);

        // 2. Metadata Grid
        docPDF.setTextColor(0, 0, 0);
        docPDF.setFontSize(10);
        docPDF.setFont('helvetica', 'bold');

        docPDF.text(`Challan No: ${challanId}`, 14, 50);
        docPDF.text(`Date & Time: ${new Date().toLocaleString()}`, 110, 50);
        docPDF.text(`Commodity: ${commodityName}`, 14, 58);
        docPDF.text(`Destination (FPS ID): ${destination}`, 110, 58);
        docPDF.text(`Dispatched By: ${dispatcher} (${dispatcherRole})`, 14, 66);
        docPDF.text(`FIFO Override: ${exceptionReason ? 'YES (Bypassed)' : 'NO (Compliant)'}`, 110, 66);

        if (exceptionReason) {
            docPDF.setTextColor(180, 80, 0);
            docPDF.text(`Override Reason: ${exceptionReason}`, 14, 74);
            docPDF.setTextColor(0, 0, 0);
        }

        // 3. Batch Breakdown Table
        const tableRows = breakdownItems.map((item, index) => [
            index + 1,
            item.batchId,
            item.receiptDate || 'N/A',
            `${item.amount} ${item.unit}`
        ]);

        autoTable(docPDF, {
            startY: exceptionReason ? 82 : 74,
            head: [['S.No', 'Batch ID', 'Receipt Date', 'Quantity Dispatched']],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [27, 22, 22], textColor: [174, 128, 43], fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 4 }
        });

        // 4. Total Summary Block
        const finalY = (docPDF.lastAutoTable ? docPDF.lastAutoTable.finalY : 120) + 12;
        docPDF.setFont('helvetica', 'bold');
        docPDF.setFontSize(11);
        docPDF.text(`Total Dispatched Quantity: ${totalQuantity} kg`, 14, finalY);

        // 5. Signatures Footer
        docPDF.setFontSize(9);
        docPDF.setFont('helvetica', 'normal');
        docPDF.text("_________________________", 14, finalY + 25);
        docPDF.text("Warehouse Officer Signature", 14, finalY + 30);

        docPDF.text("_________________________", 130, finalY + 25);
        docPDF.text("FPS Receiving Officer Stamp", 130, finalY + 30);

        docPDF.setFontSize(8);
        docPDF.setTextColor(120, 120, 120);
        docPDF.text("This document is dynamically generated by AnnaRakshak iPDS and verified via Cloud Audit Logs.", 14, 285);

        // Trigger Download
        docPDF.save(`${challanId}.pdf`);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (requestedQty <= 0) {
            alert("Please enter a valid dispatch quantity.");
            return;
        }

        // Edge Case: Stock shortfall check
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
            const challanId = generateUniqueChallanId(commodity);

            // Record consolidated dispatch entry in Firestore
            await addDoc(collection(db, "dispatches"), {
                challanId: challanId,
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

            // Generate & Download PDF Challan
            generatePDFChallan(
                challanId,
                commodity,
                requestedQty,
                destinationFps,
                allocationPreview,
                userName,
                userRole,
                isFifoViolation ? fifoReason.trim() : null
            );

            alert(`Stock dispatched successfully!\nChallan ID: ${challanId} downloaded.\nDestination: ${destinationFps}`);

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

                        {/* Conditional FIFO Exception Reason Input */}
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
                                    ⚡ Batch Allocation Breakdown (PDF Challan Ready):
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
                            {submitting ? "Generating PDF & Dispatching..." : "Confirm & Generate PDF Challan"}
                        </button>
                    </div>
                </form>
            </main>

            <Footer />
        </div>
    );
}

export default Dispatch;