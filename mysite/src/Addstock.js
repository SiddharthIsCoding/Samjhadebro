import React, { useState, useEffect } from 'react';
import Nav from './navbar';
import Footer from "./footer";
import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import './App.css';

function Addstock() {
    const [commodity, setCommodity] = useState("");
    const [batch, setBatch] = useState("");
    const [quantity, setQuantity] = useState("");
    const [unit, setUnit] = useState("kg");
    const [godown, setGodown] = useState("");
    const [supplier, setSupplier] = useState("");
    const [received, setReceived] = useState(new Date().toISOString().split('T')[0]); // Default to today
    const [expiry, setExpiry] = useState("");
    const [quality, setQuality] = useState("");
    const [loading, setLoading] = useState(false);

    // Auto-generate batch number when Commodity or Received Date changes
    useEffect(() => {
        if (commodity && received) {
            const prefix = commodity.substring(0, 3).toUpperCase(); // e.g. "WHE" for Wheat
            const dateStr = received.replace(/-/g, ''); // e.g. "20261023"
            const randomSuffix = Math.floor(100 + Math.random() * 900); // 3-digit random sequence
            setBatch(`${prefix}-${dateStr}-${randomSuffix}`);
        } else {
            setBatch("");
        }
    }, [commodity, received]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await addDoc(collection(db, "batches"), {
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
                createdAt: serverTimestamp()
            });

            alert(`Stock added successfully! Generated Batch ID: ${batch}`);
            
            // Reset form
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

    return (
        <div style={{ textAlign: "left", minHeight: "100vh", position: "relative", paddingBottom: "60px" }}>
            <Nav />

            <main className="container">
                <div className="heading">
                    <h1>Add New Stock</h1>
                </div>

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
                        <button type="reset" className="clear-btn" onClick={() => {
                            setCommodity(""); setBatch(""); setQuantity(""); setGodown(""); setSupplier(""); setExpiry(""); setQuality("");
                        }}>
                            Clear Form
                        </button>

                        <button type="submit" className="save-btn" disabled={loading}>
                            {loading ? "Saving..." : "Save Stock"}
                        </button>
                    </div>
                </form>
            </main>

            <Footer />
        </div>
    );
}

Addstock.displayName = "Addstock";

export default Addstock;