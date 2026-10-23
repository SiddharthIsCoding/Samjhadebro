import React, { useState, useEffect } from 'react';
import Nav from './navbar';
import Footer from "./footer";
import { auth, db } from './firebase';
import { collection, addDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import './App.css';

function Addstock() {
    const [commodity, setCommodity] = useState("");
    const [batch, setBatch] = useState("");
    const [quantity, setQuantity] = useState("");
    const [unit, setUnit] = useState("kg");
    const [godown, setGodown] = useState("");
    const [supplier, setSupplier] = useState("");
    const [received, setReceived] = useState(new Date().toISOString().split('T')[0]);
    const [expiry, setExpiry] = useState("");
    const [quality, setQuality] = useState("");
    const [loading, setLoading] = useState(false);
    
    // QR Code State upon successful stock addition
    const [successBatchData, setSuccessBatchData] = useState(null);

    useEffect(() => {
        if (commodity && received) {
            const prefix = commodity.substring(0, 3).toUpperCase();
            const dateStr = received.replace(/-/g, '');
            const randomSuffix = Math.floor(100 + Math.random() * 900);
            setBatch(`${prefix}-${dateStr}-${randomSuffix}`);
        } else {
            setBatch("");
        }
    }, [commodity, received]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const currentUser = auth.currentUser;
            let userName = currentUser ? currentUser.displayName || "Godown Manager" : "System";
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

            const docRef = await addDoc(collection(db, "batches"), {
                batchId: batch,
                commodity: commodity,
                quantity: parseFloat(quantity),
                remainingQuantity: parseFloat(quantity),
                unit: unit,
                godownLocation: godown,
                supplier: supplier,
                receiptDate: received,
                expiryDate: expiry || null,
                qualityStatus: quality,
                addedBy: userName,
                addedByRole: userRole,
                timestamp: serverTimestamp()
            });

            setSuccessBatchData({
                docId: docRef.id,
                batchId: batch,
                commodity: commodity
            });

            alert(`Stock added successfully! Generated Batch ID: ${batch}`);
            
            // Reset Form Fields
            setCommodity("");
            setBatch("");
            setQuantity("");
            setUnit("kg");
            setGodown("");
            setSupplier("");
            setReceived(new Date().toISOString().split('T')[0]);
            setExpiry("");
            setQuality("");
        } catch (error) {
            console.error("Error adding stock: ", error);
            alert("Failed to add stock. Please check console.");
        } finally {
            setLoading(false);
        }
    };

    const batchUrl = successBatchData ? `${window.location.origin}/batch/${successBatchData.docId}` : "";
    const qrImageUrl = successBatchData ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(batchUrl)}` : "";

    // Handler to download QR code image
    const handleDownloadQR = async () => {
        if (!qrImageUrl || !successBatchData) return;
        try {
            const response = await fetch(qrImageUrl);
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `QR_${successBatchData.batchId}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error("Error downloading QR code:", error);
            alert("Could not download QR code image automatically. You can right-click the image to save.");
        }
    };

    return (
        <div style={{ textAlign: "left", minHeight: "100vh", position: "relative", paddingBottom: "60px" }}>
            <Nav />
            <main className="container" style={{ maxWidth: "800px" }}>


                {/* Stock Inward Form */}
                <form className="form-card" onSubmit={handleSubmit}>
                    <h2 className="section-title">Stock Information (Auto-Batching Enabled)</h2>

                    <div className="form-grid">
                        <div className="field">
                            <label htmlFor="commodity">Commodity Name *</label>
                            <select 
                                id="commodity" 
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
                            <label htmlFor="received">Receiving Date *</label>
                            <input 
                                type="date" 
                                id="received" 
                                value={received} 
                                onChange={(e) => setReceived(e.target.value)} 
                                required 
                            />
                        </div>

                        <div className="field full-width">
                            <label htmlFor="batch">Batch Number (Auto-Generated / Editable) *</label>
                            <input
                                type="text"
                                id="batch"
                                placeholder="Select commodity & date to auto-generate"
                                value={batch}
                                onChange={(e) => setBatch(e.target.value)}
                                required
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="quantity">Quantity Received *</label>
                            <input
                                type="number"
                                id="quantity"
                                min="0.01"
                                step="0.01"
                                placeholder="Enter quantity"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                required
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="unit">Unit *</label>
                            <select 
                                id="unit" 
                                value={unit} 
                                onChange={(e) => setUnit(e.target.value)} 
                                required
                            >
                                <option value="kg">Kilogram (kg)</option>
                                <option value="quintal">Quintal</option>
                                <option value="ton">Metric Ton</option>
                                <option value="litre">Litre</option>
                            </select>
                        </div>

                        <div className="field">
                            <label htmlFor="godown">Godown Location *</label>
                            <input
                                type="text"
                                id="godown"
                                placeholder="Enter godown name"
                                value={godown}
                                onChange={(e) => setGodown(e.target.value)}
                                required
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="supplier">Supplier / Source *</label>
                            <input
                                type="text"
                                id="supplier"
                                placeholder="Enter supplier name"
                                value={supplier}
                                onChange={(e) => setSupplier(e.target.value)}
                                required
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="expiry">Expiry / Best Before Date</label>
                            <input 
                                type="date" 
                                id="expiry" 
                                value={expiry} 
                                onChange={(e) => setExpiry(e.target.value)} 
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="quality">Quality Status *</label>
                            <select 
                                id="quality" 
                                value={quality} 
                                onChange={(e) => setQuality(e.target.value)} 
                                required
                            >
                                <option value="">Select quality status</option>
                                <option value="eligible">Quality Checked - Eligible</option>
                                <option value="pending">Quality Check Pending</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                    </div>

                    <div className="buttons">
                        <button type="button" className="clear-btn" onClick={() => {
                            setCommodity(""); setBatch(""); setQuantity(""); setGodown(""); setSupplier(""); setExpiry(""); setQuality("");
                        }}>
                            Clear Form
                        </button>

                        <button type="submit" className="save-btn" disabled={loading}>
                            {loading ? "Saving..." : "Save Stock & Generate QR"}
                        </button>
                    </div>
                </form>

                {/* Generated QR Code Card rendered BELOW the form */}
                {successBatchData && (
                    <div className="form-card" style={{ marginTop: "25px", border: "2px solid rgb(174, 128, 43)", textAlign: "center" }}>
                        <h2 style={{ color: "rgb(174, 128, 43)", margin: "0 0 10px 0" }}>Consignment QR Generated Successfully!</h2>
                        <p style={{ color: "#b0bec5", fontSize: "14px", marginBottom: "15px" }}>
                            Batch ID: <strong>{successBatchData.batchId}</strong> ({successBatchData.commodity})
                        </p>
                        
                        <div style={{ background: "white", padding: "15px", display: "inline-block", borderRadius: "8px" }}>
                            <img 
                                src={qrImageUrl} 
                                alt={`QR Code for ${successBatchData.batchId}`} 
                                style={{ display: "block", width: "180px", height: "180px" }}
                            />
                        </div>

                        <div style={{ marginTop: "15px", display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                            <button 
                                type="button" 
                                onClick={handleDownloadQR} 
                                className="save-btn" 
                                style={{ background: "rgb(174, 128, 43)", width: "auto", padding: "10px 22px" }}
                            >
                                📥 Download QR Code
                            </button>
                            <a 
                                href={`/batch/${successBatchData.docId}`} 
                                target="_blank" 
                                rel="noreferrer" 
                                style={{ textDecoration: "none" }}
                            >
                                <button 
                                    type="button" 
                                    className="save-btn" 
                                    style={{ background: "#333", width: "auto", padding: "10px 22px" }}
                                >
                                    🔗 Open Inspection View
                                </button>
                            </a>
                        </div>
                        
                        <p style={{ color: "#8294aa", fontSize: "12px", marginTop: "15px", wordBreak: "break-all" }}>
                            Target Link: {batchUrl}
                        </p>
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
}

export default Addstock;