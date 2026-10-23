import React, { useState, useEffect } from 'react';
import Nav from './navbar';
import Footer from "./footer";
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import './App.css';

function Inventory() {
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCommodity, setSelectedCommodity] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");

    // Listen to real-time updates from Firestore 'batches' collection
    useEffect(() => {
        setLoading(true);
        const batchesRef = collection(db, "batches");

        // Subscribe to real-time changes
        const unsubscribe = onSnapshot(batchesRef, (snapshot) => {
            const fetchedBatches = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                fetchedBatches.push({
                    id: docSnap.id,
                    ...data,
                    // Parse numeric quantities safely
                    quantity: parseFloat(data.quantity) || 0,
                    remainingQuantity: parseFloat(data.remainingQuantity) || 0,
                    // Parse dates for sorting fallback
                    rawTime: data.timestamp?.toMillis ? data.timestamp.toMillis() : new Date(data.receiptDate || Date.now()).getTime()
                });
            });

            // Sort newest batches first
            fetchedBatches.sort((a, b) => b.rawTime - a.rawTime);
            setBatches(fetchedBatches);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching live inventory: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Filter batches based on search query, commodity, and quality status
    const filteredBatches = batches.filter((batch) => {
        const matchesSearch = 
            (batch.batchId && batch.batchId.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (batch.commodity && batch.commodity.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (batch.supplier && batch.supplier.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (batch.godownLocation && batch.godownLocation.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesCommodity = selectedCommodity === "ALL" || batch.commodity === selectedCommodity;
        const matchesStatus = statusFilter === "ALL" || (batch.qualityStatus && batch.qualityStatus.toLowerCase() === statusFilter.toLowerCase());

        return matchesSearch && matchesCommodity && matchesStatus;
    });

    return (
        <div style={{ textAlign: "left", minHeight: "100vh", position: "relative", paddingBottom: "70px" }}>
            <Nav />

            <main className="container" style={{ maxWidth: "1200px" }}>


                {/* Filter & Search Bar */}
                <div className="inventory-controls form-card" style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginBottom: "20px" }}>
                    <div className="search-group" style={{ flex: 2, minWidth: "250px" }}>
                        <input
                            type="text"
                            placeholder="Search by Batch ID, commodity, supplier, or godown..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input"
                        />
                    </div>

                    <div className="filter-group" style={{ flex: 1, minWidth: "160px" }}>
                        <select 
                            value={selectedCommodity} 
                            onChange={(e) => setSelectedCommodity(e.target.value)}
                            className="select"
                        >
                            <option value="ALL">All Commodities</option>
                            <option value="Wheat">Wheat</option>
                            <option value="Rice">Rice</option>
                            <option value="Sugar">Sugar</option>
                            <option value="Salt">Salt</option>
                            <option value="Oil">Oil</option>
                            <option value="Chana">Chana</option>
                            <option value="Tuvar Dal">Tuvar Dal</option>
                        </select>
                    </div>

                    <div className="filter-group" style={{ flex: 1, minWidth: "160px" }}>
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="select"
                        >
                            <option value="ALL">All Quality Statuses</option>
                            <option value="eligible">Eligible</option>
                            <option value="pending">Pending</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                </div>

                {/* Inventory Table Container */}
                <div className="form-card" style={{ overflowX: "auto" }}>
                    <h2 className="section-title">Active Batches ({filteredBatches.length})</h2>

                    {loading ? (
                        <p style={{ textAlign: "center", color: "#8294aa", padding: "30px" }}>Loading inventory batches...</p>
                    ) : filteredBatches.length === 0 ? (
                        <p style={{ textAlign: "center", color: "#8294aa", padding: "30px" }}>No stock batches found matching your criteria.</p>
                    ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", textAlign: "left" }}>
                            <thead>
                                <tr style={{ borderBottom: "2px solid #333", color: "#8294aa", fontSize: "13px", textTransform: "uppercase" }}>
                                    <th style={{ padding: "12px 10px" }}>Batch ID</th>
                                    <th style={{ padding: "12px 10px" }}>Commodity</th>
                                    <th style={{ padding: "12px 10px" }}>Remaining / Initial</th>
                                    <th style={{ padding: "12px 10px" }}>Godown</th>
                                    <th style={{ padding: "12px 10px" }}>Supplier</th>
                                    <th style={{ padding: "12px 10px" }}>Recd Date</th>
                                    <th style={{ padding: "12px 10px" }}>Quality</th>
                                    <th style={{ padding: "12px 10px" }}>QR Portal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBatches.map((b) => (
                                    <tr key={b.id} style={{ borderBottom: "1px solid #222", fontSize: "14px" }}>
                                        <td style={{ padding: "14px 10px", fontWeight: "bold", color: "rgb(174, 128, 43)" }}>
                                            {b.batchId}
                                        </td>
                                        <td style={{ padding: "14px 10px" }}>{b.commodity}</td>
                                        <td style={{ padding: "14px 10px" }}>
                                            <strong style={{ color: b.remainingQuantity > 0 ? "#4CAF50" : "#f44336" }}>
                                                {b.remainingQuantity} {b.unit || 'kg'}
                                            </strong> 
                                            <span style={{ color: "#8294aa", fontSize: "12px" }}> / {b.quantity} {b.unit || 'kg'}</span>
                                        </td>
                                        <td style={{ padding: "14px 10px" }}>{b.godownLocation || 'Main'}</td>
                                        <td style={{ padding: "14px 10px" }}>{b.supplier || 'N/A'}</td>
                                        <td style={{ padding: "14px 10px", color: "#8294aa" }}>{b.receiptDate}</td>
                                        <td style={{ padding: "14px 10px" }}>
                                            <span className={`status-badge ${b.qualityStatus || 'eligible'}`}>
                                                {(b.qualityStatus || 'eligible').toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: "14px 10px" }}>
                                            <a 
                                                href={`/batch/${b.id}`} 
                                                target="_blank" 
                                                rel="noreferrer" 
                                                style={{ color: "rgb(174, 128, 43)", textDecoration: "none", fontSize: "13px" }}
                                            >
                                                🔍 Inspect
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}

export default Inventory;