import React, { useState, useEffect } from 'react';
import Nav from './navbar';
import Footer from './footer';
import { db } from './firebase';
import { collection, getDocs, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './App.css';

function Dispatch() {
    const [commodities, setCommodities] = useState(["Wheat", "Rice", "Sugar", "Salt", "Oil", "Pulses"]);
    const [selectedCommodity, setSelectedCommodity] = useState("Wheat");
    const [eligibleBatches, setEligibleBatches] = useState([]);
    const [selectedBatchId, setSelectedBatchId] = useState("");
    const [dispatchQuantity, setDispatchQuantity] = useState("");
    const [destinationFPS, setDestinationFPS] = useState("");
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    // 1. Fetch batches from Firestore and filter for the selected commodity using FIFO prioritization
    useEffect(() => {
        const fetchBatches = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "batches"));
                const fetchedBatches = [];

                querySnapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    
                    // Normalize commodity name for case-insensitive matching
                    const docCommodity = (data.commodity || "").trim().toLowerCase();
                    const targetCommodity = (selectedCommodity || "").trim().toLowerCase();

                    // Safely parse remaining quantity (strips out strings like "litre", "kg", "quintal")
                    let remaining = 0;
                    if (typeof data.remainingQuantity === 'number') {
                        remaining = data.remainingQuantity;
                    } else if (typeof data.remainingQuantity === 'string') {
                        const parsed = parseFloat(data.remainingQuantity.replace(/[^0-9.]/g, ''));
                        remaining = isNaN(parsed) ? 0 : parsed;
                    }

                    // Check quality status (ignore rejected stock)
                    const qualityStatus = (data.quality || data.qualityStatus || "ELIGIBLE").toUpperCase();
                    const isEligible = qualityStatus !== "REJECTED";

                    if (docCommodity === targetCommodity && remaining > 0 && isEligible) {
                        fetchedBatches.push({
                            id: docSnap.id,
                            batchId: data.batchId || docSnap.id,
                            remainingQuantity: remaining,
                            recdDate: data.recdDate || data.arrivalDate || "2026-01-01",
                            godown: data.godown || "Main Godown",
                            supplier: data.supplier || "State Agency",
                            ...data
                        });
                    }
                });

                // Sort by FIFO: Oldest arrival date first (First In, First Out)
                fetchedBatches.sort((a, b) => new Date(a.recdDate) - new Date(b.recdDate));

                setEligibleBatches(fetchedBatches);
                if (fetchedBatches.length > 0) {
                    setSelectedBatchId(fetchedBatches[0].id);
                } else {
                    setSelectedBatchId("");
                }
            } catch (err) {
                console.error("Error fetching batches for dispatch:", err);
                setErrorMessage("Failed to load inventory batches from Firestore.");
            }
        };

        fetchBatches();
    }, [selectedCommodity]);

    // Handle Dispatch Form Submission & PDF Challan Generation
    const handleDispatchSubmit = async (e) => {
        e.preventDefault();
        setSuccessMessage("");
        setErrorMessage("");

        if (!selectedBatchId) {
            setErrorMessage("Please select an eligible batch for dispatch.");
            return;
        }

        const qtyToDispatch = parseFloat(dispatchQuantity);
        if (!qtyToDispatch || qtyToDispatch <= 0) {
            setErrorMessage("Please enter a valid dispatch quantity.");
            return;
        }

        if (!destinationFPS.trim()) {
            setErrorMessage("Please enter a destination Fair Price Shop (FPS) ID.");
            return;
        }

        const targetBatch = eligibleBatches.find(b => b.id === selectedBatchId);
        if (!targetBatch) {
            setErrorMessage("Selected batch no longer exists.");
            return;
        }

        if (qtyToDispatch > targetBatch.remainingQuantity) {
            setErrorMessage(`Dispatch quantity exceeds batch remaining stock (${targetBatch.remainingQuantity}).`);
            return;
        }

        setLoading(true);

        try {
            // Generate unique challan ID: CHAL-YYYYMM-COMM-XXXX
            const now = new Date();
            const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
            const randomCode = Math.floor(1000 + Math.random() * 9000);
            const challanId = `CHAL-${yearMonth}-${selectedCommodity.toUpperCase().substring(0, 3)}-${randomCode}`;

            // 1. Record dispatch log in Firestore
            const dispatchRecord = {
                challanId,
                commodity: selectedCommodity,
                batchId: targetBatch.batchId || targetBatch.id,
                quantityDispatched: qtyToDispatch,
                destinationFPS: destinationFPS.trim(),
                timestamp: Timestamp.now(),
                godown: targetBatch.godown,
                status: "Dispatched & Verified"
            };

            await addDoc(collection(db, "dispatches"), dispatchRecord);

            // 2. Update remaining quantity in the batch document
            const newRemaining = targetBatch.remainingQuantity - qtyToDispatch;
            const batchDocRef = doc(db, "batches", targetBatch.id);
            await updateDoc(batchDocRef, {
                remainingQuantity: newRemaining
            });

            // 3. Generate PDF Delivery Challan using jsPDF
            const docPdf = new jsPDF();
            
            // Header
            docPdf.setFontSize(18);
            docPdf.setTextColor(174, 128, 43); // Brand Gold Accent
            docPdf.text("AnnaRakshak - iPDS Official Delivery Challan", 14, 20);

            docPdf.setFontSize(10);
            docPdf.setTextColor(100, 100, 100);
            docPdf.text(`Generated on: ${now.toLocaleString()}`, 14, 27);

            // Challan Meta Table
            docPdf.autoTable({
                startY: 35,
                head: [['Challan Reference', 'Destination FPS', 'Godown Origin', 'Dispatch Date']],
                body: [[challanId, destinationFPS.trim(), targetBatch.godown, now.toLocaleDateString()]],
                theme: 'grid',
                headStyles: { fillColor: [174, 128, 43] }
            });

            // Commodity Details Table
            docPdf.autoTable({
                startY: docPdf.lastAutoTable.finalY + 10,
                head: [['Commodity', 'Batch ID', 'Source Arrival Date', 'Dispatched Quantity']],
                body: [[selectedCommodity, targetBatch.batchId || targetBatch.id, targetBatch.recdDate, `${qtyToDispatch} kg`]],
                theme: 'grid',
                headStyles: { fillColor: [30, 30, 30] }
            });

            // Footer notes
            const finalY = docPdf.lastAutoTable.finalY + 20;
            docPdf.setFontSize(9);
            docPdf.text("This is an electronically verified transit challan generated under the iPDS Smart Commodity framework.", 14, finalY);
            docPdf.text("Authorized Signatory / Warehouse Supervisor", 14, finalY + 15);

            // Save PDF
            docPdf.save(`${challanId}.pdf`);

            setSuccessMessage(`Successfully dispatched ${qtyToDispatch} kg of ${selectedCommodity}! Challan ${challanId} generated and downloaded.`);
            setDispatchQuantity("");
            setDestinationFPS("");

            // Refresh batch list locally
            setEligibleBatches(prev => prev.map(b => b.id === targetBatch.id ? { ...b, remainingQuantity: newRemaining } : b).filter(b => b.remainingQuantity > 0));

        } catch (err) {
            console.error("Error processing dispatch transaction:", err);
            setErrorMessage("Transaction failed. Please check your Firestore connection permissions.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ textAlign: "left", minHeight: "100vh", position: "relative", paddingBottom: "70px", backgroundColor: "#1b1616", color: "#fff" }}>
            <Nav />

            <main className="container" style={{ maxWidth: "900px" }}>
                <div className="heading">
                    <span style={{ background: "rgba(174, 128, 43, 0.2)", color: "rgb(174, 128, 43)", fontSize: "11px", fontWeight: "bold", padding: "4px 10px", borderRadius: "4px", letterSpacing: "1px" }}>
                        📦 FIFO ALLOCATION &amp; DISPATCH
                    </span>
                    <h1>Dispatch Stock (iPDS)</h1>
                    <p className="dashboard-subtext">FIFO batch prioritization with unique challan ID and automated PDF delivery challan</p>
                </div>

                <div className="form-card" style={{ padding: "30px", marginTop: "20px" }}>
                    <h2 className="section-title">Batch Selection &amp; Delivery Challan</h2>

                    {successMessage && (
                        <div style={{ background: "rgba(76, 175, 80, 0.15)", color: "#4CAF50", padding: "12px 16px", borderRadius: "6px", marginBottom: "20px", fontSize: "14px", border: "1px solid #4CAF50" }}>
                            {successMessage}
                        </div>
                    )}

                    {errorMessage && (
                        <div style={{ background: "rgba(244, 67, 54, 0.15)", color: "#f44336", padding: "12px 16px", borderRadius: "6px", marginBottom: "20px", fontSize: "14px", border: "1px solid #f44336" }}>
                            {errorMessage}
                        </div>
                    )}

                    <form onSubmit={handleDispatchSubmit}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "20px", marginBottom: "20px" }}>
                            
                            {/* Commodity Selection */}
                            <div>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "8px", color: "#b0bec5" }}>
                                    Commodity Name *
                                </label>
                                <select 
                                    value={selectedCommodity} 
                                    onChange={(e) => setSelectedCommodity(e.target.value)}
                                    style={{ width: "100%", padding: "12px", background: "#060505", border: "1px solid #333", color: "#fff", borderRadius: "6px" }}
                                >
                                    {commodities.map((comm, idx) => (
                                        <option key={idx} value={comm}>{comm}</option>
                                    ))}
                                </select>
                            </div>

                            {/* FIFO Auto-Prioritized Batch Dropdown */}
                            <div>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "8px", color: "#b0bec5" }}>
                                    Select Batch (FIFO Auto-Prioritized) *
                                </label>
                                <select 
                                    value={selectedBatchId} 
                                    onChange={(e) => setSelectedBatchId(e.target.value)}
                                    style={{ width: "100%", padding: "12px", background: "#060505", border: "1px solid #333", color: "#fff", borderRadius: "6px" }}
                                >
                                    {eligibleBatches.length === 0 ? (
                                        <option value="">No eligible stock available</option>
                                    ) : (
                                        eligibleBatches.map((batch) => (
                                            <option key={batch.id} value={batch.id}>
                                                [{batch.batchId}] Available: {batch.remainingQuantity} kg | Recd: {batch.recdDate}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>

                            {/* Quantity to Dispatch */}
                            <div>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "8px", color: "#b0bec5" }}>
                                    Dispatch Quantity (kg) *
                                </label>
                                <input 
                                    type="number" 
                                    placeholder="Enter quantity"
                                    value={dispatchQuantity}
                                    onChange={(e) => setDispatchQuantity(e.target.value)}
                                    style={{ width: "100%", padding: "12px", background: "#060505", border: "1px solid #333", color: "#fff", borderRadius: "6px", boxSizing: "border-box" }}
                                />
                            </div>

                            {/* Destination Fair Price Shop */}
                            <div>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "8px", color: "#b0bec5" }}>
                                    Fair Price Shop (FPS) ID / Destination *
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. FPS-1042 / Sector 6 Centre"
                                    value={destinationFPS}
                                    onChange={(e) => setDestinationFPS(e.target.value)}
                                    style={{ width: "100%", padding: "12px", background: "#060505", border: "1px solid #333", color: "#fff", borderRadius: "6px", boxSizing: "border-box" }}
                                />
                            </div>

                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: "flex", gap: "15px", marginTop: "30px", justifyContent: "flex-end" }}>
                            <button 
                                type="button" 
                                onClick={() => { setDispatchQuantity(""); setDestinationFPS(""); setSuccessMessage(""); setErrorMessage(""); }}
                                style={{ padding: "12px 24px", background: "transparent", border: "1px solid #444", color: "#b0bec5", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}
                            >
                                Clear Form
                            </button>
                            <button 
                                type="submit" 
                                disabled={loading || eligibleBatches.length === 0}
                                style={{ padding: "12px 28px", background: "rgb(174, 128, 43)", border: "none", color: "#000", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", opacity: (loading || eligibleBatches.length === 0) ? 0.6 : 1 }}
                            >
                                {loading ? "Processing Dispatch..." : "Confirm & Generate PDF Challan"}
                            </button>
                        </div>
                    </form>
                </div>
            </main>

            <Footer />
        </div>
    );
}

export default Dispatch;